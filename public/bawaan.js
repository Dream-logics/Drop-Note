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
       Boleh diganti dari layar Setelan. */
    model: 'gemini-3.5-flash-lite',

    /* OAuth Client ID Google. Ini BUKAN rahasia - dia memang terbaca di semua
       aplikasi browser, dan yang menjaganya adalah daftar origin yang kamu
       daftarkan di Google Cloud Console. Kosong di sini berarti pemakainya
       menempelkannya sendiri sekali di layar Setelan. */
    clientId: '',

    /* Hanya drive.file: aplikasi ini cuma bisa menyentuh berkas yang DIA
       sendiri buat. Google tidak menganggapnya cakupan sensitif, jadi tidak
       perlu peninjauan - dan pemakainya tidak perlu menyerahkan seluruh
       Drive-nya cuma untuk mencadangkan catatan. */
    lingkup: 'https://www.googleapis.com/auth/drive.file'
  };
})(window);
