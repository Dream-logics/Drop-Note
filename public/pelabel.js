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

  /* Obrolan dan gambar memakai modelnya sendiri, dan keduanya jatuh kembali ke
     model pelabelan kalau bawaan.js tidak menyebutkannya - aplikasi yang mati
     total karena satu baris setelan hilang adalah kerusakan yang tidak perlu. */
  function modelObrol(setelan) {
    return ((setelan && setelan.modelObrol) || '').trim() || TBawaan.modelObrol || TBawaan.model;
  }

  function modelGambar(setelan) {
    return ((setelan && setelan.modelGambar) || '').trim() || TBawaan.modelGambar || TBawaan.model;
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
      /* Tiga baris, bukan empat puluh. Yang panjang sudah dikerjakan arahanGambar
         di jalur gambar; di sini driver cuma muncul untuk gambar yang dilabeli
         tanpa dibaca (mode Hemat), dan di situ satu-satunya isyarat yang ada
         memang cuma drivernya. */
      'Kalau sebuah entri punya baris DRIVER, itu dua-tiga kata yang diketik pemiliknya sendiri:',
      'sudut pandangnya, bukan keterangan tambahan. Judul dan tag disusun DARI situ, dan',
      'bahasanya mengikuti bahasa driver itu.',
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
      '      Email, WhatsApp, Akun, Nomor, Alamat, Jadwal, Harga, Resep, Berkas, Idea.',
      '      Boleh DUA KATA kalau memang begitu namanya di sumbernya: "Client ID", "Client',
      '      Secret", "API Key". Jangan dipendekkan jadi satu kata dan jangan diganti istilah',
      '      lain - dia mencarinya dengan nama yang dia dengar dari Google, bukan namamu.',
      '      Boleh memakai penanda lain kalau memang lebih tepat - daftar ini bukan kandang.',
      '      Dengan begitu daftar hasil bisa dipindai dari tepi kiri saja, tanpa membaca',
      '      seluruh barisnya.',
      '      Pilih yang paling KHUSUS: "kode otp" jadi "OTP", bukan "Code"; "nomor telepon"',
      '      jadi "WhatsApp", bukan "Nomor" - nomor seluler hari ini hampir tidak pernah',
      '      benar-benar ditelepon, dan "WhatsApp" itulah kata yang ada di kepalanya waktu',
      '      mencari. Kata umum yang cuma jadi ancang-ancang ke istilah',
      '      khususnya jangan ikut ditulis lagi.',
      '',
      '      WHATSAPP LAWAN TELEPON DIBACA DARI BENTUK ANGKANYA, bukan dari kata di sekitarnya:',
      '        08xx, +628xx  -> seluler, bisa di-WhatsApp     -> "WhatsApp"',
      '        021, 0361, 031 dan kode area lain              -> "Telepon"',
      '        108, 188, 14000, 1500888 (nomor layanan)       -> "Telepon"',
      '      Halo BCA 14000 dan Damkar 113 TIDAK BISA di-WhatsApp sama sekali; menamainya',
      '      WhatsApp membuat satu-satunya tindakan yang mungkin jadi salah alamat.',
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
      '   Begitu juga "Nomor Rekening BCA" -> "No Rekening", "Client ID Google" -> "Client ID".',
      '   Dan "Nomor" SELALU disingkat "No": namanya ditulis di kolom sempit, dan enam huruf',
      '   untuk keterangan yang sudah jelas dari angkanya sendiri itu pemborosan.',
      namaEl ? '   Nama yang SUDAH DIPAKAI - kalau maknanya sama, salin PERSIS: ' + namaEl
             : '   Belum ada nama elemen sama sekali; susun sendiri dari nol.',
      '',
      '   Kalau memang tidak ada yang menonjol, kembalikan elemen kosong. Itu jawaban yang sah:',
      '   berarti catatan itu utuh sebagai catatan. JANGAN mengarang elemen supaya tidak kosong.',
      '',
      '3. TAG. SEBANYAK YANG BENAR-BENAR ADA DI CATATANNYA, TIDAK LEBIH.',
      '   Tidak ada jumlah minimum. Dua sampai tiga untuk catatan sebaris; enam paling banyak',
      '   untuk yang memang panjang dan berkonteks. Delapan itu batas atas, bukan sasaran.',
      '',
      '   TAG ITU RUANGAN, BUKAN JARING. Tag yang meleset dulu cuma pintu tambahan yang',
      '   tidak terpakai; sekarang dia menentukan catatan itu MENDARAT DI FOLDER MANA. Satu',
      '   tebakan yang salah tidak lagi gratis - dia menaruh barang di kamar yang salah.',
      '',
      '   TAG HARUS BISA DITUNJUK ASALNYA. Sebelum menulis satu tag, tanyakan pada dirimu:',
      '   kata mana di catatan ini yang jadi alasannya? Kalau kamu tidak bisa menunjuknya,',
      '   tag itu KARANGAN - jangan ditulis. Ini pengujian yang harus lolos untuk SETIAP tag,',
      '   satu per satu, bukan untuk daftarnya secara keseluruhan.',
      '',
      '   Cuma ada DUA sumber yang sah:',
      '',
      '   SUMBER 1 - KATA YANG MEMANG TERTULIS di catatannya. Termasuk bentuk bakunya:',
      '   catatan menulis "telpon", tagnya boleh "WhatsApp"; menulis "ide", tagnya boleh',
      '   "Idea". Itu kata yang sama, ditulis dengan ejaan yang nanti dia pakai mencari.',
      '',
      '   SUMBER 2 - BENTUK YANG MENYEBUT DIRINYA SENDIRI. Ini BUKAN tafsiran, ini bacaan:',
      '     08xx atau +628xx  -> WhatsApp        (bentuk nomornya memang begitu)',
      '     021, 14000, 108   -> Telepon',
      '     https://...       -> Link',
      '     ada@ada.com       -> Email',
      '   Bentuk yang tidak menyebut dirinya sendiri tidak masuk sumber ini. Deretan angka',
      '   biasa bukan "harga", dan nama orang bukan "klien".',
      '',
      '   DI LUAR DUA SUMBER ITU, TIDAK ADA LAGI. Dua larangan di bawah cuma dua bentuk yang',
      '   paling sering terpeleset:',
      '',
      '   a. JANGAN MENGARANG HUBUNGAN, SIFAT, ATAU KEADAAN. "Sandy 087575686578" itu sebuah',
      '      nomor milik seseorang bernama Sandy. Titik. Kamu TIDAK tahu Sandy itu teman,',
      '      keluarga, atau urusan pribadi - dia bisa saja salesman mobil yang menawarkan',
      '      produk. Tag "teman", "pribadi", "penting", "mendesak", "rutin" hanya boleh ditulis',
      '      kalau kata itu MEMANG ADA di catatannya.',
      '',
      '   b. JANGAN MEMAKAI KATA YANG MENYEBUT BENTUKNYA, BUKAN ISINYA: catatan, data, info,',
      '      daftar, berkas, dokumen, nomor, teks, memo. Kata seperti itu cocok untuk hampir',
      '      semua yang pernah disimpan, jadi sebagai ruangan dia tidak memisahkan apa pun -',
      '      dan folder yang isinya seluruh timbunan sama saja dengan tidak ada folder.',
      '',
      '   Dan jangan menulis satu benda dengan tiga kata: "Telepon", "nomor", dan "seluler"',
      '   itu satu hal. Pilih SATU, yang paling sering diketik orangnya waktu mencari.',
      '',
      '   CONTOH LENGKAP. Catatan: "Sandy 087575686578"',
      '     BENAR : ["Sandy", "WhatsApp"]  - Sandy tertulis; 087x itu bentuk yang menyebut diri.',
      '     SALAH : ["teman", "pribadi", "kontak", "seluler", "nomor", "catatan"]',
      '             tidak satu pun bisa ditunjuk asalnya. Sandy bisa saja salesman mobil.',
      '',
      '   Kalau sebuah catatan cuma pantas dapat dua tag, beri dua. Dua tag yang bisa ditunjuk',
      '   asalnya mengalahkan delapan yang setengahnya karangan.',
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
        /* Driver ditaruh SEBELUM isinya, dan itu bukan kerapian: model membaca
           dari atas, dan sudut pandangnya harus sudah terpasang sebelum dia
           melihat apa yang tergambar. */
        e.driver ? 'DRIVER: ' + String(e.driver).slice(0, 60) : '',
        e.album ? 'gerbong: ' + e.album : '',
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
          e.tag = gabungTag(e.tag, (h.tag || []).slice(0, TAG_MAKS_BARU));
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

  /* ===================== ARAHAN GAMBAR =====================
     PENDEK, DAN ITU BUKAN KEMALASAN. Arahan yang panjang membuat model
     kehilangan fokus: yang di tengah tenggelam, dan yang tenggelam di sini
     justru drivernya. Percobaan di lapangan membuktikannya - prompt tiga
     kalimat yang ditulis pemakainya sendiri mengalahkan arahan dua ratus baris
     milik aplikasi ini, pada gambar yang sama persis.

     Sebabnya: yang panjang itu arahan PEMBACA DOKUMEN (faktur, KTP, struk)
     yang ditempeli paragraf driver. Isinya masih menyuruh "sebutkan jenis
     dokumennya" dan "tulis apa adanya, jangan menafsirkan" - dua perintah yang
     langsung bertabrakan dengan sudut pandang. Foto referensi bukan dokumen,
     jadi dia dapat arahannya sendiri.

     SEPULUH TAG, DUA LAPIS, dan pembagian ini yang paling menentukan:

       lapis luas   Interior, Design, Furnishing  -> menaruhnya di KAMAR yang benar
       lapis sempit Sofa, Grey, LED, Vanity       -> memisahkannya DI DALAM kamar

     Dulu kukira tag yang luas itu mubazir. Itu ukuran Google, bukan ukuran
     gudang ini: di sana "interior" bersaing dengan satu miliar gambar, di sini
     dengan tiga ribu, dan menyisakan satu dari sepuluh kamar itu justru
     pekerjaan yang benar. Yang benar-benar kosong cuma tag yang berlaku untuk
     SELURUH himpunannya - "foto" pada foto - karena dia tidak pernah bisa
     menaikkan atau menurunkan peringkat siapa pun.

     SATU TAG SATU KATA. Tanpa itu "kamar tidur" pecah jadi #kamar dan #tidur,
     dan keduanya lumpuh sendirian.

     "Seolah bersaing SEO global" sengaja dipasang walau gudangnya cuma puluhan
     ribu: yang lolos di satu miliar pasti lolos di tiga ribu, dan menaikkan
     standarnya tidak menambah ongkos sepeser pun. */
  function arahanGambar(driver, tagLama) {
    var daftar = (tagLama || []).slice(0, 60).join(', ');
    return [
      driver ? 'Keywords: ' + String(driver).slice(0, 60) : 'Tidak ada keywords; baca apa adanya.',
      '',
      'Beri 1 kalimat padat untuk mendeskripsikan gambar ini, sebagai caption bagi orang yang',
      'tidak melihatnya. Kalimat itu masuk database jadi elemen SEO yang menempatkan gambar di',
      'daftar pertama. Tulis DARI SUDUT PANDANG keywords di atas, bukan dari yang paling',
      'menonjol di gambar.',
      '',
      'Lalu 10 hashtag, SATU HASHTAG SATU KATA:',
      '  5 luas   - bidang, ruang, gaya; yang menaruhnya di kamar yang benar',
      '  5 sempit - benda, warna, bahan, ukuran; yang memisahkannya dari sesamanya',
      '',
      'Judul maksimal 8 kata, juga dari sudut pandang keywords.',
      '',
      'BAHASA JAWABAN MENGIKUTI BAHASA KEYWORDS.',
      'Jangan pakai kata yang benar untuk semua foto: foto, gambar, image, screenshot, kamera.',
      daftar ? 'Kalau tagmu sudah ada di daftar ini, salin ejaannya persis: ' + daftar : '',
      '',
      'Jawab HANYA JSON: {"judul":"...","teks":"...","tag":["..."],"label":["..."],',
      '"elemen":[{"jenis":"...","nilai":"...","nama":"..."}]}',
      'elemen: kode, nomor seri, atau nama merek yang TERBACA di gambar. Kosongkan kalau tidak ada.'
    ].filter(Boolean).join('\n');
  }

  /* KATA YANG MENYEBUT BENTUKNYA, BUKAN ISINYA.

     "catatan", "data", "daftar", "berkas", "nomor" - semuanya cocok untuk
     hampir apa pun yang pernah disimpan di sini, jadi sebagai penyaring dia
     tidak memisahkan satu pun. Dan sejak tag ikut menentukan folder, satu tag
     seperti ini menyeret sepertiga timbunan ke ruangan bernama "catatan".

     Yang di baris kedua kata untuk GAMBAR, dan di situ dia bahkan lebih kosong.
     Seratus persen foto adalah foto - dia tidak pernah punya kesempatan jadi
     yang lain - jadi #foto tidak memisahkan satu pun dari dua puluh ribu
     saudaranya. Sama gunanya dengan memberi tag "manusia" pada seseorang.

     TAPI CUMA YANG SEPERTI ITU. Tag yang sekadar LUAS - Interior, Design,
     Modern - tetap boleh, dan daftar ini tidak boleh melar ke sana. Itu ukuran
     Google, bukan ukuran gudang ini: di sana "interior" bersaing dengan satu
     miliar gambar, di sini dengan tiga ribu, dan menyisakan satu dari sepuluh
     kamar itu justru pekerjaan yang benar. Yang ditolak cuma yang berlaku
     untuk SELURUH himpunannya, karena dia tidak pernah bisa menaikkan atau
     menurunkan peringkat siapa pun.

     Ditegakkan di sini, bukan cuma diminta di arahan: aturan yang cuma diminta
     akan bocor persis di hari tersibuk. */
  var TAG_BENTUK = ['catatan', 'catat', 'data', 'info', 'informasi', 'daftar',
                    'berkas', 'file', 'dokumen', 'teks', 'memo', 'nomor', 'nomer',
                    'entri', 'entry', 'note', 'notes', 'umum', 'lainnya', 'lain',
                    'foto', 'poto', 'photo', 'gambar', 'image', 'picture', 'pic',
                    'img', 'screenshot', 'tangkapanlayar', 'kamera', 'camera',
                    'jpg', 'jpeg', 'png'];

  /* Huruf besarnya DIPERTAHANKAN. Tag ini dilihat pemakainya, dan
     "#ShamiraWeb" lebih cepat dikenali daripada "#shamiraweb" - sementara
     pencocokannya sendiri tetap tidak peduli huruf besar-kecil. */
  /* HURUF APA PUN, BUKAN CUMA ABJAD LATIN. Dulu di sini ada [^A-Za-z0-9], dan
     itu membuang seluruh tag yang tidak ditulis dengan alfabet Inggris - Rusia,
     Arab, Jepang, bahkan huruf beraksen. Akibatnya diam: tagnya tidak ditolak
     dengan pesan, dia cuma jadi string kosong lalu lenyap.

     Dan itu melanggar janji yang paling dasar di sini: kata yang KAMU ketik
     adalah milikmu. Dia masuk apa adanya, dalam bahasa apa pun, karena itu kata
     yang akan kamu ketik lagi enam bulan kemudian. \p{L}\p{N} membaca seluruh
     huruf dan angka Unicode; yang dibuang cuma spasi dan tanda baca. */
  function bersihTag(t) {
    var v = String(t || '').replace(/^#+/, '');
    try { v = v.replace(/[^\p{L}\p{N}]+/gu, ''); }
    catch (e) { v = v.replace(/[^A-Za-z0-9]+/g, ''); }
    v = v.slice(0, 24);
    if (TAG_BENTUK.indexOf(v.toLowerCase()) >= 0) return '';
    return v;
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

  /* Batas atas jumlah tag BARU per entri. Arahannya sudah meminta secukupnya,
     tapi model yang kelebihan semangat tetap bisa mengirim lima belas - dan
     yang kelima belas sudah pasti karangan, karena catatannya cuma tiga kata.
     Yang disebut duluan yang dipertahankan: model menulis yang paling yakin
     lebih dulu. */
  var TAG_MAKS_BARU = 8;

  /* Gambar dapat jatah lebih besar, dan itu bukan kelonggaran: dia butuh DUA
     lapis penuh - lima yang menaruhnya di kamar yang benar, lima yang
     memisahkannya di dalam kamar. Delapan berarti salah satu lapis dipotong,
     dan yang dipotong selalu lapis sempitnya (model menulis yang umum lebih
     dulu). */
  var TAG_MAKS_GAMBAR = 10;

  /* Kata drivermu, dipecah jadi tag satu-satu. Kata sambung yang terlalu
     pendek dibuang - "di", "dan", "yg" tidak pernah jadi ruangan. */
  function kataDriver(driver) {
    var teks = String(driver || '');
    var potong;
    /* Dipisah di SPASI DAN TANDA BACA, bukan di daftar huruf yang diizinkan.
       Daftar huruf selalu ketinggalan satu aksara - dan waktu ketinggalan,
       yang hilang seluruh drivernya sekaligus, diam-diam. */
    try { potong = teks.split(/[^\p{L}\p{N}]+/gu); }
    catch (e) { potong = teks.split(/[^A-Za-z0-9\u00C0-\u024F]+/); }
    return potong.filter(function (w) { return w.length >= 3; }).slice(0, 5);
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
  /* TAG BARU MENUNGGU DI RUANG TUNGGU, TIDAK LANGSUNG MASUK PUSTAKA.

     Alasannya satu kalimat: hidup orangnya berputar di lingkaran yang
     terbatas, jadi tagnya SEHARUSNYA konvergen - itu-itu saja, dan makin lama
     makin bisa diandalkan buat menyaring. Yang merusak sifat itu bukan tag
     yang salah sesekali, tapi tag yang masuk pustaka tanpa pernah dilihat:
     sekali "kursi" ikut terdaftar di sebelah "sofa", AI akan memakai keduanya
     bergantian selamanya, dan tidak satu pun bisa dipercaya lagi.

     Jadi tag baru menumpuk di tagUsulan sampai dilihat sekali. Yang sudah ada
     di pustaka dipakai diam-diam - itu jalur yang normal, dan dia tidak
     menagih apa pun.

     Tagnya SUDAH menempel di entrinya sejak sekarang, jadi pencarian sudah
     bisa memakainya hari ini juga. Yang ditunda cuma keanggotaannya di
     pustaka - dan itu memang keputusan yang boleh menunggu. */
  function catatTag(setelan, tag) {
    var pustaka = daftarTag(setelan);
    var usul = (setelan.tagUsulan || []).slice();
    var berubah = false;
    (tag || []).forEach(function (t) {
      if (pustaka.some(function (x) { return samaTag(x, t); })) return;
      if (usul.some(function (x) { return samaTag(x, t); })) return;
      usul.push(t);
      berubah = true;
    });
    if (!berubah) return Promise.resolve();
    usul = usul.slice(-60);
    setelan.tagUsulan = usul;
    return TSimpan.setel('tagUsulan', usul);
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
      '- tag: sebanyak yang benar-benar ada di dokumennya, tidak lebih. Dua sampai tiga untuk',
      '  yang isinya sedikit, enam paling banyak untuk yang panjang. Tidak ada jumlah minimum.',
      '  TIAP TAG HARUS BISA DITUNJUK ASALNYA: kata yang memang tertulis di dokumen itu, atau',
      '  bentuk yang menyebut dirinya sendiri (08xx -> WhatsApp, https:// -> Link). Kalau kamu',
      '  tidak bisa menunjuk asalnya, tag itu karangan - jangan ditulis.',
      '  JANGAN mengarang hubungan atau sifat yang tidak tertulis, dan jangan memakai kata yang',
      '  menyebut BENTUKNYA (catatan, data, info, daftar, berkas, dokumen, nomor) - kata seperti',
      '  itu cocok untuk hampir semua yang pernah disimpan, jadi sebagai ruangan dia tidak',
      '  memisahkan apa pun.',
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

  /* FOTO REFERENSI LAWAN DOKUMEN, dan aturannya pantas punya nama karena
     dialah yang memilih arahan mana yang berangkat.

     Yang kamu POTRET atau UNGGAH sendiri selalu foto referensi, ada drivernya
     atau tidak - kamera tidak pernah menghasilkan faktur. Yang punya driver
     juga, dari mana pun dia masuk: driver berarti kamu sudah memberitahu
     sedang melihat apa.

     Sisanya - yang jatuh lewat kotak Drop tanpa driver - dibaca sebagai
     dokumen, dan di situ tangkapan layar struk, KTP, dan faktur memang yang
     terbanyak.

     Dulu yang memilih cuma drivernya, dan itu meninggalkan lubang yang
     mematikan seluruh perbaikan ini: satu foto yang lolos tanpa sempat
     ditanya sudut pandangnya jatuh ke pembaca dokumen, lalu dijawab dalam
     bahasa Indonesia dengan tag yang disedot dari pustaka. */
  function fotoReferensi(e) {
    return !!(e && (e.driver || e.sumber === 'kamera' || e.sumber === 'unggah'));
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
            /* DUA ARAHAN, DAN YANG MEMILIH ASAL-USULNYA - bukan drivernya.
               Dulu yang memilih drivernya, dan itu meninggalkan satu lubang
               yang persis mematikan seluruh perbaikan ini: foto yang masuk
               tanpa sempat ditanya sudut pandangnya jatuh ke pembaca dokumen,
               lalu dijawab dalam bahasa Indonesia dengan tag dari pustaka -
               #AmaraLiving pada foto kamar tidur.

               Yang benar: apa pun yang kamu POTRET atau UNGGAH sendiri adalah
               foto referensi, ada drivernya atau tidak. Kamera tidak pernah
               menghasilkan faktur. Yang masuk lewat kotak Drop lain ceritanya -
               di situ tangkapan layar struk dan KTP memang yang terbanyak, dan
               pembaca dokumen yang teliti memang yang dibutuhkan. */
            var pakaiGambar = fotoReferensi(e);
            return tanya(setelan, [
              { inline_data: { mime_type: e.tipeBerkas, data: b64 } },
              { text: e.driver ? 'Keywords: ' + e.driver
                    : (pakaiGambar ? 'Baca gambar ini.' : 'Baca dokumen ini.') }
            ], pakaiGambar
                 ? arahanGambar(e.driver, daftarTag(setelan))
                 : arahanBaca(daftarTag(setelan), daftarNamaElemen(setelan)));
          }).then(function (h) {
            if (!h) throw new Error('Dokumen tidak terbaca');
            if (!e.judulManual && h.judul) {
              e.judul = TOtak.susunJudul(String(h.judul), e).slice(0, 90);
            }
            e.label = gabungLabel(e.label, h.label);
            e.elemen = TOtak.gabungElemen(h.elemen, e.elemen, daftarNamaElemen(setelan));
            /* KATA DRIVERMU JADI TAG DULUAN, dan ditegakkan KODENYA - bukan
               diminta di arahan. Itu satu-satunya teks di entri ini yang lahir
               dari kepalanya; kalau AI kebetulan tidak memakainya, kata yang
               paling pasti dia ingat enam bulan lagi justru yang hilang.
               Bahasa apa pun ikut apa adanya - Rusia sekalipun, itu tetap kata
               yang akan dia ketik lagi. */
            e.tag = gabungTag(e.tag, kataDriver(e.driver)
              .concat((h.tag || []).slice(0, TAG_MAKS_GAMBAR)));
            /* Teksnya ditaruh di isi, bukan di kolom baru: dengan begitu
               pencarian yang sudah ada langsung menemukannya, tanpa satu baris
               pun perubahan di otak.js. */
            /* CAPTION MENUMPUK, TIDAK MENIMPA - tapi cuma kalau ada driver.
               Driver kedua pada foto yang sama itu sudut pandang kedua, bukan
               ralat: foto masjid yang tadi dibaca sebagai lampu gantung dan
               sekarang dibaca sebagai motif karpet harus bisa ditemukan lewat
               KEDUANYA. Caption di sini memang bukan catatan kebenaran; dia
               daftar pintu masuk, dan pintu tidak pernah terlalu banyak. */
            if (h.teks) {
              var lamaIsi = String(e.isi || '').trim();
              var baruIsi = String(h.teks).trim();
              if (!lamaIsi) e.isi = baruIsi.slice(0, 1500);
              else if (e.driver && lamaIsi.toLowerCase().indexOf(baruIsi.toLowerCase()) < 0) {
                e.isi = (lamaIsi + '\n\n' + baruIsi).slice(0, 1500);
              }
            }
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

  /* ===================== OBROLAN =====================
     Satu-satunya bagian AI yang KAMU ajak bicara, bukan yang bekerja di
     belakangmu. Karakternya asisten pribadi, bukan mesin serba tahu: yang
     dipakai di sini orang yang menjalankan banyak peran sekaligus dan sedang
     kehabisan tenaga, jadi jawaban enam paragraf untuk pertanyaan lima kata
     bukan menolong - itu menambah beban di tempat yang sama.

     Riwayatnya tinggal di perangkat, di toko yang sama dengan catatan, jadi
     ikut cadangan dan tidak hilang waktu halamannya dimuat ulang. */
  var ARAHAN_OBROL = [
    'Kamu asisten pribadi seseorang yang menjalankan banyak peran sekaligus - beberapa usaha,',
    'beberapa tim, dan hampir tidak pernah punya waktu utuh.',
    '',
    'Cara menjawab, dan ini yang paling menentukan:',
    '- SEIMBANG DENGAN PERTANYAANNYA. Pertanyaan lima kata dijawab beberapa kalimat, bukan',
    '  enam paragraf. Dia membacanya di HP, di sela pekerjaan lain.',
    '- INTINYA DI DEPAN. Kesimpulan dulu, alasannya sesudahnya - dan cuma kalau alasannya',
    '  memang mengubah keputusan.',
    '- KALAU ADA YANG PERLU DIPUTUSKAN, beri SATU rekomendasi, bukan daftar pilihan.',
    '  Daftar pilihan memindahkan pekerjaan berpikir kembali ke dia.',
    '- Bahasa Indonesia, apa adanya, tanpa basa-basi pembuka dan tanpa menawarkan bantuan',
    '  lanjutan di akhir.',
    '- Kalau kamu tidak tahu, bilang tidak tahu. Menebak dengan yakin lebih mahal daripada',
    '  mengaku tidak tahu.'
  ].join('\n');

  /* Jawaban obrolan itu teks biasa, jadi dia tidak lewat urai() seperti yang
     lain - satu-satunya tempat di berkas ini yang tidak mengharapkan JSON. */
  function obrolTeks(setelan, riwayat) {
    var bagian = (riwayat || []).slice(-20).map(function (m) {
      return { text: (m.dari === 'aku' ? 'Aku: ' : 'Kamu: ') + m.teks };
    });
    if (!bagian.length) return Promise.reject(new Error('Belum ada yang ditanyakan'));
    var arahan = ARAHAN_OBROL + '\n\nJawab sebagai teks biasa, BUKAN JSON.';
    var ambilTeks = function (j) {
      var p = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
              j.candidates[0].content.parts && j.candidates[0].content.parts[0];
      return (p && p.text) || '';
    };
    if (lewatProxy(setelan)) {
      return TAwan.ambilToken(setelan, true).then(function (token) {
        return fetch(TBawaan.alamatAI, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ token: token, arahan: arahan, bagian: bagian, mode: 'obrol' })
        });
      }).then(function (r) {
        if (!r.ok) throw new Error('Layanan AI menjawab ' + r.status);
        return r.text();
      }).then(function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) { throw new Error('Jawaban tidak dikenali'); }
        if (j && j.galat) throw new Error(j.galat);
        return ambilTeks(j);
      });
    }
    return fetch(AKAR + encodeURIComponent(modelObrol(setelan)) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': setelan.kunciGemini },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: arahan }] },
        contents: [{ role: 'user', parts: bagian }],
        generationConfig: { temperature: 0.6 }
      })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error && j.error.message) || ('Gemini menjawab ' + r.status));
        return ambilTeks(j);
      });
    });
  }

  /* Gambar buatan AI kembali sebagai base64 DI DALAM jawabannya, bukan sebagai
     alamat yang harus diunduh belakangan. Itu kebetulan yang menguntungkan di
     sini: begitu jawabannya sampai, gambarnya sudah ada di perangkat, dan dia
     masuk ke toko berkas lewat jalan yang sama persis dengan gambar yang kamu
     lampirkan sendiri - tidak ada jalur kedua yang harus dipelihara. */
  function gambarAI(setelan, perintah) {
    var teks = String(perintah || '').trim();
    if (!teks) return Promise.reject(new Error('Belum ada yang diminta'));
    var ambilGambar = function (j) {
      var bagian = (j && j.candidates && j.candidates[0] && j.candidates[0].content &&
                    j.candidates[0].content.parts) || [];
      for (var i = 0; i < bagian.length; i++) {
        /* Dua ejaan kunci yang sama: REST memakai inlineData, sebagian jalur
           lain inline_data. Keduanya diterima supaya jawaban yang benar tidak
           terbaca sebagai kegagalan. */
        var d = bagian[i].inlineData || bagian[i].inline_data;
        if (d && d.data) return { data: d.data, tipe: d.mimeType || d.mime_type || 'image/png' };
      }
      throw new Error('AI tidak mengembalikan gambar');
    };
    if (lewatProxy(setelan)) {
      return TAwan.ambilToken(setelan, true).then(function (token) {
        return fetch(TBawaan.alamatAI, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ token: token, bagian: [{ text: teks }], mode: 'gambar' })
        });
      }).then(function (r) {
        if (!r.ok) throw new Error('Layanan AI menjawab ' + r.status);
        return r.text();
      }).then(function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) { throw new Error('Jawaban tidak dikenali'); }
        if (j && j.galat) throw new Error(j.galat);
        return ambilGambar(j);
      });
    }
    return fetch(AKAR + encodeURIComponent(modelGambar(setelan)) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': setelan.kunciGemini },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: teks }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error && j.error.message) || ('Gemini menjawab ' + r.status));
        return ambilGambar(j);
      });
    });
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
    obrolTeks: obrolTeks, gambarAI: gambarAI, ARAHAN_OBROL: ARAHAN_OBROL,
    /* Cuma untuk uji: melihat arahan yang benar-benar dikirim, bukan menebak
       dari kodenya. */
    arahanUji: function (setelan) { return arahanLabel(daftarTag(setelan), daftarNamaElemen(setelan)); },
    /* Cuma untuk uji: melihat apa yang benar-benar MENINGGALKAN perangkat -
       drivernya ikut atau tidak, dan duduk di urutan yang mana. */
    pesananUji: pesanan,
    /* Cuma untuk uji: arahan gambar yang benar-benar dikirim, dan kata driver
       yang benar-benar jadi tag - bukan menebaknya dari kodenya. */
    arahanGambarUji: arahanGambar,
    kataDriverUji: kataDriver,
    fotoReferensiUji: fotoReferensi,
    antreUji: function (semua) { return antreLabel(semua).map(function (e) { return e.id; }); },
    /* Cuma untuk uji: memperlihatkan tag yang benar-benar lolos saringan
       kodenya, bukan menebaknya dari arahan yang dikirim. */
    saringTagUji: function (tag) {
      return gabungTag([], (tag || []).slice(0, TAG_MAKS_BARU));
    }
  };
})(window);
