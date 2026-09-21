/* ============================================================================
   Drop Note — pembaca PDF
   ============================================================================
   KENAPA MESIN SENDIRI, BUKAN PERAMBANNYA. Chrome di Android MENOLAK
   menggambar PDF di dalam '<iframe>' / '<embed>' / '<object>' - yang dia
   tawarkan mengunduhnya. Itu bukan cacat yang sedang diperbaiki, itu perilaku
   yang sudah bertahun-tahun begitu, dan tidak ada akal-akalan HTML yang
   menolong. Karena aplikasi ini dipakai di HP, jalan gratis itu tertutup
   sejak awal: menggambar PDF di sini berarti membawa mesinnya sendiri.

   PUSTAKANYA DIMUAT MALAS, DAN ITU ATURAN - BUKAN OPTIMASI.
   pdf.mjs + pdf.worker.mjs = 1,8 MB. Seluruh aplikasi ini 936 KB. Jadi
   pustakanya DUA KALI LIPAT aplikasinya sendiri, untuk layar yang dibuka
   sesekali. Kalau dia ikut 'KERANGKA' di sw.js, tiap pemasangan dan tiap
   terbitan baru menyeret 1,8 MB - dibayar setiap orang, setiap kali, untuk
   sesuatu yang kebanyakan hari tidak dipakai. Jadi dia BARU diambil waktu
   PDF pertama dibuka, lalu disinggahkan di ember terpisah yang namanya
   bernomor versi ('pustaka-pdfjs-…', lihat sw.js) - ember itu tidak dibuang
   'activate', jadi sekali terunduh dia tinggal, dan terbitan baru aplikasi
   tidak memaksanya turun lagi.

   'import()' dinamis, bukan '<script type=module>' di index.html: yang kedua
   berangkat waktu halaman dimuat, dan itu persis yang dilarang di atas.
   Tidak ada build step - peramban modern menjalankan modul apa adanya, jadi
   aturan "buka berkasnya, jalan" tetap utuh.

   TIDAK MENYIMPAN APA-APA. Dia alat, sekelas kalkulator: buka, baca, tutup.
   Sorotan, catatan tempel, dan tanda tangan SENGAJA tidak ada - itu editor,
   bukan pembaca, dan editor menuntut penyimpanan, versi, dan resolusi
   konflik. Yang dibuka di sini berkas yang sudah kamu punya.
   ============================================================================ */
(function (global) {
  'use strict';

  /* Versinya ikut di nama ember singgahan (sw.js), jadi menaikkannya di sini
     otomatis membuat ember baru dan meninggalkan yang lama untuk dibuang. */
  var VERSI = '6.3.289';
  var JALUR = './pustaka/pdfjs/';

  var pustaka = null;      /* modul yang sudah termuat */
  var sedangMuat = null;   /* janji yang sedang berjalan - supaya dua ketukan
                              cepat tidak mengunduh 1,8 MB dua kali */

  /* SUDAH TERUNDUH ATAU BELUM, DAN INI DIPAKAI LAYARNYA UNTUK JUJUR.
     Unduhan 1,8 MB di sinyal seadanya bisa belasan detik. Layar yang diam
     selama itu terbaca "tombolnya tidak berfungsi" - jadi layarnya wajib
     bisa bertanya "ini unduhan pertama atau bukan", dan mengatakannya. */
  function siap() { return !!pustaka; }

  /* Satu-satunya pintu ke pustakanya. Semua yang butuh PDF.js lewat sini,
     jadi tidak ada satu jalur pun yang bisa diam-diam memuatnya lebih awal. */
  function muat() {
    if (pustaka) return Promise.resolve(pustaka);
    if (sedangMuat) return sedangMuat;
    sedangMuat = import(JALUR + 'pdf.mjs').then(function (mod) {
      /* Workernya WAJIB versi yang sama persis dengan intinya. Karena
         keduanya kita yang menaruh, di folder yang sama, itu terjamin -
         dan itu sebabnya pustakanya ditanam, bukan diambil dari CDN. */
      mod.GlobalWorkerOptions.workerSrc = new URL(
        JALUR + 'pdf.worker.mjs', global.location.href
      ).href;
      pustaka = mod;
      return mod;
    }).catch(function (e) {
      /* Gagal memuat TIDAK boleh menyandera percobaan berikutnya: kalau
         janjinya dibiarkan menggantung, satu kegagalan jaringan membuat
         tombolnya mati selamanya sampai aplikasinya dimuat ulang. */
      sedangMuat = null;
      throw e;
    });
    return sedangMuat;
  }

  /* ------------------------------------------------------------------ buka */

  /* Menerima Blob/File. Dibaca jadi ArrayBuffer dulu, bukan diserahkan
     sebagai URL: blob URL punya umur, dan PDF besar yang masih digambar
     waktu URL-nya dicabut berhenti di tengah tanpa satu galat pun. */
  function bukaBlob(blob) {
    return muat().then(function (mod) {
      return blob.arrayBuffer().then(function (buf) {
        return mod.getDocument({ data: new Uint8Array(buf) }).promise;
      });
    });
  }

  /* ===== MELEPAS DOKUMEN LEWAT 'loadingTask', BUKAN LEWAT DOKUMENNYA =====
     Ini bekas luka, dan dia ditemukan dengan mengukur - tidak dari layar mana
     pun. Kodenya dulu memanggil 'dok.destroy()' di dalam try/catch, dan
     'PDFDocumentProxy' TIDAK PUNYA 'destroy' sama sekali di PDF.js v6: yang
     punya 'loadingTask'-nya. Jadi panggilannya melempar TypeError, ditelan
     catch-nya, dan pelepasannya tidak pernah terjadi - tanpa satu galat pun
     di mana pun.

     Akibatnya sebanding dengan dokumennya: di lima halaman tidak terlihat,
     di dua ratus lembar gambar kerja CAD setiap dokumen yang pernah dibuka
     tinggal utuh di memori bersama worker-nya sampai tab-nya mati.

     Pelajarannya bukan "jangan pakai try/catch" tapi "jangan menelan galat
     dari panggilan yang KAMU yang menentukan bentuknya". catch di sini cuma
     untuk dokumen yang sudah terlanjur rusak, bukan untuk menutupi API yang
     salah panggil - jadi keberadaan fungsinya dijaga uji terima, bukan
     diserahkan ke catch. */
  function lepas(dok) {
    if (!dok) return;
    var tugas = dok.loadingTask;
    if (tugas && typeof tugas.destroy === 'function') {
      try { tugas.destroy(); } catch (e) {}
      return;
    }
    /* Jalan mundur kalau suatu hari bentuknya berubah lagi: 'cleanup' tidak
       mematikan worker-nya, tapi dia melepas halaman yang sudah terurai -
       separuh jalan jauh lebih baik daripada tidak sama sekali. */
    if (dok.cleanup) { try { dok.cleanup(); } catch (e) {} }
  }

  /* --------------------------------------------------------------- gambar */

  /* SKALA DIHITUNG DARI LEBAR YANG TERSEDIA, bukan dipatok angka. Satu PDF
     bisa A4 tegak, A3 rebah, atau struk kasir selebar 8 cm - skala tetap
     berarti dua di antaranya selalu salah. Yang dipakai 'fit width': itu
     yang dituju mata di layar sempit, dan itu juga yang dipakai tiap pembaca
     PDF di HP. */
  function skalaMuat(halaman, lebarTersedia, zoom) {
    var asli = halaman.getViewport({ scale: 1 });
    if (!asli.width) return zoom || 1;
    return (lebarTersedia / asli.width) * (zoom || 1);
  }

  /* Rasio piksel perangkat DIPAKAI, tapi DIBATASI 2. Di HP ber-DPR 3 dan
     PDF A4, kanvasnya jadi 2480x3508 piksel per halaman - tiga halaman saja
     sudah ratusan megabyte dan tab-nya dibunuh sistem tanpa pesan apa pun.
     Selisih 2 lawan 3 hampir tidak terlihat mata; selisih hidup dan mati
     tab-nya jelas terlihat. */
  var DPR_MAKS = 2;

  /* 'lapor' menerima RenderTask-nya supaya pemanggil bisa MEMBATALKAN.
     Itu bukan kerapian: halaman yang tergulir lewat waktu jarimu cepat masih
     punya pekerjaan di worker, dan pekerjaan yang tidak pernah dibatalkan
     mengantre di depan halaman yang SEDANG kamu lihat. Di dokumen 500
     halaman, menggulir cepat tanpa pembatalan berarti antrean panjang berisi
     halaman yang sudah lama lewat. */
  function gambarHalaman(halaman, kanvas, lebarTersedia, zoom, lapor) {
    var skala = skalaMuat(halaman, lebarTersedia, zoom);
    var lihat = halaman.getViewport({ scale: skala });
    var dpr = Math.min(global.devicePixelRatio || 1, DPR_MAKS);

    kanvas.width = Math.floor(lihat.width * dpr);
    kanvas.height = Math.floor(lihat.height * dpr);
    /* Ukuran CSS-nya yang menentukan tata letak; ukuran piksel di atas cuma
       menentukan ketajamannya. Dua-duanya wajib, dan lupa yang kedua adalah
       cara paling cepat mendapat PDF yang buram di HP. */
    kanvas.style.width = Math.floor(lihat.width) + 'px';
    kanvas.style.height = Math.floor(lihat.height) + 'px';

    var ktx = kanvas.getContext('2d');
    var tugas = halaman.render({
      canvasContext: ktx,
      viewport: lihat,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
    });
    if (typeof lapor === 'function') lapor(tugas);
    /* Pembatalan BUKAN kegagalan. 'RenderingCancelledException' adalah
       jawaban yang benar untuk halaman yang sudah tergulir lewat, jadi dia
       ditelan di sini - kalau tidak, tiap geseran cepat menumpahkan galat
       yang tidak menandakan apa pun. Galat LAIN tetap dilempar. */
    return tugas.promise.catch(function (e) {
      if (e && e.name === 'RenderingCancelledException') return null;
      throw e;
    });
  }

  global.TPdf = {
    VERSI: VERSI,
    JALUR: JALUR,
    siap: siap,
    muat: muat,
    bukaBlob: bukaBlob,
    lepas: lepas,
    gambarHalaman: gambarHalaman,
    skalaMuatUji: skalaMuat
  };
})(window);
