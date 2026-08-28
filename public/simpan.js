/* ============================================================================
   Drop Note — lapis penyimpanan
   ============================================================================
   DUA LAPIS, dan urutannya yang penting:

     1. Lapis cepat  — IndexedDB di perangkat. Semua tulis dan semua cari
                       terjadi di sini. Nol detik, jalan tanpa sinyal, tidak
                       pernah gagal karena jaringan.
     2. Lapis simpan — Google Sheets lewat Apps Script. Menyusul di belakang,
                       tidak pernah ditunggu.

   Kalau lapis 1 dilewati dan kotak masuk langsung menembak jaringan, tiap
   drop jadi menunggu satu-dua detik. Yang berat bukan detiknya - yang berat
   adalah nge-drop berhenti terasa gratis, dan begitu itu terjadi kebiasaannya
   mati. Itu sebabnya urutan ini tidak boleh dibalik.
   ============================================================================ */
(function (global) {
  'use strict';

  /* Nama basis data sengaja tidak menyebut merek. Mengganti nama aplikasi
     tidak boleh membuang timbunan pemakainya - jadi yang satu ini permanen. */
  var NAMA = 'simpanan';
  var VERSI = 1;
  var db = null;

  function buka() {
    if (db) return Promise.resolve(db);
    return new Promise(function (terima, tolak) {
      var p = indexedDB.open(NAMA, VERSI);
      p.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('entri')) {
          var s = d.createObjectStore('entri', { keyPath: 'id' });
          s.createIndex('diubah', 'diubah');
          s.createIndex('kategori', 'kategori');
          s.createIndex('jenis', 'jenis');
        }
        /* Berkas (gambar, pdf, apk, rekaman) disimpan terpisah dari entrinya.
           Kalau blob ikut menempel di entri, tiap pencarian - yang membaca
           SEMUA entri - ikut menyeret puluhan megabita ke memori. */
        if (!d.objectStoreNames.contains('berkas')) d.createObjectStore('berkas', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('setelan')) d.createObjectStore('setelan', { keyPath: 'kunci' });
      };
      p.onsuccess = function () { db = p.result; terima(db); };
      p.onerror = function () { tolak(p.error); };
    });
  }

  function urus(toko, mode, kerja) {
    return buka().then(function (d) {
      return new Promise(function (terima, tolak) {
        var t = d.transaction(toko, mode);
        var hasil;
        var permintaan = kerja(t.objectStore(toko));
        if (permintaan) permintaan.onsuccess = function () { hasil = permintaan.result; };
        t.oncomplete = function () { terima(hasil); };
        t.onerror = function () { tolak(t.error); };
        t.onabort = function () { tolak(t.error); };
      });
    });
  }

  /* ---------------------------- entri ---------------------------- */

  function taruh(entri) { return urus('entri', 'readwrite', function (s) { return s.put(entri); }); }
  function ambil(id) { return urus('entri', 'readonly', function (s) { return s.get(id); }); }
  function hapus(id) { return urus('entri', 'readwrite', function (s) { return s.delete(id); }); }

  function semua() {
    return urus('entri', 'readonly', function (s) { return s.getAll(); }).then(function (a) {
      return (a || []).sort(function (x, y) { return (y.diubah || 0) - (x.diubah || 0); });
    });
  }

  function jumlah() { return urus('entri', 'readonly', function (s) { return s.count(); }); }

  /* ---------------------------- berkas ---------------------------- */

  function taruhBerkas(id, blob, nama, tipe) {
    return urus('berkas', 'readwrite', function (s) {
      return s.put({ id: id, blob: blob, nama: nama, tipe: tipe });
    });
  }
  function ambilBerkas(id) { return urus('berkas', 'readonly', function (s) { return s.get(id); }); }
  function hapusBerkas(id) { return urus('berkas', 'readwrite', function (s) { return s.delete(id); }); }

  /* ---------------------------- setelan ---------------------------- */

  function setel(kunci, nilai) {
    return urus('setelan', 'readwrite', function (s) { return s.put({ kunci: kunci, nilai: nilai }); });
  }
  function setelan(kunci) {
    return urus('setelan', 'readonly', function (s) { return s.get(kunci); }).then(function (r) {
      return r ? r.nilai : null;
    });
  }
  function semuaSetelan() {
    return urus('setelan', 'readonly', function (s) { return s.getAll(); }).then(function (a) {
      var o = {};
      (a || []).forEach(function (r) { o[r.kunci] = r.nilai; });
      return o;
    });
  }

  /* ---------------------------- cadangan ----------------------------
     Ekspor sengaja TIDAK menyertakan isi berkas: satu cadangan bisa jadi
     ratusan megabita dan gagal di tengah jalan di HP. Yang diekspor teksnya
     - bagian yang tidak tergantikan. */

  function ekspor() {
    return Promise.all([semua(), semuaSetelan()]).then(function (r) {
      var setelanAman = {};
      Object.keys(r[1]).forEach(function (k) {
        if (k === 'kunciGemini') return;           /* kunci API tidak ikut ke berkas cadangan */
        setelanAman[k] = r[1][k];
      });
      return {
        aplikasi: 'Drop Note',
        versi: 1,
        waktu: new Date().toISOString(),
        entri: r[0].map(function (e) {
          var s = {};
          Object.keys(e).forEach(function (k) { s[k] = e[k]; });
          return s;
        }),
        setelan: setelanAman
      };
    });
  }

  function impor(data) {
    if (!data || !Array.isArray(data.entri)) return Promise.reject(new Error('Berkas cadangan tidak dikenali'));
    return buka().then(function (d) {
      return new Promise(function (terima, tolak) {
        var t = d.transaction('entri', 'readwrite');
        var s = t.objectStore('entri');
        data.entri.forEach(function (e) { if (e && e.id) s.put(e); });
        t.oncomplete = function () { terima(data.entri.length); };
        t.onerror = function () { tolak(t.error); };
      });
    });
  }

  function kosongkan() {
    return buka().then(function (d) {
      return new Promise(function (terima, tolak) {
        var t = d.transaction(['entri', 'berkas'], 'readwrite');
        t.objectStore('entri').clear();
        t.objectStore('berkas').clear();
        t.oncomplete = function () { terima(true); };
        t.onerror = function () { tolak(t.error); };
      });
    });
  }

  global.TSimpan = {
    buka: buka,
    taruh: taruh, ambil: ambil, hapus: hapus, semua: semua, jumlah: jumlah,
    taruhBerkas: taruhBerkas, ambilBerkas: ambilBerkas, hapusBerkas: hapusBerkas,
    setel: setel, setelan: setelan, semuaSetelan: semuaSetelan,
    ekspor: ekspor, impor: impor, kosongkan: kosongkan
  };
})(window);
