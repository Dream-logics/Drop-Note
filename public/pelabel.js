/* ============================================================================
   Pelabel — satu-satunya bagian yang memakai AI
   ============================================================================
   Dua tugas, dan keduanya soal yang sama: membuat sesuatu bisa DITEMUKAN
   berbulan-bulan kemudian oleh orang yang sudah lupa menamainya.

   1. LABEL. Catatan lahir dalam tiga detik, jadi konteksnya tidak ikut
      tertulis. Kartu "Link dev photo studio" nanti dicari dengan kata
      "apps A" - dan tidak ada satu pun kata yang cocok.

   2. BACA BERKAS (OCR). Foto KTP bernama IMG_20240312_094512.jpg tidak cocok
      dengan apa pun yang diingat pemiliknya. AI membaca isinya sekali, lalu
      menuliskan kata-kata yang nanti dipakai mencari. Setelah itu pencarian
      biasa - offline, nol biaya - sudah cukup menemukannya.

   Pembagiannya tetap: AI MENULIS sekali saat entri masuk, LOGIC MEMBACA tiap
   kali mencari. Kebalikannya bikin pencarian - hal yang paling sering
   dilakukan - jadi lambat dan berbayar.

   TIGA ATURAN YANG TIDAK BOLEH DILANGGAR

   1. Tidak pernah di jalur masuk. Nge-drop tidak boleh menunggu jaringan
      sedetik pun. Semua di sini berjalan belakangan, atas antrean.
   2. Borongan untuk label. Sekali panggil untuk banyak entri.
   3. Gagal itu wajar dan diam. Entrinya tetap tersimpan dan tetap bisa dicari
      lewat label logic. Aplikasinya jalan penuh kalau AI tidak pernah hidup.
   ============================================================================ */
(function (global) {
  'use strict';

  var AKAR = 'https://generativelanguage.googleapis.com/v1beta/models/';
  var SEKALI = 12;               /* entri per panggilan label */
  var BACA_SEKALI = 2;           /* berkas per putaran - ini yang paling mahal */
  var BACA_MAKS = 5 * 1024 * 1024;
  var jalan = false;

  function model(setelan) {
    return ((setelan && setelan.model) || '').trim() || TBawaan.model;
  }

  /* DUA JALAN, DAN YANG PERTAMA YANG NORMAL.

     1. LEWAT PROXY (bawaan, untuk semua pemakai). Kunci Gemini tinggal di
        proxy milik pembuat aplikasi. Pemakai tidak membawa kunci, tidak
        membeli kunci, tidak tahu ada kunci - dia dikenali dari token Google
        yang sudah dia berikan untuk cadangan, lalu dilayani atau tidak.
        Yang memutuskan itu proxy, bukan aplikasi ini.

     2. LANGSUNG (khusus pengembang). Kunci di perangkat sendiri, untuk
        mencoba-coba tanpa proxy. Isiannya cuma muncul kalau alamat proxy
        memang belum ditanam di bawaan.js. */
  function lewatProxy(setelan) { return !setelan.kunciGemini && !!TBawaan.alamatAI; }

  function siap(setelan) {
    if (!setelan || !setelan.modeAI || setelan.modeAI === 'mati') return false;
    return !!setelan.kunciGemini || !!TBawaan.alamatAI;
  }

  function ambilJawab(j) {
    var p = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
            j.candidates[0].content.parts && j.candidates[0].content.parts[0];
    return urai(p && p.text);
  }

  function tanya(setelan, bagian, arahan) {
    return lewatProxy(setelan) ? tanyaProxy(setelan, bagian, arahan)
                               : tanyaLangsung(setelan, bagian, arahan);
  }

  /* Token Google-nya ikut dikirim supaya proxy bisa memastikan sendiri siapa
     yang memanggil - bukan percaya pada apa yang ditulis aplikasi. */
  function tanyaProxy(setelan, bagian, arahan) {
    return TAwan.ambilToken(setelan, true).then(function (token) {
      return fetch(TBawaan.alamatAI, {
        method: 'POST',
        /* text/plain sengaja: bikin permintaan ini "sederhana" menurut CORS,
           jadi tidak ada preflight OPTIONS - yang tidak dijawab Apps Script. */
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: token, arahan: arahan, bagian: bagian })
      });
    }).then(function (r) {
      if (!r.ok) throw new Error('Layanan AI menjawab ' + r.status);
      return r.text();
    }).then(function (t) {
      var j;
      try { j = JSON.parse(t); } catch (e) { throw new Error('Jawaban tidak dikenali'); }
      if (j && j.galat) throw new Error(j.galat);
      return ambilJawab(j);
    });
  }

  /* Bentuk permintaannya mengikuti REST v1beta:
     POST .../models/<model>:generateContent dengan kunci di header. */
  function tanyaLangsung(setelan, bagian, arahan) {
    return fetch(AKAR + encodeURIComponent(model(setelan)) + ':generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': setelan.kunciGemini
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: arahan }] },
        contents: [{ role: 'user', parts: bagian }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error && j.error.message) || ('Gemini menjawab ' + r.status));
        return j;
      });
    }).then(ambilJawab);
  }

  function urai(teks) {
    var t = String(teks || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  }

  /* ===================== label ===================== */

  /* Tiga langkah, dan urutannya yang penting: subjek dulu, baru elemen, baru
     tag. Kalau tag diminta lebih dulu, model menebak dari kata yang kebetulan
     ada di permukaan; kalau subjeknya sudah ditetapkan, tagnya menempel pada
     maksud catatan.

     ELEMEN adalah bagian yang paling menentukan di sini. Menemukan kartunya
     itu setengah pekerjaan; setengah lagi adalah menyalin satu baris dari
     dalamnya - dan itu justru dikerjakan saat orangnya paling buru-buru.

     Daftar tag lama ikut dikirim supaya tag tidak beranak sendiri. Tanpa itu
     "klien", "pelanggan", dan "customer" jadi tiga tag berbeda dalam sebulan,
     dan tidak ada satu pun yang bisa diandalkan buat menyaring. */
  function arahanLabel(tagLama, namaElemenLama) {
    var daftar = (tagLama || []).slice(0, 150).join(', ');
    var namaEl = (namaElemenLama || []).slice(0, 80).join(', ');
    return [
      'Kamu membantu seseorang menemukan kembali catatannya sendiri berbulan-bulan kemudian.',
      'Catatannya ditulis dalam tiga detik, jadi konteksnya tidak ikut tertulis. Tugasmu menambalnya.',
      '',
      'Untuk SETIAP entri, kerjakan tiga langkah berurutan:',
      '',
      '1. SUBJEK -> judul.',
      '   BARIS PERTAMA tiap entri adalah IDE UTAMANYA - bukan judul yang sudah jadi.',
      '   Orangnya menulis itu dalam tiga detik, jadi bentuknya memang setengah: disingkat,',
      '   tanpa huruf besar, kadang menggantung di tengah kalimat. Dia menulisnya di baris',
      '   pertama karena isian judul yang terpisah menuntut ketukan kedua, dan judul yang',
      '   menuntut ketukan kedua tidak pernah terisi.',
      '',
      '   SUSUN judulnya DARI baris itu. Pakai kata-katanya, buka singkatannya',
      '   ("kntr" -> "kantor"), lengkapi yang menggantung, dan boleh mengambil satu-dua kata',
      '   dari isi catatan supaya judulnya berdiri sendiri saat dibaca enam bulan lagi.',
      '   Maksimal 8 kata.',
      '',
      '   Tiga aturan bentuk judul, dan ketiganya soal yang sama - judul harus memakai kata',
      '   yang ADA DI KEPALANYA saat mencari, bukan kata yang paling rapi:',
      '',
      '   a. KATA PERTAMA adalah penanda jenisnya: satu kata benda yang menyebut catatan ini',
      '      barang apa. Yang sudah dipakai: Link, Prompt, Menu, Code, OTP, PIN, API, Password,',
      '      Email, Telepon, Akun, Nomor, Alamat, Jadwal, Harga, Resep, Berkas, Idea.',
      '      Boleh DUA KATA kalau memang begitu namanya di sumbernya: "Client ID", "Client',
      '      Secret", "API Key". Jangan dipendekkan jadi satu kata dan jangan diganti istilah',
      '      lain - dia mencarinya dengan nama yang dia dengar dari Google, bukan namamu.',
      '      Boleh memakai penanda lain kalau memang lebih tepat - daftar ini bukan kandang.',
      '      Dengan begitu daftar hasil bisa dipindai dari tepi kiri saja, tanpa membaca',
      '      seluruh barisnya.',
      '      Pilih yang paling KHUSUS: "kode otp" jadi "OTP", bukan "Code"; "nomor telepon"',
      '      jadi "Telepon", bukan "Nomor". Kata umum yang cuma jadi ancang-ancang ke istilah',
      '      khususnya jangan ikut ditulis lagi.',
      '',
      '   b. INGGRIS DULU kalau istilahnya bentrok. Dia mengetik "link" waktu mencari, jadi',
      '      tulis "Link" - JANGAN "Tautan". Begitu juga Password (bukan Sandi), Email (bukan',
      '      Surel), Code (bukan Kode), Idea (bukan Ide), API, OTP, PIN, Prompt, Menu.',
      '      Menyimpannya',
      '      dengan kata lain berarti aplikasinya sendiri yang bikin dia lupa. Selebihnya',
      '      tetap bahasa Indonesia.',
      '',
      '   c. JANGAN ADA KATA KEMBAR, termasuk yang kembar maknanya. "Uji coba dan pengecekan',
      '      versi editor" itu satu maksud yang ditulis dua kali - cukup "Uji coba versi',
      '      editor". Judul panjang tidak menambah pintu masuk; yang menambah itu tag, dan',
      '      tagnya sudah banyak.',
      '',
      '   Yang TIDAK BOLEH: berpindah subjek. Kalau baris pertama bicara soal sandi wifi,',
      '   judulnya tetap soal sandi wifi - bukan soal kantornya, bukan soal jadwal gantinya.',
      '   Ide itu miliknya; kamu yang merapikan bentuknya, bukan menggantinya.',
      '',
      '   Baru kalau baris pertama memang bukan ide sama sekali - sekadar alamat, deretan',
      '   angka, atau potongan tempelan - susun subjeknya dari seluruh isi catatan.',
      '',
      '2. ELEMEN. Cari potongan yang nanti akan dia SALIN atau BUKA, bukan yang dia baca:',
      '   tautan, prompt, kode, sandi, PIN, token, nomor (rekening, pesanan, seri, plat, OTP),',
      '   alamat, nama berkas, nama supplier atau klien, resep dan dosis obat, jadwal, harga.',
      '   Ambil nilainya PERSIS apa adanya - jangan dirapikan, jangan diterjemahkan, jangan dipotong.',
      '   SATU penanda tetap SATU elemen walau di dalamnya ada tanda hubung, titik, atau spasi:',
      '   Client ID Google, kunci API, nomor faktur, dan plat nomor itu utuh - memecahnya jadi',
      '   potongan membuat semuanya tidak berguna, karena yang disalin memang keseluruhannya.',
      '   Namai dengan sebutan yang dipakai di tempat asalnya - "Client ID", "Client Secret",',
      '   "nomor rekening" - bukan sebutan umum seperti "kode" atau "nomor".',
      '   Kalau satu entri memuat beberapa - misalnya tiga tautan sekaligus - pisahkan semuanya.',
      '   Beri "nama" pendek untuk tiap elemen, sebutan yang menjelaskan itu apa.',
      '',
      '   NAMA ELEMEN MENYEBUT JENIS BENDANYA, TIDAK PERNAH PEMILIKNYA.',
      '   "No WhatsApp Bunda" SALAH - namanya "No WhatsApp", titik. Bunda sudah ada di judul',
      '   dan di tag. Menempelkan nama orang, proyek, atau bank ke nama jenis membuat elemen',
      '   itu tidak akan pernah berkumpul dengan saudaranya: sebulan kemudian ada sepuluh nama',
      '   untuk satu benda, dan tidak satu pun bisa dipakai menyaring.',
      '   Begitu juga "Nomor Rekening BCA" -> "Nomor Rekening", "Client ID Google" -> "Client ID".',
      namaEl ? '   Nama yang SUDAH DIPAKAI - kalau maknanya sama, salin PERSIS: ' + namaEl
             : '   Belum ada nama elemen sama sekali; susun sendiri dari nol.',
      '',
      '   Kalau memang tidak ada yang menonjol, kembalikan elemen kosong. Itu jawaban yang sah:',
      '   berarti catatan itu utuh sebagai catatan. JANGAN mengarang elemen supaya tidak kosong.',
      '',
      '3. TAG. 8 sampai 20 tag, satu kata masing-masing (boleh gabungan tanpa spasi).',
      '   Anggap seperti tagar di bawah satu unggahan Instagram: banyak, dan tiap satunya',
      '   PANCINGAN - satu kemungkinan kata yang nanti diketik orangnya waktu mencari.',
      '   Karena itu sengaja dari beberapa sudut sekaligus, bukan satu sudut diulang-ulang:',
      '   nama proyek atau klien, jenis barangnya, orang yang terlibat, tempat, keadaan',
      '   (mendesak/rutin/sekali pakai), dan sebutan sehari-hari yang mungkin dia pakai',
      '   walaupun tidak tertulis di catatannya.',
      '   Yang dilarang cuma satu: tag yang TIDAK nyangkut sama sekali. Tag yang tepat tidak',
      '   pernah jadi sampah - dia satu pintu lagi menuju catatan yang sama.',
      '   Setiap entri WAJIB dapat minimal 8 tag. Tidak boleh ada satu pun yang pulang tanpa tag:',
      '   orangnya sedang kehabisan tenaga, dan menyusun tag itu memang tugasmu, bukan tugasnya.',
      '',
      '   Daftar di bawah adalah rak yang SUDAH ADA - bukan daftar tertutup, bukan pilihan terbatas.',
      '   Kalau maknanya sama, pakai ulang dan salin PERSIS penulisannya, huruf besar-kecilnya sekalian.',
      '   Yang disebut paling awal itu rak andalannya; dahulukan kalau memang cocok.',
      '   Kalau tidak ada yang benar-benar cocok, BUAT TAG BARU tanpa ragu. Tag baru yang tepat',
      '   jauh lebih berguna daripada tag lama yang meleset - memaksakan yang meleset justru',
      '   merusak seluruh daftarnya.',
      daftar ? '   Rak yang sudah ada: ' + daftar : '   Belum ada rak sama sekali; susun sendiri dari nol.',
      '',
      'Selain itu, label: 4 sampai 8 kata kunci huruf kecil yang TIDAK dilihat pemakainya -',
      'tugasnya cuma membuat pencarian ketemu. Sertakan sebutan yang mungkin dia pakai saat',
      'mencari, termasuk yang TIDAK tertulis di isinya tapi jelas dari konteks.',
      '',
      'Bahasa Indonesia, kecuali istilah teknis yang memang lazim Inggris.',
      'Jawab HANYA JSON: {"hasil":[{"i":0,"judul":"...",' +
        '"elemen":[{"jenis":"tautan|kode|nomor|telepon|surel|alamat|berkas|nama|jadwal|harga|prompt|lainnya",' +
        '"nilai":"...","nama":"..."}],"tag":["..."],"label":["..."]}]}'
    ].join('\n');
  }

  function pesanan(entri) {
    return entri.map(function (e, i) {
      var isi = (e.isi || '').slice(0, 700);
      var daftar = (e.daftar || []).map(function (b) { return b.teks; }).join('; ').slice(0, 300);
      return [
        '--- ' + i + ' ---',
        'jenis: ' + e.jenis,
        e.kategori ? 'kategori: ' + e.kategori : '',
        e.namaBerkas ? 'berkas: ' + e.namaBerkas : '',
        isi ? 'isi: ' + isi : '',
        daftar ? 'daftar: ' + daftar : ''
      ].filter(Boolean).join('\n');
    }).join('\n');
  }

  /* Siapa yang boleh berangkat. Dipisah jadi fungsi sendiri karena ini
     satu-satunya tempat yang memutuskan apa yang meninggalkan perangkat -
     dan yang seperti itu pantas bisa diuji langsung. */
  function antreLabel(semua) {
    return semua.filter(function (e) {
      /* JANJI YANG MENENTUKAN: yang ditandai rahasia tidak pernah berangkat.
         Bukan disaring di layanan - tidak pernah dikirim sama sekali. Ini
         saringan pertama; penanda diLabeliAI di kunci.js penjaga keduanya. */
      if (e.rahasia) return false;
      /* Judul tugas ITU tugasnya - diketik sendiri, pendek, dan sudah benar.
         Membiarkan AI menyusun ulangnya berarti "Bayar listrik" bisa kembali
         sebagai kalimat lain, dan yang dibaca orangnya besok bukan lagi yang
         dia tulis. Langkah tugas tersimpan di kolom daftar, jadi tanpa
         saringan ini dia memang ikut terkirim. */
      if (e.jenis === 'tugas') return false;
      return !e.diLabeliAI && !e.pensiun && !e.dihapus && (e.isi || e.namaBerkas || (e.daftar || []).length);
    }).slice(0, SEKALI);
  }

  function labeli(setelan, semua) {
    var antre = antreLabel(semua);
    if (!antre.length) return Promise.resolve(0);

    var namaEl = daftarNamaElemen(setelan);
    return tanya(setelan, [{ text: pesanan(antre) }], arahanLabel(daftarTag(setelan), namaEl))
      .then(function (jawab) {
        var hasil = (jawab && jawab.hasil) || [];
        if (!hasil.length) throw new Error('Jawaban AI kosong');
        var tagBaru = [];
        var elBaru = [];
        var tulis = hasil.map(function (h) {
          var e = antre[h.i];
          if (!e) return null;
          /* Judul yang sudah diketik sendiri tidak pernah ditimpa. Itu punya
             pemakainya - AI cuma mengisi yang kosong atau yang disusun mesin. */
          /* Dirapikan lagi di sini, bukan cuma dipesankan di arahan: model
             sesekali lupa aturannya, dan aturan yang cuma diminta - tidak
             ditegakkan - akan bocor di hari yang paling sibuk. */
          if (!e.judulManual && h.judul) {
            e.judul = TOtak.susunJudul(String(h.judul), e).slice(0, 90);
          }
          e.label = gabungLabel(e.label, h.label);
          /* Elemen AI DULUAN, baru sisa tebakan pola. AI yang tahu potongan
             itu sebenarnya apa - "Client ID", bukan "kode" - dan yang pertama
             terlihat di kartu ringkas cuma satu. */
          /* Nama elemennya dibakukan terhadap yang sudah ada SEBELUM disimpan.
             Daftar lama sudah dikirim ke AI, tapi permintaan bukan jaminan -
             yang menegakkan aturan ini kodenya. */
          e.elemen = TOtak.gabungElemen(h.elemen, e.elemen, namaEl);
          (e.elemen || []).forEach(function (x) {
            if (x.nama && elBaru.indexOf(x.nama) < 0) elBaru.push(x.nama);
          });
          e.tag = gabungTag(e.tag, h.tag);
          e.tag.forEach(function (t) { if (tagBaru.indexOf(t) < 0) tagBaru.push(t); });
          e.diLabeliAI = true;
          e.diubah = Date.now();
          return TSimpan.taruh(e);
        }).filter(Boolean);
        return Promise.all(tulis)
          .then(function () { return catatTag(setelan, tagBaru); })
          .then(function () { return catatNamaElemen(setelan, elBaru); })
          .then(function () { return tulis.length; });
      });
  }

  /* Huruf besarnya DIPERTAHANKAN. Tag ini dilihat pemakainya, dan
     "#ShamiraWeb" lebih cepat dikenali daripada "#shamiraweb" - sementara
     pencocokannya sendiri tetap tidak peduli huruf besar-kecil. */
  function bersihTag(t) {
    return String(t || '').replace(/^#+/, '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 24);
  }

  function samaTag(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }

  function gabungTag(lama, tambahan) {
    var gabung = (lama || []).slice();
    (tambahan || []).map(bersihTag).filter(Boolean).forEach(function (t) {
      if (!gabung.some(function (x) { return samaTag(x, t); })) gabung.push(t);
    });
    /* Batasnya lebar. Tag yang tepat tidak pernah jadi sampah - dia cuma
       menambah satu pintu lagi menuju catatan yang sama. Yang perlu dibatasi
       itu TAMPILANNYA, dan itu urusan kartu, bukan urusan penyimpanan. */
    return gabung.slice(0, 30);
  }

  /* Tag andalan disebut LEBIH DULU daripada yang pernah dipakai: itu rak yang
     sudah dia putuskan sendiri, dan model membaca daftar dari depan. */
  function daftarTag(setelan) {
    var awal = setelan.tagFavorit != null ? setelan.tagFavorit : (TBawaan.tagAwal || []);
    var keluar = (awal || []).slice();
    (setelan.hashtag || []).forEach(function (t) {
      if (!keluar.some(function (x) { return samaTag(x, t); })) keluar.push(t);
    });
    return keluar;
  }

  /* Daftar tag hidup di perangkat, bukan di Sheet. Kalau otoritasnya di Drive,
     pelabelan ikut mati saat Drive belum tersambung - padahal AI harus tetap
     bisa jalan sendiri. Sheet cuma cerminannya, dan cerminan boleh telat. */
  function catatTag(setelan, tag) {
    var lama = (setelan.hashtag || []).slice();
    var berubah = false;
    tag.forEach(function (t) {
      if (!lama.some(function (x) { return samaTag(x, t); })) { lama.push(t); berubah = true; }
    });
    if (!berubah) return Promise.resolve();
    lama = lama.slice(-300);
    setelan.hashtag = lama;
    return TSimpan.setel('hashtag', lama);
  }

  /* Daftar nama elemen yang sudah dipakai - sama peran dengan daftar tag:
     rak yang sudah ada, supaya AI memakai ulang alih-alih mengarang nama baru
     untuk benda yang sama. Yang terbaru di belakang, jadi yang dipangkas kalau
     kepanjangan adalah yang paling lama tidak muncul. */
  function daftarNamaElemen(setelan) {
    return ((setelan && setelan.namaElemen) || []).slice();
  }

  function catatNamaElemen(setelan, nama) {
    var lama = daftarNamaElemen(setelan);
    var berubah = false;
    (nama || []).forEach(function (n) {
      var t = String(n || '').trim();
      if (!t) return;
      if (!lama.some(function (x) { return samaTag(x, t); })) { lama.push(t); berubah = true; }
    });
    if (!berubah) return Promise.resolve();
    lama = lama.slice(-120);
    setelan.namaElemen = lama;
    return TSimpan.setel('namaElemen', lama);
  }

  function gabungLabel(lama, tambahan) {
    var gabung = (lama || []).slice();
    (tambahan || []).map(function (l) { return TOtak.normal(l); }).filter(Boolean)
      .forEach(function (l) { if (gabung.indexOf(l) < 0) gabung.push(l); });
    return gabung.slice(0, 50);
  }

  /* ===================== baca berkas (OCR) ===================== */

  function arahanBaca(tagLama, namaElemenLama) {
    var daftar = (tagLama || []).slice(0, 150).join(', ');
    var namaEl = (namaElemenLama || []).slice(0, 80).join(', ');
    return [
      'Kamu membaca satu dokumen atau foto milik seseorang, supaya dia bisa menemukannya lagi',
      'bertahun-tahun kemudian saat dia cuma ingat samar-samar isinya.',
      'Hasilkan:',
      '- judul: maksimal 8 kata, sebutkan jenis dokumennya dan pihak/objek utamanya.',
      '- elemen: nomor, kode, nama pihak, tanggal, dan jumlah yang nanti akan dia SALIN dari',
      '  dokumen ini - nomor KTP, nomor faktur, nominal, nama apotek, dosis obat. Persis apa adanya.',
      '  Beri "nama" pendek untuk tiap elemen. Kosongkan kalau memang tidak ada yang menonjol.',
      '  NAMA ELEMEN MENYEBUT JENIS BENDANYA, TIDAK PERNAH PEMILIKNYA: "No WhatsApp", bukan',
      '  "No WhatsApp Bunda". Pemiliknya sudah ada di judul dan di tag.',
      namaEl ? '  Nama yang sudah dipakai - salin persis kalau maknanya sama: ' + namaEl : '',
      '- tag: 8 sampai 20, satu kata masing-masing, seperti tagar di bawah unggahan Instagram:',
      '  tiap satunya pancingan, satu kemungkinan kata yang nanti diketik saat mencari.',
      '  Daftar di bawah rak yang sudah ada, bukan daftar tertutup: pakai ulang kalau maknanya sama',
      '  (salin persis penulisannya), buat baru tanpa ragu kalau tidak ada yang cocok.',
      daftar ? '  Rak yang sudah ada: ' + daftar : '  Belum ada rak sama sekali; susun sendiri dari nol.',
      '- label: 5 sampai 12 kata kunci huruf kecil - jenis dokumen, nama orang/perusahaan,',
      '  tahun, nomor penting, dan sebutan sehari-hari yang mungkin dipakai mencarinya.',
      '- teks: ringkasan isi terpenting, maksimal 600 karakter. Tulis apa adanya, jangan menafsirkan.',
      'Bahasa Indonesia. Jawab HANYA JSON:',
      '{"judul":"...","elemen":[{"jenis":"...","nilai":"...","nama":"..."}],' +
        '"tag":["..."],"label":["..."],"teks":"..."}'
    ].join('\n');
  }

  var BISA_DIBACA = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;

  function keBase64(blob) {
    return new Promise(function (terima, tolak) {
      var baca = new FileReader();
      baca.onload = function () {
        var hasil = String(baca.result);
        terima(hasil.slice(hasil.indexOf(',') + 1));
      };
      baca.onerror = function () { tolak(new Error('Berkas tidak terbaca')); };
      baca.readAsDataURL(blob);
    });
  }

  function ambilBlob(setelan, e) {
    if (e.berkasId) {
      return TSimpan.ambilBerkas(e.berkasId).then(function (b) { return b && b.blob; });
    }
    if (e.driveId) return TAwan.unduhBerkas(setelan, e.driveId);
    return Promise.resolve(null);
  }

  function bacaBerkas(setelan, semua) {
    var antre = semua.filter(function (e) {
      if (e.rahasia) return false;
      return !e.diBacaAI && !e.pensiun && !e.dihapus &&
             (e.berkasId || e.driveId) && BISA_DIBACA.test(e.tipeBerkas || '') &&
             (e.ukuran || 0) <= BACA_MAKS;
    }).slice(0, BACA_SEKALI);
    if (!antre.length) return Promise.resolve(0);

    return antre.reduce(function (rantai, e) {
      return rantai.then(function (n) {
        return ambilBlob(setelan, e).then(function (blob) {
          if (!blob) { e.diBacaAI = true; return TSimpan.taruh(e).then(function () { return n; }); }
          return keBase64(blob).then(function (b64) {
            return tanya(setelan, [
              { inline_data: { mime_type: e.tipeBerkas, data: b64 } },
              { text: 'Baca dokumen ini.' }
            ], arahanBaca(daftarTag(setelan), daftarNamaElemen(setelan)));
          }).then(function (h) {
            if (!h) throw new Error('Dokumen tidak terbaca');
            if (!e.judulManual && h.judul) {
              e.judul = TOtak.susunJudul(String(h.judul), e).slice(0, 90);
            }
            e.label = gabungLabel(e.label, h.label);
            e.elemen = TOtak.gabungElemen(h.elemen, e.elemen, daftarNamaElemen(setelan));
            e.tag = gabungTag(e.tag, h.tag);
            /* Teksnya ditaruh di isi, bukan di kolom baru: dengan begitu
               pencarian yang sudah ada langsung menemukannya, tanpa satu baris
               pun perubahan di otak.js. */
            if (!String(e.isi || '').trim() && h.teks) e.isi = String(h.teks).slice(0, 1500);
            e.diBacaAI = true;
            e.diLabeliAI = true;
            e.diubah = Date.now();
            return TSimpan.taruh(e)
              .then(function () { return catatTag(setelan, e.tag); })
              .then(function () {
                return catatNamaElemen(setelan, (e.elemen || []).map(function (x) { return x.nama; }));
              })
              .then(function () { return n + 1; });
          });
        }).catch(function () {
          /* Satu berkas yang gagal dibaca tidak boleh menghentikan antreannya.
             Ditandai supaya tidak dicoba terus-menerus dan menghabiskan kuota. */
          e.diBacaAI = true;
          return TSimpan.taruh(e).then(function () { return n; });
        });
      });
    }, Promise.resolve(0));
  }

  /* ===================== putaran ===================== */

  function putaran(setelan) {
    if (jalan || !siap(setelan)) return Promise.resolve(0);
    jalan = true;
    var total = 0;

    return TSimpan.semua().then(function (semua) {
      return labeli(setelan, semua).then(function (n) {
        total += n;
        return setelan.modeAI === 'penuh' ? bacaBerkas(setelan, semua) : 0;
      }).then(function (n) { total += n; });
    }).then(function () {
      return TSimpan.setel('aiGalat', '');
    }).catch(function (err) {
      /* Tetap diam di layar utama - tapi sebabnya disimpan, karena satu
         kegagalan di sini punya arti yang perlu dibaca pemakainya:
         "belum terdaftar" bukan gangguan, itu jawaban. */
      TSimpan.setel('aiGalat', err.message);
      if (global.console && console.debug) console.debug('[pelabelan tertunda]', err.message);
    }).then(function () { jalan = false; return total; },
            function () { jalan = false; return total; });
  }

  /* Uji dari layar Setelan - satu-satunya tempat kegagalan AI boleh berisik. */
  function coba(setelan) {
    var contoh = [{ jenis: 'tautan', kategori: '', isi: 'https://script.google.com/macros/s/AKfycbCONTOH/dev' }];
    return tanya(setelan, [{ text: pesanan(contoh) }],
                 arahanLabel(daftarTag(setelan), daftarNamaElemen(setelan))).then(function (j) {
      if (!j || !j.hasil || !j.hasil.length) throw new Error('Tersambung, tapi jawabannya tidak dikenali');
      return j.hasil[0];
    });
  }

  global.TPelabel = {
    putaran: putaran, coba: coba, siap: siap, model: model, lewatProxy: lewatProxy,
    /* Cuma untuk uji: melihat arahan yang benar-benar dikirim, bukan menebak
       dari kodenya. */
    arahanUji: function (setelan) { return arahanLabel(daftarTag(setelan), daftarNamaElemen(setelan)); },
    antreUji: function (semua) { return antreLabel(semua).map(function (e) { return e.id; }); }
  };
})(window);
