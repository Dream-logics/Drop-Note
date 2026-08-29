/* ============================================================================
   Sinkron — cadangan ke Drive & Sheets milik pemakainya sendiri
   ============================================================================
   Lapis kedua, bukan pasangan sinkron dua arah. Kebenaran tetap di IndexedDB
   di HP; awan adalah brankas.

   SATU ARAH (HP -> awan) dengan satu pengecualian: menghapus.

   Kalau menghapus tidak ikut naik, baris yang sudah dibuang di HP akan hidup
   lagi begitu dipulihkan - dan wadah "sekali pakai" kembali jadi wadah yang
   tidak pernah kosong. Itu penyakit yang justru mau disembuhkan aplikasi ini.
   Jadi penghapusan punya nisan (`dihapus`) yang naik, menghapus barisnya di
   Sheet dan berkasnya di Drive, baru dibuang dari HP.

   BERKAS

   Blob mentah dibuang dari HP setelah selamat sampai Drive; yang ditahan cuma
   thumbnail. Ratusan dokumen akan memenuhi kuota IndexedDB dalam hitungan
   bulan, dan kuota penuh artinya drop mulai gagal - pelanggaran aturan nomor
   satu. Daftar tetap seketika karena thumbnail-nya lokal.
   ============================================================================ */
(function (global) {
  'use strict';

  var SEKALI = 100;              /* baris per kiriman */
  var POTONG_MAKS = 6;
  var BERKAS_SEKALI = 3;         /* unggahan per putaran; sisanya menyusul */
  var JEDA = 30 * 60 * 1000;
  var jalan = false;

  function nyala(s) {
    return !!(s && s.cadanganNyala && ((s.clientId || TBawaan.clientId)));
  }

  function catat(setelan, kunci, nilai) {
    setelan[kunci] = nilai;
    return TSimpan.setel(kunci, nilai);
  }

  function simpanRumah(setelan) {
    return function (r) {
      Object.keys(r).forEach(function (k) { setelan[k] = r[k]; });
      return Promise.all(Object.keys(r).map(function (k) { return TSimpan.setel(k, r[k]); }));
    };
  }

  function rumah(setelan) {
    if (setelan.sheetId && setelan.folderBerkas) {
      return Promise.resolve({
        folderAkar: setelan.folderAkar, folderBerkas: setelan.folderBerkas,
        sheetId: setelan.sheetId, sheetTab: setelan.sheetTab || 'Sheet1'
      });
    }
    return TAwan.siapkanRumah(setelan, simpanRumah(setelan));
  }

  /* -------------------------------------------------------- baris <-> entri */

  function pipihkan(e) {
    return TAwan.KOLOM.map(function (k) {
      if (k === 'label') return (e.label || []).join(' ');
      if (k === 'tag') return (e.tag || []).join(' ');
      if (k === 'elemen') return JSON.stringify(e.elemen || []);
      /* Yang rahasia naik ke Drive sudah berupa sandi - isinya memang sudah
         tersimpan begitu, jadi tidak ada langkah tambahan di sini. */
      if (k === 'elemenTerkunci') return e.elemenTerkunci || '';
      if (k === 'daftar') return JSON.stringify(e.daftar || []);
      if (k === 'riwayat') return JSON.stringify(e.riwayat || []);
      var v = e[k];
      if (v == null) return '';
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      return String(v);
    });
  }

  function mekarkan(r) {
    function urai(t, bawaan) {
      if (Array.isArray(t)) return t;
      try { return JSON.parse(t); } catch (e) { return bawaan; }
    }
    function benar(v) { return v === true || v === 'true' || v === 'TRUE'; }
    return {
      id: String(r.id), jenis: r.jenis || 'teks', judul: r.judul || '',
      judulManual: benar(r.judulManual),
      isi: r.isi == null ? '' : String(r.isi),
      kategori: r.kategori || '',
      label: String(r.label || '').split(' ').filter(Boolean),
      tag: String(r.tag || '').split(' ').filter(Boolean),
      elemen: urai(r.elemen, []),
      rahasia: benar(r.rahasia), elemenTerkunci: r.elemenTerkunci || '',
      selesai: benar(r.selesai), selesaiPada: Number(r.selesaiPada) || 0,
      penting: benar(r.penting), hariIni: Number(r.hariIni) || 0,
      tenggat: Number(r.tenggat) || 0, ulang: r.ulang || '',
      daftar: urai(r.daftar, []),
      berkasId: r.berkasId || null, driveId: r.driveId || null,
      namaBerkas: r.namaBerkas || '', tipeBerkas: r.tipeBerkas || '',
      ukuran: Number(r.ukuran) || 0,
      dibuat: Number(r.dibuat) || 0, diubah: Number(r.diubah) || 0,
      dipakai: Number(r.dipakai) || 0,
      diLabeliAI: benar(r.diLabeliAI), pensiun: benar(r.pensiun),
      dihapus: false, riwayat: urai(r.riwayat, []), thumb: ''
    };
  }

  function antrean(semua, sejak) {
    return semua.filter(function (e) { return !e.dihapus && (e.diubah || 0) > sejak; })
                .sort(function (a, b) { return (a.diubah || 0) - (b.diubah || 0); });
  }

  function belumTerkirim(setelan) {
    var sejak = Number(setelan && setelan.cadanganSampai) || 0;
    return TSimpan.semua().then(function (semua) { return antrean(semua, sejak).length; });
  }

  /* ------------------------------------------------------------ satu putaran */

  function unggahAntre(setelan, sarang) {
    return TSimpan.semua().then(function (semua) {
      var antre = semua.filter(function (e) {
        return e.berkasId && !e.driveId && !e.dihapus;
      }).slice(0, BERKAS_SEKALI);

      return antre.reduce(function (rantai, e) {
        return rantai.then(function () {
          return TSimpan.ambilBerkas(e.berkasId).then(function (b) {
            if (!b || !b.blob) { e.driveId = ''; return null; }
            return TAwan.unggahBerkas(setelan, sarang.folderBerkas, b.blob,
                                      e.namaBerkas || 'berkas', e.tipeBerkas)
              .then(function (id) {
                e.driveId = id;
                /* Baru dibuang SETELAH id-nya di tangan. Kalau urutannya
                   dibalik, satu sinyal putus berarti berkasnya lenyap. */
                return TSimpan.hapusBerkas(e.berkasId).then(function () {
                  e.berkasId = null;
                  return TSimpan.taruh(e);
                });
              });
          });
        });
      }, Promise.resolve()).then(function () { return antre.length; });
    });
  }

  function bersihkanNisan(setelan, sarang) {
    return TSimpan.semua().then(function (semua) {
      var mati = semua.filter(function (e) { return e.dihapus; });
      if (!mati.length) return 0;

      return TAwan.hapusBaris(setelan, sarang, mati.map(function (e) { return e.id; }))
        .then(function () {
          return Promise.all(mati.map(function (e) {
            return e.driveId ? TAwan.hapusBerkas(setelan, e.driveId) : null;
          }));
        })
        .then(function () {
          return Promise.all(mati.map(function (e) {
            return Promise.all([
              e.berkasId ? TSimpan.hapusBerkas(e.berkasId) : null,
              TSimpan.hapus(e.id)
            ]);
          }));
        })
        .then(function () { return mati.length; });
    });
  }

  /* Daftar tag ikut naik ke tab sendiri, dan cuma kalau memang berubah -
     kalau tidak, tiap putaran menulis ulang ratusan baris tanpa guna.
     Gagal di sini tidak boleh menggagalkan cadangannya: tagnya cerminan,
     catatannya yang tidak tergantikan. */
  function cerminTag(setelan, sarang) {
    var tag = setelan.hashtag || [];
    var cap = tag.join(' ');
    if (!tag.length || cap === setelan.hashtagTerkirim) return Promise.resolve();
    return TAwan.tulisTag(setelan, sarang, tag)
      .then(function () { return catat(setelan, 'hashtagTerkirim', cap); })
      .catch(function () { /* diam - dicoba lagi putaran berikutnya */ });
  }

  function putaran(setelan, paksa) {
    if (jalan || !nyala(setelan)) return Promise.resolve(0);
    if (!paksa && (Date.now() - (Number(setelan.cadanganDicoba) || 0)) < JEDA) {
      return Promise.resolve(0);
    }
    jalan = true;
    var naik = 0, sarang = null;

    return catat(setelan, 'cadanganDicoba', Date.now())
      .then(function () { return rumah(setelan); })
      .then(function (r) {
        sarang = r;
        return bersihkanNisan(setelan, sarang);
      })
      .then(function () { return unggahAntre(setelan, sarang); })
      .then(function () { return TSimpan.semua(); })
      .then(function (semua) {
        var antre = antrean(semua, Number(setelan.cadanganSampai) || 0);
        if (!antre.length) return 0;

        var potongan = [];
        for (var i = 0; i < antre.length && potongan.length < POTONG_MAKS; i += SEKALI) {
          potongan.push(antre.slice(i, i + SEKALI));
        }

        /* Berurutan: tiap potongan yang berhasil langsung memajukan batas air,
           jadi sinyal putus di tengah tidak mengulang semuanya besok. */
        return potongan.reduce(function (rantai, bagian) {
          return rantai.then(function () {
            return TAwan.tulisBaris(setelan, sarang, bagian.map(pipihkan)).then(function () {
              naik += bagian.length;
              return catat(setelan, 'cadanganSampai', bagian[bagian.length - 1].diubah || Date.now());
            });
          });
        }, Promise.resolve()).then(function () { return naik; });
      })
      .then(function () { return cerminTag(setelan, sarang); })
      .then(function () {
        return catat(setelan, 'cadanganBerhasil', Date.now())
          .then(function () { return catat(setelan, 'cadanganGalat', ''); })
          .then(function () { return naik; });
      })
      .catch(function (err) {
        /* Diam. Catatannya tetap di HP, antreannya dicoba lagi nanti; pesannya
           cuma disimpan supaya bisa dilihat di Setelan kalau memang dicari. */
        catat(setelan, 'cadanganGalat', err.message);
        if (global.console && console.debug) console.debug('[cadangan tertunda]', err.message);
        return naik;
      })
      .then(function (n) { jalan = false; return n; },
            function () { jalan = false; return naik; });
  }

  /* Menarik balik. Manual, dan sengaja - ini tindakan waktu ganti HP, bukan
     bagian dari hari biasa. */
  function pulihkan(setelan) {
    return rumah(setelan).then(function (sarang) {
      return TAwan.bacaSemuaBaris(setelan, sarang);
    }).then(function (baris) {
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

  function coba(setelan) {
    return rumah(setelan).then(function (sarang) {
      return TAwan.bacaSemuaBaris(setelan, sarang).then(function (b) {
        return { baris: b.length, sheetId: sarang.sheetId };
      });
    });
  }

  global.TSinkron = {
    putaran: putaran, pulihkan: pulihkan, coba: coba, rumah: rumah,
    nyala: nyala, belumTerkirim: belumTerkirim,
    pipihkan: pipihkan, mekarkan: mekarkan
  };
})(window);
