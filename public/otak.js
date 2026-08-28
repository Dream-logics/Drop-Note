/* ============================================================================
   Drop Note — otak
   ============================================================================
   Semua yang "menebak" ada di berkas ini, dan hampir seluruhnya LOGIC BIASA:
   membaca jenis, menyusun judul dari alamat, membetulkan kategori salah ketik,
   menarik kata kunci, dan menilai hasil pencarian. Tanpa jaringan, tanpa biaya,
   jalan di pesawat sekalipun.

   AI (Gemini) hanya menambal SATU celah, dan tinggal di berkas terpisah
   (pelabel.js) supaya berkas ini tetap jalan penuh kalau AI mati:
   catatan lahir dalam 3 detik, jadi konteksnya tidak pernah ikut tertulis.
   Enam bulan kemudian kartu berjudul "Link dev photo studio" dicari dengan
   kata "apps A" - dan tidak ada satu pun kata yang cocok. Yang ditambal AI
   adalah selisih itu, bukan kerapian.

   Karena itu pembagiannya: AI MENULIS (sekali, saat entri masuk), LOGIC
   MEMBACA (tiap kali mencari). Kebalikannya bikin pencarian - hal yang paling
   sering dilakukan - jadi lambat dan berbayar.
   ============================================================================ */
(function (global) {
  'use strict';

  /* ===================== JENIS ===================== */

  var POLA_URL = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/i;

  function bacaJenis(teks) {
    var t = (teks || '').trim();
    if (!t) return 'teks';
    /* Tautan hanya kalau alamatnya BERDIRI SENDIRI. Satu URL di tengah
       paragraf tetap catatan - yang penting isinya, bukan alamatnya. */
    var baris = t.split(/\s+/);
    if (baris.length <= 2 && POLA_URL.test(t)) return 'tautan';
    return 'teks';
  }

  function ambilUrl(teks) {
    var m = (teks || '').match(POLA_URL);
    if (!m) return '';
    var u = m[0];
    return /^www\./i.test(u) ? 'https://' + u : u;
  }

  /* ===================== JUDUL DARI ALAMAT =====================
     Judul halaman yang sebenarnya tidak bisa diambil langsung dari browser:
     situs lain memblokirnya lewat CORS. Jadi judul disusun dari alamatnya
     sendiri - dan untuk alamat yang sehari-hari dipakai, hasilnya justru
     lebih berguna daripada judul aslinya ("Google Apps Script" untuk semua). */

  var KENAL = [
    { pola: /script\.google\.com/i, nama: 'Apps Script' },
    { pola: /docs\.google\.com\/spreadsheets/i, nama: 'Google Sheets' },
    { pola: /docs\.google\.com\/document/i, nama: 'Google Docs' },
    { pola: /docs\.google\.com\/presentation/i, nama: 'Google Slides' },
    { pola: /docs\.google\.com\/forms|forms\.gle/i, nama: 'Google Forms' },
    { pola: /drive\.google\.com/i, nama: 'Google Drive' },
    { pola: /console\.cloud\.google\.com/i, nama: 'Google Cloud' },
    { pola: /(^|\.)github\.com/i, nama: 'GitHub' },
    { pola: /(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)/i, nama: 'WhatsApp' },
    { pola: /(youtube\.com|youtu\.be)/i, nama: 'YouTube' },
    { pola: /(bit\.ly|tinyurl|s\.id|cutt\.ly)/i, nama: 'Tautan pendek' },
    { pola: /figma\.com/i, nama: 'Figma' },
    { pola: /notion\.so/i, nama: 'Notion' },
    { pola: /vercel\.app|netlify\.app/i, nama: 'Pratinjau web' }
  ];

  function judulTautan(url) {
    var u;
    try { u = new URL(url); } catch (e) { return url; }
    var host = u.hostname.replace(/^www\./, '');
    var nama = '';
    for (var i = 0; i < KENAL.length; i++) if (KENAL[i].pola.test(url)) { nama = KENAL[i].nama; break; }
    if (!nama) nama = host;

    var jalur = u.pathname.split('/').filter(Boolean);
    var ekor = jalur.length ? jalur[jalur.length - 1] : '';

    /* Apps Script: /dev dan /exec itu dua alamat yang sangat berbeda dan
       sangat mirip dilihat sekilas. Salah satu penyebab paling sering
       "kok link-nya tidak jalan". Jadi bedanya ditulis, bukan disembunyikan. */
    if (/script\.google\.com/i.test(url)) {
      if (ekor === 'dev') return nama + ' — uji coba (/dev)';
      if (ekor === 'exec') return nama + ' — terbit (/exec)';
      return nama;
    }
    if (/(^|\.)github\.com/i.test(url) && jalur.length >= 2) return nama + ' — ' + jalur[0] + '/' + jalur[1];
    if (/(wa\.me|api\.whatsapp\.com)/i.test(url) && ekor) return nama + ' — ' + ekor;

    if (ekor && !/^[0-9a-f-]{16,}$/i.test(ekor)) {
      var bersih = decodeURIComponent(ekor).replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_+]+/g, ' ').trim();
      if (bersih && bersih.length <= 60) return nama + ' — ' + bersih;
    }
    return nama;
  }

  function judulTeks(teks) {
    var t = (teks || '').trim();
    if (!t) return '';
    var baris1 = t.split('\n')[0].trim();
    if (baris1.length <= 64) return baris1;
    var potong = baris1.slice(0, 60);
    var spasi = potong.lastIndexOf(' ');
    return (spasi > 30 ? potong.slice(0, spasi) : potong) + '…';
  }

  function judulOtomatis(entri) {
    if (entri.jenis === 'tautan') return judulTautan(entri.isi);
    if (entri.jenis === 'gambar') return entri.namaBerkas || 'Gambar';
    if (entri.jenis === 'berkas') return entri.namaBerkas || 'Berkas';
    if (entri.jenis === 'suara') return 'Rekaman ' + waktuPendek(entri.dibuat);
    if (entri.jenis === 'daftar') {
      var d = (entri.daftar || []).filter(function (b) { return b.teks; });
      return d.length ? d[0].teks.slice(0, 50) : 'Daftar';
    }
    return judulTeks(entri.isi);
  }

  function waktuPendek(ts) {
    var d = new Date(ts || Date.now());
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ===================== KATEGORI =====================
     Kategori diketik buru-buru, jadi salah ketik itu bawaan, bukan
     kecelakaan. "apps desig" harus mendarat di "apps design" yang sudah ada
     - kalau tidak, tiap salah ketik melahirkan kategori baru dan dalam
     sebulan daftarnya jadi sampah. */

  function normal(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function jarak(a, b) {
    if (a === b) return 0;
    if (!a.length || !b.length) return Math.max(a.length, b.length);
    var baris = [], i, j;
    for (j = 0; j <= b.length; j++) baris[j] = j;
    for (i = 1; i <= a.length; i++) {
      var kiri = baris[0]; baris[0] = i;
      for (j = 1; j <= b.length; j++) {
        var atas = baris[j];
        baris[j] = Math.min(baris[j] + 1, baris[j - 1] + 1, kiri + (a[i - 1] === b[j - 1] ? 0 : 1));
        kiri = atas;
      }
    }
    return baris[b.length];
  }

  function benahiKategori(ketikan, daftar) {
    var asli = (ketikan || '').trim();
    var k = normal(asli);
    if (!k) return { kategori: '', dibetulkan: false, asli: asli };

    var ada = (daftar || []).filter(Boolean);
    var i, n;

    for (i = 0; i < ada.length; i++) if (normal(ada[i]) === k) return { kategori: ada[i], dibetulkan: false, asli: asli };

    /* Awalan: "apps desig" -> "apps design". Yang terpendek menang supaya
       ketikan pendek tidak melompat ke kategori yang jauh lebih panjang. */
    var awalan = ada.filter(function (c) { return normal(c).indexOf(k) === 0; })
                    .sort(function (a, b) { return a.length - b.length; });
    if (awalan.length) return { kategori: awalan[0], dibetulkan: normal(awalan[0]) !== k, asli: asli };

    /* Salah ketik: toleransi tumbuh dengan panjang kata, tapi tidak pernah
       lebih dari 3 - di atas itu tebakannya jadi menakutkan, bukan membantu. */
    var batas = k.length <= 4 ? 1 : (k.length <= 8 ? 2 : 3);
    var terbaik = null, terdekat = 99;
    for (i = 0; i < ada.length; i++) {
      n = normal(ada[i]);
      var d = jarak(k, n);
      if (d < terdekat && d <= batas) { terdekat = d; terbaik = ada[i]; }
    }
    if (terbaik) return { kategori: terbaik, dibetulkan: true, asli: asli };

    return { kategori: asli, dibetulkan: false, asli: asli, baru: true };
  }

  /* Usul kategori dari isi: kategori lama yang kata-katanya paling banyak
     muncul di entri ini. Sederhana, tapi menang telak dibanding kosong. */
  function usulKategori(entri, riwayatKategori) {
    var bahan = normal([entri.isi, entri.judul, entri.namaBerkas].filter(Boolean).join(' '));
    var terbaik = '', nilaiTerbaik = 0;
    (riwayatKategori || []).forEach(function (r) {
      var kata = normal(r.kategori).split(' ').filter(function (w) { return w.length > 2; });
      if (!kata.length) return;
      var cocok = kata.filter(function (w) { return bahan.indexOf(w) >= 0; }).length;
      if (!cocok) return;
      var nilai = (cocok / kata.length) * 10 + Math.min(r.jumlah, 20) * 0.1;
      if (nilai > nilaiTerbaik) { nilaiTerbaik = nilai; terbaik = r.kategori; }
    });
    return nilaiTerbaik >= 5 ? terbaik : '';
  }

  /* ===================== LABEL =====================
     Kata kunci tersembunyi. Tidak pernah dilihat pemakainya; tugasnya cuma
     membuat pencarian ketemu. */

  var BUANG = ('yang untuk dari dengan pada ini itu dan atau adalah akan sudah belum tidak bisa juga saya aku kamu kita ada dalam ke di ya nya kalau saat lalu jadi agar biar the and for with this that are was from your you have has not but can will its into about http https www com net org id co macros exec dev'
  ).split(' ');

  function labelOtomatis(entri) {
    var label = [];
    function tambah(w) {
      w = normal(w);
      if (!w || w.length < 3 || BUANG.indexOf(w) >= 0) return;
      if (label.indexOf(w) < 0) label.push(w);
    }

    if (entri.jenis === 'tautan') {
      try {
        var u = new URL(entri.isi);
        u.hostname.replace(/^www\./, '').split('.').forEach(tambah);
        u.pathname.split(/[\/\-_.]+/).forEach(function (bagian) {
          if (bagian && bagian.length < 20 && !/^[0-9a-f-]{16,}$/i.test(bagian)) tambah(bagian);
        });
        if (/\/dev$/.test(u.pathname)) { tambah('uji'); tambah('staging'); }
        if (/\/exec$/.test(u.pathname)) { tambah('terbit'); tambah('produksi'); }
      } catch (e) { /* alamat cacat - lewati saja, jangan gagalkan penyimpanan */ }
    }

    normal([entri.judul, entri.isi, entri.namaBerkas, entri.kategori].filter(Boolean).join(' '))
      .split(' ').slice(0, 120).forEach(tambah);

    (entri.daftar || []).forEach(function (b) { normal(b.teks).split(' ').forEach(tambah); });

    return label.slice(0, 40);
  }

  /* ===================== ELEMEN =====================
     Yang sebenarnya dicari orang sering BUKAN catatannya, melainkan satu
     potong di dalamnya: alamatnya, kodenya, nomornya. Menemukan kartunya lalu
     masih harus menyorot teks dengan jempol untuk menyalin satu baris adalah
     pekerjaan yang tidak perlu ada - dan itu justru di ujung, saat orangnya
     paling buru-buru.

     Yang di sini murni pola, tanpa AI, jadi tetap bekerja kalau AI mati
     selamanya. AI menambah yang tidak berpola: nama supplier, dosis obat,
     maksud sebuah angka. Pembagian yang sama seperti label. */

  var POLA_ELEMEN = [
    { jenis: 'tautan',  pola: /\bhttps?:\/\/[^\s<>"']+/gi },
    { jenis: 'surel',   pola: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi },
    { jenis: 'telepon', pola: /(?:\+62|\b0)8\d{7,12}\b/g },
    /* SATU penanda = SATU elemen, walau di dalamnya ada tanda hubung dan titik.
       Ini pelajaran mahal: memisah di tiap tanda hubung mencincang satu Client
       ID Google jadi empat "kode" yang tidak berguna satu pun - dan yang utuh
       jadi tenggelam di bawahnya. Penanda buatan mesin memang dirakit dari
       potongan; potongannya sendiri tidak pernah dipakai siapa-siapa. */
    { jenis: 'penanda', pola: /[A-Za-z0-9][A-Za-z0-9._-]{3,}[A-Za-z0-9]/g }
  ];

  /* Yang lolos cuma yang mengandung angka: tanpa itu, tiap kata biasa dalam
     kalimat ikut terangkat jadi "elemen". */
  function jenisPenanda(teks) {
    if (!/\d/.test(teks)) return '';
    if (/^\d+$/.test(teks)) return teks.length >= 5 ? 'nomor' : '';
    return teks.length >= 5 ? 'kode' : '';
  }

  function tambahElemen(daftar, jenis, nilai, nama) {
    var v = String(nilai || '').trim().replace(/[.,;:]+$/, '');
    if (!v || v.length > 300) return;
    for (var i = 0; i < daftar.length; i++) {
      if (daftar[i].nilai.toLowerCase() === v.toLowerCase()) return;
    }
    daftar.push({ jenis: jenis, nilai: v, nama: String(nama || '') });
  }

  function elemenOtomatis(entri) {
    var sisa = [entri.isi || '', entri.namaBerkas || '',
                (entri.daftar || []).map(function (b) { return b.teks; }).join('\n')]
               .filter(Boolean).join('\n');
    var keluar = [];
    POLA_ELEMEN.forEach(function (p) {
      sisa = sisa.replace(p.pola, function (cocok) {
        var jenis = p.jenis === 'penanda' ? jenisPenanda(cocok.replace(/[.\-_]+$/, '')) : p.jenis;
        if (jenis) tambahElemen(keluar, jenis, cocok);
        /* Diganti spasi, bukan dibiarkan: kalau tidak, pola berikutnya
           memungut potongan dari dalam alamat yang sudah terambil utuh -
           satu URL bisa melahirkan lima "kode" palsu. */
        return jenis ? ' ' : cocok;
      });
    });
    return buangSerpihan(keluar).slice(0, 12);
  }

  /* Kalau satu nilai termuat UTUH di dalam nilai lain, dia serpihan - dan
     serpihan bukan elemen. "376616148815" di dalam Client ID lengkap bukan
     barang kedua yang bisa disalin; dia bagian dari barang pertama, dan
     menampilkannya sendiri cuma menenggelamkan yang utuh. */
  function buangSerpihan(daftar) {
    return daftar.filter(function (x, i) {
      return !daftar.some(function (y, j) {
        return i !== j && y.nilai.length > x.nilai.length &&
               y.nilai.toLowerCase().indexOf(x.nilai.toLowerCase()) >= 0;
      });
    });
  }

  /* Menyamarkan penanda DI DALAM judul. Judul entri rahasia sengaja tetap
     terbuka supaya catatannya masih bisa ditemukan - termasuk terbuka di
     spreadsheet cadangan, yang bisa dibaca siapa pun yang masuk akun Google.
     Padahal baris pertama itu judulnya, dan orang yang menempel kunci API
     buru-buru akan menempelkannya di baris pertama.
     Jadi yang berbentuk penanda dibuang dari judulnya; kata-katanya tetap,
     dan kata-kata itulah yang dipakai mencari. */
  function samarkanPenanda(teks) {
    return String(teks || '')
      .replace(/\bhttps?:\/\/[^\s<>"']+/gi, '•••')
      .replace(/[A-Za-z0-9][A-Za-z0-9._-]{3,}[A-Za-z0-9]/g, function (cocok) {
        return jenisPenanda(cocok.replace(/[.\-_]+$/, '')) ? '•••' : cocok;
      })
      .replace(/(\s*•••\s*)+/g, ' ••• ').trim();
  }

  function gabungElemen(lama, tambahan) {
    var gabung = (lama || []).slice();
    (tambahan || []).forEach(function (x) {
      if (x && x.nilai) tambahElemen(gabung, x.jenis || 'lainnya', x.nilai, x.nama);
    });
    return buangSerpihan(gabung).slice(0, 20);
  }

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
               'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  /* Di daftar hasil, waktu itu keterangan - bukan isi. "28 Agustus 2026 ·
     18.27" memakan selebar judulnya sendiri untuk menjawab pertanyaan yang
     jarang ditanya. Yang ditulis cuma bagian yang membedakan: jam kalau hari
     ini, tanggal kalau tahun ini, tahunnya kalau lebih lama. */
  function waktuRingkas(ts) {
    var d = new Date(ts || Date.now());
    var kini = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    if (d.toDateString() === kini.toDateString()) return p(d.getHours()) + '.' + p(d.getMinutes());
    var pendek = d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3);
    return d.getFullYear() === kini.getFullYear() ? pendek
                                                  : pendek + ' ' + String(d.getFullYear()).slice(2);
  }

  function tanggalIndo(ts) {
    var d = new Date(ts || Date.now());
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() +
           ' · ' + p(d.getHours()) + '.' + p(d.getMinutes());
  }

  /* ===================== PENCARIAN =====================
     Berjalan di atas salinan lokal. Tidak ada jaringan, tidak ada AI, tidak
     ada tunggu. Ini bagian yang paling sering dipakai, jadi paling murah. */

  function cari(daftar, kueri, saringJenis, saringKat) {
    var kata = normal(kueri).split(' ').filter(Boolean);

    var pakai = (daftar || []).filter(function (e) {
      if (e.pensiun) return false;
      if (saringJenis && saringJenis !== 'semua' && e.jenis !== saringJenis) return false;
      /* Kategori boleh berisi beberapa keyword yang dipisah spasi, jadi
         saringannya mencocokkan SALAH SATU - bukan seluruh isian. */
      if (saringKat && normal(e.kategori).split(' ').indexOf(normal(saringKat)) < 0) return false;
      return true;
    });

    if (!kata.length) {
      return pakai.slice().sort(function (a, b) { return (b.diubah || 0) - (a.diubah || 0); });
    }

    function nilaiSatu(e, w) {
      var n = 0;
      if (normal(e.judul).indexOf(w) >= 0) n += 6;
      if ((e.label || []).some(function (l) { return l.indexOf(w) === 0; })) n += 5;
      /* Tag dinilai setinggi label karena dia label yang KELIHATAN - sekali
         dipakai orangnya, dia akan mengetik kata itu lagi. */
      if ((e.tag || []).some(function (t) { return normal(t).indexOf(w) === 0; })) n += 5;
      if (!e.rahasia && (e.elemen || []).some(function (x) {
        return normal(x.nilai).indexOf(w) >= 0 || normal(x.nama).indexOf(w) >= 0;
      })) n += 4;
      if (normal(e.kategori).indexOf(w) >= 0) n += 4;
      /* Isi dan elemen entri rahasia sudah berupa sandi - mencocokkannya
         cuma menghasilkan kecocokan palsu. Judul, tag, dan labelnya tetap
         terbuka, dan itu memang yang membuatnya masih bisa DITEMUKAN. */
      if (!e.rahasia && normal(e.isi).indexOf(w) >= 0) n += 3;
      if (normal(e.namaBerkas).indexOf(w) >= 0) n += 3;
      if ((e.daftar || []).some(function (b) { return normal(b.teks).indexOf(w) >= 0; })) n += 3;
      return n;
    }

    function nilai(e) {
      var total = 0, cocok = 0;
      kata.forEach(function (w) { var n = nilaiSatu(e, w); if (n) { cocok++; total += n; } });
      if (!cocok) return 0;
      /* Semua kata harus ketemu. Kalau tidak ada satu pun entri yang memenuhi,
         syaratnya dilonggarkan di bawah - lebih baik hasil kurang tepat
         daripada layar kosong padahal barangnya ada. */
      if (cocok < kata.length) return -total;
      return total + Math.min(e.dipakai || 0, 20) * 0.6;
    }

    var ketat = [], longgar = [];
    pakai.forEach(function (e) {
      var n = nilai(e);
      if (n > 0) ketat.push({ e: e, n: n });
      else if (n < 0) longgar.push({ e: e, n: -n });
    });

    var sumber = ketat.length ? ketat : longgar;
    return sumber.sort(function (a, b) {
      if (b.n !== a.n) return b.n - a.n;
      return (b.e.diubah || 0) - (a.e.diubah || 0);
    }).map(function (x) { return x.e; });
  }

  global.TOtak = {
    bacaJenis: bacaJenis, ambilUrl: ambilUrl,
    judulTautan: judulTautan, judulTeks: judulTeks, judulOtomatis: judulOtomatis,
    benahiKategori: benahiKategori, usulKategori: usulKategori,
    labelOtomatis: labelOtomatis, cari: cari,
    elemenOtomatis: elemenOtomatis, gabungElemen: gabungElemen,
    samarkanPenanda: samarkanPenanda,
    buangSerpihan: buangSerpihan,
    normal: normal, jarak: jarak, waktuPendek: waktuPendek,
    tanggalIndo: tanggalIndo, waktuRingkas: waktuRingkas
  };
})(window);
