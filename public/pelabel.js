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
     board. Kalau alamatnya diminta lebih dulu, model memilih dari kata yang
     kebetulan ada di permukaan; kalau subjeknya sudah ditetapkan, alamatnya
     dipilih berdasarkan maksud catatan.

     ELEMEN adalah bagian yang paling menentukan di sini. Menemukan kartunya
     itu setengah pekerjaan; setengah lagi adalah menyalin satu baris dari
     dalamnya - dan itu justru dikerjakan saat orangnya paling buru-buru.

     Pohon board ikut dikirim UTUH, dan itu bukan sekadar konteks: dialah daftar
     pilihannya. Yang tidak ada di daftar itu tidak boleh keluar dari sini. */
  function arahanLabel(daftarBoard, namaElemenLama, akhiran) {
    var board = (daftarBoard || []).join(', ');
    var akhir = (akhiran || []).join(', ');
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
      'sudut pandangnya, bukan keterangan tambahan. Judul dan board dipilih DARI situ, dan',
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
      '      editor". Judul panjang tidak menambah pintu masuk; yang menambah itu',
      '      deskripsinya, dan deskripsinya sudah menampung semuanya.',
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
      '   dan di deskripsinya. Menempelkan nama orang, proyek, atau bank ke nama jenis membuat elemen',
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
      '3. BOARD. SATU alamat, dipilih dari daftar di bawah - tidak pernah dikarang.',
      '',
      '   Daftarnya TERTUTUP. Kalau tidak ada yang cocok, kembalikan board kosong. Board kosong',
      '   itu jawaban yang sah; board karangan tidak, karena barisnya memang tidak ada di',
      '   aplikasinya - catatannya akan mendarat di ruangan yang tidak pernah bisa dibuka.',
      '',
      '   Pilih SUB BOARD kalau ada yang benar-benar cocok; kalau tidak, cukup main board-nya.',
      '   "Interior" saja lebih benar daripada memaksakan "Interior Bedroom" untuk foto masjid.',
      '   Salin namanya PERSIS seperti tertulis, lengkap dengan nama induknya.',
      board ? '   Board yang tersedia: ' + board : '   Belum ada board sama sekali; kembalikan kosong.',
      akhir ? '   Kalau tidak ada sub yang cocok, gabungkan nama main board dengan SATU kata dari'
            : '',
      akhir ? '   daftar ini: ' + akhir : '',
      akhir ? '   Dua daftar itu TERTUTUP: jangan mengarang nama main board baru, jangan mengarang'
            : '',
      akhir ? '   akhiran baru. Kalau akhirannya pun tidak pas, cukup main board-nya saja.' : '',
      '   Kalau tidak ada satu pun main board yang cocok, jawab "' + (TBawaan.boardLain || '') +
        '" — itu jawaban yang benar, bukan kegagalan.',
      '',
      'Selain itu, label: 4 sampai 8 kata kunci huruf kecil yang TIDAK dilihat pemakainya -',
      'tugasnya cuma membuat pencarian ketemu. Sertakan sebutan yang mungkin dia pakai saat',
      'mencari, termasuk yang TIDAK tertulis di isinya tapi jelas dari konteks.',
      '',
      'Bahasa Indonesia, kecuali istilah teknis yang memang lazim Inggris.',
      'Jawab HANYA JSON: {"hasil":[{"i":0,"judul":"...",' +
        '"elemen":[{"jenis":"tautan|kode|nomor|telepon|surel|alamat|berkas|nama|jadwal|harga|prompt|lainnya",' +
        '"nilai":"...","nama":"..."}],"board":"...","label":["..."]}]}'
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
        e.album ? 'board: ' + e.album : '',
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
    var board = daftarBoard(setelan);
    return tanya(setelan, [{ text: pesanan(antre) }],
                 arahanLabel(board, namaEl, daftarAkhiran(setelan)))
      .then(function (jawab) {
        var hasil = (jawab && jawab.hasil) || [];
        if (!hasil.length) throw new Error('Jawaban AI kosong');
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
          e.diLabeliAI = true;
          e.diubah = Date.now();
          /* Alamat yang KAMU tentukan tidak pernah ditimpa - sama persis dengan
             judul manual. Yang diisi AI cuma yang masih kosong. */
          return taruhBoard(setelan, e, h.board).then(function () {
            return TSimpan.taruh(e);
          });
        }).filter(Boolean);
        return Promise.all(tulis)
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

     DUA HASIL SAJA: satu deskripsi dan satu board. Tidak ada tag.

     Hashtag sudah dicoba dan dibuang, dan alasannya bukan selera: tag buatan
     mesin melar dan tidak pernah konvergen - sebulan kemudian ada #sofa,
     #kursi, dan #seating untuk satu benda, dan pemiliknya tidak mengenali satu
     pun waktu mencari. Kata yang tidak dia ingat bukan pintu masuk, cuma
     hiasan di kartu. Deskripsi tidak punya penyakit itu: dia kalimat, jadi
     dia konsisten dengan dirinya sendiri, dan tiap kata di dalamnya ikut
     dicari.

     ISINYA KONTEKSTUAL, dan yang menentukan konteks itu DRIVER - bukan yang
     paling menonjol di gambar. Foto masjid dengan driver "interior mesjid"
     harus menghasilkan kalimat tentang elemen interiornya; yang sama dengan
     driver "karpet mesjid" menghasilkan kalimat tentang motif dan bahan
     karpetnya. Bendanya satu, deskripsinya dua, dan keduanya benar.

     DUA KALIMAT, DAN ITU BATAS ATAS - bukan sasaran. Waktu diminta "2-3
     kalimat", yang kembali lima: model mengisi jatahnya dengan menulis ulang
     kalimat pertama memakai kata lain, dan yang ketiga sampai kelima tidak
     menambah satu pun pintu masuk. Deskripsi yang harus digulir berhenti
     dibaca, dan yang berhenti dibaca sama saja dengan tidak ada - jadi
     larangan mengulang ditulis terang-terangan, dan panjangnya ditegakkan
     KODENYA lewat potongKalimat(), bukan cuma diminta di arahan. */
  function arahanGambar(driver, daftarBoard, akhiran) {
    var board = (daftarBoard || []).join(', ');
    var akhir = (akhiran || []).join(', ');
    return [
      driver ? 'Keywords: ' + String(driver).slice(0, 60) : 'Tidak ada keywords; baca apa adanya.',
      '',
      'Tulis MAKSIMAL 2 kalimat yang mendeskripsikan gambar ini DARI SUDUT PANDANG keywords di',
      'atas, bukan dari yang paling menonjol di gambar. Sebutkan: nama objeknya, gayanya,',
      'kategorinya, bentuknya, fungsinya, dan satu hal unik yang benar-benar terlihat.',
      'Kalimat itu satu-satunya kata kunci yang dipunyai gambar ini, jadi pakai sebutan yang',
      'akan dia ketik lagi enam bulan kemudian - bukan bahasa katalog.',
      'JANGAN MENGULANG: kalimat kedua tidak boleh menyebut ulang apa yang sudah ada di kalimat',
      'pertama dengan kata lain. Satu kalimat yang padat lebih baik daripada dua yang berputar.',
      '',
      'Judul maksimal 8 kata, juga dari sudut pandang keywords.',
      '',
      'Lalu pilih SATU board dari daftar ini, salin namanya PERSIS:',
      board || '(kosong)',
      'Daftarnya BERTINGKAT: akar (Business, Personal, …) > interest > sub interest.',
      'JAWABANNYA HARUS SUB INTEREST — tingkat paling dalam. Jangan berhenti di akar, dan',
      'jangan berhenti di interest: gambar yang ditaruh di pintu ruangan menumpuk di situ.',
      'Kalau keywords menyebut nama interest, jawabannya WAJIB di dalam interest itu.',
      '',
      'Kalau tidak ada sub interest yang cocok, buat satu: nama interest-nya + SATU kata dari',
      'daftar akhiran ini, tidak boleh kata lain.',
      akhir || '(kosong)',
      'Contoh: interest "Business Hampers" tanpa sub yang cocok -> "Business Hampers Inspiration".',
      'DUA DAFTAR DI ATAS TERTUTUP: jangan mengarang nama main board baru, jangan mengarang',
      'akhiran baru.',
      'Kalau tidak ada satu pun main board yang cocok — gambarnya memang di luar semua bidang',
      'di daftar itu — jawab "' + (TBawaan.boardLain || '') + '". Itu jawaban yang benar, bukan',
      'kegagalan; jangan memaksakan bidang yang paling mirip.',
      '',
      'BAHASA JAWABAN MENGIKUTI BAHASA KEYWORDS.',
      '',
      'Jawab HANYA JSON: {"judul":"...","teks":"...","board":"...",',
      '"elemen":[{"jenis":"...","nilai":"...","nama":"..."}]}',
      'elemen: kode, nomor seri, atau nama merek yang TERBACA di gambar. Kosongkan kalau tidak ada.'
    ].filter(Boolean).join('\n');
  }

  /* DUA KALIMAT, DITEGAKKAN KODENYA. Arahannya sudah meminta, tapi permintaan
     bukan jaminan - dan yang bocor di sini tidak pernah kelihatan sebagai
     galat, cuma sebagai kartu yang makin lama makin panjang.

     Dipotong di UJUNG KALIMAT, bukan di jumlah karakter: kalimat yang putus di
     tengah kata terbaca sebagai data rusak, dan itu lebih buruk daripada
     kepanjangan. Kalau kalimat pertamanya sendiri sudah melewati batas, dia
     dibiarkan utuh - memotongnya berarti membuang satu-satunya yang ada. */
  var DESKRIPSI_MAKS = 400;

  function potongKalimat(teks, maksKalimat) {
    var v = String(teks || '').trim();
    if (!v) return '';
    var pecah = v.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [v];
    var ambil = pecah.slice(0, maksKalimat || 2).join('').trim();
    if (ambil.length <= DESKRIPSI_MAKS) return ambil;
    return pecah[0].trim();
  }

  /* ===================== BOARD =====================
     Satu-satunya alamat, dan daftarnya TERTUTUP.

     AI memilih dari pohon yang ditulis pemakainya; dia tidak pernah menambah
     barisnya. Itu satu-satunya yang menahan daftar ini supaya tidak melar -
     dan daftar alamat yang melar persis sama gunanya dengan tidak punya
     alamat: gudang dengan seribu ruangan tidak memisahkan apa pun.

     Ditegakkan DI SINI, bukan cuma diminta di arahan. Aturan yang cuma diminta
     akan bocor persis di hari tersibuk, dan yang bocor di sini melahirkan
     ruangan hantu - nama yang menempel di entrinya tapi tidak ada barisnya di
     Setelan, jadi tidak pernah bisa dibuka. */
  /* Akar bawaan DITAMBAH yang ditambah/dinamai sendiri di Setelan. Kalau yang
     dibaca cuma daftar bawaan, akar buatan tangan tidak dikenali sebagai akar
     di sini - dan akibatnya AI membuatkan "Ladang Inspiration" di dalam tulang
     punggung, ruangan yang tidak menjawab apa pun. */
  function daftarAkar(setelan) {
    var tangan = [];
    try {
      var v = JSON.parse((setelan || {}).akarTangan || '[]');
      if (Array.isArray(v)) tangan = v;
    } catch (e) { tangan = []; }
    return (TBawaan.akarAwal || []).concat(tangan);
  }

  function daftarAkhiran(setelan) {
    var d = setelan && setelan.akhiran;
    if (d == null) return (TBawaan.akhiranAwal || []).slice();
    try {
      var v = typeof d === 'string' ? JSON.parse(d) : d;
      return Array.isArray(v) ? v.filter(Boolean) : [];
    } catch (e) { return []; }
  }

  function indukDari(nama, semua) {
    var n = TOtak.normal(nama), terbaik = '';
    (semua || []).forEach(function (m) {
      if (m === nama) return;
      var v = TOtak.normal(m);
      if (n.indexOf(v + ' ') !== 0) return;
      if (v.length > TOtak.normal(terbaik).length) terbaik = m;
    });
    return terbaik;
  }

  function daftarBoard(setelan) {
    var teks = setelan && setelan.board;
    if (teks == null) return (TBawaan.boardAwal || []).slice();
    try {
      var d = typeof teks === 'string' ? JSON.parse(teks) : teks;
      return Array.isArray(d) ? d.filter(Boolean) : [];
    } catch (e) { return []; }
  }

  /* Jawaban AI dicocokkan ke baris yang BENAR-BENAR ADA. Yang tidak ketemu
     dibuang diam-diam - bukan disimpan apa adanya - karena alamat yang tidak
     ada barisnya lebih buruk daripada tanpa alamat: yang tanpa alamat masih
     kelihatan di "Belum berboard", yang salah nama hilang sama sekali. */
  function pilihBoard(nama, daftar, akhiran, wajibInduk, akarLuar) {
    var n = TOtak.normal(nama || '');
    if (!n) return '';
    var punya = (daftar || []).filter(Boolean);

    /* KALAU DRIVERNYA SUDAH MENYEBUT MAIN BOARD-NYA, jawabannya wajib di dalam
       situ. Kamu sudah menjawab separuh; membiarkan model memindahkannya ke
       bidang lain berarti membatalkan jawaban yang barusan kamu berikan. */
    function sah(b) {
      if (!wajibInduk) return true;
      var w = TOtak.normal(wajibInduk);
      var v = TOtak.normal(b);
      return v === w || v.indexOf(w + ' ') === 0;
    }

    var ada = punya.filter(function (b) { return TOtak.normal(b) === n && sah(b); })[0];
    if (ada) return ada;
    /* Model sesekali menjawab nama pendeknya saja ("Bedroom" untuk "Interior
       Bedroom"). Itu jawaban yang benar dengan penulisan yang salah, jadi
       diselamatkan - tapi cuma kalau cuma SATU baris yang berakhir begitu;
       dua kandidat berarti tebakan, dan menebak alamat itu yang dihindari. */
    var ekor = punya.filter(function (b) {
      var v = TOtak.normal(b);
      return (v === n || v.slice(-(n.length + 1)) === ' ' + n) && sah(b);
    });
    if (ekor.length === 1) return ekor[0];

    /* RUANGAN BARU: satu-satunya nama yang boleh lahir dari sini adalah
       <interest yang sudah ada> + <akhiran yang sudah ada>. Model tidak pernah
       mengarang kata; dia cuma menggabungkan dua potong yang sudah tertulis,
       dan penggabungannya dikerjakan di sini - bukan di sana.

       Tanpa ini, satu interest baru yang belum punya sub sama sekali akan
       menampung SEMUANYA, dan tumpukan yang dilawan aplikasi ini lahir lagi
       di dalam ruangan yang baru saja dibuat untuk mencegahnya.

       INTEREST, BUKAN AKAR. Akar itu tulang punggung - "Business Inspiration"
       adalah ruangan yang tidak menjawab apa pun, dan menaruhnya di situ sama
       saja dengan tidak menaruhnya. */
    var akarPunya = akarLuar || (TBawaan.akarAwal || []);
    function adalahAkar(b) {
      return akarPunya.some(function (a) { return TOtak.normal(a) === TOtak.normal(b); });
    }
    var mains = punya.filter(function (b) {
      if (adalahAkar(b)) return false;
      var ind = indukDari(b, punya);
      return !ind || adalahAkar(ind);
    });
    var pilihM = '', pilihA = '';
    mains.forEach(function (m) {
      if (!sah(m)) return;
      /* Ruangan di dalam ruang tunggu membatalkan gunanya ruang tunggu:
         "Other and Various Inspiration" tidak memberitahu apa pun yang tidak
         sudah diberitahu namanya sendiri. */
      if (TOtak.normal(m) === TOtak.normal(TBawaan.boardLain || '')) return;
      var vm = TOtak.normal(m);
      if (n.indexOf(vm + ' ') !== 0) return;
      var sisa = n.slice(vm.length + 1);
      (akhiran || []).forEach(function (x) {
        if (TOtak.normal(x) !== sisa) return;
        /* Yang terpanjang menang, sama seperti di mana-mana: "Apps Dev" lebih
           menjawab daripada "Apps" seandainya keduanya ada. */
        if (vm.length > TOtak.normal(pilihM).length) { pilihM = m; pilihA = x; }
      });
    });
    return pilihM ? pilihM + ' ' + pilihA : '';
  }

  /* Ruangan yang lahir dari akhiran DICATAT sebagai buatan AI. Bukan supaya
     bisa dibedakan gunanya - isinya sama saja - tapi supaya sekali seminggu
     kamu bisa melihat ruangan mana yang tumbuh tanpa kamu tulis, dan
     membereskannya sebelum jumlahnya jadi masalah. */
  function daftarBoardAI(setelan) {
    var d = setelan && setelan.boardAI;
    if (!d) return [];
    try {
      var v = typeof d === 'string' ? JSON.parse(d) : d;
      return Array.isArray(v) ? v.filter(Boolean) : [];
    } catch (e) { return []; }
  }

  function tambahBoardBaru(setelan, nama) {
    var punya = daftarBoard(setelan);
    if (punya.some(function (b) { return TOtak.normal(b) === TOtak.normal(nama); })) {
      return Promise.resolve();
    }
    punya.push(nama);
    var buatan = daftarBoardAI(setelan);
    buatan.push(nama);
    /* Objek setelan yang sama yang dipegang layar - jadi begitu putaran ini
       selesai, pohon di memori sudah berisi ruangan barunya tanpa memuat ulang
       apa pun. */
    setelan.board = JSON.stringify(punya);
    setelan.boardAI = JSON.stringify(buatan);
    return Promise.all([
      TSimpan.setel('board', setelan.board),
      TSimpan.setel('boardAI', setelan.boardAI)
    ]);
  }

  /* Satu corong untuk dua jalur (labeli & bacaBerkas): memilih boardnya,
     membuat barisnya kalau memang baru, lalu menempelkannya. */
  function taruhBoard(setelan, e, jawab) {
    if (e.albumManual) return Promise.resolve();
    var punya = daftarBoard(setelan);
    var akhiran = daftarAkhiran(setelan);
    var akarAda = daftarAkar(setelan);
    var sebut = TOtak.bacaBoardDariDriver(e.driver, punya, akhiran, akarAda);
    var pilih = pilihBoard(jawab, punya, akhiran, sebut.main || '', akarAda);
    /* TIDAK ADA BIDANG YANG COCOK ITU JAWABAN, BUKAN KEGAGALAN. Foto antariksa
       tidak punya rumah di daftar bidang usahanya, dan membiarkannya di "Belum
       berboard" berarti menaruhnya di baris yang bunyinya seperti kesalahan -
       baris yang makin lama makin dihindari sampai tidak pernah dibuka lagi.

       Cuma kalau drivernya tidak menyebut bidangnya sendiri: kalau kamu sudah
       bilang "Interior", jawabannya yang salah bukan alasan memindahkannya ke
       ruang tunggu - yang benar membiarkannya di Interior. */
    /* KAMU SUDAH MENYEBUT BIDANGNYA - jawaban AI yang meleset bukan alasan
       membuang alamat itu. Yang tersisa cuma "kamarnya yang mana", dan kalau
       itu pun tidak terjawab, ruang tunggu bidang itulah jawabannya. */
    if (!pilih && sebut.main) pilih = sebut.main;
    if (!pilih && !sebut.main && !sebut.sub) {
      var lain = punya.filter(function (b) {
        return TOtak.normal(b) === TOtak.normal(TBawaan.boardLain || '');
      })[0];
      if (lain) pilih = lain;
    }
    if (!pilih) return Promise.resolve();

    /* JANGAN BERHENTI DI PINTU RUANGAN. Interest yang menampung foto lepas di
       samping sub board-nya persis timbunan yang dilawan aplikasi ini - dan
       itu keadaan yang paling sering terjadi, karena "cukup interest-nya saja"
       selalu terasa jawaban yang aman buat model.

       Jadi jawaban yang berhenti di interest DINAIKKAN satu tingkat ke dalam,
       ke ruang tunggu milik interest itu sendiri. Dibuat waktu pertama
       dibutuhkan, bukan disiapkan kosong di tiap interest. */
    var akarPunya2 = akarAda;
    var indukPilih = indukDari(pilih, punya);
    var akarSendiri = akarPunya2.some(function (a) {
      return TOtak.normal(a) === TOtak.normal(pilih);
    });
    var indukAkar = indukPilih && akarPunya2.some(function (a) {
      return TOtak.normal(a) === TOtak.normal(indukPilih);
    });
    var interest = !akarSendiri && (!indukPilih || indukAkar);
    var lainNama = TOtak.normal(TBawaan.boardLain || '');
    if (interest && TOtak.normal(pilih) !== lainNama) {
      var pakai = (akhiran || []).filter(function (x) {
        return TOtak.normal(x) === 'various';
      })[0];
      if (pakai) pilih = pilih + ' ' + pakai;
    }

    e.album = pilih;
    return punya.indexOf(pilih) >= 0 ? Promise.resolve()
                                     : tambahBoardBaru(setelan, pilih);
  }

  function samaKata(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }

  /* Daftar nama elemen yang sudah dipakai - sama peran dengan pohon board:
     nama yang sudah ada, supaya AI memakai ulang alih-alih mengarang nama baru
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
      if (!lama.some(function (x) { return samaKata(x, t); })) { lama.push(t); berubah = true; }
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

  function arahanBaca(daftarBoard, namaElemenLama, akhiran) {
    var board = (daftarBoard || []).join(', ');
    var akhir = (akhiran || []).join(', ');
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
      '  "No WhatsApp Bunda". Pemiliknya sudah ada di judul dan di deskripsinya.',
      namaEl ? '  Nama yang sudah dipakai - salin persis kalau maknanya sama: ' + namaEl : '',
      '- board: SATU alamat, dipilih dari daftar di bawah dan disalin PERSIS. Daftarnya',
      '  TERTUTUP - kalau tidak ada yang cocok, kosongkan. Sub board kalau ada yang benar-benar',
      '  cocok, kalau tidak cukup main board-nya.',
      board ? '  Board yang tersedia: ' + board : '  Belum ada board sama sekali; kosongkan.',
      akhir ? '  Kalau tidak ada sub yang cocok, gabungkan nama main board dengan satu kata dari:'
            : '',
      akhir ? '  ' + akhir + ' — di luar itu jangan mengarang nama.' : '',
      '- label: 5 sampai 12 kata kunci huruf kecil - jenis dokumen, nama orang/perusahaan,',
      '  tahun, nomor penting, dan sebutan sehari-hari yang mungkin dipakai mencarinya.',
      '- teks: ringkasan isi terpenting, maksimal 600 karakter. Tulis apa adanya, jangan menafsirkan.',
      'Bahasa Indonesia. Jawab HANYA JSON:',
      '{"judul":"...","elemen":[{"jenis":"...","nilai":"...","nama":"..."}],' +
        '"board":"...","label":["..."],"teks":"..."}'
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
     bahasa Indonesia, dengan alamat yang dibaca dari teks yang tidak ada. */
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
               lalu dijawab dalam bahasa Indonesia sebagai dokumen - "Foto
               Interior Ruang Tamu Modern" untuk foto kamar tidur.

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
                 ? arahanGambar(e.driver, daftarBoard(setelan), daftarAkhiran(setelan))
                 : arahanBaca(daftarBoard(setelan), daftarNamaElemen(setelan),
                              daftarAkhiran(setelan)));
          }).then(function (h) {
            if (!h) throw new Error('Dokumen tidak terbaca');
            if (!e.judulManual && h.judul) {
              e.judul = TOtak.susunJudul(String(h.judul), e).slice(0, 90);
            }
            e.label = gabungLabel(e.label, h.label);
            e.elemen = TOtak.gabungElemen(h.elemen, e.elemen, daftarNamaElemen(setelan));
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
              /* Cuma untuk foto referensi: deskripsi dua kalimat itu aturan
                 arahan gambar. Yang lewat pembaca dokumen memang ringkasan isi
                 dokumennya, dan memotongnya jadi dua kalimat membuang nomor
                 faktur di kalimat ketiga. */
              var baruIsi = fotoReferensi(e) ? potongKalimat(h.teks, 2) : String(h.teks).trim();
              if (!lamaIsi) e.isi = baruIsi.slice(0, 1500);
              else if (e.driver && lamaIsi.toLowerCase().indexOf(baruIsi.toLowerCase()) < 0) {
                e.isi = (lamaIsi + '\n\n' + baruIsi).slice(0, 1500);
              }
            }
            e.diBacaAI = true;
            e.diLabeliAI = true;
            e.diubah = Date.now();
            /* ALAMAT YANG KAMU TENTUKAN TIDAK PERNAH DITIMPA. Berdiri di dalam
               board waktu memotret itu jawaban, bukan kebetulan - dan jawaban
               yang barusan diberikan tidak boleh dibatalkan tebakan yang datang
               tiga detik kemudian. Yang diisi AI cuma yang kosong. */
            return taruhBoard(setelan, e, h.board)
              .then(function () { return TSimpan.taruh(e); })
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
                 arahanLabel(daftarBoard(setelan), daftarNamaElemen(setelan),
                             daftarAkhiran(setelan))).then(function (j) {
      if (!j || !j.hasil || !j.hasil.length) throw new Error('Tersambung, tapi jawabannya tidak dikenali');
      return j.hasil[0];
    });
  }

  global.TPelabel = {
    putaran: putaran, coba: coba, siap: siap, model: model, lewatProxy: lewatProxy,
    obrolTeks: obrolTeks, gambarAI: gambarAI, ARAHAN_OBROL: ARAHAN_OBROL,
    /* Cuma untuk uji: melihat arahan yang benar-benar dikirim, bukan menebak
       dari kodenya. */
    arahanUji: function (setelan) {
      return arahanLabel(daftarBoard(setelan), daftarNamaElemen(setelan),
                         daftarAkhiran(setelan));
    },
    /* Cuma untuk uji: melihat apa yang benar-benar MENINGGALKAN perangkat -
       drivernya ikut atau tidak, dan duduk di urutan yang mana. */
    pesananUji: pesanan,
    /* Cuma untuk uji: arahan gambar yang benar-benar dikirim - bukan menebaknya
       dari kodenya. */
    arahanGambarUji: arahanGambar,
    fotoReferensiUji: fotoReferensi,
    antreUji: function (semua) { return antreLabel(semua).map(function (e) { return e.id; }); },
    /* Cuma untuk uji: memperlihatkan board yang benar-benar lolos penjaganya,
       bukan menebaknya dari arahan yang dikirim. */
    daftarBoardUji: daftarBoard,
    daftarAkarUji: daftarAkar,
    daftarAkhiranUji: daftarAkhiran,
    pilihBoardUji: pilihBoard,
    /* Cuma untuk uji: seluruh rantainya sekaligus - memilih, menaikkan yang
       berhenti di pintu ruangan, lalu menuliskan barisnya kalau memang baru. */
    taruhBoardUji: taruhBoard,
    /* Cuma untuk uji: memperlihatkan panjang deskripsi yang benar-benar
       ditegakkan kodenya, bukan yang cuma diminta di arahan. */
    potongKalimatUji: potongKalimat
  };
})(window);
