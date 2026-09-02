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
  /* Dorongan berkala. Turun dari 30 menit ke 5: dengan empat perangkat,
     setengah jam berarti catatan yang ditulis di laptop belum ada di HP waktu
     kamu sudah berdiri di lokasi. Dorongan yang dipicu perubahan (lihat
     sundulNaik di alur.js) yang mengerjakan sebagian besar; angka ini
     jaring pengamannya, untuk perubahan yang terlewat karena aplikasinya
     keburu ditutup. */
  var JEDA = 5 * 60 * 1000;
  var jalan = false;
  var menarik = false;

  /* Penjaga "belum pernah tersambung" TIDAK ditaruh di sini, dan itu disengaja.
     Sempat dicoba - nyala() menuntut sheetId - dan akibatnya perangkat KEDUA
     tidak pernah bisa menyusul: rumahnya sudah ada di Drive, tapi perangkat itu
     belum punya sheetId, jadi sinkronnya tidak pernah jalan untuk mengambilnya.
     Yang benar satu penjaga di ambilToken(): permintaan diam-diam gagal
     seketika kalau perangkat ini belum pernah tersambung, jadi tidak ada
     jendela Google yang terbuka sendiri - sementara begitu tokennya ada,
     seluruh jalur ini jalan apa adanya. */
  function nyala(s) {
    return !!(s && s.cadanganNyala && (TBawaan.clientId || s.clientId));
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
      /* Ikut dipulihkan, kalau tidak catatan yang raknya kamu hapus akan
         kembali ke rak itu begitu cadangannya dipulihkan - dan raknya lahir
         lagi bersamanya. */
      rakLepas: benar(r.rakLepas),
      album: r.album || '', sumber: r.sumber || '', driver: r.driver || '',
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
      /* SETELAN IKUT NAIK DI SINI JUGA, bukan cuma waktu menarik. Perangkat
         yang cuma pernah mendorong - dan itu keadaan yang normal untuk HP yang
         dipakai memotret seharian - tidak akan pernah mengirim pohon board
         dan daftar foldernya, jadi perangkat lain menerima catatannya tanpa
         alamat.
         gabungSetelan dua arah dan idempoten, jadi memanggilnya dari dua
         tempat aman. */
      .then(function () {
        return sinkronSetelan(setelan, sarang).catch(function () { return 0; });
      })
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

  /* ===================== SETELAN YANG IKUT BERPINDAH =====================
     Entrinya sudah ikut lewat Sheet, tapi entri saja tidak cukup. Catatan yang
     sampai di laptop TANPA RAKNYA jatuh semua ke "Belum berlabel" - dan yang
     terbaca di situ bukan "raknya belum ikut", melainkan "aplikasinya kacau".
     Alamat itu bagian dari catatannya, bukan hiasan perangkatnya.

     GARISNYA: yang berpindah cuma ISI KEPALA - daftar dan pustaka yang kamu
     susun sendiri. Tampilan dan sesi tetap milik perangkat masing-masing, dan
     itu bukan kemalasan:

     - Ukuran petak: HP mau petak kecil, PC mau besar. Menyamakannya berarti
       satu perangkat selalu salah.
     - Tema dan bahasa: berganti sendiri tanpa diminta itu yang paling cepat
       bikin orang merasa kehilangan kendali.
     - driverLengket: sesi itu KENYATAAN FISIK - kamu sedang berdiri di masjid
       dengan HP di tangan. Menularkannya ke PC di kantor berarti gambar yang
       diunggah di sana berangkat ke AI dengan sudut pandang survey yang tidak
       ada hubungannya, dan salah sudut pandang tidak pernah kamu curigai.
     - Kunci, token, id berkas Drive: milik perangkat dan akunnya sendiri.

     Menangnya per KUNCI, bukan per berkas. Kalau seluruh berkas yang menang,
     menambah satu folder di HP menghapus board yang baru kamu tulis di
     laptop lima menit sebelumnya - dan dengan empat perangkat, kekalahan
     seperti itu terjadi tiap minggu. */
  var BERKAS_SETELAN = 'setelan.json';

  var KUNCI_SINKRON = [
    'label',        /* label rak */
    'board',        /* pohon alamat gambar & catatan */
    'akarTangan',   /* akar yang kamu tambah/namai sendiri - tanpa ini, akarmu
                       turun pangkat jadi interest yatim di perangkat lain */
    'boardAI',      /* baris pohon yang lahir dari akhiran, bukan dari jarimu */
    'akhiran',      /* kosakata yang boleh dipakai AI membuat sub board */
    'folderNote',   /* folder layar Note */
    'namaElemen',
    'ekorJudul',
    'obrolan'       /* riwayat obrolan AI */
  ];

  /* DIBACA SEGAR DARI BASIS DATA, bukan dari salinan setelan di memori.
     Cap waktunya ditulis di dalam TSimpan.setel - jauh dari sini - jadi
     salinan di memori tidak pernah ikut berubah waktu kamu menyunting daftar
     folder. Membacanya dari sana berarti sinkron membandingkan dengan cap
     kemarin, lalu menyimpulkan perubahanmu yang baru saja itu kalah. Yang
     hilang persis perubahan yang paling baru - dan itu yang paling kamu ingat
     pernah kamu buat. */
  function petaWaktu() {
    return TSimpan.setelan('setelanWaktu').then(function (p) {
      return (p && typeof p === 'object') ? p : {};
    }).catch(function () { return {}; });
  }

  /* Digabung DUA ARAH sekaligus: yang lebih baru menang, dari sisi mana pun
     dia datang. Yang dikembalikan bentuk gabungannya plus daftar kunci yang
     berubah di sini - pemanggilnya yang menuliskannya, supaya fungsi ini tetap
     bisa diuji tanpa basis data. */
  function gabungSetelan(lokal, waktuLokal, jauh) {
    var hasil = {}, ubah = [];
    var isiJauh = (jauh && jauh.kunci) || {};
    KUNCI_SINKRON.forEach(function (k) {
      var tl = Number(waktuLokal[k] || 0);
      var j = isiJauh[k];
      var tj = j ? Number(j.t || 0) : 0;
      var adaLokal = lokal[k] !== undefined && lokal[k] !== null;
      /* Seri dimenangkan yang LOKAL. Dua perangkat yang menulis dalam
         milidetik yang sama praktis tidak pernah terjadi; yang sering terjadi
         adalah cap yang sama karena satu perangkat baru saja menarik dari
         yang lain - dan di situ menulis ulang cuma kerja sia-sia. */
      if (j && tj > tl) {
        hasil[k] = { n: j.n, t: tj };
        ubah.push(k);
      } else if (adaLokal) {
        hasil[k] = { n: lokal[k], t: tl || Date.now() };
      } else if (j) {
        hasil[k] = { n: j.n, t: tj };
        ubah.push(k);
      }
    });
    return { kunci: hasil, ubah: ubah };
  }

  function sinkronSetelan(setelan, sarang) {
    var idBerkas = setelan.setelanBerkasId || '';
    var siap = idBerkas ? Promise.resolve({ id: idBerkas })
      : TAwan.cariBerkas(setelan, BERKAS_SETELAN, sarang.folderAkar);
    /* Kalau belum ada sama sekali, jangan dibuat DI SINI - biar tulisJson yang
       membuatnya lewat penjaga balapannya. Membuat di dua tempat berarti
       penjaganya cuma menjaga separuh. */
    return siap.then(function (berkas) {
      if (!berkas) return null;
      return TAwan.bacaJson(setelan, berkas.id).then(function (isi) {
        return { id: berkas.id, isi: isi };
      }).catch(function () { return { id: berkas.id, isi: null }; });
    }).then(function (jauh) {
      return petaWaktu().then(function (wl) { return { jauh: jauh, wl: wl }; });
    }).then(function (d) {
      var jauh = d.jauh;
      var gabung = gabungSetelan(setelan, d.wl, jauh && jauh.isi);
      var tulisLokal = gabung.ubah.map(function (k) {
        setelan[k] = gabung.kunci[k].n;
        return TSimpan.setel(k, gabung.kunci[k].n);
      });
      return Promise.all(tulisLokal).then(function () {
        /* Cap waktu yang datang dari jauh ditulis ulang APA ADANYA. TSimpan
           mencapnya "sekarang" waktu menyimpan, dan kalau dibiarkan, nilai
           yang baru saja ditarik dari HP akan terlihat lebih baru daripada
           aslinya - lalu dia balik menimpa perubahan yang lebih baru di sana. */
        if (!gabung.ubah.length) return null;
        return petaWaktu().then(function (peta) {
          gabung.ubah.forEach(function (k) { peta[k] = gabung.kunci[k].t; });
          setelan.setelanWaktu = peta;
          return TSimpan.setel('setelanWaktu', peta);
        });
      }).then(function () {
        return TAwan.tulisJson(setelan, sarang.folderAkar, BERKAS_SETELAN,
                               { kunci: gabung.kunci }, jauh && jauh.id);
      }).then(function (id) {
        if (id && id !== setelan.setelanBerkasId) return catat(setelan, 'setelanBerkasId', id);
        return null;
      }).then(function () { return gabung.ubah.length; });
    });
  }

  /* ===================== TARIK =====================
     Dulu manual, dan itu benar selama ini cuma aplikasi HP: menarik balik
     adalah tindakan waktu ganti perangkat, bukan bagian dari hari biasa.

     Dengan empat perangkat, itu berhenti benar. Catatan ditulis di laptop,
     dibutuhkan di HP sepuluh menit kemudian - dan kalau layarnya kosong
     sampai kamu ingat menekan tombol Pulihkan, yang terbaca bukan "belum
     saya tarik", melainkan "datanya hilang". Sekali itu terbaca, kepercayaan
     yang bikin orang mau menjatuhkan catatan ke sini ikut hilang.

     Jadi sekarang dia jalan sendiri waktu aplikasinya dibuka. Yang TIDAK
     berubah: dia tetap tidak pernah menyentuh jalur drop, tetap boleh gagal
     diam-diam, dan tetap kalah oleh yang lebih baru di perangkat ini. */
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

  /* Tarik yang jalan sendiri. Bedanya dengan pulihkan(): dia MEMERIKSA DULU
     apakah memang ada yang baru, dan berhenti kalau tidak.

     Itu bukan penghematan kecil. Menarik seluruh tabel dua puluh ribu baris
     tiap kali aplikasinya dibuka adalah ongkos yang dibayar setiap hari untuk
     jawaban yang hampir selalu "tidak ada yang baru" - dan di HP dengan sinyal
     seadanya, ongkos itu terasa sebagai aplikasi yang lambat dibuka. Satu
     panggilan modifiedTime menggantikannya.

     Setelan tetap disinkronkan walau tabelnya tidak berubah: menambah satu
     folder tidak menyentuh Sheet sama sekali, jadi kalau ikut dilewati, daftar
     folder tidak akan pernah berpindah perangkat. */
  function tarik(setelan, paksa) {
    if (menarik || !nyala(setelan)) return Promise.resolve(0);
    menarik = true;
    var sarang = null, ubah = 0;
    return rumah(setelan).then(function (r) {
      sarang = r;
      return sinkronSetelan(setelan, sarang).catch(function () { return 0; });
    }).then(function (n) {
      ubah += (n || 0);
      return TAwan.waktuBerkas(setelan, sarang.sheetId).catch(function () { return 0; });
    }).then(function (waktu) {
      /* ===== DUA JAM YANG BERBEDA TIDAK PERNAH DIBANDINGKAN =====
         'tarikCap' menyimpan modifiedTime SPREADSHEET-NYA - jam servernya
         Google. Dulu, kalau pemeriksaan modifiedTime gagal (sinyal putus,
         berkasnya sedang dikunci, medan apa pun), waktu-nya jadi 0 dan yang
         DICATAT malah Date.now() - jam LOKAL perangkat ini.

         Sejak saat itu perangkat itu membandingkan jam server dengan jam
         lokalnya sendiri. Spreadsheet yang diubah HP dua puluh menit lalu
         punya modifiedTime yang LEBIH KECIL daripada "sekarang" yang terlanjur
         tercatat, jadi jawabannya selalu "tidak ada yang baru" - dan pulihkan()
         tidak pernah dijalankan lagi. Selamanya.

         Yang terlihat di layar justru sehat: pemeriksaannya berhasil, jadi
         "Terakhir menarik: baru saja" - padahal yang berhasil cuma
         memeriksanya, bukan menariknya. Laptop berisi 11 catatan sementara HP
         berisi 55, dan dua-duanya melapor baik-baik saja.

         Sekarang capnya cuma diisi kalau waktunya MEMANG dari Google. Kalau
         tidak terbaca, tariknya tetap jalan dan capnya dibiarkan - lebih baik
         menarik sekali lagi tanpa perlu daripada berhenti menarik selamanya. */
      var lalu = Number(setelan.tarikCap) || 0;
      if (!paksa && waktu && waktu <= lalu) return 0;
      return pulihkan(setelan).then(function (n) {
        /* Batas airnya dimajukan SESUDAH berhasil, bukan sebelum: tarikan yang
           putus di tengah harus diulang, bukan dilewati. */
        if (!waktu) return n;
        return catat(setelan, 'tarikCap', waktu).then(function () { return n; });
      });
    }).then(function (n) {
      ubah += (n || 0);
      /* Dicatat walau tidak ada yang berubah: yang dijawab baris ini di layar
         bukan "berapa yang turun" tapi "kapan terakhir dia benar-benar
         memeriksa" - dan "tidak ada yang baru" itu pemeriksaan yang berhasil,
         bukan yang gagal. */
      return catat(setelan, 'tarikBerhasil', Date.now())
        .then(function () { return catat(setelan, 'tarikGalat', ''); })
        .then(function () { return ubah; });
    }).catch(function (err) {
      /* Diam, seperti semua yang di berkas ini. Yang di perangkat tetap utuh;
         yang gagal cuma pertemuannya dengan perangkat lain. */
      catat(setelan, 'tarikGalat', err.message);
      if (global.console && console.debug) console.debug('[tarik tertunda]', err.message);
      return ubah;
    }).then(function (n) { menarik = false; return n; },
            function () { menarik = false; return ubah; });
  }

  function coba(setelan) {
    return rumah(setelan).then(function (sarang) {
      return TAwan.bacaSemuaBaris(setelan, sarang).then(function (b) {
        return { baris: b.length, sheetId: sarang.sheetId };
      });
    });
  }

  global.TSinkron = {
    putaran: putaran, pulihkan: pulihkan, tarik: tarik, coba: coba, rumah: rumah,
    nyala: nyala, belumTerkirim: belumTerkirim,
    pipihkan: pipihkan, mekarkan: mekarkan,
    gabungSetelan: gabungSetelan, KUNCI_SINKRON: KUNCI_SINKRON
  };
})(window);
