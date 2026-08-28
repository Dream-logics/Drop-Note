/* ============================================================================
   Drop Note — alur UI
   ============================================================================
   Berkas ini cuma penghubung: HTML sudah ada, otak sudah ada, penyimpanan
   sudah ada. Yang dikerjakan di sini adalah urutan kejadiannya - dan justru
   di urutan itulah aplikasi seperti ini biasanya mati.

   TIGA HAL YANG MENENTUKAN, DAN TIDAK BOLEH DIBALIK

   1. Jalur drop tidak pernah menyentuh jaringan. Susun entri, tulis ke
      IndexedDB, kosongkan kotak. Selesai. Tidak ada fetch, tidak ada await
      yang bisa menggantung. Begitu nge-drop terasa menunggu, kebiasaannya
      mati dan aplikasinya ikut mati.

   2. Layar depan tidak pernah menampilkan kartu. Sesak datang dari tampilan,
      bukan dari jumlah - sepuluh ribu catatan yang tidak terlihat tidak
      menyesakkan sama sekali. Godaan "tampilkan 3 catatan terakhir di depan"
      adalah perbaikan yang paling sering terpikir, dan itu membatalkan
      seluruh gunanya.

   3. Tidak ada dialog konfirmasi di jalan sehari-hari. Tiap pertanyaan yang
      kita ajukan adalah tagihan pada dompet keputusan yang sudah kosong.
      Membuang pun tidak bertanya: langsung pensiunkan, lalu tawarkan urung
      lewat pesan sekilas. Yang bertanya cuma satu - menghapus semua data.
   ============================================================================ */
(function (global) {
  'use strict';

  /* Jeda-jeda ini bukan angka acak: 250ms cukup untuk berhenti mengetik satu
     alamat, 120ms membuat pencarian terasa mengikuti jari, 700ms cukup lama
     supaya menyimpan tidak mengganggu tapi cukup pendek supaya menutup layar
     tidak pernah kehilangan kalimat. */
  var JEDA_BACA = 250;
  var JEDA_CARI = 120;
  var JEDA_SIMPAN = 700;

  /* Versi lama hanya didorong ke riwayat kalau suntingan terakhir sudah lama.
     Tanpa jarak ini, satu sesi mengetik melahirkan lima puluh versi dan
     riwayatnya jadi sampah - persis masalah yang mau dihindari. */
  var JARAK_RIWAYAT = 10 * 60 * 1000;
  var RIWAYAT_MAKS = 20;

  var PUTARAN_LABEL = 3 * 60 * 1000;

  /* Momen paling murah untuk melabeli adalah tepat SESUDAH catatan jatuh:
     HP masih di tangan, sinyal masih menyala. Menunggu putaran 3 menit membuat
     catatan yang baru dijatuhkan tidak bisa dicari padahal orangnya masih di
     depan layar - dan yang dia simpulkan bukan "belum sempat", melainkan
     "pencariannya tidak bekerja".

     Ini tidak melanggar aturan nomor satu: yang dilarang adalah AI MENGHAMBAT
     drop. Ini berjalan sesudah drop selesai, di belakang layar, dan boleh
     gagal diam-diam seperti biasa.

     Ditunda sebentar, bukan seketika, supaya menjatuhkan lima catatan
     berturut-turut tetap jadi satu panggilan borongan - bukan lima. Jedanya
     dipendekkan sampai batas itu saja: lebih cepat berarti judul, elemen, dan
     tagnya sudah rapi sebelum orangnya sempat pindah layar - dan yang dia
     rasakan bukan "AI-nya lambat", tapi "aplikasinya memang begitu". */
  var JEDA_SUNDUL = 1200;

  /* Foto HP 6 MB akan memenuhi kuota penyimpanan dalam hitungan minggu, dan
     kuota penuh artinya drop mulai gagal - pelanggaran aturan nomor satu. */
  var SISI_MAKS = 1600;
  var MUTU_JPEG = 0.82;

  var SERING = 5;

  var JENIS_SARING = [
    ['semua', 'Semua'], ['tautan', 'Tautan'], ['gambar', 'Gambar'],
    ['berkas', 'Berkas'], ['daftar', 'Daftar'], ['suara', 'Suara'],
    ['catatan', 'Catatan']
  ];

  /* ===================== alat kecil ===================== */

  function $(pemilih, akar) { return (akar || document).querySelector(pemilih); }
  function $$(pemilih, akar) {
    return Array.prototype.slice.call((akar || document).querySelectorAll(pemilih));
  }

  function H(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function tunda(kerja, ms) {
    var jam = null;
    return function () {
      var arg = arguments, diri = this;
      clearTimeout(jam);
      jam = setTimeout(function () { kerja.apply(diri, arg); }, ms);
    };
  }

  function idBaru(awalan) {
    return awalan + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  function ukuranTeks(n) {
    if (!n) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function entriBaru(jenis) {
    var t = Date.now();
    return {
      id: idBaru('e'), jenis: jenis || 'teks',
      judul: '', judulManual: false, isi: '', daftar: [],
      kategori: '', label: [], tag: [], elemen: [],
      berkasId: null, driveId: null, thumb: '',
      namaBerkas: '', tipeBerkas: '', ukuran: 0,
      dibuat: t, diubah: t, dipakai: 0,
      diLabeliAI: false, diBacaAI: false,
      pensiun: false, dihapus: false, riwayat: []
    };
  }

  /* ===================== keadaan ===================== */

  var semuaEntri = [];        /* salinan lokal; pencarian jalan di atas ini */
  var setelanSaat = {};
  var draf = null;            /* lampiran yang sudah siap tapi belum di-drop */
  var entriCatat = null;
  var saringJenis = 'semua';
  var saringKat = '';
  var urutSaat = 'waktu';
  var urlSementara = [];
  var perekam = null;
  var rekamJam = null;
  var layarSaat = 'l-utama';
  var tumpukan = [];
  var pakaiRiwayatBrowser = true;
  var pesanJam = null;

  /* ===================== pesan sekilas ===================== */

  function sembunyikanPesan() {
    var kotak = $('#pesan');
    kotak.classList.remove('tampil');
    kotak.style.pointerEvents = 'none';
  }

  /* Pesan boleh membawa satu tindakan (biasanya "Urungkan"). Itu sebabnya
     membuang tidak perlu bertanya lebih dulu: urungnya ditawarkan setelah,
     bukan sebelum - dan yang tidak butuh tinggal mengabaikannya. */
  function pesan(teks, aksi) {
    var kotak = $('#pesan');
    kotak.textContent = teks;
    kotak.style.pointerEvents = 'none';
    if (aksi) {
      var tombol = document.createElement('button');
      tombol.className = 'pesan-aksi';
      tombol.textContent = aksi.teks;
      tombol.addEventListener('click', function () { sembunyikanPesan(); aksi.jalan(); });
      kotak.appendChild(tombol);
      kotak.style.pointerEvents = 'auto';
    }
    kotak.classList.add('tampil');
    clearTimeout(pesanJam);
    pesanJam = setTimeout(sembunyikanPesan, aksi ? 6000 : 1800);
  }

  /* ===================== layar ===================== */

  function tampilkanLayar(id) {
    if (layarSaat === 'l-catat' && id !== 'l-catat') simpanCatat();
    if (layarSaat === 'l-hasil' && id !== 'l-hasil') bersihkanUrl();
    ['l-mulai', 'l-utama', 'l-hasil', 'l-catat', 'l-setelan'].forEach(function (x) {
      $('#' + x).classList.toggle('aktif', x === id);
    });
    layarSaat = id;
    if (id === 'l-utama') perbaruiJumlah();
    global.scrollTo(0, 0);
  }

  function keLayar(id) {
    if (id === layarSaat) return;
    tumpukan.push(layarSaat);
    if (pakaiRiwayatBrowser) {
      try { history.pushState({ layar: id }, ''); } catch (e) { pakaiRiwayatBrowser = false; }
    }
    tampilkanLayar(id);
  }

  /* Tombol kembali di layar harus sama persis dengan tombol kembali HP.
     Kalau berbeda, orang berhenti percaya pada salah satunya. */
  function kembali() {
    if (pakaiRiwayatBrowser) { history.back(); return; }
    tampilkanLayar(tumpukan.pop() || 'l-utama');
  }

  /* ===================== cache entri ===================== */

  function muatSemua() {
    return TSimpan.semua().then(function (a) {
      semuaEntri = a || [];
      perbaruiJumlah();
      return semuaEntri;
    });
  }

  function segarkanCache(e) {
    for (var i = 0; i < semuaEntri.length; i++) {
      if (semuaEntri[i].id === e.id) { semuaEntri[i] = e; return; }
    }
    semuaEntri.unshift(e);
  }

  function perbaruiJumlah() {
    var n = semuaEntri.filter(function (e) { return !e.pensiun; }).length;
    $('#jumlah').textContent = n + ' tersimpan';
  }

  function daftarKategori() {
    var hitung = {};
    semuaEntri.forEach(function (e) {
      if (e.pensiun || !e.kategori) return;
      /* Satu catatan boleh punya beberapa keyword, dipisah spasi. Dihitung
         satu per satu, kalau tidak "klien urgent" jadi rak sendiri yang
         terpisah dari "klien". */
      pecahKeyword(e.kategori).forEach(function (k) {
        hitung[k] = (hitung[k] || 0) + 1;
      });
    });
    return Object.keys(hitung).map(function (k) {
      return { kategori: k, jumlah: hitung[k] };
    }).sort(function (a, b) { return b.jumlah - a.jumlah; });
  }

  /* ===================== layar utama ===================== */

  function bacaDraf() {
    var teks = $('#kotak').value;
    if (draf) return draf.jenis;
    if ($('#petak-daftar').classList.contains('sembunyi')) return TOtak.bacaJenis(teks);
    return 'daftar';
  }

  function perbaruiTebakan() {
    var kotak = $('#tebakan');
    var teks = $('#kotak').value.trim();

    if (draf) {
      kotak.classList.remove('sembunyi');
      $('#tebakan-jenis').textContent = draf.jenis === 'suara' ? 'Rekaman' :
        (draf.jenis === 'gambar' ? 'Gambar' : 'Berkas');
      $('#tebakan-judul').textContent = draf.namaBerkas;
      $('#tebakan-ket').textContent = ukuranTeks(draf.ukuran) +
        (draf.jenis === 'gambar' ? ' · sudah dikecilkan' : '');
      return;
    }

    if (TOtak.bacaJenis(teks) === 'tautan') {
      var url = TOtak.ambilUrl(teks);
      kotak.classList.remove('sembunyi');
      $('#tebakan-jenis').textContent = 'Tautan terbaca';
      $('#tebakan-judul').textContent = TOtak.judulTautan(url);
      $('#tebakan-ket').textContent = 'Judul disusun dari alamatnya, tanpa jaringan.';
      return;
    }

    kotak.classList.add('sembunyi');
  }

  function pecahKeyword(s) {
    return String(s || '').split(/\s+/).filter(Boolean);
  }

  /* Pilihan bawaan supaya tidak ada yang perlu dipikirkan. Mengetik keyword
     dari nol itu keputusan kecil yang diulang tiap kali nge-drop - dan
     keputusan berulang persis yang membunuh sistem-sistem sebelumnya.
     Yang sering dipakai naik sendiri di depan daftar ini. */
  var KEYWORD_UMUM = ['kerja', 'klien', 'proyek', 'keuangan', 'pribadi', 'rumah',
                      'kesehatan', 'kendaraan', 'belanja', 'kontak', 'sandi', 'dokumen'];

  function perbaruiUsulKategori() {
    var wadah = $('#kat-usul');
    var dipilih = pecahKeyword($('#kat').value).map(function (k) { return k.toLowerCase(); });

    var urut = [];
    function tambah(k) {
      if (k && urut.indexOf(k) < 0) urut.push(k);
    }

    var contoh = { isi: $('#kotak').value, judul: '', namaBerkas: draf ? draf.namaBerkas : '' };
    tambah(TOtak.usulKategori(contoh, daftarKategori()));
    daftarKategori().slice(0, 6).forEach(function (r) { tambah(r.kategori); });
    dipilih.forEach(tambah);
    KEYWORD_UMUM.forEach(tambah);

    wadah.innerHTML = urut.slice(0, 14).map(function (k) {
      var nyala = dipilih.indexOf(k.toLowerCase()) >= 0;
      return '<button class="cip' + (nyala ? ' nyala' : '') + '" data-kat="' + H(k) + '">#' +
             H(k) + '</button>';
    }).join('');
  }

  /* Centang = tambah, centang lagi = buang. Bukan mengganti: satu catatan
     boleh masuk beberapa rak sekaligus, dan memaksa memilih satu adalah
     keputusan yang tidak perlu diadakan. */
  function alihKeyword(k) {
    var isian = $('#kat');
    var ada = pecahKeyword(isian.value);
    var i = -1;
    ada.forEach(function (x, n) { if (x.toLowerCase() === k.toLowerCase()) i = n; });
    if (i >= 0) ada.splice(i, 1);
    else ada.push(k);
    isian.value = ada.join(' ');
    $('#b-kat-hapus').classList.toggle('sembunyi', !isian.value);
    perbaruiUsulKategori();
  }

  /* Koreksi kategori sengaja DITAMPILKAN, tidak diam-diam. Tebakan yang tidak
     terlihat itu yang bikin sebuah alat terasa tidak bisa ditebak - dan alat
     yang tidak bisa ditebak akan ditinggalkan. */
  function benahiKotakKategori() {
    var kotak = $('#kat');
    var tanda = $('#kat-koreksi');
    var rak = daftarKategori().map(function (r) { return r.kategori; });

    /* Dibetulkan per kata, bukan sekaligus: "kerja klien" itu dua rak, dan
       mencocokkannya sebagai satu kalimat tidak akan pernah ketemu. */
    var koreksi = [];
    var keluar = pecahKeyword(kotak.value).map(function (k) {
      var h = TOtak.benahiKategori(k, rak);
      if (h.dibetulkan) koreksi.push('<s>' + H(h.asli) + '</s> → <b>' + H(h.kategori) + '</b>');
      return h.kategori;
    }).filter(Boolean);

    var gabung = keluar.join(' ');
    kotak.value = gabung;
    if (koreksi.length) {
      tanda.innerHTML = koreksi.join(' · ');
      tanda.classList.remove('sembunyi');
    } else {
      tanda.classList.add('sembunyi');
    }
    $('#b-kat-hapus').classList.toggle('sembunyi', !gabung);
    perbaruiUsulKategori();
    return gabung;
  }

  function barisDaftarBaru(teks, selesai) {
    var baris = document.createElement('div');
    baris.className = 'baris-daftar';
    baris.innerHTML = '<input type="checkbox"><input type="text" placeholder="baris">';
    var centang = baris.querySelector('input[type=checkbox]');
    var isian = baris.querySelector('input[type=text]');
    centang.checked = !!selesai;
    isian.value = teks || '';
    isian.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); tambahBarisDaftar(); }
    });
    $('#daftar-baris').appendChild(baris);
    return isian;
  }

  function tambahBarisDaftar() {
    var isian = barisDaftarBaru('', false);
    isian.focus();
  }

  function ambilDaftar() {
    return $$('#daftar-baris .baris-daftar').map(function (b) {
      return {
        teks: b.querySelector('input[type=text]').value.trim(),
        selesai: b.querySelector('input[type=checkbox]').checked
      };
    }).filter(function (b) { return b.teks; });
  }

  function setelDaftarNyala(nyala) {
    $('#petak-daftar').classList.toggle('sembunyi', !nyala);
    $$('.lamp').forEach(function (b) {
      if (b.getAttribute('data-lamp') === 'daftar') b.classList.toggle('nyala', nyala);
    });
    if (nyala && !$$('#daftar-baris .baris-daftar').length) barisDaftarBaru('', false);
  }

  function kosongkanKotak() {
    $('#kotak').value = '';
    $('#daftar-baris').innerHTML = '';
    setelDaftarNyala(false);
    draf = null;
    $$('.lamp').forEach(function (b) { b.classList.remove('nyala'); });
    $('#tebakan').classList.add('sembunyi');
    $('#kat-koreksi').classList.add('sembunyi');
    perbaruiUsulKategori();
  }

  /* JALUR MASUK. Tidak ada satu pun panggilan jaringan di sini, dan tidak
     boleh pernah ada. Pelabelan AI menyusul belakangan lewat antrean. */
  function drop() {
    var teks = $('#kotak').value.trim();
    var daftar = ambilDaftar();
    var jenis = bacaDraf();

    if (!teks && !daftar.length && !draf) { pesan('Kotaknya masih kosong'); return; }

    var e = entriBaru(jenis);
    e.kategori = benahiKotakKategori();
    e.isi = jenis === 'tautan' ? TOtak.ambilUrl(teks) : teks;
    e.daftar = daftar;
    if (draf) {
      e.berkasId = draf.berkasId;
      e.namaBerkas = draf.namaBerkas;
      e.tipeBerkas = draf.tipeBerkas;
      e.ukuran = draf.ukuran;
      e.thumb = draf.thumb || '';
      e.driveId = draf.driveId || null;
    }
    e.judul = TOtak.judulOtomatis(e);
    e.label = TOtak.labelOtomatis(e);
    /* Elemen berpola sudah terpisah SEBELUM AI menyentuhnya. Kalau AI mati,
       tautan dan kode tetap bisa disalin sendiri-sendiri. */
    e.elemen = TOtak.elemenOtomatis(e);

    TSimpan.taruh(e).then(function () {
      segarkanCache(e);
      perbaruiJumlah();
      /* Kategori sengaja TIDAK dikosongkan: menjatuhkan lima catatan ke rak
         yang sama itu hal biasa, dan mengetiknya lagi tiap kali adalah
         keputusan berulang tanpa guna. Supaya tidak diam-diam, raknya ikut
         disebut di pesan. */
      pesan('Tersimpan' + (e.kategori ? ' · #' + e.kategori : ''));
      kosongkanKotak();
      $('#kotak').focus();
      sundulLabel();
    }).catch(function (err) {
      pesan('Gagal menyimpan: ' + err.message);
    });
  }

  /* ===================== berkas & rekaman ===================== */

  function kecilkanGambar(berkas) {
    return new Promise(function (terima) {
      var url = URL.createObjectURL(berkas);
      var gbr = new Image();
      gbr.onload = function () {
        var w = gbr.naturalWidth, h = gbr.naturalHeight;
        var skala = Math.min(1, SISI_MAKS / Math.max(w, h));
        var kanvas = document.createElement('canvas');
        kanvas.width = Math.round(w * skala);
        kanvas.height = Math.round(h * skala);
        kanvas.getContext('2d').drawImage(gbr, 0, 0, kanvas.width, kanvas.height);
        URL.revokeObjectURL(url);
        kanvas.toBlob(function (blob) {
          terima(blob || berkas);
        }, 'image/jpeg', MUTU_JPEG);
      };
      /* Gambar cacat atau format yang tidak bisa digambar ke kanvas: simpan
         apa adanya. Lebih baik boros daripada gagal menyimpan. */
      gbr.onerror = function () { URL.revokeObjectURL(url); terima(berkas); };
      gbr.src = url;
    });
  }

  /* Thumbnail 200px disimpan sebagai dataURL di dalam entri, bukan sebagai
     blob terpisah. Setelah berkas aslinya naik ke Drive dan dibuang dari HP,
     inilah satu-satunya yang tersisa - dan berkat dia daftar hasil tetap
     tergambar seketika, bahkan tanpa sinyal. */
  function buatThumb(blob) {
    return new Promise(function (terima) {
      if (!/^image\//.test(blob.type || '')) return terima('');
      var url = URL.createObjectURL(blob);
      var gbr = new Image();
      gbr.onload = function () {
        var skala = Math.min(1, 200 / Math.max(gbr.naturalWidth, gbr.naturalHeight));
        var k = document.createElement('canvas');
        k.width = Math.max(1, Math.round(gbr.naturalWidth * skala));
        k.height = Math.max(1, Math.round(gbr.naturalHeight * skala));
        k.getContext('2d').drawImage(gbr, 0, 0, k.width, k.height);
        URL.revokeObjectURL(url);
        try { terima(k.toDataURL('image/jpeg', 0.6)); } catch (e) { terima(''); }
      };
      gbr.onerror = function () { URL.revokeObjectURL(url); terima(''); };
      gbr.src = url;
    });
  }

  function pasangBerkas(berkas, jenis) {
    var siap = jenis === 'gambar' ? kecilkanGambar(berkas) : Promise.resolve(berkas);
    return siap.then(function (blob) {
      var bid = idBaru('b');
      var nama = berkas.name || (jenis === 'suara' ? 'rekaman.webm' : 'berkas');
      return Promise.all([
        TSimpan.taruhBerkas(bid, blob, nama, blob.type || berkas.type),
        buatThumb(blob)
      ]).then(function (r) {
        draf = {
          jenis: jenis, berkasId: bid, namaBerkas: nama, thumb: r[1] || '',
          tipeBerkas: blob.type || berkas.type || '', ukuran: blob.size || 0
        };
        $$('.lamp').forEach(function (b) {
          b.classList.toggle('nyala', b.getAttribute('data-lamp') === jenis);
        });
        perbaruiTebakan();
        perbaruiUsulKategori();
      });
    });
  }

  function tombolSuara() {
    return $$('.lamp').filter(function (b) { return b.getAttribute('data-lamp') === 'suara'; })[0];
  }

  function mulaiRekam() {
    if (!navigator.mediaDevices || !global.MediaRecorder) {
      pesan('Perangkat ini tidak bisa merekam');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (arus) {
      var potongan = [];
      perekam = new MediaRecorder(arus);
      perekam.ondataavailable = function (e) { if (e.data && e.data.size) potongan.push(e.data); };
      perekam.onstop = function () {
        arus.getTracks().forEach(function (t) { t.stop(); });
        clearInterval(rekamJam);
        var tombol = tombolSuara();
        tombol.classList.remove('rekam');
        tombol.querySelector('span').textContent = 'Suara';
        perekam = null;
        var blob = new Blob(potongan, { type: potongan.length ? potongan[0].type : 'audio/webm' });
        blob.name = 'rekaman ' + TOtak.waktuPendek(Date.now()) + '.webm';
        pasangBerkas(blob, 'suara');
      };
      perekam.start();

      var mulai = Date.now();
      var tombol = tombolSuara();
      tombol.classList.add('rekam', 'nyala');
      rekamJam = setInterval(function () {
        var d = Math.floor((Date.now() - mulai) / 1000);
        tombol.querySelector('span').textContent =
          'Stop ' + Math.floor(d / 60) + ':' + (d % 60 < 10 ? '0' : '') + (d % 60);
      }, 250);
    }).catch(function () {
      pesan('Izin mikrofon ditolak');
    });
  }

  /* ===================== layar hasil ===================== */

  function bersihkanUrl() {
    urlSementara.forEach(function (u) { URL.revokeObjectURL(u); });
    urlSementara = [];
  }

  /* Saringan jenis cuma digambar kalau memang bisa menyaring sesuatu. Enam cip
     yang semuanya menuju hasil yang sama itu satu baris penuh yang mendorong
     hasil pertama ke bawah layar - dan hasil pertama itu yang dicari. */
  function gambarSaringJenis() {
    var ada = {};
    semuaEntri.forEach(function (e) {
      if (!e.pensiun) ada[e.jenis === 'teks' ? 'catatan' : e.jenis] = true;
    });
    var punya = Object.keys(ada).length;

    var wadah = $('#saring-jenis');
    wadah.classList.toggle('sembunyi', punya < 2);
    if (punya < 2) { saringJenis = 'semua'; wadah.innerHTML = ''; return; }

    wadah.innerHTML = JENIS_SARING.filter(function (j) {
      return j[0] === 'semua' || ada[j[0]];
    }).map(function (j) {
      return '<button class="cip' + (saringJenis === j[0] ? ' nyala' : '') +
             '" data-jenis="' + j[0] + '">' + H(j[1]) + '</button>';
    }).join('');
  }

  function gambarSaringKategori() {
    var cip = ['<button class="cip' + (saringKat ? '' : ' nyala') + '" data-katsaring="">Semua rak</button>'];
    daftarKategori().slice(0, 8).forEach(function (r) {
      cip.push('<button class="cip' + (saringKat === r.kategori ? ' nyala' : '') +
               '" data-katsaring="' + H(r.kategori) + '">#' + H(r.kategori) + ' ' + r.jumlah + '</button>');
    });
    $('#saring-kat').innerHTML = cip.join('');
  }

  function cuplikan(e) {
    if (e.jenis === 'tautan' || e.jenis === 'daftar') return '';
    var isi = (e.isi || '').trim();
    if (!isi) return '';
    /* Judul otomatis diambil dari baris pertama isinya. Kalau cuplikannya
       ikut mengulang baris itu, kartunya mengucapkan hal yang sama dua kali
       dan tingginya membengkak tanpa menambah satu pun kata baru. */
    var judul = (e.judul || '').replace(/…+$/, '').trim();
    if (judul && isi.indexOf(judul) === 0) return isi.slice(judul.length).replace(/^[\s…]+/, '');
    return isi;
  }

  /* KARTU RINGKAS.
     Sebelumnya tiap kartu mengucapkan semuanya sekaligus: judul, cuplikan,
     semua elemen, semua tag, tanggal penuh, tiga tombol. Satu layar cuma muat
     dua hasil - padahal yang dikerjakan orangnya di layar ini adalah MEMINDAI,
     dan memindai butuh banyak baris pendek, bukan sedikit baris lengkap.

     Jadi bawaannya sekarang tiga baris saja: judul, satu baris isi, dan SATU
     elemen yang paling mungkin dia butuhkan - lengkap dengan tombol salinnya,
     supaya kejadian tersering tetap selesai tanpa membuka apa pun.

     Sisanya - elemen lain, tag, catatan utuh, tombol - menunggu disentuh.
     Tidak dibuang, cuma tidak berteriak. */
  function kartuHtml(e) {
    var sering = (e.dipakai || 0) >= SERING;
    var b = [];

    b.push('<div class="kartu-atas">' +
      '<div class="kartu-judul">' + (sering ? '<span class="titik" title="sering dipakai"></span>' : '') +
      H(e.judul || '(tanpa judul)') + '</div>' +
      '<span class="kartu-waktu">' + H(TOtak.waktuRingkas(e.diubah)) + '</span></div>');

    /* Satu baris saja, dan CUMA kalau tidak ada elemen. Kalau elemennya ada,
       dia sudah jadi ringkasan yang lebih baik daripada potongan mentahnya -
       "BCA 6573937947 ibu nani" di bawah judul "Nomor rekening BCA Ibu Nani"
       cuma mengulang hal yang sama dengan huruf yang lebih jelek.
       Catatan utuhnya tetap ada, satu sentuhan di bawah. */
    var elemen = e.elemen || [];
    var adaDiElemen = elemen.some(function (x) { return x.nilai === e.isi; });
    var cup = cuplikan(e) ||
              (e.jenis === 'tautan' && !adaDiElemen ? e.isi : '') ||
              (e.namaBerkas ? e.namaBerkas + ' · ' + ukuranTeks(e.ukuran) : '');
    if (cup && !elemen.length) b.push('<div class="kartu-cuplik">' + H(cup) + '</div>');

    /* Thumbnail-nya sudah ada di dalam entri, jadi tidak ada satu pun
       permintaan - ke IndexedDB maupun ke jaringan - saat menggambar hasil. */
    if (e.thumb) {
      b.push('<img class="kartu-gambar" src="' + H(e.thumb) + '" alt="">');
    } else if (e.jenis === 'gambar' && e.berkasId) {
      b.push('<img class="kartu-gambar" data-berkas="' + H(e.berkasId) + '" alt="">');
    }

    /* Elemen pertama ikut terlihat: menyalin satu nomor adalah alasan
       tersering kartu ini dibuka sama sekali. Kalau dia ikut disembunyikan,
       yang dihemat cuma tinggi kartu - yang dibayar satu ketukan tambahan
       pada gerakan tersering. */
    if (elemen.length) b.push('<div class="elemen">' + elemenBaris(elemen[0], 0) + '</div>');

    var r = [];
    if (elemen.length > 1) {
      r.push('<div class="elemen">' + elemen.slice(1, 10).map(function (x, i) {
        return elemenBaris(x, i + 1);
      }).join('') + '</div>');
    }
    if (e.jenis === 'daftar' && (e.daftar || []).length) {
      r.push('<div class="kartu-daftar">' + e.daftar.slice(0, 8).map(function (x) {
        return '<div><span>' + (x.selesai ? '☑' : '☐') + '</span><span>' + H(x.teks) + '</span></div>';
      }).join('') + '</div>');
    }
    var isi = String(e.isi || '').trim();
    if (isi && (elemen.length || isi !== cup)) r.push('<div class="kartu-penuh">' + H(isi) + '</div>');
    r.push(tagHtml(e));

    var meta = [];
    /* Ditulis "rak: x", bukan "#x". Kalau bentuknya sama persis dengan tag,
       kartunya seolah punya dua tag #keuangan - padahal yang satu rak yang
       kamu ketik sendiri, yang satu tag yang disusun AI. */
    if (e.kategori) meta.push('<span class="tanda-kat">rak: ' + H(e.kategori) + '</span>');
    meta.push('<span class="kartu-tanggal">' + H(TOtak.tanggalIndo(e.diubah)) + '</span>');

    r.push('<div class="kartu-kaki"><div class="kartu-meta">' + meta.join('') + '</div>' +
      '<div class="kartu-aksi">' +
      IKON_AKSI('salin', 'Salin', '<rect x="9" y="9" width="12" height="12" rx="2"/>' +
        '<path d="M5 15V5a2 2 0 0 1 2-2h10"/>') +
      IKON_AKSI('sunting', 'Ubah', '<path d="M4 20h16"/><path d="M14.5 4.5l5 5L8 21H3v-5z"/>') +
      IKON_AKSI('pensiun', 'Pensiunkan', '<path d="M3 6h18"/><path d="M8 6V4h8v2"/>' +
        '<path d="M19 6l-1 14H6L5 6"/>') +
      '</div></div>');

    b.push('<div class="kartu-rinci sembunyi">' + r.join('') + '</div>');

    return '<article class="kartu' + (sering ? ' sering' : '') +
           '" data-id="' + H(e.id) + '">' + b.join('') + '</article>';
  }

  function IKON_AKSI(nama, label, isi) {
    return '<button class="aksi" data-' + nama + ' aria-label="' + H(label) + '">' +
           '<svg viewBox="0 0 24 24" class="ik">' + isi + '</svg></button>';
  }

  /* Nama elemen ditulis di atas nilainya, bukan di sampingnya: nilai yang
     panjang (tautan, token) akan mendorong namanya keluar layar kalau
     sebaris. */
  var NAMA_JENIS = {
    tautan: 'tautan', surel: 'surel', telepon: 'telepon', kode: 'kode',
    nomor: 'nomor', alamat: 'alamat', berkas: 'berkas', nama: 'nama',
    jadwal: 'jadwal', harga: 'harga', prompt: 'prompt', lainnya: 'catatan'
  };

  function elemenBaris(x, i) {
    var nama = x.nama || NAMA_JENIS[x.jenis] || 'elemen';
    var nilai = String(x.nilai || '');
    /* Tautan harus bisa langsung dibuka - itu satu-satunya alasan dia
       disimpan. Yang lain cukup bisa disalin. */
    var isi = /^https?:\/\//i.test(nilai)
      ? '<a class="elemen-nilai" href="' + H(nilai) + '" target="_blank" rel="noopener">' + H(nilai) + '</a>'
      : '<div class="elemen-nilai">' + H(nilai) + '</div>';
    return '<div class="elemen-baris">' +
      '<div class="elemen-isi"><div class="elemen-nama">' + H(nama) + '</div>' + isi + '</div>' +
      '<button class="elemen-salin" data-elemen="' + i + '" aria-label="Salin ' + H(nama) + '">' +
      '<svg viewBox="0 0 24 24" class="ik"><rect x="9" y="9" width="12" height="12" rx="2"/>' +
      '<path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button></div>';
  }

  /* Tagnya boleh banyak - tiap tag yang tepat adalah satu pintu lagi menuju
     catatan ini. Yang tidak boleh banyak adalah yang TERLIHAT: sepuluh sudah
     memenuhi dua baris di HP, dan sesak datang dari tampilan, bukan dari
     jumlah. Sisanya ada, tinggal diminta. */
  var TAG_TAMPIL = 8;

  function tagHtml(e) {
    var tag = e.tag || [];
    if (!tag.length) return '';
    var sisa = tag.length - TAG_TAMPIL;

    var isi = tag.map(function (t, i) {
      return '<button class="tag' + (i >= TAG_TAMPIL ? ' terlipat' : '') +
             '" data-tag="' + H(t) + '">#' + H(t) + '</button>';
    }).join('');

    if (sisa > 0) {
      isi += '<button class="tag lagi" data-tag-lagi>+' + sisa + '</button>';
    }
    return '<div class="tag-baris">' + isi + '</div>';
  }

  function pasangGambarKartu(akar) {
    $$('img[data-berkas]', akar).forEach(function (img) {
      TSimpan.ambilBerkas(img.getAttribute('data-berkas')).then(function (r) {
        if (!r || !r.blob) return;
        var u = URL.createObjectURL(r.blob);
        urlSementara.push(u);
        img.src = u;
      });
    });
  }

  function jalankanCari() {
    var kueri = $('#cari-input').value;

    /* Catatan yang ditulis di memo pad berjenis 'catatan', teks yang
       dijatuhkan begitu saja berjenis 'teks'. Bedanya penting di dalam, tapi
       tidak berarti apa-apa buat orang yang sedang mencari - jadi satu cip
       menutup keduanya. */
    var pakaiJenis = saringJenis === 'catatan' ? '' : saringJenis;
    var hasil = TOtak.cari(semuaEntri, kueri, pakaiJenis, saringKat);
    if (saringJenis === 'catatan') {
      hasil = hasil.filter(function (e) { return e.jenis === 'catatan' || e.jenis === 'teks'; });
    }

    bersihkanUrl();
    var wadah = $('#hasil');
    if (!hasil.length) {
      $('#hasil-ket').textContent = '';
      wadah.innerHTML = '<div class="kosong">Tidak ada yang cocok.<br>Coba satu kata saja — pencarian ini memaafkan.</div>';
      return;
    }
    $('#hasil-ket').textContent = hasil.length + ' hasil';
    var potong = hasil.slice(0, 200);

    if (urutSaat === 'tag') {
      wadah.innerHTML = kelompokTag(potong).map(function (k) {
        return '<div class="kelompok"><span class="kelompok-nama">' + H(k.nama) + '</span>' +
               '<span class="kelompok-jumlah">' + k.isi.length + '</span></div>' +
               k.isi.map(kartuHtml).join('');
      }).join('');
    } else {
      wadah.innerHTML = potong.map(kartuHtml).join('');
    }
    pasangGambarKartu(wadah);
  }

  function keHasil(kueri) {
    $('#cari-input').value = kueri || '';
    gambarSaringJenis();
    gambarSaringKategori();
    gambarUrut();
    keLayar('l-hasil');
    jalankanCari();
    /* Kalau ada yang belum dinilai, kerjakan sekarang juga - bukan tunggu
       jadwal. Orang yang baru saja nge-drop lalu langsung mencari akan
       menyimpulkan "pencariannya tidak bekerja", bukan "labelnya belum
       sempat". Hasilnya menggambar ulang sendiri begitu sampai. */
    putaranLabel();
    if (!kueri) $('#cari-input').focus();
  }

  /* Melihat SELURUH timbunan. Ini tidak melanggar "layar depan kosong":
     yang dilarang adalah dinding kartu yang menyambut tanpa diminta. Kalau
     kamu sendiri yang menekan tombolnya, kamu memang sedang mencari sesuatu
     yang belum punya kata. */
  function keSemua() {
    saringJenis = 'semua';
    saringKat = '';
    keHasil('');
    $('#cari-input').blur();
  }

  function keCatatBaru() {
    var e = entriBaru('catatan');
    e.isi = layarSaat === 'l-utama' ? $('#kotak').value : '';
    if (layarSaat === 'l-utama') {
      e.kategori = benahiKotakKategori();
      kosongkanKotak();
    }
    keCatat(e);
    $('#catat-isi').focus();
  }

  /* Nilai awal dari bawaan.js dipakai HANYA kalau pemakainya belum pernah
     menyunting daftarnya. Begitu dia menyentuhnya sekali, daftarnya jadi
     miliknya - termasuk kalau dia mengosongkannya sampai habis. */
  function daftarTagFavorit(s) {
    if (s && s.tagFavorit != null) return s.tagFavorit;
    return (TBawaan.tagAwal || []).slice();
  }

  function uraiTagFavorit(teks) {
    var keluar = [];
    String(teks || '').split(/[\s,]+/).forEach(function (t) {
      var v = t.replace(/^#+/, '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 24);
      if (!v) return;
      var ada = keluar.some(function (x) { return x.toLowerCase() === v.toLowerCase(); });
      if (!ada) keluar.push(v);
    });
    return keluar.slice(0, 200);
  }

  var URUT = [['waktu', 'Terbaru'], ['tag', 'Per tag — terbanyak dulu']];

  /* Digabung ke baris rak, bukan barisnya sendiri: dua-duanya menjawab
     pertanyaan yang sama - "potongan mana yang mau kulihat" - dan satu baris
     tambahan di sini berarti satu hasil lebih sedikit yang terlihat. */
  function gambarUrut() {
    $('#urut-baris').innerHTML = '<span class="cip-pisah"></span>' + URUT.map(function (u) {
      return '<button class="cip' + (urutSaat === u[0] ? ' nyala' : '') +
             '" data-urut="' + u[0] + '">' + H(u[1]) + '</button>';
    }).join('');
  }

  /* Tag diurut dari yang paling banyak dipakai. Itu bukan sekadar rapi:
     urutan terbanyak-dulu adalah satu-satunya urutan yang menaruh rak yang
     benar-benar kamu pakai di paling atas, tanpa kamu perlu menatanya. */
  function kelompokTag(daftar) {
    var hitung = {};
    daftar.forEach(function (e) {
      (e.tag || []).forEach(function (t) { hitung[t] = (hitung[t] || 0) + 1; });
    });
    var urut = Object.keys(hitung).sort(function (a, b) {
      if (hitung[b] !== hitung[a]) return hitung[b] - hitung[a];
      return a.localeCompare(b);
    });

    var sudah = {};
    var keluar = [];
    urut.forEach(function (t) {
      var isi = daftar.filter(function (e) {
        return (e.tag || []).indexOf(t) >= 0 && !sudah[e.id];
      });
      if (!isi.length) return;
      isi.forEach(function (e) { sudah[e.id] = true; });
      keluar.push({ nama: '#' + t, isi: isi });
    });

    /* Yang belum bertag ditaruh paling bawah, bukan disembunyikan - kalau
       tidak, "Semua" tidak lagi berarti semua. */
    var sisa = daftar.filter(function (e) { return !sudah[e.id]; });
    if (sisa.length) keluar.push({ nama: 'Belum bertag', isi: sisa });
    return keluar;
  }

  function isiSalin(e) {
    if (e.jenis === 'tautan') return e.isi;
    if (e.jenis === 'daftar') {
      return (e.daftar || []).map(function (r) {
        return (r.selesai ? '[x] ' : '[ ] ') + r.teks;
      }).join('\n');
    }
    return e.isi || e.judul || '';
  }

  /* clipboard API ditolak di konteks non-HTTPS dan di Android lama - dan
     "salin" yang diam-diam gagal lebih buruk daripada tidak ada tombolnya. */
  function salin(teks) {
    function mundur() {
      var ta = document.createElement('textarea');
      ta.value = teks;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var berhasil = false;
      try { berhasil = document.execCommand('copy'); } catch (e) { berhasil = false; }
      document.body.removeChild(ta);
      pesan(berhasil ? 'Disalin' : 'Tidak bisa menyalin di sini');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(function () { pesan('Disalin'); }, mundur);
    } else {
      mundur();
    }
  }

  function bukaKartu(id) {
    var e = null;
    semuaEntri.forEach(function (x) { if (x.id === id) e = x; });
    if (!e) return;
    /* Inilah saluran keluarnya: yang dipakai naik, yang tidak disentuh
       tenggelam sendiri. Tidak ada yang perlu dirapikan tangan. */
    e.dipakai = (e.dipakai || 0) + 1;
    e.diubah = e.diubah || Date.now();
    TSimpan.taruh(e);
    segarkanCache(e);
    keCatat(e);
  }

  /* ===================== layar catat ===================== */

  function tanda(teks) { $('#simpan-tanda').textContent = teks; }

  function gambarLampiranCatat(e) {
    var wadah = $('#catat-lampiran');
    wadah.innerHTML = '';
    if (!e.berkasId && !e.driveId) return;

    wadah.innerHTML = '<div class="terpasang">' +
      (e.thumb ? '<img src="' + H(e.thumb) + '" alt="">' : '') +
      '<div class="terpasang-tubuh">' +
      '<div class="terpasang-nama">' + H(e.namaBerkas || 'Berkas') + '</div>' +
      '<div class="terpasang-ukuran">' + H(ukuranTeks(e.ukuran)) +
      (e.driveId ? ' · di Drive' : '') + '</div>' +
      '<button class="terpasang-unduh" id="b-unduh">Unduh berkas</button>' +
      '</div></div>';

    $('#b-unduh').addEventListener('click', function () { unduh(e); });
  }

  /* Blob aslinya dibuang setelah selamat sampai Drive, jadi mengunduh punya
     dua jalan. Yang lokal instan; yang di Drive butuh sinyal - dan itu
     dikatakan apa adanya, bukan digantung tanpa kabar. */
  function unduh(e) {
    var tombol = $('#b-unduh');
    function beri(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = e.namaBerkas || 'berkas';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      if (tombol) tombol.textContent = 'Unduh berkas';
    }
    if (e.berkasId) {
      TSimpan.ambilBerkas(e.berkasId).then(function (r) {
        if (r && r.blob) beri(r.blob);
        else pesan('Berkasnya tidak ketemu');
      });
      return;
    }
    if (tombol) tombol.textContent = 'Mengambil…';
    TAwan.unduhBerkas(setelanSaat, e.driveId).then(beri, function (err) {
      if (tombol) tombol.textContent = 'Unduh berkas';
      pesan('Gagal mengambil: ' + err.message);
    });
  }

  function gambarRiwayat() {
    var e = entriCatat;
    var wadah = $('#riwayat');
    var r = (e.riwayat || []);
    if (!r.length) {
      wadah.innerHTML = '<div class="riwayat-waktu">Belum ada versi sebelumnya. ' +
        'Versi lama disimpan sendiri saat kamu menyunting lagi di hari lain.</div>';
      return;
    }
    wadah.innerHTML = r.slice().reverse().map(function (v, i) {
      var asli = r.length - 1 - i;
      return '<div class="riwayat-baris"><div class="riwayat-waktu">' +
        H(TOtak.waktuPendek(v.ts)) + '</div><div class="riwayat-isi">' + H(v.isi) +
        '</div><button class="riwayat-pulih" data-pulih="' + asli + '">pulihkan</button></div>';
    }).join('');
  }

  function keCatat(e) {
    entriCatat = e;
    $('#catat-judul').value = e.judul || '';
    $('#catat-kat').value = e.kategori || '';
    $('#catat-isi').value = e.isi || '';
    $('#riwayat').classList.add('sembunyi');
    gambarLampiranCatat(e);
    tanda('tersimpan');
    keLayar('l-catat');
  }

  function simpanCatat() {
    var e = entriCatat;
    if (!e) return Promise.resolve();

    var judul = $('#catat-judul').value.trim();
    var kat = $('#catat-kat').value.trim();
    var isi = $('#catat-isi').value;

    if (judul === e.judul && kat === e.kategori && isi === e.isi) {
      tanda('tersimpan');
      return Promise.resolve();
    }
    /* Catatan yang belum berisi apa-apa tidak perlu jadi baris di timbunan. */
    if (!judul && !isi.trim() && !(e.daftar || []).length && !e.berkasId) {
      return Promise.resolve();
    }

    var sekarang = Date.now();
    var isiSebelum = e.isi;
    /* Inti kenapa aplikasi ini ada: merevisi memperbarui BARIS YANG SAMA, dan
       versi lamanya tetap ada. Di Keep, tiap revisi melahirkan catatan baru -
       dan dari enam versi mirip tidak ada cara tahu mana yang terakhir. */
    if (isi !== e.isi && e.isi && (sekarang - (e.diubah || 0)) > JARAK_RIWAYAT) {
      e.riwayat = (e.riwayat || []).concat([{ isi: e.isi, ts: e.diubah || sekarang }]).slice(-RIWAYAT_MAKS);
    }

    e.judul = judul;
    e.kategori = kat;
    e.isi = isi;
    e.diubah = sekarang;
    /* Judul dikosongkan = dikembalikan ke mesin. Selama masih ada isinya,
       judul manual tidak pernah ditimpa - termasuk oleh AI. */
    if (!judul) {
      e.judulManual = false;
      e.judul = TOtak.judulOtomatis(e);
      $('#catat-judul').placeholder = e.judul || 'Judul';
    }
    e.label = TOtak.labelOtomatis(e);

    /* Isi yang berubah artinya penilaian lamanya sudah tidak menggambarkan
       catatan ini lagi. Judul, elemen, dan tag disusun ulang - dan judul yang
       diketik sendiri tetap tidak ikut ditimpa, karena judulManual yang
       menjaganya, bukan penanda ini. */
    if (isi !== isiSebelum) {
      e.elemen = TOtak.gabungElemen([], TOtak.elemenOtomatis(e));
      e.diLabeliAI = false;
      sundulLabel();
    }

    tanda('menyimpan…');
    return TSimpan.taruh(e).then(function () {
      segarkanCache(e);
      tanda('tersimpan');
    }).catch(function (err) {
      tanda('gagal menyimpan');
      pesan('Gagal menyimpan: ' + err.message);
    });
  }

  /* Dari kartu, tanpa membuka apa pun. Sengaja TIDAK bertanya "yakin?":
     yang basi cuma berhenti muncul, datanya tetap ada, dan urungnya satu
     ketukan. Dialog konfirmasi di sini adalah keputusan yang dibebankan
     tanpa perlu. */
  function pensiunkanKartu(e) {
    e.pensiun = true;
    e.diubah = Date.now();
    TSimpan.taruh(e).then(function () {
      segarkanCache(e);
      perbaruiJumlah();
      jalankanCari();
      pesan('Dipensiunkan', {
        teks: 'Urungkan',
        jalan: function () {
          e.pensiun = false;
          TSimpan.taruh(e).then(function () {
            segarkanCache(e);
            perbaruiJumlah();
            jalankanCari();
          });
        }
      });
    });
  }

  function pensiunkan() {
    var e = entriCatat;
    if (!e) return;
    e.pensiun = true;
    e.diubah = Date.now();
    TSimpan.taruh(e).then(function () {
      segarkanCache(e);
      kembali();
      /* Tidak ada yang benar-benar terhapus - yang basi cuma berhenti muncul.
         Karena itu urungnya gampang dan tidak perlu ditanya di depan. */
      pesan('Dipensiunkan', {
        teks: 'Urungkan',
        jalan: function () {
          e.pensiun = false;
          TSimpan.taruh(e).then(function () {
            segarkanCache(e);
            perbaruiJumlah();
            if (layarSaat === 'l-hasil') jalankanCari();
          });
        }
      });
    });
  }

  /* Menghapus sungguhan. Bukan bawaan, dan sengaja butuh tekan lama - tapi
     tanpa ini, catatan sekali pakai meninggalkan bangkai di Sheet dan wadahnya
     kembali jadi wadah yang tidak pernah kosong. Nisannya (`dihapus`) yang
     naik ke awan; barisnya di Sheet dan berkasnya di Drive dihapus di sana,
     baru entrinya dibuang dari HP. */
  function hapusPermanen() {
    var e = entriCatat;
    if (!e) return;
    e.dihapus = true;
    e.pensiun = true;
    e.diubah = Date.now();
    TSimpan.taruh(e).then(function () {
      segarkanCache(e);
      kembali();
      pesan('Dihapus permanen', {
        teks: 'Urungkan',
        jalan: function () {
          e.dihapus = false;
          e.pensiun = false;
          TSimpan.taruh(e).then(function () {
            segarkanCache(e);
            perbaruiJumlah();
            if (layarSaat === 'l-hasil') jalankanCari();
          });
        }
      });
      /* Kalau cadangan nyala, nisannya menyusul di putaran berikutnya. */
    });
  }

  /* ===================== layar mulai =====================
     Swalayan. Pemakainya tidak membuat folder, tidak membuat spreadsheet,
     tidak menempel kode ke mana pun - dia menekan satu tombol dan aplikasi
     ini yang membuat rumahnya sendiri di Drive-nya.

     Dan seluruh layar ini boleh dilewati. Aplikasinya jalan penuh tanpa
     Google dan tanpa AI; yang dua itu menambah, bukan menyalakan. */

  function sudahDipasang() { return !!setelanSaat.dipasang; }

  function gambarMulai() {
    var s = setelanSaat;
    var tersambung = !!s.sheetId;
    /* Client ID itu urusan PEMBUAT, sekali seumur proyek - bukan urusan
       pemakai. Tidak ada aplikasi yang meminta hal seperti itu saat dipasang,
       dan kalau sampai muncul di sini, pemasangannya sudah gagal sebelum
       dimulai. Isiannya cuma tampil kalau bawaan.js memang belum diisi, yaitu
       hanya di mesin pengembangnya. */
    var modePengembang = !TBawaan.clientId;

    $('#mulai-isi').innerHTML = [
      '<div class="mulai-sambut">',
      '<div class="mulai-judul">' + H(TBawaan.nama) + '</div>',
      '<div class="mulai-tagline">' + H(TBawaan.tagline) + '</div>',
      '</div>',

      '<div class="set-kotak">',
      '<div class="set-judul">' + (tersambung ? 'Cadangan aktif' : 'Cadangkan ke Google-mu') + '</div>',
      '<div class="set-ket">' + (tersambung
        ? 'Folder <b>' + H(TBawaan.nama) + '</b> sudah dibuat di Drive-mu. Catatanmu tidak akan hilang bersama HP ini.'
        : 'Tanpa ini, catatanmu cuma ada di HP ini. Aplikasi membuat sendiri folder di Drive-mu — kamu tidak perlu menyiapkan apa pun.') + '</div>',
      modePengembang
        ? '<input class="set-input" id="mulai-client" placeholder="OAuth Client ID (khusus pengembang)" value="">' : '',
      '<button class="set-tbl' + (tersambung ? '' : ' emas') + '" id="b-mulai-google">' +
        (tersambung ? 'Tersambung' : 'Hubungkan Google') + '</button>',
      '<div class="set-ket" id="mulai-google-ket"></div>',
      '</div>',

      /* Pemakai tidak diminta apa pun untuk AI - tidak ada kunci, tidak ada
         pendaftaran di sini. Dia sudah dikenali dari akun Google yang tadi
         disambungkan; sisanya urusan layanan. */
      TBawaan.alamatAI ? [
        '<div class="set-kotak">',
        '<div class="set-judul">Biar yang lahir setengah tetap ketemu</div>',
        '<div class="set-ket">Foto dokumen tidak punya kata sama sekali. AI menuliskannya sekali di belakang layar, supaya bisa dicari bertahun-tahun kemudian.<br><br>' +
          'Aktif sendiri untuk pengguna terdaftar — tidak ada yang perlu kamu isi.</div>',
        '<div class="set-ket" id="mulai-ai-ket"></div>',
        '</div>'
      ].join('') : [
        '<div class="set-kotak">',
        '<div class="set-judul">Bantuan AI</div>',
        '<div class="set-ket">Layanan AI belum ditanam di aplikasi ini. Untuk mencoba sendiri, tempel kunci Gemini-mu — ' +
          '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">ambil di AI Studio</a>, gratis. (khusus pengembang)</div>',
        '<input class="set-input" id="mulai-kunci" type="password" placeholder="Kunci Gemini" value="' + H(s.kunciGemini || '') + '">',
        '<div class="set-ket" id="mulai-ai-ket"></div>',
        '</div>'
      ].join(''),

      /* SATU tombol. Dua tombol "Mulai" dan "Lewati" yang sama-sama menutup
         layar ini adalah keputusan yang tidak perlu diadakan - dan tiap
         keputusan yang tidak perlu adalah tagihan pada dompet yang kosong. */
      /* Emas cuma satu di layar ini, dan dia berpindah: selama Google belum
         tersambung, yang bernilai adalah menyambungkannya. Setelah tersambung,
         yang bernilai adalah mulai memakai. */
      '<button class="set-tbl' + (tersambung ? ' emas' : '') + '" id="b-mulai-selesai">Mulai</button>',
      '<div class="kaki">Dua-duanya boleh dilewati. Aplikasinya jalan penuh tanpa keduanya, dan bisa dipasang kapan saja dari Setelan.</div>'
    ].join('');

    pasangMulai();
  }

  function pasangMulai() {
    pasangSelesaiMulai();
    var ket = $('#mulai-google-ket');

    $('#b-mulai-google').addEventListener('click', function () {
      var isian = $('#mulai-client');
      var simpan = isian && isian.value.trim()
        ? simpanSetelan('clientId', isian.value.trim()) : Promise.resolve();
      ket.textContent = 'Menyiapkan…';
      simpan.then(function () {
        return TAwan.masuk(setelanSaat);
      }).then(function () {
        return TSinkron.rumah(setelanSaat);
      }).then(function () {
        return simpanSetelan('cadanganNyala', true);
      }).then(function () {
        ket.innerHTML = '<b>Selesai.</b> Folder <b>' + H(TBawaan.nama) + '</b> dibuat di Drive-mu.';
        $('#b-mulai-google').textContent = 'Tersambung';
        $('#b-mulai-google').classList.remove('emas');
        $('#b-mulai-selesai').classList.add('emas');
      }).catch(function (err) {
        ket.textContent = 'Gagal: ' + err.message;
      });
    });

    /* Kuncinya diuji sendiri saat ditempel. Menyuruh orang menekan "Uji"
       setelah menempel itu satu langkah yang mesin bisa kerjakan sendiri. */
    var kunci = $('#mulai-kunci');
    var k = $('#mulai-ai-ket');
    if (!kunci) return;
    kunci.addEventListener('change', function () {
      var nilai = kunci.value.trim();
      if (!nilai) return;
      k.textContent = 'Memeriksa kunci…';
      simpanSetelan('kunciGemini', nilai)
        .then(function () { return simpanSetelan('modeAI', 'penuh'); })
        .then(function () { return TPelabel.coba(setelanSaat); })
        .then(function () { k.innerHTML = '<b>Kuncinya jalan.</b> AI akan bekerja di belakang layar.'; },
              function (err) { k.textContent = 'Kunci ditolak: ' + err.message; });
    });

  }

  function pasangSelesaiMulai() {
    $('#b-mulai-selesai').addEventListener('click', function () {
      simpanSetelan('dipasang', true).then(function () {
        tampilkanLayar('l-utama');
        $('#kotak').focus();
        muatSemua().then(function () { perbaruiUsulKategori(); });
      });
    });
  }

  /* ===================== layar setelan ===================== */

  function mintaPermanen() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
    return navigator.storage.persisted().then(function (sudah) {
      /* Tanpa status ini, browser boleh membuang data situs sendiri saat
         penyimpanan HP sesak - tanpa bertanya, tanpa kabar. Untuk PWA yang
         sudah dipasang di layar utama, Chrome hampir selalu mengabulkan. */
      return sudah ? true : navigator.storage.persist();
    }).catch(function () { return false; });
  }

  function taksirSimpanan() {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().catch(function () { return null; });
  }

  function waktuPanjang(ts) {
    if (!ts) return 'belum pernah';
    var lalu = Date.now() - ts;
    if (lalu < 60000) return 'barusan';
    if (lalu < 3600000) return Math.floor(lalu / 60000) + ' menit lalu';
    if (lalu < 86400000) return Math.floor(lalu / 3600000) + ' jam lalu';
    return Math.floor(lalu / 86400000) + ' hari lalu';
  }

  function gambarSetelan() {
    var s = setelanSaat;
    var mode = s.modeAI || 'mati';
    var tersambung = !!s.sheetId;

    $('#setelan-isi').innerHTML = [
      /* Cadangan ditaruh paling atas dengan sengaja: ini satu-satunya bagian
         yang menjawab "kalau HP-nya hilang, hilang juga semuanya?" */
      '<div class="set-bagian">Brankas</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">' + (tersambung ? 'Tersambung ke Drive-mu' : 'Belum tersambung') + '</div>',
      '<div class="set-ket">' + (tersambung
        ? 'Folder <b>' + H(TBawaan.nama) + '</b> berisi cadangan dan berkasmu. Cadangan berjalan saat aplikasi dibuka, di belakang layar, dan <b>tidak pernah</b> di jalur drop.'
        : 'Catatanmu cuma ada di HP ini. Menghapus “cookies and site data” akan menghapus semuanya.') + '</div>',
      TBawaan.clientId ? '' :
        '<input class="set-input" id="set-client" placeholder="OAuth Client ID (khusus pengembang)" value="' + H(s.clientId || '') + '">',
      '<div class="set-pilih" id="set-cadangan">',
      '<button class="cip' + (s.cadanganNyala ? '' : ' nyala') + '" data-cadangan="mati">Mati</button>',
      '<button class="cip' + (s.cadanganNyala ? ' nyala' : '') + '" data-cadangan="nyala">Nyala</button>',
      '</div>',
      '<div class="set-ket" id="cadangan-status">…</div>',
      '<button class="set-tbl' + (tersambung ? '' : ' emas') + '" id="b-hubungkan">' +
        (tersambung ? 'Sambungkan ulang Google' : 'Hubungkan Google') + '</button>',
      tersambung ? '<button class="set-tbl" id="b-buka-sheet">Buka spreadsheet-nya</button>' : '',
      tersambung ? '<button class="set-tbl" id="b-cadang-sekarang">Kirim sekarang</button>' : '',
      tersambung ? '<button class="set-tbl" id="b-pulihkan">Pulihkan dari Drive</button>' : '',
      '</div>',

      '<div class="set-bagian">Penyimpanan di perangkat</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Timbunanmu ada di sini</div>',
      '<div class="set-ket" id="simpanan-ket">…</div>',
      '</div>',

      '<div class="set-bagian">Bantuan AI</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Menambal konteks yang tidak sempat ditulis</div>',
      '<div class="set-ket"><b>Hemat</b> memberi judul dan kata kunci pada catatan. ' +
        '<b>Penuh</b> juga membaca isi foto dan PDF — KTP, kontrak, struk jadi bisa dicari lewat isinya. ' +
        'Keduanya berjalan di belakang layar dan boleh gagal diam-diam.</div>',
      '<div class="set-pilih" id="set-mode">',
      ['mati', 'hemat', 'penuh'].map(function (m) {
        return '<button class="cip' + (mode === m ? ' nyala' : '') + '" data-mode="' + m + '">' +
          m.charAt(0).toUpperCase() + m.slice(1) + '</button>';
      }).join(''),
      '</div>',
      mode !== 'mati' ? '<div class="set-ket" id="ai-status">…</div>' : '',
      /* Isian kunci cuma untuk pengembang, dan cuma kalau layanannya memang
         belum ditanam. Pemakai tidak pernah memegang kunci. */
      (mode !== 'mati' && !TBawaan.alamatAI)
        ? '<input class="set-input" id="set-kunci" type="password" placeholder="Kunci Gemini (khusus pengembang)" value="' + H(s.kunciGemini || '') + '">' +
          '<input class="set-input" id="set-model" placeholder="' + H(TBawaan.model) + '" value="' + H(s.model || '') + '">' +
          '<button class="set-tbl" id="b-uji">Uji kunci</button><div class="set-ket" id="uji-hasil"></div>'
        : '',
      '</div>',

      /* Kunci di perangkat memang tidak bisa disembunyikan - tapi itu cuma
         berlaku di mode pengembang. Pemakai biasa tidak membawa kunci sama
         sekali, jadi peringatan ini tidak perlu ditunjukkan kepadanya. */
      (mode !== 'mati' && !TBawaan.alamatAI && s.kunciGemini)
        ? '<div class="set-kotak awas"><div class="set-judul">Kunci di HP tidak bisa disembunyikan</div>' +
          '<div class="set-ket">Di aplikasi yang seluruhnya jalan di browser, <b>kunci API tidak bisa benar-benar disembunyikan</b>. ' +
          'Ini mode pengembang — untuk pemakai biasa, kuncinya tinggal di layanan dan tidak pernah sampai ke perangkat.</div></div>'
        : '',

      '<div class="set-bagian">Tag andalan</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Rak yang kamu sudah tahu akan dipakai</div>',
      '<div class="set-ket">Tulis di sini tag yang pasti sering kamu pakai — nama proyek, nama klien, jenis barang. ' +
        'Daftar ini ikut dikirim ke AI tiap kali melabeli, jadi dia memakai tag <b>ini</b> ' +
        'dan tidak mengarang sinonimnya sendiri. Pisahkan dengan spasi atau baris baru; pagarnya boleh tidak ditulis.</div>',
      '<textarea class="set-input tinggi" id="set-tag" spellcheck="false" placeholder="MAP ProjectSpace Resep">' +
        H(daftarTagFavorit(s).join(' ')) + '</textarea>',
      '<div class="set-ket" id="tag-jumlah">…</div>',
      '</div>',

      '<div class="set-bagian">Cadangan manual</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Salinan teks ke berkas</div>',
      '<div class="set-ket">Isi berkas sengaja tidak ikut — satu cadangan bisa ratusan megabita dan gagal di tengah jalan. Yang diekspor teksnya, bagian yang tidak tergantikan.</div>',
      '<button class="set-tbl" id="b-ekspor">Ekspor</button>',
      '<button class="set-tbl" id="b-impor">Impor</button>',
      '</div>',

      '<div class="set-bagian">Bahaya</div>',
      '<div class="set-kotak awas">',
      '<div class="set-judul">Kosongkan semua data</div>',
      '<div class="set-ket">Semua entri dan berkas di perangkat ini hilang, tanpa urung. Yang sudah naik ke Drive tetap aman. Ketik <b>HAPUS</b> untuk membuka tombolnya.</div>',
      '<input class="set-input" id="set-hapus-ketik" placeholder="HAPUS" autocomplete="off">',
      '<button class="set-tbl bahaya" id="b-kosongkan" disabled>Kosongkan</button>',
      '</div>'
    ].join('');

    pasangSetelan();
    perbaruiStatusSetelan();
  }

  function perbaruiStatusSetelan() {
    var kotak = $('#cadangan-status');
    if (kotak) {
      var s = setelanSaat;
      if (!TSinkron.nyala(s)) {
        kotak.textContent = 'Mati — catatanmu cuma ada di HP ini.';
      } else {
        TSinkron.belumTerkirim(s).then(function (n) {
          kotak.innerHTML = 'Terakhir berhasil: <b>' + H(waktuPanjang(s.cadanganBerhasil)) + '</b>' +
            ' · belum terkirim: <b>' + n + '</b>' +
            (s.cadanganGalat ? '<br>Percobaan terakhir gagal: ' + H(s.cadanganGalat) : '');
        });
      }
    }

    var ai = $('#ai-status');
    if (ai) {
      if (!TPelabel.lewatProxy(setelanSaat)) {
        ai.textContent = setelanSaat.kunciGemini
          ? 'Mode pengembang: memakai kunci di perangkat ini.'
          : 'Layanan AI belum ditanam di aplikasi ini.';
      } else if (/belum-terdaftar/i.test(setelanSaat.aiGalat || '')) {
        /* Ini satu-satunya kegagalan AI yang perlu dibaca: bukan gangguan,
           melainkan jawaban. */
        ai.innerHTML = '<b>Akun ini belum terdaftar</b> untuk bantuan AI. ' +
          'Semua yang lain tetap jalan seperti biasa.';
      } else {
        TAwan.siapa(setelanSaat).then(function (email) {
          ai.innerHTML = 'Aktif untuk <b>' + H(email) + '</b>. Kuncinya ada di layanan, tidak pernah di HP ini.' +
            (setelanSaat.aiGalat ? '<br>Percobaan terakhir gagal: ' + H(setelanSaat.aiGalat) : '');
        }, function () {
          ai.textContent = 'Hubungkan Google dulu supaya bantuan AI bisa mengenalimu.';
        });
      }
    }

    var ket = $('#simpanan-ket');
    if (!ket) return;
    Promise.all([mintaPermanen(), taksirSimpanan(), TSimpan.jumlah()]).then(function (r) {
      var permanen = r[0], taksir = r[1], jumlah = r[2];
      var baris = [jumlah + ' entri'];
      if (taksir && taksir.usage != null) baris.push(ukuranTeks(taksir.usage) + ' terpakai');
      ket.innerHTML = baris.join(' · ') + '<br>' + (permanen
        ? 'Status: <b>permanen</b>. Browser tidak akan membuangnya sendiri saat penyimpanan HP sesak.'
        : 'Status: <b>sementara</b>. Browser boleh membuangnya saat penyimpanan HP sesak — dan menghapus “cookies and site data” tetap menghapus semuanya.');
    });
  }

  function simpanSetelan(kunci, nilai) {
    setelanSaat[kunci] = nilai;
    return TSimpan.setel(kunci, nilai);
  }

  function pasangSetelan() {
    var klien = $('#set-client');
    if (klien) klien.addEventListener('change', function () { simpanSetelan('clientId', klien.value.trim()); });

    $('#b-hubungkan').addEventListener('click', function () {
      var ket = $('#cadangan-status');
      ket.textContent = 'Membuka izin Google…';
      TAwan.masuk(setelanSaat).then(function () {
        ket.textContent = 'Menyiapkan folder dan spreadsheet…';
        return TSinkron.rumah(setelanSaat);
      }).then(function () {
        return simpanSetelan('cadanganNyala', true);
      }).then(gambarSetelan, function (err) {
        ket.textContent = 'Gagal: ' + err.message;
      });
    });

    var bukaSheet = $('#b-buka-sheet');
    if (bukaSheet) bukaSheet.addEventListener('click', function () {
      global.open('https://docs.google.com/spreadsheets/d/' + setelanSaat.sheetId + '/edit', '_blank', 'noopener');
    });

    $$('#set-cadangan .cip').forEach(function (b) {
      b.addEventListener('click', function () {
        simpanSetelan('cadanganNyala', b.getAttribute('data-cadangan') === 'nyala').then(gambarSetelan);
      });
    });

    var sekarang = $('#b-cadang-sekarang');
    if (sekarang) sekarang.addEventListener('click', function () {
      sekarang.textContent = 'Mengirim…';
      TSinkron.putaran(setelanSaat, true).then(function (n) {
        sekarang.textContent = 'Kirim sekarang';
        pesan(n ? n + ' catatan naik ke Drive' : (setelanSaat.cadanganGalat || 'Semua sudah tersalin'));
        perbaruiStatusSetelan();
      });
    });

    var pulih = $('#b-pulihkan');
    if (pulih) pulih.addEventListener('click', function () {
      pulih.textContent = 'Menarik…';
      TSinkron.pulihkan(setelanSaat).then(function (n) {
        pulih.textContent = 'Pulihkan dari Drive';
        return muatSemua().then(function () {
          pesan(n ? n + ' catatan dipulihkan' : 'Tidak ada yang perlu dipulihkan');
        });
      }, function (err) {
        pulih.textContent = 'Pulihkan dari Drive';
        pesan('Gagal memulihkan: ' + err.message);
      });
    });

    $$('#set-mode .cip').forEach(function (b) {
      b.addEventListener('click', function () {
        simpanSetelan('modeAI', b.getAttribute('data-mode')).then(gambarSetelan);
      });
    });

    var kunci = $('#set-kunci');
    if (kunci) kunci.addEventListener('change', function () { simpanSetelan('kunciGemini', kunci.value.trim()); });

    var model = $('#set-model');
    if (model) model.addEventListener('change', function () { simpanSetelan('model', model.value.trim()); });

    var isianTag = $('#set-tag');
    if (isianTag) {
      var tampilJumlahTag = function () {
        var n = uraiTagFavorit(isianTag.value).length;
        $('#tag-jumlah').textContent = n ? n + ' tag andalan' : 'Belum ada — AI akan menyusun tagnya sendiri.';
      };
      tampilJumlahTag();
      isianTag.addEventListener('input', tampilJumlahTag);
      isianTag.addEventListener('change', function () {
        var daftar = uraiTagFavorit(isianTag.value);
        isianTag.value = daftar.join(' ');
        tampilJumlahTag();
        simpanSetelan('tagFavorit', daftar);
      });
    }

    var uji = $('#b-uji');
    if (uji) uji.addEventListener('click', function () {
      var ket = $('#uji-hasil');
      ket.textContent = 'Mencoba…';
      /* Satu-satunya tempat kegagalan AI boleh berisik. Di jalur sehari-hari
         dia selalu diam. */
      TPelabel.coba(setelanSaat).then(function (h) {
        ket.innerHTML = 'Tersambung. Contoh judul: <b>' + H(h.judul || '') + '</b>';
      }, function (err) {
        ket.textContent = 'Gagal: ' + err.message;
      });
    });

    $('#b-ekspor').addEventListener('click', function () {
      TSimpan.ekspor().then(function (data) {
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var u = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = u;
        a.download = TOtak.normal(TBawaan.nama).replace(/\s+/g, '-') + '-' +
                     new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      });
    });

    $('#b-impor').addEventListener('click', function () { $('#pilih-cadangan').click(); });

    var ketik = $('#set-hapus-ketik');
    var tombolHapus = $('#b-kosongkan');
    ketik.addEventListener('input', function () {
      tombolHapus.disabled = ketik.value.trim().toUpperCase() !== 'HAPUS';
    });
    tombolHapus.addEventListener('click', function () {
      if (ketik.value.trim().toUpperCase() !== 'HAPUS') return;
      TSimpan.kosongkan().then(function () {
        return muatSemua();
      }).then(function () {
        ketik.value = '';
        tombolHapus.disabled = true;
        pesan('Semua data dikosongkan');
      });
    });
  }

  /* ===================== kerja di belakang layar =====================
     Dua-duanya berjalan setelah aplikasi terbuka, bukan saat drop. Kalau
     salah satu pindah ke jalur masuk, nge-drop berhenti terasa gratis - dan
     itu yang membunuh semua sistem sebelumnya. */

  function adaAntrean() {
    return semuaEntri.some(function (e) { return !e.diLabeliAI && !e.pensiun; });
  }

  /* Sekali saja walau lima catatan jatuh beruntun: yang terakhir yang menang. */
  var sundulan = null;
  function sundulLabel() {
    clearTimeout(sundulan);
    sundulan = setTimeout(putaranLabel, JEDA_SUNDUL);
  }

  function putaranLabel() {
    if (!TPelabel.siap(setelanSaat) || !adaAntrean()) return;
    TPelabel.putaran(setelanSaat).then(function (n) {
      if (n) muatSemua().then(function () { if (layarSaat === 'l-hasil') jalankanCari(); });
    });
  }

  function putaranCadangan() {
    return TSinkron.putaran(setelanSaat).then(function () {
      /* WAJIB. Cadangan menyunting entri di belakang layar: berkas yang naik
         ke Drive kehilangan berkasId dan mendapat driveId, dan nisan yang
         sudah bersih dibuang. Kalau salinan di memori tidak disegarkan,
         suntingan berikutnya menimpanya dengan keadaan lama - dan berkasnya
         jadi yatim di Drive, tidak bisa diambil lagi dari mana pun. */
      return muatSemua();
    }).then(function () {
      if (layarSaat === 'l-setelan') perbaruiStatusSetelan();
      if (layarSaat === 'l-hasil') jalankanCari();
      /* Entri yang sedang dibuka ikut disegarkan, kalau dia belum disunting. */
      if (entriCatat) {
        var segar = null;
        semuaEntri.forEach(function (x) { if (x.id === entriCatat.id) segar = x; });
        if (segar && segar.diubah >= (entriCatat.diubah || 0)) {
          entriCatat = segar;
          gambarLampiranCatat(segar);
        }
      }
    }).catch(function () { /* cadangan gagal bukan kabar buruk buat pemakainya */ });
  }

  /* ===================== bagikan & pemasangan ===================== */

  /* Titipan dari tombol Bagikan aplikasi lain, sudah ditulis sw.js ke
     IndexedDB. Sengaja TIDAK langsung di-drop: isinya masuk ke kotak supaya
     raknya sempat ditempel sekali ketuk. Satu ketukan, bukan satu keputusan. */
  function ambilBagikan() {
    if (location.search.indexOf('bagikan=1') < 0) return Promise.resolve();
    return TSimpan.setelan('bagikanTertunda').then(function (t) {
      if (!t) return;
      var bagian = [];
      if (t.judul && (t.teks || '').indexOf(t.judul) < 0) bagian.push(t.judul);
      if (t.teks) bagian.push(t.teks);
      if (t.tautan && bagian.join(' ').indexOf(t.tautan) < 0) bagian.push(t.tautan);
      $('#kotak').value = bagian.join('\n').trim();

      if (t.berkasId) {
        draf = {
          jenis: (t.tipeBerkas || '').indexOf('image/') === 0 ? 'gambar' :
                 ((t.tipeBerkas || '').indexOf('audio/') === 0 ? 'suara' : 'berkas'),
          berkasId: t.berkasId, namaBerkas: t.namaBerkas,
          tipeBerkas: t.tipeBerkas, ukuran: t.ukuran
        };
      }
      perbaruiTebakan();
      perbaruiUsulKategori();
      pesan('Diterima dari Bagikan');
      return TSimpan.setel('bagikanTertunda', null);
    }).then(function () {
      /* Alamatnya dibersihkan supaya menyegarkan halaman tidak menempelkan
         titipan yang sama dua kali. */
      try { history.replaceState({ layar: 'l-utama' }, '', './'); } catch (e) { /* file:// */ }
    }).catch(function () { /* titipan gagal bukan kabar buruk buat pemakainya */ });
  }

  function daftarSW() {
    if (!navigator.serviceWorker) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.register('sw.js').catch(function () {
      /* Tanpa service worker aplikasinya tetap jalan penuh - yang hilang cuma
         membuka tanpa sinyal dan menerima Bagikan. */
    });
  }

  /* ===================== pasang semua ===================== */

  function pasang() {
    /* --- layar utama --- */
    var bacaTertunda = tunda(function () {
      perbaruiTebakan();
      perbaruiUsulKategori();
    }, JEDA_BACA);
    $('#kotak').addEventListener('input', bacaTertunda);

    /* Enter = cari. Kotak ini pintu masuk DAN pintu keluar: mengetik satu kata
       lalu menekan Enter adalah gerakan yang paling sering terjadi, dan
       memaksanya lewat tombol menambah satu ketukan pada gerakan tersering.
       Isi kotaknya tidak hilang - kalau ternyata mau di-drop, tekan Drop.
       Shift+Enter tetap baris baru buat catatan yang memang berbaris-baris. */
    $('#kotak').addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || ev.shiftKey) return;
      var isi = $('#kotak').value.trim();
      if (!isi) return;
      ev.preventDefault();
      keHasil(isi);
    });

    $('#b-drop').addEventListener('click', drop);
    $('#b-cari').addEventListener('click', function () { keHasil($('#kotak').value.trim()); });
    $('#b-catat').addEventListener('click', keCatatBaru);
    $('#b-semua').addEventListener('click', function () { keSemua(); });

    /* Dari layar hasil, yang paling sering terjadi berikutnya bukan mencari
       lagi - tapi menjatuhkan sesuatu yang barusan teringat gara-gara hasil
       ini. Jadi tombolnya sama persis, cuma lebih kecil. */
    $('#b-hasil-drop').addEventListener('click', function () { keLayar('l-utama'); $('#kotak').focus(); });
    $('#b-hasil-cari').addEventListener('click', function () { $('#cari-input').focus(); });
    $('#b-hasil-catat').addEventListener('click', keCatatBaru);
    $('#b-hasil-semua').addEventListener('click', function () { keSemua(); });

    $('#urut-baris').addEventListener('click', function (ev) {
      var cip = ev.target.closest('[data-urut]');
      if (!cip) return;
      urutSaat = cip.getAttribute('data-urut');
      gambarUrut();
      jalankanCari();
    });
    $('#b-setelan').addEventListener('click', function () {
      gambarSetelan();
      keLayar('l-setelan');
    });

    $('#kat').addEventListener('blur', benahiKotakKategori);
    $('#kat').addEventListener('input', function () {
      $('#b-kat-hapus').classList.toggle('sembunyi', !$('#kat').value);
      perbaruiUsulKategori();
    });
    $('#b-kat-hapus').addEventListener('click', function () {
      $('#kat').value = '';
      $('#kat-koreksi').classList.add('sembunyi');
      $('#b-kat-hapus').classList.add('sembunyi');
      perbaruiUsulKategori();
    });
    $('#kat-usul').addEventListener('click', function (ev) {
      var cip = ev.target.closest('[data-kat]');
      if (!cip) return;
      $('#kat-koreksi').classList.add('sembunyi');
      alihKeyword(cip.getAttribute('data-kat'));
    });

    $('#b-tambah-baris').addEventListener('click', tambahBarisDaftar);

    $('#lampiran').addEventListener('click', function (ev) {
      var tombol = ev.target.closest('[data-lamp]');
      if (!tombol) return;
      var apa = tombol.getAttribute('data-lamp');
      if (apa === 'gambar') $('#pilih-gambar').click();
      else if (apa === 'berkas') $('#pilih-berkas').click();
      else if (apa === 'daftar') setelDaftarNyala($('#petak-daftar').classList.contains('sembunyi'));
      else if (apa === 'suara') {
        if (perekam) perekam.stop();
        else mulaiRekam();
      }
    });

    $('#pilih-gambar').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) pasangBerkas(f, 'gambar');
      ev.target.value = '';
    });
    $('#pilih-berkas').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) pasangBerkas(f, 'berkas');
      ev.target.value = '';
    });

    /* --- layar hasil --- */
    $('#cari-input').addEventListener('input', tunda(jalankanCari, JEDA_CARI));
    /* Tombol kirim di papan ketik = cari, lalu papan ketiknya menutup supaya
       hasilnya langsung kelihatan utuh. Di kotak drop, Enter tetap baris baru:
       kehilangan satu baris di catatan tiga detik jauh lebih mahal. */
    $('#cari-input').addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      jalankanCari();
      ev.target.blur();
    });
    $('#saring-jenis').addEventListener('click', function (ev) {
      var cip = ev.target.closest('[data-jenis]');
      if (!cip) return;
      saringJenis = cip.getAttribute('data-jenis');
      gambarSaringJenis();
      jalankanCari();
    });
    $('#saring-kat').addEventListener('click', function (ev) {
      var cip = ev.target.closest('[data-katsaring]');
      if (!cip) return;
      saringKat = cip.getAttribute('data-katsaring');
      gambarSaringKategori();
      jalankanCari();
    });
    $('#hasil').addEventListener('click', function (ev) {
      /* Membuka lipatan tag: bukan mencari, bukan membuka kartunya. */
      var lipat = ev.target.closest('[data-tag-lagi]');
      if (lipat) {
        var kotakTag = lipat.parentNode;
        $$('.tag.terlipat', kotakTag).forEach(function (t) { t.classList.remove('terlipat'); });
        lipat.remove();
        return;
      }

      /* Tag dibaca lebih dulu, sebelum kartunya: menekan tag berarti
         "carikan yang lain seperti ini", bukan "buka yang ini". */
      var cipTag = ev.target.closest('[data-tag]');
      if (cipTag) {
        saringKat = '';
        saringJenis = 'semua';
        $('#cari-input').value = cipTag.getAttribute('data-tag');
        gambarSaringJenis();
        gambarSaringKategori();
        jalankanCari();
        return;
      }

      var kartu = ev.target.closest('.kartu');
      if (!kartu) return;
      var id = kartu.getAttribute('data-id');
      var e = null;
      semuaEntri.forEach(function (x) { if (x.id === id) e = x; });

      var satuan = ev.target.closest('[data-elemen]');
      if (satuan && e) {
        var x = (e.elemen || [])[Number(satuan.getAttribute('data-elemen'))];
        if (x) salin(x.nilai);
        return;
      }

      if (ev.target.closest('[data-salin]')) { if (e) salin(isiSalin(e)); return; }
      if (ev.target.closest('[data-sunting]')) { bukaKartu(id); return; }
      if (ev.target.closest('[data-pensiun]')) { if (e) pensiunkanKartu(e); return; }

      if (ev.target.closest('a')) return;   /* tautan dibuka, bukan kartunya */

      /* Menyentuh kartunya = membuka rinciannya di tempat, bukan pindah layar.
         Pindah layar itu mahal saat sedang memindai: kamu kehilangan posisi
         gulir dan harus mencari lagi dari atas. Yang benar-benar mau menyunting
         menekan tombol pensil yang baru saja muncul. */
      var rinci = kartu.querySelector('.kartu-rinci');
      if (rinci) {
        var buka = rinci.classList.contains('sembunyi');
        rinci.classList.toggle('sembunyi', !buka);
        kartu.classList.toggle('terbuka', buka);
      }
    });

    /* --- layar catat --- */
    var simpanTertunda = tunda(simpanCatat, JEDA_SIMPAN);
    $('#catat-judul').addEventListener('input', function () {
      /* Judul yang diketik sendiri tidak pernah ditimpa AI. */
      if (entriCatat && $('#catat-judul').value.trim()) entriCatat.judulManual = true;
      tanda('menyimpan…');
      simpanTertunda();
    });
    $('#catat-kat').addEventListener('input', function () { tanda('menyimpan…'); simpanTertunda(); });
    $('#catat-isi').addEventListener('input', function () { tanda('menyimpan…'); simpanTertunda(); });

    $('#b-riwayat').addEventListener('click', function () {
      var kotak = $('#riwayat');
      if (kotak.classList.contains('sembunyi')) gambarRiwayat();
      kotak.classList.toggle('sembunyi');
    });
    $('#riwayat').addEventListener('click', function (ev) {
      var tombol = ev.target.closest('[data-pulih]');
      if (!tombol || !entriCatat) return;
      var i = parseInt(tombol.getAttribute('data-pulih'), 10);
      var versi = (entriCatat.riwayat || [])[i];
      if (!versi) return;
      /* Memulihkan juga menyimpan versi sekarang - supaya tidak ada langkah
         yang menghilangkan tulisan. */
      entriCatat.riwayat = entriCatat.riwayat.concat([{ isi: entriCatat.isi, ts: entriCatat.diubah }]).slice(-RIWAYAT_MAKS);
      entriCatat.isi = '';
      $('#catat-isi').value = versi.isi;
      simpanCatat().then(gambarRiwayat);
      pesan('Versi dipulihkan');
    });
    /* Ketuk = pensiun (bisa diurungkan). Tekan lama = hapus permanen sampai ke
       Sheet dan Drive. Dua tindakan, satu tombol, tanpa dialog yang bertanya. */
    var tekanJam = null, sudahLama = false;
    var buang = $('#b-buang');
    function mulaiTekan() {
      sudahLama = false;
      clearTimeout(tekanJam);
      tekanJam = setTimeout(function () {
        sudahLama = true;
        if (navigator.vibrate) navigator.vibrate(18);
        hapusPermanen();
      }, 650);
    }
    function lepasTekan() { clearTimeout(tekanJam); }
    buang.addEventListener('pointerdown', mulaiTekan);
    buang.addEventListener('pointerup', lepasTekan);
    buang.addEventListener('pointerleave', lepasTekan);
    buang.addEventListener('pointercancel', lepasTekan);
    buang.addEventListener('click', function () { if (!sudahLama) pensiunkan(); });

    /* --- umum --- */
    $$('[data-kembali]').forEach(function (b) {
      b.addEventListener('click', kembali);
    });

    var pilihCadangan = document.createElement('input');
    pilihCadangan.type = 'file';
    pilihCadangan.accept = 'application/json,.json';
    pilihCadangan.id = 'pilih-cadangan';
    pilihCadangan.hidden = true;
    document.body.appendChild(pilihCadangan);
    pilihCadangan.addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      f.text().then(function (t) {
        return TSimpan.impor(JSON.parse(t));
      }).then(function (n) {
        return muatSemua().then(function () { pesan(n + ' catatan dipulihkan'); });
      }).catch(function (err) {
        pesan('Impor gagal: ' + err.message);
      });
    });

    global.addEventListener('popstate', function (ev) {
      tampilkanLayar((ev.state && ev.state.layar) || 'l-utama');
    });

    /* Menutup tab atau berpindah aplikasi tidak boleh memakan kalimat
       terakhir. Di HP, 'hidden' jauh lebih bisa diandalkan daripada
       'beforeunload'. */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        if (layarSaat === 'l-catat') simpanCatat();
        return;
      }
      /* Di HP, aplikasi jarang benar-benar ditutup - dia cuma ditinggal.
         Jadi "dibuka lagi" dihitung sebagai pembukaan, dan cadangannya
         menyusul di situ. TSinkron sendiri yang menahan supaya tidak
         menembak berulang dalam satu sesi. */
      putaranCadangan();
    });
  }

  function mulai() {
    try { history.replaceState({ layar: 'l-utama' }, ''); }
    catch (e) { pakaiRiwayatBrowser = false; }

    /* Nama aplikasi dituliskan dari satu tempat saja (bawaan.js), supaya
       menggantinya besok tidak menyentuh apa pun selain kulitnya. */
    $$('#merek, #merek-mulai').forEach(function (n) { n.textContent = TBawaan.nama; });
    $('#kaki-utama').textContent = TBawaan.tagline +
      ' Tersimpan langsung di perangkat, tanpa menunggu jaringan.';

    pasang();

    daftarSW();

    TSimpan.semuaSetelan().then(function (s) {
      setelanSaat = s || {};
      return muatSemua();
    }).then(function () {
      return ambilBagikan();
    }).then(function () {
      perbaruiUsulKategori();
      /* Minta status penyimpanan permanen sekali di awal: tanpa itu browser
         boleh membuang seluruh timbunan saat penyimpanan HP sesak, diam-diam. */
      mintaPermanen();

      /* Layar pemasangan cuma muncul sekali, dan hanya kalau kotaknya masih
         benar-benar kosong. Kalau sudah ada isinya - misalnya masuk lewat
         tombol Bagikan - jangan pernah menghalangi jalan masuk. */
      if (!sudahDipasang() && !semuaEntri.length && !$('#kotak').value) {
        gambarMulai();
        tampilkanLayar('l-mulai');
      }

      putaranLabel();
      putaranCadangan();
      setInterval(putaranLabel, PUTARAN_LABEL);
    }).catch(function (err) {
      pesan('Penyimpanan tidak bisa dibuka: ' + err.message);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
  else mulai();

  /* Dibuka untuk uji terima; aplikasinya sendiri tidak memakainya. */
  global.TAlur = {
    keHasil: keHasil, keCatat: keCatat, drop: drop,
    gambarMulai: gambarMulai, gambarSetelan: gambarSetelan,
    alihKeyword: alihKeyword, perbaruiUsulKategori: perbaruiUsulKategori,
    keSemua: keSemua, uraiTagFavorit: uraiTagFavorit, kartuHtmlUji: kartuHtml,
    /* Cuma untuk uji: memindah layar tanpa lewat tombol. */
    keLayarUji: keLayar,
    semuaEntri: function () { return semuaEntri; }
  };
})(window);
