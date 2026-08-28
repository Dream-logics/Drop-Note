/* ============================================================================
   Drop Note — cadangan ke Google Sheets
   ============================================================================
   Lapis kedua, dan cuma itu. Kebenaran tetap ada di IndexedDB di HP; Sheet
   adalah brankas. Bukan sumber, bukan pasangan sinkron dua arah.

   KENAPA SATU ARAH SAJA (DB -> Sheet)

   Begitu dua arah, kamu langsung punya pertanyaan "versi mana yang menang"
   tiap kali satu entri disunting di dua tempat. Menjawabnya menuntut
   keputusan, dan keputusan adalah ongkos yang aplikasi ini dibangun untuk
   menghapusnya. Jadi: mengirim itu otomatis dan diam; menarik balik itu
   manual, satu tombol di Setelan, dipakai sekali waktu ganti HP.

   KENAPA TIDAK DI JALUR DROP

   Sama seperti pelabelan: nge-drop tidak boleh menunggu jaringan sedetik pun.
   Pengiriman berjalan saat aplikasi dibuka, di belakang layar, atas antrean
   yang tertinggal. Gagal itu wajar dan tidak dilaporkan - dicoba lagi nanti,
   dan tidak ada yang hilang kalau dia tidak pernah jalan sama sekali.

   YANG TIDAK IKUT

   Isi berkas (gambar, rekaman) tidak dikirim. Sheet cuma muat teks, dan satu
   cadangan berisi foto akan gagal di tengah jalan. Yang dijamin adalah bagian
   yang tidak tergantikan: tulisannya.
   ============================================================================ */
(function (global) {
  'use strict';

  var SEKALI = 100;               /* entri per kiriman */
  var POTONG_MAKS = 6;            /* batas kiriman per sesi; sisanya menyusul */
  var JEDA = 30 * 60 * 1000;      /* jangan menembak berulang dalam satu sesi */
  var jalan = false;

  function alamat(s) { return ((s && s.alamatScript) || '').trim(); }
  function sandi(s) { return ((s && s.sandiScript) || '').trim(); }
  function nyala(s) { return !!(s && s.cadanganNyala && alamat(s)); }

  /* Menulis ke DB sekaligus ke salinan di memori, supaya layar Setelan tidak
     perlu memuat ulang cuma untuk tahu kapan terakhir berhasil. */
  function catat(setelan, kunci, nilai) {
    setelan[kunci] = nilai;
    return TSimpan.setel(kunci, nilai);
  }

  function kirim(setelan, muatan) {
    muatan.sandi = sandi(setelan);
    return fetch(alamat(setelan), {
      method: 'POST',
      /* text/plain sengaja, alasannya sama seperti di pelabel.js: supaya CORS
         menganggapnya permintaan sederhana dan tidak mengirim preflight
         OPTIONS - yang tidak dijawab Apps Script. */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(muatan)
    }).then(function (r) {
      if (!r.ok) throw new Error('Apps Script menjawab ' + r.status);
      return r.text();
    }).then(function (t) {
      var j;
      try { j = JSON.parse(t); } catch (e) { throw new Error('Jawabannya tidak dikenali'); }
      if (j && j.galat) throw new Error(j.galat);
      return j || {};
    });
  }

  /* Entri dipipihkan jadi satu baris: Sheet tidak punya larik maupun objek. */
  function pipihkan(e) {
    return {
      id: e.id,
      jenis: e.jenis || 'teks',
      judul: e.judul || '',
      judulManual: !!e.judulManual,
      isi: e.isi || '',
      kategori: e.kategori || '',
      label: (e.label || []).join(' '),
      daftar: JSON.stringify(e.daftar || []),
      berkasId: e.berkasId || '',
      namaBerkas: e.namaBerkas || '',
      tipeBerkas: e.tipeBerkas || '',
      ukuran: e.ukuran || 0,
      dibuat: e.dibuat || 0,
      diubah: e.diubah || 0,
      dipakai: e.dipakai || 0,
      diLabeliAI: !!e.diLabeliAI,
      pensiun: !!e.pensiun,
      riwayat: JSON.stringify(e.riwayat || [])
    };
  }

  function mekarkan(r) {
    function urai(t, bawaan) {
      if (Array.isArray(t)) return t;
      try { return JSON.parse(t); } catch (e) { return bawaan; }
    }
    function benar(v) { return v === true || v === 'true' || v === 'TRUE'; }
    return {
      id: String(r.id),
      jenis: r.jenis || 'teks',
      judul: r.judul || '',
      judulManual: benar(r.judulManual),
      isi: r.isi == null ? '' : String(r.isi),
      kategori: r.kategori || '',
      label: String(r.label || '').split(' ').filter(Boolean),
      daftar: urai(r.daftar, []),
      berkasId: r.berkasId || null,
      namaBerkas: r.namaBerkas || '',
      tipeBerkas: r.tipeBerkas || '',
      ukuran: Number(r.ukuran) || 0,
      dibuat: Number(r.dibuat) || 0,
      diubah: Number(r.diubah) || 0,
      dipakai: Number(r.dipakai) || 0,
      diLabeliAI: benar(r.diLabeliAI),
      pensiun: benar(r.pensiun),
      riwayat: urai(r.riwayat, [])
    };
  }

  function antrean(semua, sejak) {
    return semua.filter(function (e) { return (e.diubah || 0) > sejak; })
                .sort(function (a, b) { return (a.diubah || 0) - (b.diubah || 0); });
  }

  function belumTerkirim(setelan) {
    var sejak = Number(setelan && setelan.cadanganSampai) || 0;
    return TSimpan.semua().then(function (semua) { return antrean(semua, sejak).length; });
  }

  /* Satu putaran pengiriman. Mengembalikan jumlah entri yang berhasil naik;
     0 berarti tidak ada kerjaan, belum waktunya, atau gagal - dan ketiganya
     sama-sama bukan kabar buruk buat pemakainya. */
  function putaran(setelan, paksa) {
    if (jalan || !nyala(setelan)) return Promise.resolve(0);
    if (!paksa && (Date.now() - (Number(setelan.cadanganDicoba) || 0)) < JEDA) {
      return Promise.resolve(0);
    }
    jalan = true;
    var naik = 0;

    return catat(setelan, 'cadanganDicoba', Date.now()).then(function () {
      return TSimpan.semua();
    }).then(function (semua) {
      var antre = antrean(semua, Number(setelan.cadanganSampai) || 0);
      if (!antre.length) return 0;

      var potongan = [];
      for (var i = 0; i < antre.length && potongan.length < POTONG_MAKS; i += SEKALI) {
        potongan.push(antre.slice(i, i + SEKALI));
      }

      /* Berurutan, bukan serentak: tiap potongan yang berhasil langsung
         memajukan batas air. Kalau sinyal putus di tengah, yang sudah naik
         tidak dikirim ulang besok. */
      return potongan.reduce(function (rantai, bagian) {
        return rantai.then(function () {
          return kirim(setelan, { tugas: 'sinkron', entri: bagian.map(pipihkan) })
            .then(function () {
              naik += bagian.length;
              return catat(setelan, 'cadanganSampai', bagian[bagian.length - 1].diubah || Date.now());
            });
        });
      }, Promise.resolve()).then(function () {
        return catat(setelan, 'cadanganBerhasil', Date.now())
          .then(function () { return catat(setelan, 'cadanganGalat', ''); })
          .then(function () { return naik; });
      });
    }).catch(function (err) {
      /* Sengaja diam. Catatannya tetap tersimpan di HP dan antreannya dicoba
         lagi nanti; pesannya cuma disimpan supaya bisa dilihat di Setelan
         kalau memang dicari. */
      catat(setelan, 'cadanganGalat', err.message);
      if (global.console && console.debug) console.debug('[Drop Note] cadangan tertunda:', err.message);
      return naik;
    }).then(function (n) { jalan = false; return n; },
            function () { jalan = false; return naik; });
  }

  /* Menarik balik dari Sheet. Manual, dan sengaja begitu - ini tindakan
     sekali seumur hidup waktu ganti HP, bukan bagian dari hari biasa. */
  function pulihkan(setelan) {
    return kirim(setelan, { tugas: 'pulihkan' }).then(function (j) {
      var baris = (j && j.entri) || [];
      return TSimpan.semua().then(function (semua) {
        var punya = {};
        semua.forEach(function (e) { punya[e.id] = e; });

        var tulis = [];
        baris.forEach(function (r) {
          if (!r || !r.id) return;
          var baru = mekarkan(r);
          var lama = punya[baru.id];
          /* Yang di HP menang kalau sama baru atau lebih baru. Memulihkan
             tidak boleh memundurkan tulisan yang belum sempat naik. */
          if (lama && (lama.diubah || 0) >= (baru.diubah || 0)) return;
          tulis.push(TSimpan.taruh(baru));
        });
        return Promise.all(tulis).then(function () { return tulis.length; });
      });
    });
  }

  /* Uji dari layar Setelan - satu-satunya tempat kegagalan boleh berisik. */
  function coba(setelan) {
    return kirim(setelan, { tugas: 'halo' });
  }

  global.TSinkron = {
    putaran: putaran, pulihkan: pulihkan, coba: coba,
    nyala: nyala, belumTerkirim: belumTerkirim,
    pipihkan: pipihkan, mekarkan: mekarkan
  };
})(window);
