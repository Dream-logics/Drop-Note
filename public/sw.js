/* ============================================================================
   Drop Note — service worker
   ============================================================================
   Dua tugas, dan keduanya soal yang sama: menghilangkan jarak antara "ingin
   menyimpan" dan "tersimpan".

   1. MENYINGGAHKAN KERANGKA. Dibuka tanpa sinyal harus tetap terbuka penuh.
      Kalau sekali saja membuka aplikasi ini memunculkan halaman gagal, orang
      berhenti mempercayainya - dan kepercayaan itu yang bikin dia mau
      menjatuhkan catatan ke sini, bukan ke grup WhatsApp.

   2. MENERIMA "BAGIKAN". Inilah yang menggantikan kebiasaan share-ke-WhatsApp:
      dari aplikasi mana pun, Bagikan -> Drop Note. Wajib POST kalau mau bisa
      menerima berkas; GET cuma cukup untuk teks.

   Bawaannya disimpan lebih dulu ke IndexedDB, baru halaman dibuka. Urutan itu
   penting: kalau bawaannya dititipkan lewat alamat, berkas tidak ikut dan
   teks panjang terpotong.
   ============================================================================ */
'use strict';

/* NAIKKAN ANGKA INI SETIAP KALI SALAH SATU BERKAS KERANGKA BERUBAH.
   Berkas selain halaman diambil dari singgahan dulu, jadi tanpa nama
   singgahan yang baru, HP yang sudah memasang aplikasinya akan terus
   memakai versi lama SELAMANYA - terbitan baru tidak akan pernah sampai.
   'activate' membuang singgahan bernama lain, jadi menaikkannya sudah cukup. */
var SINGGAH = 'singgahan-v135';
var KERANGKA = [
  './', './index.html', './gaya.css',
  './bawaan.js', './bahasa.js', './hitung.js', './simpan.js', './otak.js', './awan.js', './pelabel.js',
  './sinkron.js', './kunci.js', './tugas.js', './alur.js',
  './manifest.webmanifest', './ikon.svg', './ikon-192.png', './ikon-512.png',
  './ikon-tulis-192.png', './ikon-kamera-192.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(SINGGAH).then(function (c) {
      /* addAll gagal total kalau satu berkas saja meleset. Kerangka yang
         tersinggahi sebagian jauh lebih baik daripada tidak sama sekali. */
      return Promise.all(KERANGKA.map(function (u) {
        return c.add(u).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (kunci) {
      return Promise.all(kunci.map(function (k) {
        return k === SINGGAH ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* --------------------------- titipan "bagikan" ---------------------------
   Skema DB-nya sengaja ditulis ulang di sini, sama persis dengan simpan.js.
   Service worker tidak bisa memakai TSimpan (itu hidup di window), dan kalau
   berkas ini membuka DB tanpa skema yang sama, versinya terlanjur naik tanpa
   toko - dan aplikasinya tidak bisa menyimpan apa-apa lagi. */

function bukaDb() {
  return new Promise(function (terima, tolak) {
    var p = indexedDB.open('simpanan', 1);
    p.onupgradeneeded = function (e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains('entri')) {
        var s = d.createObjectStore('entri', { keyPath: 'id' });
        s.createIndex('diubah', 'diubah');
        s.createIndex('kategori', 'kategori');
        s.createIndex('jenis', 'jenis');
      }
      if (!d.objectStoreNames.contains('berkas')) d.createObjectStore('berkas', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('setelan')) d.createObjectStore('setelan', { keyPath: 'kunci' });
    };
    p.onsuccess = function () { terima(p.result); };
    p.onerror = function () { tolak(p.error); };
  });
}

function tulis(toko, nilai) {
  return bukaDb().then(function (d) {
    return new Promise(function (terima, tolak) {
      var t = d.transaction(toko, 'readwrite');
      t.objectStore(toko).put(nilai);
      t.oncomplete = function () { terima(true); };
      t.onerror = function () { tolak(t.error); };
    });
  });
}

function terimaBagikan(permintaan) {
  return permintaan.formData().then(function (f) {
    var judul = f.get('judul') || '';
    var teks = f.get('teks') || '';
    var tautan = f.get('tautan') || '';
    var berkas = f.getAll('berkas').filter(function (b) { return b && b.size; });

    var titipan = {
      kunci: 'bagikanTertunda',
      nilai: {
        judul: String(judul), teks: String(teks), tautan: String(tautan),
        berkasId: null, namaBerkas: '', tipeBerkas: '', ukuran: 0, waktu: Date.now()
      }
    };

    var siap = Promise.resolve();
    if (berkas.length) {
      var b = berkas[0];
      var bid = 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      titipan.nilai.berkasId = bid;
      titipan.nilai.namaBerkas = b.name || 'berkas';
      titipan.nilai.tipeBerkas = b.type || '';
      titipan.nilai.ukuran = b.size || 0;
      siap = tulis('berkas', { id: bid, blob: b, nama: titipan.nilai.namaBerkas, tipe: b.type });
    }

    return siap.then(function () { return tulis('setelan', titipan); });
  }).then(function () {
    return Response.redirect('./?bagikan=1', 303);
  }).catch(function () {
    /* Titipan gagal bukan alasan untuk memunculkan halaman galat - aplikasinya
       tetap dibuka, kotaknya saja yang kosong. */
    return Response.redirect('./', 303);
  });
}

/* --------------------------- pengambilan --------------------------- */

self.addEventListener('fetch', function (ev) {
  var permintaan = ev.request;
  var alamat = new URL(permintaan.url);

  if (permintaan.method === 'POST' && alamat.pathname.endsWith('/bagikan')) {
    ev.respondWith(terimaBagikan(permintaan));
    return;
  }
  if (permintaan.method !== 'GET' || alamat.origin !== self.location.origin) return;

  /* HALAMANNYA DARI SINGGAHAN DULU, SAMA DENGAN SISANYA - dan ini perbaikan
     atas cacat yang menghasilkan laporan lapangan yang tidak masuk akal
     ("tombolnya ada tapi tidak berfungsi", "kotaknya tidak berbingkai").

     Dulu halamannya jaringan-dulu sementara gaya.css dan alur.js
     singgahan-dulu. Akibatnya TIAP TERBITAN BARU, sekali: index.html yang
     terambil versi BARU, sementara gaya dan kodenya masih versi LAMA dari
     singgahan - karena service worker yang baru belum selesai memasang waktu
     berkas-berkas itu diminta. Yang tergambar markup baru tanpa gayanya, dan
     tombol baru yang tidak punya satu pun penangan. Itu bukan "singgahan
     basi" yang hilang sendiri sesudah refresh: itu SATU MUATAN YANG ISINYA
     DUA GENERASI, dan yang melihatnya melaporkannya sebagai fitur yang rusak.

     Sekarang satu muatan selalu satu generasi. Ongkosnya disebut: terbitan
     baru butuh SATU pembukaan lagi sebelum terlihat (yang pertama memasang
     service worker barunya, yang kedua memakainya). Terbitan yang telat satu
     pembukaan jauh lebih murah daripada terbitan yang sampai dalam keadaan
     rusak. */
  if (permintaan.mode === 'navigate') {
    ev.respondWith(
      caches.match('./index.html').then(function (r) {
        return r || fetch(permintaan).catch(function () {
          return new Response('Tidak ada sinyal', { status: 503 });
        });
      })
    );
    return;
  }

  /* MANIFEST SELALU DARI JARINGAN DULU, dan itu satu-satunya berkas yang
     diperlakukan begitu. Sebabnya bukan kesegaran biasa: manifest dibaca
     Android SEKALI, waktu ikonnya dipasang ke layar home, dan dari situ dia
     mencetak WebAPK yang isinya tidak berubah lagi. Kalau yang dibacanya
     salinan lama dari singgahan, shortcut "Tulis" dan "Kamera" tidak akan
     pernah ada di ikonnya - dan memasang ulang berapa kali pun tidak menolong,
     karena yang dibaca ulang tetap salinan yang sama.

     Jatuh ke singgahan kalau jaringannya mati: manifest yang tidak terbaca
     berarti aplikasinya berhenti bisa dipasang sama sekali. */
  if (alamat.pathname.endsWith('/manifest.webmanifest')) {
    ev.respondWith(
      fetch(permintaan).then(function (jawab) {
        if (jawab && jawab.ok && jawab.type === 'basic') {
          var salinan = jawab.clone();
          caches.open(SINGGAH).then(function (c) { c.put(permintaan, salinan); });
        }
        return jawab;
      }).catch(function () {
        return caches.match(permintaan).then(function (r) {
          return r || new Response('{}', { headers: { 'Content-Type': 'application/manifest+json' } });
        });
      })
    );
    return;
  }

  ev.respondWith(
    caches.match(permintaan).then(function (tersinggah) {
      if (tersinggah) return tersinggah;
      return fetch(permintaan).then(function (jawab) {
        if (jawab && jawab.ok && jawab.type === 'basic') {
          var salinan = jawab.clone();
          caches.open(SINGGAH).then(function (c) { c.put(permintaan, salinan); });
        }
        return jawab;
      });
    })
  );
});
