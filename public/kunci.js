/* ============================================================================
   Kunci — enkripsi selektif untuk yang memang rahasia
   ============================================================================
   Kenapa SELEKTIF, bukan semuanya:

   Mengunci seluruh timbunan terdengar lebih aman, dan itu jebakannya. Kalau
   semuanya terkunci, pencarian mati (dia jalan di atas teks biasa, di
   perangkat, tanpa jaringan) dan tiap membuka aplikasi menuntut sandi. Dua-
   duanya membunuh kebiasaan yang justru bikin aplikasi ini hidup: nge-drop
   tanpa mikir, cari tanpa nunggu. Yang aman tapi tidak dipakai bukan aman -
   dia cuma tidak ada.

   Jadi yang dikunci cuma yang kamu tandai sendiri, dan cuma bagian yang
   memang rahasia:

     TERKUNCI   isi, elemen        <- yang tidak boleh terbaca siapa pun
     TERBUKA    judul, tag, label  <- supaya tetap BISA DITEMUKAN

   Itu tukar-tambah yang disengaja. Kamu tetap bisa menemukan "Client Secret
   Cortex Space" lewat pencarian; yang tidak bisa dilakukan orang lain adalah
   membacanya. Judul yang ikut terkunci berarti catatannya hilang dari
   pencarian - dan catatan yang tidak bisa ditemukan sama saja dengan tidak
   disimpan.

   TIGA JANJI YANG MENENTUKAN

   1. Yang ditandai rahasia TIDAK PERNAH dikirim ke AI. Bukan disaring di
      layanan, tapi tidak pernah berangkat sama sekali (lihat pelabel.js).
   2. Sandinya tidak pernah disimpan, tidak di perangkat, tidak di Drive.
      Yang tersimpan cuma garam dan satu penanda untuk memeriksa sandinya
      benar. Lupa sandi = isinya hilang selamanya, dan itu memang harganya.
   3. Yang naik ke Drive sudah berupa sandi. Spreadsheet cadangannya boleh
      dibaca siapa pun yang bisa masuk akunmu; yang terkunci tetap terkunci.

   AES-GCM 256 bit, kunci diturunkan dari sandimu lewat PBKDF2. Semuanya
   dikerjakan Web Crypto bawaan browser - tanpa pustaka, tanpa npm.
   ============================================================================ */
(function (global) {
  'use strict';

  var AWALAN = 'terkunci1:';     /* penanda di depan teks bersandi */
  var PUTARAN = 310000;          /* putaran PBKDF2 - berat di penebak, sekejap di pemakai */
  var UJI = 'drop-memory-kunci'; /* teks penanda untuk memeriksa sandi */

  /* Kunci hidup di MEMORI saja. Menutup aplikasi berarti terkunci lagi, dan
     itu memang yang diharapkan orang dari kata "terkunci". Menyimpannya di
     penyimpanan berarti sandinya cuma pajangan. */
  var kunciSesi = null;

  function ada() { return !!(global.crypto && global.crypto.subtle); }

  function keBiner(s) { return new TextEncoder().encode(s); }
  function keTeks(b) { return new TextDecoder().decode(b); }

  function ke64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function dari64(s) {
    var b = atob(s), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }

  function turunkan(sandi, garam) {
    return crypto.subtle.importKey('raw', keBiner(sandi), 'PBKDF2', false, ['deriveKey'])
      .then(function (bahan) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: garam, iterations: PUTARAN, hash: 'SHA-256' },
          bahan,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      });
  }

  function sandikan(kunci, teks) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, kunci, keBiner(teks))
      .then(function (buf) { return AWALAN + ke64(iv) + ':' + ke64(buf); });
  }

  function bukaSandi(kunci, teks) {
    var bagian = String(teks).slice(AWALAN.length).split(':');
    if (bagian.length !== 2) return Promise.reject(new Error('Bentuknya tidak dikenali'));
    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: dari64(bagian[0]) }, kunci, dari64(bagian[1])
    ).then(keTeks);
  }

  /* ------------------------------------------------------------ pemasangan */

  function sudahDipasang(setelan) {
    return !!(setelan && setelan.kunciGaram && setelan.kunciUji);
  }

  /* Memasang sandi baru. Yang disimpan cuma garam dan penanda uji - dari
     keduanya sandinya tidak bisa disusun ulang. */
  function pasang(setelan, sandi) {
    if (!ada()) return Promise.reject(new Error('Peramban ini tidak punya Web Crypto'));
    if (!sandi || sandi.length < 6) return Promise.reject(new Error('Sandi minimal 6 huruf'));

    var garam = crypto.getRandomValues(new Uint8Array(16));
    return turunkan(sandi, garam).then(function (k) {
      return sandikan(k, UJI).then(function (penanda) {
        kunciSesi = k;
        setelan.kunciGaram = ke64(garam);
        setelan.kunciUji = penanda;
        return Promise.all([
          TSimpan.setel('kunciGaram', setelan.kunciGaram),
          TSimpan.setel('kunciUji', setelan.kunciUji)
        ]);
      });
    });
  }

  function buka(setelan, sandi) {
    if (!sudahDipasang(setelan)) return Promise.reject(new Error('Kunci belum dipasang'));
    return turunkan(sandi, dari64(setelan.kunciGaram)).then(function (k) {
      return bukaSandi(k, setelan.kunciUji).then(function (hasil) {
        if (hasil !== UJI) throw new Error('Sandinya salah');
        kunciSesi = k;
        return true;
      }, function () { throw new Error('Sandinya salah'); });
    });
  }

  function tutup() { kunciSesi = null; }
  function terbuka() { return !!kunciSesi; }

  /* ------------------------------------------------------------- pemakaian */

  function terkunci(teks) {
    return typeof teks === 'string' && teks.indexOf(AWALAN) === 0;
  }

  function kunciTeks(teks) {
    if (!kunciSesi) return Promise.reject(new Error('Kunci belum dibuka'));
    if (!teks) return Promise.resolve('');
    if (terkunci(teks)) return Promise.resolve(teks);
    return sandikan(kunciSesi, teks);
  }

  function bukaTeks(teks) {
    if (!terkunci(teks)) return Promise.resolve(teks);
    if (!kunciSesi) return Promise.reject(new Error('Kunci belum dibuka'));
    return bukaSandi(kunciSesi, teks);
  }

  /* Satu entri, bolak-balik. Elemen ikut karena di situlah nilainya berada -
     mengunci isi tapi membiarkan elemen sama saja dengan tidak mengunci. */
  function kunciEntri(e) {
    return kunciTeks(e.isi || '').then(function (isi) {
      var punya = (e.elemen || []).length
        ? kunciTeks(JSON.stringify(e.elemen)) : Promise.resolve('');
      return punya.then(function (elemen) {
        e.isi = isi;
        e.elemenTerkunci = elemen;
        e.elemen = [];
        e.rahasia = true;
        /* Judulnya tetap terbuka - itu memang yang membuatnya bisa ditemukan.
           Tapi baris pertama ITU judulnya, dan orang yang menempel kunci API
           buru-buru menempelkannya di baris pertama. Jadi penanda di dalam
           judul disamarkan: katanya tetap, nilainya tidak. Tanpa ini, yang
           paling rahasia justru satu-satunya bagian yang terbaca di
           spreadsheet cadangan. */
        e.judul = TOtak.samarkanPenanda(e.judul);
        /* Ditandai sudah dinilai supaya antrean AI tidak pernah menyentuhnya
           lagi - ini penjaga kedua, setelah saringan di pelabel.js. */
        e.diLabeliAI = true;
        e.diBacaAI = true;
        return e;
      });
    });
  }

  function bukaEntri(e) {
    return bukaTeks(e.isi || '').then(function (isi) {
      var punya = e.elemenTerkunci ? bukaTeks(e.elemenTerkunci) : Promise.resolve('');
      return punya.then(function (elemen) {
        var salinan = {};
        Object.keys(e).forEach(function (k) { salinan[k] = e[k]; });
        salinan.isi = isi;
        try { salinan.elemen = elemen ? JSON.parse(elemen) : []; }
        catch (x) { salinan.elemen = []; }
        return salinan;
      });
    });
  }

  /* Membuka kunci untuk selamanya: isinya dikembalikan jadi teks biasa. */
  function lepasEntri(e) {
    return bukaEntri(e).then(function (bersih) {
      e.isi = bersih.isi;
      e.elemen = bersih.elemen;
      e.elemenTerkunci = '';
      e.rahasia = false;
      return e;
    });
  }

  global.TKunci = {
    ada: ada, pasang: pasang, buka: buka, tutup: tutup, terbuka: terbuka,
    sudahDipasang: sudahDipasang, terkunci: terkunci,
    kunciTeks: kunciTeks, bukaTeks: bukaTeks,
    kunciEntri: kunciEntri, bukaEntri: bukaEntri, lepasEntri: lepasEntri
  };
})(window);
