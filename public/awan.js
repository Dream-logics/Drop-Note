/* ============================================================================
   Awan — Google Drive & Sheets, tanpa server dan tanpa pasang-pasangan
   ============================================================================
   SWALAYAN. Pemakainya tidak membuat folder, tidak membuat spreadsheet, tidak
   menempel kode ke mana pun. Dia menekan satu tombol "Hubungkan Google", dan
   aplikasi ini yang membuat rumahnya sendiri:

       Drive/
         └─ <nama aplikasi>/          <- dibuat aplikasi
              ├─ cadangan             <- spreadsheet, dibuat aplikasi
              └─ berkas/              <- gambar & dokumen, dibuat aplikasi

   Itu sebabnya lapis ini memakai Google API langsung, bukan Apps Script.
   Apps Script menuntut tiap pemakai membuat proyek, menempel kode, dan
   men-deploy sendiri - lima langkah teknis yang tidak akan pernah dikerjakan
   siapa pun selain pembuatnya.

   KENAPA CUMA drive.file

   Cakupan ini hanya memberi akses ke berkas yang dibuat aplikasi ini sendiri.
   Isi Drive pemakai yang lain tidak terlihat sama sekali. Selain itu jujur
   lebih aman, Google tidak menganggapnya sensitif - jadi tidak ada layar
   peringatan menakutkan dan tidak perlu peninjauan.

   TIGA ATURAN

   1. Tidak pernah di jalur drop. Semua di sini berjalan setelah aplikasi
      terbuka, di belakang layar.
   2. Boleh gagal diam-diam. Tidak ada sinyal, token kedaluwarsa, kuota habis -
      catatannya tetap tersimpan di HP dan dicoba lagi nanti.
   3. Tidak pernah menahan UI. Tidak ada layar yang menunggu jawaban Google.
   ============================================================================ */
(function (global) {
  'use strict';

  var GIS = 'https://accounts.google.com/gsi/client';
  var DRIVE = 'https://www.googleapis.com/drive/v3/files';
  var UNGGAH = 'https://www.googleapis.com/upload/drive/v3/files';
  var SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

  var token = null;          /* hanya di memori - tidak pernah ditulis ke disk */
  var tokenSampai = 0;
  var klien = null;
  var muatGis = null;

  /* ------------------------------------------------------------------ masuk */

  function skripGis() {
    if (muatGis) return muatGis;
    muatGis = new Promise(function (terima, tolak) {
      if (global.google && global.google.accounts) return terima();
      var s = document.createElement('script');
      s.src = GIS;
      s.async = true;
      s.onload = terima;
      s.onerror = function () { tolak(new Error('Tidak bisa memuat Google Sign-In')); };
      document.head.appendChild(s);
    });
    return muatGis;
  }

  function siapkanKlien(clientId) {
    return skripGis().then(function () {
      if (klien && klien._id === clientId) return klien;
      klien = global.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: TBawaan.lingkup,
        callback: function () { /* diganti tiap permintaan */ }
      });
      klien._id = clientId;
      return klien;
    });
  }

  /* diam = true: coba tanpa memunculkan apa pun. Dipakai di latar; kalau
     pemakainya belum pernah mengizinkan, ini memang gagal, dan itu wajar. */
  function ambilToken(setelan, diam) {
    if (token && Date.now() < tokenSampai - 60000) return Promise.resolve(token);
    var id = (setelan && setelan.clientId) || TBawaan.clientId;
    if (!id) return Promise.reject(new Error('Client ID Google belum diisi'));

    return siapkanKlien(id).then(function (k) {
      return new Promise(function (terima, tolak) {
        var selesai = false;
        k.callback = function (jawab) {
          selesai = true;
          if (jawab && jawab.access_token) {
            token = jawab.access_token;
            tokenSampai = Date.now() + (Number(jawab.expires_in) || 3600) * 1000;
            terima(token);
          } else {
            tolak(new Error((jawab && jawab.error) || 'Izin Google ditolak'));
          }
        };
        k.error_callback = function (e) {
          selesai = true;
          tolak(new Error((e && e.type) || 'Masuk Google gagal'));
        };
        k.requestAccessToken({ prompt: diam ? '' : 'consent' });
        /* Jendela izin yang ditutup diam-diam tidak selalu memanggil callback. */
        setTimeout(function () { if (!selesai) tolak(new Error('Tidak ada jawaban dari Google')); }, diam ? 8000 : 120000);
      });
    });
  }

  function keluar() {
    token = null;
    tokenSampai = 0;
  }

  /* Email pemakainya dipakai untuk satu hal saja: ditunjukkan kembali
     kepadanya di layar Setelan, supaya jelas akun mana yang dipakai. Yang
     memutuskan dia terdaftar atau tidak adalah proxy, bukan aplikasi ini -
     kalau keputusan itu diambil di sini, siapa pun bisa mengubahnya. */
  function siapa(setelan) {
    return ambilToken(setelan, true).then(function (t) {
      return fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + t }
      });
    }).then(function (r) {
      if (!r.ok) throw new Error('Tidak bisa membaca akun');
      return r.json();
    }).then(function (j) { return (j && j.email) || ''; });
  }

  /* Coba diam dulu. Kalau pemakainya sudah pernah mengizinkan - dan setelah
     sekali, dia selalu sudah - tidak ada satu pun layar yang muncul. Layar
     izin Google cuma keluar saat memang belum pernah diberikan. */
  function masuk(setelan) {
    return ambilToken(setelan, true).catch(function () {
      return ambilToken(setelan, false);
    });
  }
  function punyaToken() { return !!token && Date.now() < tokenSampai; }

  /* ------------------------------------------------------------------ dasar */

  function panggil(setelan, alamat, pilihan) {
    return ambilToken(setelan, true).then(function (t) {
      var p = pilihan || {};
      p.headers = p.headers || {};
      p.headers.Authorization = 'Bearer ' + t;
      return fetch(alamat, p);
    }).then(function (r) {
      if (r.status === 401) { keluar(); throw new Error('Izin Google kedaluwarsa'); }
      return r.text().then(function (teks) {
        var j = null;
        try { j = teks ? JSON.parse(teks) : {}; } catch (e) { j = { mentah: teks }; }
        if (!r.ok) throw new Error((j && j.error && j.error.message) || ('Google menjawab ' + r.status));
        return j;
      });
    });
  }

  function cariAtauBuat(setelan, nama, mime, indukId) {
    var syarat = "name='" + nama.replace(/'/g, "\\'") + "' and mimeType='" + mime +
                 "' and trashed=false" + (indukId ? " and '" + indukId + "' in parents" : '');
    return panggil(setelan, DRIVE + '?q=' + encodeURIComponent(syarat) + '&fields=files(id,name)&pageSize=1')
      .then(function (j) {
        if (j.files && j.files.length) return j.files[0].id;
        var badan = { name: nama, mimeType: mime };
        if (indukId) badan.parents = [indukId];
        return panggil(setelan, DRIVE + '?fields=id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(badan)
        }).then(function (b) { return b.id; });
      });
  }

  /* ------------------------------------------------------------------ rumah */

  /* Kolom baru DITAMBAHKAN DI EKOR, tidak pernah disisipkan di tengah. Baris
     lama membaca nilainya berdasarkan urutan, jadi menyisipkan satu kolom
     menggeser seluruh cadangan yang sudah terlanjur ada. */
  var KOLOM = ['id', 'jenis', 'judul', 'judulManual', 'isi', 'kategori', 'label',
               'daftar', 'berkasId', 'driveId', 'namaBerkas', 'tipeBerkas', 'ukuran',
               'dibuat', 'diubah', 'dipakai', 'diLabeliAI', 'pensiun', 'dihapus', 'riwayat',
               'tag', 'elemen', 'rahasia', 'elemenTerkunci',
               'selesai', 'selesaiPada', 'penting', 'hariIni', 'tenggat', 'ulang'];

  /* Lewat 26 kolom, Sheets memakai dua huruf (AA, AB, ...). Menghitungnya
     dengan satu fromCharCode menghasilkan '[' dan seluruh cadangan gagal
     diam-diam. */
  function hurufKolom(n) {
    var s = '';
    while (n > 0) {
      var sisa = (n - 1) % 26;
      s = String.fromCharCode(65 + sisa) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  var HURUF_AKHIR = hurufKolom(KOLOM.length);   /* AD untuk 30 kolom - lewat Z, jadi hurufnya dihitung, bukan ditebak */

  /* Tab kedua: kumpulan tag yang pernah dibuat AI. Gunanya supaya tag tidak
     beranak - dan supaya kamu bisa melihat sendiri daftarnya tanpa membuka
     aplikasinya. Sumber kebenarannya tetap di HP; ini cerminan. */
  var TAB_TAG = 'hashtag';

  /* Menyiapkan folder + spreadsheet, lalu mengingat id-nya. Aman dipanggil
     berkali-kali: kalau sudah ada, dia cuma memakai yang lama. */
  function siapkanRumah(setelan, simpanKunci) {
    var akar, berkas, sheet;
    return cariAtauBuat(setelan, TBawaan.nama, 'application/vnd.google-apps.folder', null)
      .then(function (id) {
        akar = id;
        return cariAtauBuat(setelan, 'berkas', 'application/vnd.google-apps.folder', akar);
      })
      .then(function (id) {
        berkas = id;
        return cariAtauBuat(setelan, 'cadangan', 'application/vnd.google-apps.spreadsheet', akar);
      })
      .then(function (id) {
        sheet = id;
        return panggil(setelan, SHEETS + '/' + sheet + '?fields=sheets.properties.title');
      })
      .then(function (j) {
        var tab = (j.sheets && j.sheets[0] && j.sheets[0].properties.title) || 'Sheet1';
        return simpanKunci({ folderAkar: akar, folderBerkas: berkas, sheetId: sheet, sheetTab: tab })
          .then(function () { return tulisKepala(setelan, sheet, tab); })
          .then(function () { return { folderAkar: akar, folderBerkas: berkas, sheetId: sheet, sheetTab: tab }; });
      });
  }

  function rentang(tab, a, b) {
    return encodeURIComponent("'" + tab.replace(/'/g, "''") + "'!" + a + ':' + b);
  }

  function tulisKepala(setelan, sheetId, tab) {
    return panggil(setelan, SHEETS + '/' + sheetId + '/values/' + rentang(tab, 'A1', HURUF_AKHIR + '1'))
      .then(function (j) {
        if (j.values && j.values.length && j.values[0][0] === 'id') return true;
        return panggil(setelan, SHEETS + '/' + sheetId + '/values/' +
          rentang(tab, 'A1', HURUF_AKHIR + '1') + '?valueInputOption=RAW', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [KOLOM] })
        });
      });
  }

  /* ------------------------------------------------------------------ baris */

  function bacaId(setelan, s) {
    return panggil(setelan, SHEETS + '/' + s.sheetId + '/values/' + rentang(s.sheetTab, 'A2', 'A'))
      .then(function (j) {
        var peta = {};
        (j.values || []).forEach(function (r, i) { if (r[0]) peta[String(r[0])] = i + 2; });
        return peta;
      });
  }

  /* valueInputOption=RAW itu bukan detail: tanpa itu, catatan yang diawali "="
     ditelan Sheets sebagai rumus dan tulisannya rusak diam-diam. */
  function tulisBaris(setelan, s, baris) {
    return bacaId(setelan, s).then(function (peta) {
      var perbarui = [], tambah = [];
      baris.forEach(function (b) {
        var nomor = peta[String(b[0])];
        if (nomor) {
          perbarui.push({
            range: "'" + s.sheetTab.replace(/'/g, "''") + "'!A" + nomor + ':' + HURUF_AKHIR + nomor,
            values: [b]
          });
        } else {
          tambah.push(b);
        }
      });

      var kerja = Promise.resolve();
      if (perbarui.length) {
        kerja = kerja.then(function () {
          return panggil(setelan, SHEETS + '/' + s.sheetId + '/values:batchUpdate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valueInputOption: 'RAW', data: perbarui })
          });
        });
      }
      if (tambah.length) {
        kerja = kerja.then(function () {
          return panggil(setelan, SHEETS + '/' + s.sheetId + '/values/' +
            rentang(s.sheetTab, 'A', HURUF_AKHIR) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: tambah })
          });
        });
      }
      return kerja.then(function () { return baris.length; });
    });
  }

  function bacaSemuaBaris(setelan, s) {
    return panggil(setelan, SHEETS + '/' + s.sheetId + '/values/' + rentang(s.sheetTab, 'A2', HURUF_AKHIR))
      .then(function (j) {
        return (j.values || []).filter(function (r) { return r[0]; }).map(function (r) {
          var o = {};
          KOLOM.forEach(function (k, i) { o[k] = r[i] == null ? '' : r[i]; });
          return o;
        });
      });
  }

  /* Menghapus baris betulan, bukan menandainya. Untuk catatan sekali pakai,
     meninggalkan bangkai di Sheet sama saja dengan tidak menghapus. */
  function hapusBaris(setelan, s, idDaftar) {
    if (!idDaftar.length) return Promise.resolve(0);
    return Promise.all([bacaId(setelan, s), nomorTab(setelan, s)]).then(function (r) {
      var peta = r[0], tabId = r[1];
      var nomor = idDaftar.map(function (id) { return peta[String(id)]; })
                          .filter(Boolean).sort(function (a, b) { return b - a; });
      if (!nomor.length) return 0;
      /* Dari bawah ke atas: menghapus baris atas menggeser nomor di bawahnya. */
      var minta = nomor.map(function (n) {
        return { deleteDimension: { range: { sheetId: tabId, dimension: 'ROWS', startIndex: n - 1, endIndex: n } } };
      });
      return panggil(setelan, SHEETS + '/' + s.sheetId + ':batchUpdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: minta })
      }).then(function () { return nomor.length; });
    });
  }

  /* Menulis ulang seluruh daftar, bukan menambah satu per satu: daftarnya
     ratusan baris, sekali tulis lebih murah daripada mencari selisihnya -
     dan tidak ada yang bisa rusak setengah jalan. */
  function tulisTag(setelan, s, tag) {
    var isi = (tag || []).map(function (t) { return [t]; });
    return siapkanTabTag(setelan, s).then(function () {
      return panggil(setelan, SHEETS + '/' + s.sheetId + '/values/' +
        rentang(TAB_TAG, 'A1', 'A') + ':clear', { method: 'POST' });
    }).then(function () {
      if (!isi.length) return true;
      return panggil(setelan, SHEETS + '/' + s.sheetId + '/values/' +
        rentang(TAB_TAG, 'A1', 'A' + isi.length) + '?valueInputOption=RAW', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: isi })
      });
    });
  }

  function siapkanTabTag(setelan, s) {
    return panggil(setelan, SHEETS + '/' + s.sheetId + '?fields=sheets.properties.title')
      .then(function (j) {
        var ada = (j.sheets || []).some(function (x) { return x.properties.title === TAB_TAG; });
        if (ada) return true;
        return panggil(setelan, SHEETS + '/' + s.sheetId + ':batchUpdate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB_TAG } } }] })
        });
      });
  }

  function nomorTab(setelan, s) {
    return panggil(setelan, SHEETS + '/' + s.sheetId + '?fields=sheets.properties')
      .then(function (j) {
        var cocok = (j.sheets || []).filter(function (x) { return x.properties.title === s.sheetTab; })[0];
        return cocok ? cocok.properties.sheetId : 0;
      });
  }

  /* ----------------------------------------------------------------- berkas */

  function unggahBerkas(setelan, folderId, blob, nama, tipe) {
    var batas = '-----batas' + Math.random().toString(36).slice(2);
    var kepala = { name: nama, parents: [folderId] };
    var awal = '--' + batas + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
               JSON.stringify(kepala) + '\r\n--' + batas + '\r\nContent-Type: ' +
               (tipe || 'application/octet-stream') + '\r\n\r\n';
    var akhir = '\r\n--' + batas + '--';
    var badan = new Blob([awal, blob, akhir], { type: 'multipart/related; boundary=' + batas });

    return panggil(setelan, UNGGAH + '?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + batas },
      body: badan
    }).then(function (j) { return j.id; });
  }

  function unduhBerkas(setelan, driveId) {
    return ambilToken(setelan, true).then(function (t) {
      return fetch(DRIVE + '/' + driveId + '?alt=media', { headers: { Authorization: 'Bearer ' + t } });
    }).then(function (r) {
      if (!r.ok) throw new Error('Berkas tidak bisa diambil (' + r.status + ')');
      return r.blob();
    });
  }

  function hapusBerkas(setelan, driveId) {
    return panggil(setelan, DRIVE + '/' + driveId, { method: 'DELETE' }).catch(function () {
      /* Sudah tidak ada itu hasil yang sama baiknya. */
      return null;
    });
  }

  global.TAwan = {
    masuk: masuk, keluar: keluar, punyaToken: punyaToken, ambilToken: ambilToken,
    siapa: siapa,
    siapkanRumah: siapkanRumah,
    tulisBaris: tulisBaris, bacaSemuaBaris: bacaSemuaBaris, hapusBaris: hapusBaris,
    unggahBerkas: unggahBerkas, unduhBerkas: unduhBerkas, hapusBerkas: hapusBerkas,
    tulisTag: tulisTag,
    KOLOM: KOLOM, TAB_TAG: TAB_TAG
  };
})(window);
