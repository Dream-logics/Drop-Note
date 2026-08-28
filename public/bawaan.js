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
    nama: 'Drop Memory',
    tagline: 'Simpan dulu, cari nanti.',

    /* Model Gemini. Flash-Lite dipilih bukan karena murah saja: tugasnya cuma
       memberi judul dan kata kunci, dan model terkecil sudah cukup untuk itu.
       Yang memakainya adalah proxy, bukan aplikasi ini. */
    model: 'gemini-3.5-flash-lite',

    /* Tag yang pasti sering dipakai, ditanam sekali supaya AI punya rak yang
       benar sejak catatan pertama - bukan setelah sebulan meraba-raba.
       Ini cuma NILAI AWAL: begitu aplikasinya dipasang, daftarnya jadi milik
       pemakainya dan disunting di Setelan. Mengubah baris ini tidak menyentuh
       daftar yang sudah terlanjur ada di HP siapa pun. */
    tagAwal: ['MAP', 'ProjectSpace', 'Ngoffee', 'AmaraLiving', 'Ultima',
              'ShamiraWeb', 'ShamiraCreative', 'Resep', 'IdeBisnis',
              'linkdev', 'linkexec', 'prompt', 'script', 'password',
              'Akun', 'titip'],

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
