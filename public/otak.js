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

  /* ===================== ISTILAH & STRUKTUR JUDUL =====================
     Judul di sini bukan hiasan - dia kata yang nanti diketik orangnya waktu
     mencari. Karena itu tiga aturan, dan ketiganya soal yang sama: judul harus
     memakai kata yang ADA DI KEPALANYA, bukan kata yang paling rapi.

     1. INGGRIS DULU kalau istilahnya bentrok. Dia mengetik "link" waktu
        mencari; menyimpannya sebagai "tautan" berarti aplikasinya sendiri
        yang bikin dia lupa. Bahasa layar tetap Indonesia - yang diinggriskan
        cuma istilah teknis yang memang dipakai sehari-hari dalam bahasa
        Inggris.
     2. TIDAK ADA KATA KEMBAR. "Uji coba dan pengecekan versi" itu satu makna
        yang ditulis dua kali. Panjang tidak menambah pintu masuk - tag yang
        menambahnya.
     3. KATA PERTAMA ITU PENANDA JENISNYA, satu kata benda: Link, Nomor, API,
        Telepon. Dengan begitu daftar hasil bisa dipindai dari tepi kiri saja,
        tanpa membaca seluruh barisnya. */

  /* URUTANNYA ADALAH PRIORITAS, bukan sekadar daftar. "kode otp bca" memuat
     dua istilah sekaligus; yang menang harus yang lebih KHUSUS (OTP), bukan
     yang kebetulan lebih dulu tertulis (Code). Jadi yang khusus ditaruh di
     atas, dan pemilihnya membandingkan peringkat - bukan berhenti di temuan
     pertama. */
  var ISTILAH = [
    ['OTP', ['otp', 'kode otp', 'verifikasi', 'sandi sekali pakai']],
    ['PIN', ['pin', 'kode pin']],
    ['API', ['api', 'apikey', 'apikeys', 'endpoint']],
    ['Prompt', ['prompt', 'prompts', 'promt', 'instruksi ai']],
    ['Menu', ['menu', 'menus', 'daftar menu', 'paket menu']],
    ['Link', ['link', 'tautan', 'url', 'alamat web', 'links', 'linknya']],
    /* Code, bukan Kode. Dia mengetik "code" waktu mencari potongan program,
       dan itu istilah yang memang hidup dalam bahasa Inggris di kepalanya. */
    ['Code', ['code', 'kode', 'coding', 'snippet', 'script', 'syntax', 'sintaks',
              'potongan code', 'potongan kode', 'source']],
    /* Password paling sering dipakai di sini, dan sebagian besar memang bukan
       yang paling rahasia: wifi, akun aplikasi, sandi tamu. Yang benar-benar
       rahasia ditandai gemboknya sendiri - istilahnya tidak menentukan itu. */
    ['Password', ['password', 'sandi', 'kata sandi', 'pass', 'pw', 'passwd', 'pwd']],
    ['Email', ['email', 'surel', 'e-mail', 'mail', 'emailnya']],
    ['Telepon', ['telepon', 'telpon', 'telp', 'hp', 'phone', 'nomor hp', 'wa', 'whatsapp']],
    ['Akun', ['akun', 'account', 'login', 'username', 'user']],
    /* "rekening" sengaja TIDAK dianggap sinonim "nomor": dia jenis barangnya,
       bukan kata lain untuk hal yang sama. Kalau disamakan, "Nomor rekening
       BCA" kehilangan kata "rekening" - padahal itu yang diketik saat mencari. */
    ['Nomor', ['nomor', 'no', 'nomer', 'number']],
    ['Alamat', ['alamat', 'address', 'lokasi']],
    ['Resep', ['resep', 'obat', 'dosis']],
    ['Berkas', ['berkas', 'file', 'dokumen', 'document']],
    ['Jadwal', ['jadwal', 'schedule', 'agenda']],
    ['Harga', ['harga', 'price', 'tarif', 'biaya']],
    /* Idea, bukan Ide - aturan Inggris-dulu berlaku juga di sini, dan
       konsistensinya lebih berharga daripada satu kata yang lebih pendek. */
    ['Idea', ['idea', 'ide', 'gagasan', 'konsep']]
  ];

  /* PENANDA DUA KATA, dan ini bukan kerapian - "Client ID" memang namanya di
     Google. Memotongnya jadi "Client" atau menggantinya jadi "Token" membuat
     orangnya mencari dengan kata yang tidak pernah dia dengar dari sumbernya.

     Frasa selalu menang atas kata tunggal: dia lebih khusus, dan yang lebih
     khusus selalu lebih berguna sebagai penanda. */
  var FRASA = [
    ['Client ID', ['client id', 'clientid', 'oauth client id', 'id client']],
    ['Client Secret', ['client secret', 'clientsecret', 'secret client']],
    ['API Key', ['api key', 'apikey', 'kunci api']]
  ];

  function cariFrasa(kata, i) {
    if (i + 1 >= kata.length) return '';
    var dua = normal(kata[i].replace(/[^\wÀ-ÿ]/g, '') + ' ' + kata[i + 1].replace(/[^\wÀ-ÿ]/g, ''));
    for (var f = 0; f < FRASA.length; f++) {
      if (FRASA[f][1].indexOf(dua) >= 0) return FRASA[f][0];
    }
    return '';
  }

  /* Kata yang dipakai apa adanya sebagai penanda, walau bukan istilah yang
     dikenal. Begitu satu kebiasaan menulis judul terbentuk - dan kebiasaan itu
     memang yang sedang tumbuh - penanda buatannya sendiri harus dihormati,
     bukan diganti dengan tebakan dari elemen. */
  function penandaSendiri(kata) {
    var w = String(kata || '').replace(/[^\wÀ-ÿ]/g, '');
    if (w.length < 3 || w.length > 14) return '';
    if (/\d/.test(w)) return '';
    if (BUANG.indexOf(normal(w)) >= 0) return '';
    /* Ditulis berhuruf besar di awal = dia memang memaksudkannya sebagai
       penanda, bukan kata biasa yang kebetulan di depan. */
    if (w[0] !== w[0].toUpperCase() || w[0] === w[0].toLowerCase()) return '';
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  /* Penanda yang diturunkan dari elemen, dipakai kalau judulnya sendiri belum
     menyebut satu pun istilah yang dikenal. */
  var PENANDA_JENIS = {
    tautan: 'Link', surel: 'Email', telepon: 'Telepon',
    kode: 'Code', nomor: 'Nomor', alamat: 'Alamat', berkas: 'Berkas',
    jadwal: 'Jadwal', harga: 'Harga', prompt: 'Prompt'
  };

  function peringkatIstilah(kata) {
    var k = normal(kata);
    if (!k) return -1;
    for (var i = 0; i < ISTILAH.length; i++) {
      if (ISTILAH[i][1].indexOf(k) >= 0) return i;
    }
    return -1;
  }

  function bakuIstilah(kata) {
    var i = peringkatIstilah(kata);
    return i < 0 ? '' : ISTILAH[i][0];
  }

  /* Kata kembar dibuang, yang pertama menang. Yang dibandingkan bentuk
     normalnya, jadi "Link" dan "link," terhitung sama. */
  function buangKembar(kata) {
    var lihat = {};
    return kata.filter(function (w) {
      var n = normal(w);
      if (!n) return true;
      /* Kata sambung boleh berulang - membuangnya bikin judulnya jadi
         telegram yang sulit dibaca. */
      if (n.length <= 3) return true;
      if (lihat[n]) return false;
      lihat[n] = true;
      return true;
    });
  }

  function penandaDari(entri) {
    var el = (entri && entri.elemen) || [];
    for (var i = 0; i < el.length; i++) {
      if (PENANDA_JENIS[el[i].jenis]) return PENANDA_JENIS[el[i].jenis];
    }
    if (entri && entri.jenis === 'tautan') return 'Link';
    if (entri && entri.jenis === 'gambar') return 'Gambar';
    if (entri && entri.jenis === 'suara') return 'Rekaman';
    return '';
  }

  function susunJudul(teks, entri) {
    var kata = String(teks || '').trim().split(/\s+/).filter(Boolean);
    if (!kata.length) return '';

    /* Istilah yang bentrok dibakukan lebih dulu, di mana pun letaknya -
       "tautan" di tengah kalimat pun jadi "link". */
    kata = kata.map(function (w) {
      var baku = bakuIstilah(w.replace(/[^\wÀ-ÿ]/g, ''));
      if (!baku) return w;
      /* Yang di tengah kalimat ditulis huruf kecil supaya judulnya tidak
         terbaca seperti judul berita. */
      return baku === 'API' ? baku : baku.toLowerCase();
    });

    kata = buangKembar(kata);

    /* Penanda di depan. Kalau judulnya sudah menyebut istilahnya, istilah itu
       yang diangkat ke depan - bukan ditambahi penanda kedua yang artinya
       sama. */
    /* Frasa dicari lebih dulu dan langsung menang - dua kata yang dikenal
       selalu lebih khusus daripada satu kata mana pun di kalimat yang sama. */
    var adaIstilah = -1, istilah = '', terbaik = 999, panjangnya = 1;
    for (var f = 0; f < kata.length && f < 6; f++) {
      var fr = cariFrasa(kata, f);
      if (fr) { istilah = fr; adaIstilah = f; panjangnya = 2; terbaik = -1; break; }
    }
    if (adaIstilah < 0) {
      for (var i = 0; i < kata.length && i < 6; i++) {
        var p = peringkatIstilah(kata[i].replace(/[^\wÀ-ÿ]/g, ''));
        if (p >= 0 && p < terbaik) { terbaik = p; adaIstilah = i; istilah = ISTILAH[p][0]; }
      }
    }
    if (adaIstilah >= 0) {
      kata.splice(adaIstilah, panjangnya);
      /* Kata umum yang menempel tepat SEBELUM istilah khususnya ikut dibuang:
         "kode otp" -> OTP, "nomor telepon" -> Telepon. Yang umum di situ cuma
         ancang-ancang menuju yang khusus, dan menyisakannya berarti judulnya
         menyebut jenis yang sama dua kali. Yang datang SESUDAHNYA dibiarkan -
         "Nomor rekening BCA" masih menyimpan "rekening", dan kata itu dipakai
         orangnya waktu mencari. */
      var sebelum = adaIstilah - 1;
      if (sebelum >= 0) {
        var pUmum = peringkatIstilah(kata[sebelum].replace(/[^\wÀ-ÿ]/g, ''));
        if (pUmum > terbaik) kata.splice(sebelum, 1);
      }
    } else {
      /* Penanda buatannya sendiri lebih tahu daripada tebakan dari elemen -
         dia yang tahu catatan ini barang apa. */
      istilah = penandaSendiri(kata[0]);
      if (istilah) kata.shift();
      else istilah = penandaDari(entri);
    }

    var sisa = kata.join(' ').replace(/^[\s,;:.\-]+/, '').trim();
    var hasil = istilah ? (sisa ? istilah + ' ' + sisa : istilah) : sisa;
    return hasil.split(/\s+/).slice(0, 9).join(' ').slice(0, 90);
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
    return susunJudul(judulTeks(entri.isi), entri);
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

    /* Awalan: "apps desig" -> "apps design". TAPI cuma kalau yang kurang
       tinggal satu-dua huruf.

       Tanpa batas itu, aturan ini menukar satu kata dengan kata LAIN yang
       kebetulan diawali sama: "project" jadi "ProjectSpace" - padahal
       ProjectSpace itu nama tempat, bukan proyek. Mesin di berkas ini cuma
       bisa membandingkan EJAAN; dia tidak tahu apa-apa soal makna. Ejaan yang
       mirip tidak berarti maknanya berhubungan, dan tebakan makna yang salah
       lebih merusak daripada tidak menebak sama sekali - karena diam-diam dia
       menaruh catatanmu di rak yang keliru, dan kamu baru tahu enam bulan lagi
       waktu mencarinya.

       Dua huruf itu batas antara "ketikannya terputus" dan "ini kata lain". */
    var EKOR_MAKS = 2;
    var awalan = ada.filter(function (c) {
      var n = normal(c);
      return n.indexOf(k) === 0 && n.length - k.length <= EKOR_MAKS;
    }).sort(function (a, b) { return a.length - b.length; });
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

  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
               'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  /* Bulannya selalu disingkat. "6 September" dan "6 Sep" menjawab pertanyaan
     yang sama persis, tapi yang panjang mendorong judulnya menyempit - dan
     judul itulah yang sebenarnya dibaca. */
  function tanggalPendek(ts) {
    var d = new Date(ts || Date.now());
    var pendek = d.getDate() + ' ' + BULAN[d.getMonth()];
    return d.getFullYear() === new Date().getFullYear()
      ? pendek : pendek + ' ' + String(d.getFullYear()).slice(2);
  }

  /* Jamnya sengaja dibuang. Tidak ada satu pun keputusan di aplikasi ini yang
     berubah karena catatannya jatuh pukul 08.02 atau 17.40 - yang menolong
     cuma "hari ini" lawan "sudah lama". Menuliskan jam berarti membayar
     selebar enam huruf untuk keterangan yang tidak pernah dipakai. */
  function waktuRingkas(ts) {
    var d = new Date(ts || Date.now());
    var kini = new Date();
    if (d.toDateString() === kini.toDateString()) return 'Hari ini';
    var kemarin = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() - 1);
    if (d.toDateString() === kemarin.toDateString()) return 'Kemarin';
    return tanggalPendek(ts);
  }

  function tanggalIndo(ts) {
    var d = new Date(ts || Date.now());
    return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ===================== LABEL RAK =====================
     Pemakainya tidak berpikir dalam "kategori" - dia berpikir dalam nama
     proyek, divisi, dan perusahaan. Itu jumlahnya terbatas dan hampir tidak
     pernah berubah, jadi dia pantas jadi barisan tetap yang selalu ada di
     tempat yang sama, bukan daftar yang menyusun ulang dirinya sendiri.

     Tanda '=' ada untuk SATU keadaan saja: kata yang dipakai AI berbeda dari
     kata yang ada di kepalamu. "PS" cuma hidup di kepalamu, sementara AI
     melabeli "ProjectSpace" - tanpa jembatan itu, label yang rapi justru
     tidak menemukan apa-apa. Dia BUKAN kamus sinonim: "Kiddo = kids, anak"
     tidak menambah apa pun, karena tidak ada yang pernah menuliskannya beda.

     PANJANG NAMANYA TIDAK DIBATASI. Dulu dipotong di 16 huruf supaya muat di
     barisan label yang melintang - tapi itu memotong DATA demi TAMPILAN, dan
     memotongnya diam-diam: "Amara Operasional" tersimpan jadi "Amara
     Operasiona", dan "MAP Mata Angin Pratama" jadi "MAP Mata Angin P" yang
     tidak berarti apa-apa. Sekarang nama gudang disimpan utuh, dan yang
     memendekkannya cuma gaya - dengan titik-titik, di layar, bukan di data. */

  function uraiLabel(teks) {
    var keluar = [];
    String(teks || '').split(/[\r\n]+/).forEach(function (baris) {
      var potong = baris.split('=');
      var nama = potong[0].replace(/^#+/, '').trim();
      if (!nama) return;
      var istilah = [normal(nama)];
      (potong[1] || '').split(',').forEach(function (a) {
        var v = normal(a);
        if (v && istilah.indexOf(v) < 0) istilah.push(v);
      });
      if (!keluar.some(function (x) { return x.nama.toLowerCase() === nama.toLowerCase(); })) {
        keluar.push({ nama: nama, istilah: istilah });
      }
    });
    /* Batasnya ada bukan demi kerapian, tapi karena pohonnya disusun ulang
       tiap huruf yang kamu ketik - dan menyusunnya membandingkan tiap gudang
       dengan tiap gudang lain. Seratus dua puluh masih tidak terasa; seribu
       akan membuat pengetikan tersendat, dan pengetikan yang tersendat
       membunuh kebiasaannya. */
    return keluar.slice(0, 120);
  }

  /* HIERARKI DARI PENAMAAN, bukan dari sintaks baru. Label yang namanya
     diawali nama label lain otomatis jadi anaknya:

         Amara            -> rumah
         Amara Sales      -> gudang di dalamnya
         Amara Apps       -> gudang di dalamnya

     Tidak ada tanda khusus yang harus diingat, tidak ada layar baru, dan
     daftar labelnya tetap datar seperti sebelumnya. Yang berubah cuma cara
     membacanya. Dua tingkat saja - tingkat ketiga berarti ada tingkat tengah
     yang harus diingat, dan yang harus diingat pasti terlewat. */
  function pohonLabel(daftar) {
    var semua = daftar || [];
    return semua.map(function (l) {
      var induk = null;
      semua.forEach(function (c) {
        if (c === l) return;
        var n = normal(c.nama);
        if (normal(l.nama).indexOf(n + ' ') !== 0) return;
        /* Yang terpanjang menang: "Amara Apps Satu" milik "Amara Apps",
           bukan milik "Amara". */
        if (!induk || normal(c.nama).length > normal(induk.nama).length) induk = c;
      });
      return {
        nama: l.nama, istilah: l.istilah,
        induk: induk ? induk.nama : '',
        ekor: induk ? l.nama.slice(induk.nama.length).trim() : l.nama
      };
    });
  }

  /* MELENGKAPI NAMA GUDANG SAMBIL DIKETIK.

     Cuma berlaku di DUA KATA PERTAMA - sesudah itu kamu sedang menulis isinya,
     bukan menyebut alamatnya, dan teks bayangan yang muncul di tengah kalimat
     berubah dari membantu jadi mengganggu. Batas dua kata itulah yang membuat
     dia tidak terasa ada sepanjang hari.

     Yang dilengkapi HANYA nama gudang yang sudah ada. Dia tidak pernah
     menebak kata biasa, jadi tidak pernah menghalangi kalimat apa pun. */
  function lengkapiRuang(teks, daftar) {
    var t = String(teks || '');
    /* Baris kedua ke bawah sudah pasti isi, bukan alamat. */
    if (t.indexOf('\n') >= 0) return null;
    var kata = t.split(/\s+/).filter(Boolean);
    if (!kata.length || kata.length > 2) return null;
    /* Spasi di ujung berarti kata itu sudah selesai diketik - kalau sudah dua
       kata utuh, tidak ada lagi yang perlu dilengkapi. */
    if (/\s$/.test(t) && kata.length >= 2) return null;

    var k = normal(t).replace(/\s+/g, ' ');
    var cocok = (daftar || []).filter(function (l) {
      var n = normal(l.nama);
      return n.indexOf(k) === 0 && n.length > k.length;
    }).sort(function (a, b) { return a.nama.length - b.nama.length; });

    if (!cocok.length) return null;
    return { nama: cocok[0].nama, ekor: cocok[0].nama.slice(t.length), pilihan: cocok };
  }

  /* Gudang mana yang akan menampung, dibaca dari teksnya sendiri. Yang
     dikembalikan yang PALING PANJANG cocok: "amara apps error login" mendarat
     di "Amara Apps", bukan berhenti di "Amara". */
  function bacaRuang(teks, daftar) {
    var k = normal(teks).replace(/\s+/g, ' ');
    if (!k) return null;
    var terbaik = null;
    (daftar || []).forEach(function (l) {
      var n = normal(l.nama);
      if (k !== n && k.indexOf(n + ' ') !== 0) return;
      if (!terbaik || n.length > normal(terbaik.nama).length) terbaik = l;
    });
    return terbaik;
  }

  function tulisLabel(daftar) {
    return (daftar || []).map(function (l) {
      var lain = (l.istilah || []).slice(1);
      return lain.length ? l.nama + ' = ' + lain.join(', ') : l.nama;
    }).join('\n');
  }

  function cocokLabel(e, istilah) {
    if (!istilah || !istilah.length) return true;
    var kat = normal(e.kategori).split(' ').filter(Boolean);
    var katUtuh = normal(e.kategori);
    var tag = (e.tag || []).map(normal);
    return istilah.some(function (t) {
      if (!t) return false;
      if (kat.indexOf(t) >= 0 || tag.indexOf(t) >= 0) return true;
      /* Tag ditulis mepet ("AmaraLiving"), labelnya cuma sepenggal ("Amara").
         Awalan dicocokkan - tapi cuma dari empat huruf ke atas, karena "PS"
         atau "MAP" sebagai awalan akan menyeret hampir semua isi rak. */
      var rapat = t.replace(/\s+/g, '');
      if (rapat.length >= 4 && tag.some(function (x) {
        return x.replace(/\s+/g, '').indexOf(rapat) === 0;
      })) return true;
      if (t.indexOf(' ') >= 0 && katUtuh.indexOf(t) >= 0) return true;
      return false;
    });
  }

  /* ===================== PENCARIAN =====================
     Berjalan di atas salinan lokal. Tidak ada jaringan, tidak ada AI, tidak
     ada tunggu. Ini bagian yang paling sering dipakai, jadi paling murah. */

  function cari(daftar, kueri, saringJenis, saringKat) {
    var kata = normal(kueri).split(' ').filter(Boolean);

    var pakai = (daftar || []).filter(function (e) {
      if (e.pensiun) return false;
      /* Tugas menumpang di toko yang sama supaya tidak ada basis data kedua,
         tapi dia bukan catatan. "Bayar listrik" muncul di hasil pencarian
         cuma menambah barang yang harus dilewati - dan yang lebih buruk,
         tugas yang sudah selesai pun ikut naik ke permukaan. Dia punya
         layarnya sendiri, dan di sanalah satu-satunya tempat dia dicari. */
      if (e.jenis === 'tugas') return false;
      if (saringJenis && saringJenis !== 'semua' && e.jenis !== saringJenis) return false;
      /* Kategori boleh berisi beberapa keyword yang dipisah spasi, jadi
         saringannya mencocokkan SALAH SATU - bukan seluruh isian. Kalau yang
         dikirim berupa daftar, itu label rak: satu label boleh punya beberapa
         kata, dan tag pun ikut dihitung. */
      if (saringKat && saringKat.length) {
        if (typeof saringKat === 'string') {
          if (normal(e.kategori).split(' ').indexOf(normal(saringKat)) < 0) return false;
        } else if (!cocokLabel(e, saringKat)) return false;
      }
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
    susunJudul: susunJudul, bakuIstilah: bakuIstilah,
    benahiKategori: benahiKategori,
    labelOtomatis: labelOtomatis, cari: cari,
    elemenOtomatis: elemenOtomatis, gabungElemen: gabungElemen,
    samarkanPenanda: samarkanPenanda,
    buangSerpihan: buangSerpihan,
    uraiLabel: uraiLabel, tulisLabel: tulisLabel, cocokLabel: cocokLabel,
    pohonLabel: pohonLabel, lengkapiRuang: lengkapiRuang, bacaRuang: bacaRuang,
    normal: normal, jarak: jarak, waktuPendek: waktuPendek,
    tanggalIndo: tanggalIndo, waktuRingkas: waktuRingkas,
    tanggalPendek: tanggalPendek
  };
})(window);
