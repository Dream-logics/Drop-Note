/* ============================================================================
   Identitas & bawaan
   ============================================================================
   SATU-SATUNYA tempat nama aplikasi ditulis di dalam kode.

   Nama itu kulit. Jiwa dan raganya - nama basis data, nama berkas, nama
   global, nama kolom - sengaja tidak menyebut merek sama sekali, supaya
   mengganti nama besok cuma menyentuh berkas ini, judul di index.html, dan
   manifest. Tidak ada satu pun data yang perlu dipindah.

   Yang TIDAK BOLEH ikut berubah selamanya, apa pun nama aplikasinya:
   - DB       'simpanan'   -> menggantinya membuang seluruh timbunan pemakai
   - Singgahan'singgahan-*'
   - Global   TSimpan, TOtak, TPelabel, TAwan, TSinkron, TAlur
   ============================================================================ */
(function (global) {
  'use strict';

  global.TBawaan = {
    nama: 'Cortex Space',
    tagline: 'Simpan dulu, cari nanti.',

    /* Model Gemini. Flash-Lite dipilih bukan karena murah saja: tugasnya cuma
       memberi judul dan kata kunci, dan model terkecil sudah cukup untuk itu.
       Yang memakainya adalah proxy, bukan aplikasi ini. */
    model: 'gemini-3.5-flash-lite',

    /* Dua model lain, dan keduanya cuma dipakai di layar Obrol - satu-satunya
       tempat AI diajak BICARA, bukan bekerja di belakangmu. Flash-Lite di atas
       sengaja tidak dipakai di sana: memberi judul dan menjawab pertanyaan itu
       dua pekerjaan yang beda beratnya, dan yang kedua yang kamu tunggui. */
    modelObrol: 'gemini-3.5-flash',
    modelGambar: 'gemini-3.5-flash-image',

    /* Tag yang pasti sering dipakai, ditanam sekali supaya AI punya rak yang
       benar sejak catatan pertama - bukan setelah sebulan meraba-raba.
       Ini cuma NILAI AWAL: begitu aplikasinya dipasang, daftarnya jadi milik
       pemakainya dan disunting di Setelan. Mengubah baris ini tidak menyentuh
       daftar yang sudah terlanjur ada di HP siapa pun. */
    tagAwal: ['MAP', 'ProjectSpace', 'Ngoffee', 'AmaraLiving', 'Ultima',
              'ShamiraWeb', 'ShamiraCreative', 'Resep', 'IdeBisnis',
              'linkdev', 'linkexec', 'prompt', 'script', 'password',
              'Akun', 'titip'],

    /* Label rak: barisan tetap di layar hasil, satu ketuk sama dengan menyaring.
       Isinya nama proyek, divisi, dan perusahaan - bukan jenis catatan - karena
       itulah yang benar-benar dipakai orangnya untuk memilah.

       Panjang namanya tidak dibatasi - "Amara Operasional" boleh ditulis utuh,
       dan yang memendekkannya cuma tampilan. Kata sesudah '=' ikut dihitung
       sebagai label yang sama, dan itu ada untuk SATU keadaan: kata yang
       dipakai AI berbeda dari kata di kepala pemakainya ("PS" vs
       "ProjectSpace"). Bukan kamus sinonim.
       Sama seperti tagAwal, ini cuma NILAI AWAL. */
    labelAwal: [
      'MAP',
      'Amara = amaraliving',
      'Ngoffee = ngopi, coffee',
      'PS = projectspace',
      'Ultima',
      'Cons = construction, konstruksi, bangunan',
      'FnB Dev = fnb, makanan, minuman',
      'Intr Dev = interior, interiordev',
      'Kiddo = kids, anak',
      'Various = lain, umum'
    ],

    /* GERBONG: rak untuk gambar, dan sumbunya BEDA dengan label rak di atas.
       Label rak menjawab SIAPA - proyek, divisi, perusahaan - dan siapa itu
       punya tanggal selesai. Gerbong menjawab APA, dan apa tidak pernah
       selesai: satu foto sofa jadi referensi untuk klien mana pun, bertahun
       sesudah proyek yang melahirkannya ditutup.

       Yang menentukan sebuah gambar masuk gerbong mana BUKAN gambarnya, tapi
       DRIVER yang kamu ketik waktu memotretnya. Foto QR menu di sebuah resto
       itu FNB kalau yang kamu pikirkan restonya, dan Apps Dev kalau yang kamu
       pikirkan produknya. Bendanya sama; sudut pandangnya milikmu.

       Bertingkat lewat awalan nama, sama persis dengan folder Note dan album
       Gallery - tidak ada mekanik baru yang harus dipelajari.

       AI boleh MENGUSULKAN gerbong baru, tapi tidak pernah membuatnya sendiri.
       Itu satu-satunya yang menahan daftar ini supaya tidak melar tanpa batas:
       yang tumbuh bebas cuma anaknya, atapnya tetap keputusanmu.

       Quote ada di sini bukan sebagai tempelan. Yang menginspirasi di tengah
       jalan tidak punya proyek dan tidak akan pernah punya, tapi dia tetap
       butuh rumah kalau tidak mau tenggelam - dan keberadaannya yang bikin
       daftar ini daftar MILIKMU, bukan daftar bisnis.
       Sama seperti dua daftar di atas, ini cuma NILAI AWAL. */
    gerbongAwal: [
      'FNB = makanan, minuman, kuliner, cafe, kopi, resto, catering, booth, menu',
      'FNB Menu',
      'FNB Promo',
      'Interior = interior, furnishing, dekorasi, furniture, sofa, lighting, lampu',
      'Construction = construction, konstruksi, bangunan, material, struktur, granit, keramik',
      'Real Estate = properti, kost, ruko, villa, hotel, guesthouse, kontrakan, warehouse, gudang',
      'Apps Dev = aplikasi, apps, digital, sistem, software, qr, website',
      'Quote = quote, kutipan, inspirasi, renungan'
    ],

    /* Alamat proxy AI milik PEMBUAT aplikasi (Apps Script /exec).
       Kunci Gemini tinggal di sana, tidak pernah di perangkat siapa pun.
       Pemakai tidak membawa kunci, tidak membeli kunci, tidak tahu ada kunci -
       dia cuma dikenali dari email Google-nya, lalu dilayani atau tidak.

       Kosong di sini berarti aplikasinya jalan tanpa AI sama sekali. Itu
       keadaan yang sah dan lengkap, bukan keadaan rusak. */
    alamatAI: '',

    /* OAuth Client ID Google. Ini BUKAN rahasia - dia memang terbaca di semua
       aplikasi browser, dan yang menjaganya adalah daftar origin yang kamu
       daftarkan di Google Cloud Console. Kosong di sini berarti pemakainya
       menempelkannya sendiri sekali di layar Setelan. */
    clientId: '376616148815-6j81udqlnh9r0mdrfkgi2jg8lmnp2k7j' +
              '.apps.googleusercontent.com',

    /* drive.file: aplikasi cuma bisa menyentuh berkas yang DIA sendiri buat -
       isi Drive pemakai yang lain tidak terlihat sama sekali.
       userinfo.email: supaya proxy AI bisa memastikan siapa yang memanggil.
       Keduanya tidak dianggap sensitif oleh Google, jadi tidak perlu
       peninjauan dan layar izinnya tidak menakutkan. */
    lingkup: 'https://www.googleapis.com/auth/drive.file ' +
             'https://www.googleapis.com/auth/userinfo.email'
  };
})(window);
