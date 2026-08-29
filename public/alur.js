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
    ['catatan', 'Catatan'], ['tugas', 'Tugas']
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
      rahasia: false, elemenTerkunci: '',
      selesai: false, selesaiPada: 0, penting: false, hariIni: 0,
      tenggat: 0, ulang: '',
      pensiun: false, dihapus: false, riwayat: []
    };
  }

  /* ===================== keadaan ===================== */

  var semuaEntri = [];        /* salinan lokal; pencarian jalan di atas ini */
  var setelanSaat = {};
  var draf = null;            /* lampiran yang sudah siap tapi belum di-drop */
  var entriCatat = null;
  var labelDepan = null;   /* label yang sedang ditampilkan di layar depan */
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
    ['l-mulai', 'l-utama', 'l-tugas', 'l-note', 'l-catat', 'l-setelan'].forEach(function (x) {
      $('#' + x).classList.toggle('aktif', x === id);
    });
    layarSaat = id;
    if (id === 'l-utama') perbaruiJumlah();
    if (id === 'l-note') gambarNote();
    gambarTab();
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

  /* Angka di tombolnya cuma yang BELUM selesai. Menampilkan seluruh jumlah
     berarti angkanya tidak pernah turun, dan angka yang tidak pernah turun
     berhenti dibaca. */
  function jumlahTugasTertunda() {
    return semuaEntri.filter(function (e) {
      return e.jenis === 'tugas' && !e.selesai && !e.pensiun && !e.dihapus;
    }).length;
  }

  function perbaruiJumlahTugas() { gambarTab(); }

  /* TIGA PINTU, SATU BARIS, DI KEPALA - dan sama persis di ketiga layarnya.
     Digambar dari sini, bukan disalin tiga kali di HTML: baris yang disalin
     akan berbeda-beda begitu salah satunya disunting, dan bedanya baru
     ketahuan setelah dipakai berminggu-minggu.

     Namanya dipendekkan (Drop, To Do, Note) karena tiga kata panjang tidak
     muat sebaris di layar HP, dan yang tidak muat akan dipotong sendiri oleh
     browser di tempat yang tidak kamu pilih. */
  var TAB = [
    ['l-utama', 'Drop', '<path d="M12 4v13"/><path d="M6 12l6 6 6-6"/>'],
    ['l-tugas', 'To Do', '<rect x="3" y="4" width="7" height="7" rx="1.5"/><path d="M5 7.5l1.5 1.5L9 6"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/><path d="M4 15h5"/><path d="M4 19h5"/>'],
    ['l-note', 'Note', '<path d="M4 5a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>']
  ];

  function gambarTab() {
    var tunda = jumlahTugasTertunda();
    var isi = TAB.map(function (t) {
      var lencana = (t[0] === 'l-tugas' && tunda)
        ? '<span class="tab-lencana">' + tunda + '</span>' : '';
      return '<button class="tab' + (layarSaat === t[0] ? ' nyala' : '') +
             '" data-tab-ke="' + t[0] + '">' +
             '<svg viewBox="0 0 24 24" class="ik">' + t[2] + '</svg>' +
             H(t[1]) + lencana + '</button>';
    }).join('');
    $$('[data-tab]').forEach(function (n) { n.innerHTML = isi; });
  }

  function keTab(id) {
    if (id === layarSaat) return;
    if (id === 'l-tugas') TTugas.buka();
    keLayar(id);
  }

  /* Tugas menumpang di toko yang sama, tapi dia bukan bagian dari timbunan
     catatan: dia tidak dihitung, tidak menyumbang rak, dan tidak pernah muncul
     di layar hasil. Satu-satunya tempatnya adalah layar to-do. */
  function catatanSaja(e) { return !e.pensiun && e.jenis !== 'tugas'; }

  function perbaruiJumlah() {
    var n = semuaEntri.filter(catatanSaja).length;
    $('#jumlah').textContent = n + ' tersimpan';
  }

  function daftarKategori() {
    var hitung = {};
    semuaEntri.forEach(function (e) {
      if (!catatanSaja(e) || !e.kategori) return;
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
  }

  /* JALUR MASUK. Tidak ada satu pun panggilan jaringan di sini, dan tidak
     boleh pernah ada. Pelabelan AI menyusul belakangan lewat antrean. */
  function drop() {
    var teks = $('#kotak').value.trim();
    var daftar = ambilDaftar();
    var jenis = bacaDraf();

    if (!teks && !daftar.length && !draf) { pesan('Kotaknya masih kosong'); return; }

    var e = entriBaru(jenis);
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
      gambarHasilDepan();
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
        /* Lacinya menutup sendiri: lampirannya sudah terpilih, dan daftar
           label yang menggantung terbuka cuma menutupi kotaknya. */
        alihPanelLabel(false);
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
  /* Nilai awal dari bawaan.js dipakai HANYA sampai pemakainya menyuntingnya
     sekali. Sesudah itu daftarnya miliknya, termasuk kalau dia mengosongkannya. */
  function daftarLabel(s) {
    var teks = (s || setelanSaat || {}).label;
    if (teks == null) teks = (TBawaan.labelAwal || []).join('\n');
    return TOtak.uraiLabel(teks);
  }

  /* ===================== LABEL DI LAYAR DEPAN =====================
     Percobaan: memilih label tidak memindahkan layar, hasilnya digambar di
     bawah tombolnya. Alasannya sama dengan alasan tombol "Semua" dulu boleh
     ada - yang dilarang aturan nomor lima adalah dinding kartu yang MENYAMBUT
     tanpa diminta, bukan hasil yang muncul karena kamu sendiri memintanya.
     Kotaknya kosong sampai kamu memilih, dan tertutup lagi lewat silang. */

  var CARI_LABEL_MIN = 8;   /* di bawah ini seluruh daftar sudah kelihatan */

  function labelDenganJumlah() {
    var hidup = semuaEntri.filter(catatanSaja);
    return daftarLabel().map(function (l) {
      return {
        nama: l.nama, istilah: l.istilah,
        jumlah: hidup.filter(function (e) { return TOtak.cocokLabel(e, l.istilah); }).length
      };
    });
  }

  function gambarDaftarLabel() {
    var semua = labelDenganJumlah();
    var kotak = $('#label-cari');
    var kueri = TOtak.normal(kotak.value);

    kotak.classList.toggle('sembunyi', semua.length < CARI_LABEL_MIN);

    var baris = ['<button class="label-baris' + (labelDepan === '*' ? ' nyala' : '') +
                 '" data-label="*">Semua<span class="label-jumlah">' +
                 semuaEntri.filter(catatanSaja).length + '</span></button>'];

    semua.filter(function (l) {
      if (!kueri) return true;
      /* Dicocokkan ke istilahnya juga, bukan cuma namanya: mengetik
         "construction" harus menemukan label yang tertulis "Cons". */
      return l.istilah.some(function (t) { return t.indexOf(kueri) >= 0; });
    }).forEach(function (l) {
      baris.push('<button class="label-baris' + (labelDepan === l.nama ? ' nyala' : '') +
                 (l.jumlah ? '' : ' sepi') + '" data-label="' + H(l.nama) + '">' +
                 H(l.nama) + '<span class="label-jumlah">' + l.jumlah + '</span></button>');
    });

    if (baris.length === 1 && kueri) {
      baris.push('<div class="label-kosong">Tidak ada label bernama itu.</div>');
    }
    $('#label-daftar').innerHTML = baris.join('');
  }

  function alihPanelLabel(buka) {
    var panel = $('#panel-label');
    var mau = buka === undefined ? panel.classList.contains('sembunyi') : buka;
    panel.classList.toggle('sembunyi', !mau);
    $('#b-label').setAttribute('aria-expanded', mau ? 'true' : 'false');
    if (!mau) return;
    $('#label-cari').value = '';
    gambarDaftarLabel();
  }

  function pilihLabelDepan(nama) {
    labelDepan = nama;
    alihPanelLabel(false);
    gambarHasilDepan();
  }

  function tutupHasilDepan() {
    labelDepan = null;
    var kepala = $('.kepala-tetap');
    if (kepala) kepala.classList.remove('ringkas');
    $('#petak-hasil-depan').classList.add('sembunyi');
    $('#hasil-depan').innerHTML = '';
    $('#b-label-teks').textContent = 'Label';
    bersihkanUrl();
  }

  /* MENGETIK LANGSUNG MENYARING, tanpa Enter, tiap huruf. Pencarian jalan di
     atas salinan lokal - tidak ada jaringan, tidak ada tunggu - jadi menunda
     hasilnya sampai Enter cuma menahan sesuatu yang sudah siap. Dan menunggu
     itu yang bikin orang menyerah setengah jalan lalu mengetik ulang.

     Kotaknya tetap kotak DROP. Selama hasilnya terbuka, apa yang kamu ketik
     berfungsi sebagai penyaring; kalau ternyata mau disimpan, tombol Drop di
     sebelah kanan tetap menyimpannya apa adanya. Satu kotak, tapi tidak
     ambigu: yang menentukan artinya bukan mode tersembunyi, melainkan apakah
     daftar hasilnya sedang terbuka di depan matamu. */
  /* Terbuka kalau ada label yang dipilih ATAU ada yang sedang diketik. Yang
     kedua itu yang bikin dia terasa seperti WhatsApp: satu huruf, daftarnya
     langsung menyusut. Kotak kosong tanpa label berarti tidak ada apa-apa di
     bawah, dan layar depannya kembali kosong. */
  function hasilDepanAktif() {
    return !!labelDepan || !!$('#kotak').value.trim();
  }

  function gambarHasilDepan() {
    if (!hasilDepanAktif()) { tutupHasilDepan(); return; }

    var istilah = null;
    if (labelDepan && labelDepan !== '*') {
      daftarLabel().forEach(function (l) { if (l.nama === labelDepan) istilah = l.istilah; });
      if (!istilah) istilah = [TOtak.normal(labelDepan)];
    }

    var kueri = $('#kotak').value.trim();
    bersihkanUrl();
    var hasil = TOtak.cari(semuaEntri, kueri, '', istilah || '');
    $('#b-label-teks').textContent = !labelDepan ? 'Label'
                                   : labelDepan === '*' ? 'Semua' : labelDepan;
    $('#petak-hasil-depan').classList.remove('sembunyi');

    var ket = [];
    ket.push(hasil.length ? hasil.length + ' hasil' : 'Kosong');
    if (labelDepan && labelDepan !== '*') ket.push(labelDepan);
    if (kueri) ket.push('“' + kueri + '”');
    $('#hasil-depan-ket').textContent = ket.join(' · ');

    /* Kotaknya menyusut begitu hasilnya terbuka DAN kamu tidak sedang
       mengetik di dalamnya. Waktu mengetik dia harus tetap lega - itu jalur
       masuknya; begitu jarimu pindah ke daftar di bawah, tiga baris kosong
       cuma memakan tempat yang seharusnya jadi hasil. */
    $('.kepala-tetap').classList.toggle('ringkas',
      document.activeElement !== $('#kotak'));

    var wadah = $('#hasil-depan');
    if (!hasil.length) {
      wadah.innerHTML = '<div class="kosong">' + (kueri
        ? 'Tidak ada yang cocok.<br>Coba satu kata saja — pencarian ini memaafkan.'
        : 'Belum ada yang masuk label ini.<br>Label diisi AI sesudah catatannya jatuh.') +
        '</div>';
      return;
    }
    wadah.innerHTML = hasil.slice(0, 200).map(kartuHtml).join('');
    pasangGambarKartu(wadah);
  }

  /* ===================== LAYAR NOTE =====================
     Pengganti Notepad, tapi dipanggil dengan MENCARI, bukan dibuka dari pohon
     folder. Foldernya tetap ada dan tetap kelihatan - itu yang membuat satu
     catatan punya ALAMAT, bukan mengambang di timbunan - tapi menyusuri
     folder satu per satu adalah pekerjaan yang tidak perlu diadakan kalau
     kata kuncinya sudah ada di kepala.

     Alamatnya dari rak yang dipilih sendiri. Kalau lupa mengisi - dan itu yang
     biasanya terjadi - diambil dari tag pertama buatan AI. Jadi tidak pernah
     ada catatan tanpa alamat, dan tidak pernah ada keputusan yang ditagih di
     jalur masuk untuk mengadakannya. */

  var TANPA_RAK = 'Belum berlabel';
  var noteFolder = null;   /* folder yang sedang dibuka; null = daftar folder */

  function alamatNote(e) {
    /* Diambil apa adanya, bukan lewat normal(): normal() menurunkan semua
       huruf, dan folder bernama "projectspace" di sebelah "AmaraLiving" (yang
       datang dari tag) terbaca seperti dua sistem yang berbeda. */
    var kat = String(e.kategori || '').trim().split(/\s+/).filter(Boolean)[0];
    if (kat) return kat;
    var tag = (e.tag || []).filter(Boolean)[0];
    return tag || TANPA_RAK;
  }

  function folderNote() {
    var isi = {};
    semuaEntri.filter(catatanSaja).forEach(function (e) {
      var a = alamatNote(e);
      (isi[a] = isi[a] || []).push(e);
    });
    return Object.keys(isi).map(function (nama) {
      return { nama: nama, isi: isi[nama] };
    }).sort(function (a, b) {
      /* Yang belum berlabel selalu paling bawah: dia bukan folder, dia
         tumpukan yang belum sempat dinilai AI. */
      if ((a.nama === TANPA_RAK) !== (b.nama === TANPA_RAK)) return a.nama === TANPA_RAK ? 1 : -1;
      if (b.isi.length !== a.isi.length) return b.isi.length - a.isi.length;
      return a.nama.localeCompare(b.nama);
    });
  }

  function gambarNote() {
    var kueri = $('#note-cari').value.trim();
    var semua = semuaEntri.filter(catatanSaja);
    $('#note-jumlah').textContent = semua.length + ' catatan';

    /* Mengetik selalu MENEMBUS folder. Kalau pencarian cuma berlaku di folder
       yang sedang dibuka, orangnya harus tahu dulu barangnya ada di mana -
       dan kalau dia tahu, dia tidak perlu mencari. */
    if (kueri) {
      var hasil = TOtak.cari(semuaEntri, kueri, '', '');
      $('#note-alamat').innerHTML = '<button class="note-jejak" data-note-akar>Semua folder</button>' +
        '<span class="note-pisah">/</span><span class="note-jejak-kini">“' + H(kueri) + '”</span>' +
        '<span class="note-hitung">' + hasil.length + '</span>';
      $('#note-isi').innerHTML = hasil.length
        ? hasil.slice(0, 200).map(function (e) {
            /* Alamatnya ditulis di atas judulnya, bukan dikirim sebagai
               argumen kedua ke kartuHtml: kartu itu dipakai di tiga tempat,
               dan menambah parameter di sana berarti map() yang memanggilnya
               diam-diam mengoper nomor urut sebagai alamat. */
            return '<div class="note-alamat-kecil">' + H(alamatNote(e)) + ' /</div>' +
                   kartuHtml(e);
          }).join('')
        : '<div class="kosong">Tidak ada yang cocok.<br>Coba satu kata saja — pencarian ini memaafkan.</div>';
      pasangGambarKartu($('#note-isi'));
      return;
    }

    if (noteFolder) {
      var f = folderNote().filter(function (x) { return x.nama === noteFolder; })[0];
      var daftar = f ? f.isi.slice().sort(function (a, b) { return (b.diubah || 0) - (a.diubah || 0); }) : [];
      $('#note-alamat').innerHTML = '<button class="note-jejak" data-note-akar>Semua folder</button>' +
        '<span class="note-pisah">/</span><span class="note-jejak-kini">' + H(noteFolder) + '</span>' +
        '<span class="note-hitung">' + daftar.length + '</span>';
      $('#note-isi').innerHTML = daftar.length
        ? daftar.map(kartuHtml).join('')
        : '<div class="kosong">Folder ini sudah kosong.</div>';
      pasangGambarKartu($('#note-isi'));
      return;
    }

    var folder = folderNote();
    $('#note-alamat').innerHTML = '<span class="note-jejak-kini">Semua folder</span>' +
      '<span class="note-hitung">' + folder.length + '</span>';
    $('#note-isi').innerHTML = folder.length
      ? folder.map(function (f) {
          return '<button class="note-folder' + (f.nama === TANPA_RAK ? ' sepi' : '') +
                 '" data-note-folder="' + H(f.nama) + '">' +
                 '<svg viewBox="0 0 24 24" class="ik"><path d="M4 5a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>' +
                 '<span class="note-folder-nama">' + H(f.nama) + '</span>' +
                 '<span class="note-hitung">' + f.isi.length + '</span></button>';
        }).join('')
      : '<div class="kosong">Belum ada catatan.<br>Jatuhkan sesuatu dulu lewat Drop.</div>';
  }

  /* Satu pintu untuk menggambar ulang apa pun yang sedang tampil. Hasil
     sekarang bisa berada di DUA tempat, dan tiap pemanggil yang memilih
     sendiri mana yang disegarkan pasti akan melupakan salah satunya. */
  function segarkanTampilan() {
    if (layarSaat === 'l-note') gambarNote();
    if (hasilDepanAktif()) gambarHasilDepan();
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
    /* Judul dan tag tetap terbaca - itu yang membuatnya masih bisa DITEMUKAN.
       Isinya tidak, sampai kuncinya dibuka. */
    if (e.rahasia) {
      b.push('<div class="kartu-cuplik terkunci">' +
        '<svg viewBox="0 0 24 24" class="ik gembok"><rect x="4" y="10" width="16" height="11" rx="2"/>' +
        '<path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>' +
        (TKunci.terbuka() ? 'Terkunci — buka lewat tombol ubah'
                          : 'Terkunci — sandinya belum dibuka') + '</div>');
    } else if (cup && !elemen.length) {
      b.push('<div class="kartu-cuplik">' + H(cup) + '</div>');
    }

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
    if (elemen.length && !e.rahasia) b.push('<div class="elemen">' + elemenBaris(elemen[0], 0) + '</div>');

    var r = [];
    if (e.rahasia) elemen = [];
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
    var isi = e.rahasia ? '' : String(e.isi || '').trim();
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
      IKON_AKSI('pensiun', 'Arsipkan', '<path d="M3 6h18"/><path d="M8 6V4h8v2"/>' +
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

  /* GESER KE KIRI = ARSIPKAN.
     Mengarsipkan itu tindakan yang paling sering dilakukan di layar hasil
     setelah membaca - "oh, ini sudah lewat" - dan menyuruhnya lewat buka
     kartu lalu cari tombol berarti tiga ketukan untuk satu keputusan yang
     sudah bulat sejak detik pertama.

     Cuma ke KIRI, dan cuma satu arah: dua arah berarti harus mengingat mana
     yang mana, dan itu keputusan tambahan yang tidak perlu diadakan.

     Ambang 90px sengaja jauh: gulir daftar panjang dengan jempol sering
     menyerempet ke samping, dan mengarsipkan tanpa sengaja merusak
     kepercayaan lebih parah daripada gestur yang gagal sekali. */
  var GESER_AMBANG = 90;
  var GESER_MULAI = 12;

  function pasangGeser(akar) {
    var kartu = null, x0 = 0, y0 = 0, arah = '';

    akar.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('button') || ev.target.closest('a')) return;
      kartu = ev.target.closest('.kartu');
      if (!kartu) return;
      x0 = ev.clientX; y0 = ev.clientY; arah = '';
      kartu.style.transition = 'none';
    });

    akar.addEventListener('pointermove', function (ev) {
      if (!kartu) return;
      var dx = ev.clientX - x0, dy = ev.clientY - y0;

      /* Arah ditetapkan sekali di awal, lalu tidak berubah. Kalau dinilai
         ulang tiap gerakan, gulir yang sedikit miring berubah jadi geser di
         tengah jalan. */
      if (!arah) {
        if (Math.abs(dx) < GESER_MULAI && Math.abs(dy) < GESER_MULAI) return;
        arah = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'samping' : 'gulir';
        if (arah === 'gulir') { lepasGeser(); return; }
      }
      if (arah !== 'samping') return;

      ev.preventDefault();
      var geser = Math.min(0, dx);
      kartu.style.transform = 'translateX(' + geser + 'px)';
      kartu.classList.toggle('siap-arsip', geser <= -GESER_AMBANG);
    });

    function selesai(ev) {
      if (!kartu || arah !== 'samping') { lepasGeser(); return; }
      var dx = ev.clientX - x0;
      var k = kartu;
      lepasGeser();
      if (dx <= -GESER_AMBANG) {
        var e = null;
        var id = k.getAttribute('data-id');
        semuaEntri.forEach(function (x) { if (x.id === id) e = x; });
        k.style.transform = 'translateX(-100%)';
        k.style.opacity = '0';
        if (e) setTimeout(function () { pensiunkanKartu(e); }, 140);
      }
    }

    function lepasGeser() {
      if (!kartu) return;
      kartu.style.transition = '';
      kartu.style.transform = '';
      kartu.classList.remove('siap-arsip');
      kartu = null; arah = '';
    }

    akar.addEventListener('pointerup', selesai);
    akar.addEventListener('pointercancel', lepasGeser);
    akar.addEventListener('pointerleave', lepasGeser);
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
    $('#riwayat').classList.add('sembunyi');
    gambarLampiranCatat(e);
    gambarGembok(e);
    tanda('tersimpan');
    keLayar('l-catat');

    /* Isi yang terkunci baru dibuka setelah layarnya tampil - kalau menunggu
       enkripsi dulu, perpindahan layarnya terasa tersendat. */
    var isian = $('#catat-isi');
    if (!e.rahasia) { isian.value = e.isi || ''; isian.readOnly = false; return; }

    if (!TKunci.terbuka()) {
      isian.value = '';
      isian.readOnly = true;
      isian.placeholder = 'Terkunci. Buka kuncinya di Setelan untuk membacanya.';
      return;
    }
    isian.readOnly = false;
    isian.placeholder = 'Tulis apa saja…';
    isian.value = '…';
    TKunci.bukaTeks(e.isi || '').then(function (t) {
      if (entriCatat === e) { isian.value = t; e.isiTerbuka = t; }
    }, function () { if (entriCatat === e) isian.value = ''; });
  }

  function gambarGembok(e) {
    var b = $('#b-gembok');
    if (!b) return;
    b.classList.toggle('nyala', !!e.rahasia);
    b.setAttribute('aria-label', e.rahasia ? 'Buka kunci catatan ini' : 'Kunci catatan ini');
  }

  /* Menandai rahasia = mengunci isinya SEKARANG, bukan nanti. Kalau ditunda,
     ada jendela waktu ketika teks biasanya masih tersimpan - dan jendela itu
     persis yang mau ditutup. */
  function alihGembok() {
    var e = entriCatat;
    if (!e) return;
    if (!TKunci.ada()) { pesan('Peramban ini tidak punya Web Crypto'); return; }
    if (!TKunci.sudahDipasang(setelanSaat)) {
      pesan('Pasang sandi dulu di Setelan');
      return;
    }
    if (!TKunci.terbuka()) { pesan('Buka kuncinya dulu di Setelan'); return; }

    if (e.rahasia) {
      TKunci.lepasEntri(e).then(function () {
        e.diubah = Date.now();
        return TSimpan.taruh(e);
      }).then(function () {
        segarkanCache(e);
        $('#catat-isi').value = e.isi || '';
        gambarGembok(e);
        pesan('Kuncinya dilepas');
      });
      return;
    }

    /* Isi yang sedang diketik ikut dikunci, bukan yang terakhir tersimpan. */
    e.isi = $('#catat-isi').value;
    e.elemen = TOtak.gabungElemen([], TOtak.elemenOtomatis(e));
    TKunci.kunciEntri(e).then(function () {
      e.diubah = Date.now();
      return TSimpan.taruh(e);
    }).then(function () {
      segarkanCache(e);
      gambarGembok(e);
      pesan('Terkunci · tidak akan dikirim ke AI');
    }, function (err) { pesan('Gagal mengunci: ' + err.message); });
  }

  function simpanCatat() {
    var e = entriCatat;
    if (!e) return Promise.resolve();

    var judul = $('#catat-judul').value.trim();
    var kat = $('#catat-kat').value.trim();
    var isi = $('#catat-isi').value;

    /* Entri terkunci: kolom isinya berisi sandi, bukan teks. Menyimpan apa
       yang tampak di layar akan menimpanya dengan teks biasa - jadi
       perubahan isi disimpan lewat gembok, bukan lewat jalur ini. */
    if (e.rahasia) {
      if (judul === e.judul && kat === e.kategori) { tanda('tersimpan'); return Promise.resolve(); }
      e.judul = judul || e.judul;
      e.kategori = kat;
      e.diubah = Date.now();
      return TSimpan.taruh(e).then(function () { segarkanCache(e); tanda('tersimpan'); });
    }

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
      segarkanTampilan();
      pesan('Diarsipkan', {
        teks: 'Urungkan',
        jalan: function () {
          e.pensiun = false;
          TSimpan.taruh(e).then(function () {
            segarkanCache(e);
            perbaruiJumlah();
            segarkanTampilan();
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
      pesan('Diarsipkan', {
        teks: 'Urungkan',
        jalan: function () {
          e.pensiun = false;
          TSimpan.taruh(e).then(function () {
            segarkanCache(e);
            perbaruiJumlah();
            segarkanTampilan();
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
            segarkanTampilan();
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
        muatSemua();
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

      '<div class="set-bagian">Label rak</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Barisan tetap di layar hasil</div>',
      '<div class="set-ket">Satu baris satu label — nama proyek, divisi, atau perusahaan. ' +
        'Pendekkan namanya supaya sebaris muat banyak; yang harus digulir jauh tidak akan dipakai. ' +
        'Kalau singkatannya cuma ada di kepalamu, tulis kata panjangnya sesudah <b>=</b> ' +
        '(<i>Cons = construction, konstruksi</i>) supaya tag buatan AI ikut tertangkap. ' +
        'Urutannya tidak diacak ulang, jadi jarimu bisa hafal tempatnya.</div>',
      '<textarea class="set-input tinggi" id="set-label" spellcheck="false" ' +
        'placeholder="MAP&#10;Cons = construction">' +
        H((s.label != null ? s.label : (TBawaan.labelAwal || []).join('\n'))) + '</textarea>',
      '<div class="set-ket" id="label-jumlah">…</div>',
      '</div>',

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

      '<div class="set-bagian">Kunci rahasia</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">' + (TKunci.sudahDipasang(s)
        ? (TKunci.terbuka() ? 'Kuncinya sedang terbuka' : 'Terkunci')
        : 'Belum dipasang') + '</div>',
      '<div class="set-ket">Catatan yang kamu tandai gembok <b>tidak pernah dikirim ke AI</b>, dan isinya naik ke Drive sudah berupa sandi. Judul dan tagnya tetap terbuka — supaya catatannya masih bisa <b>ditemukan</b>, cuma tidak bisa dibaca.</div>',
      '<div class="set-ket awas-teks">Sandinya tidak disimpan di mana pun. Lupa sandi berarti isinya hilang selamanya — tidak ada yang bisa mengembalikannya, termasuk aku.</div>',
      TKunci.sudahDipasang(s)
        ? (TKunci.terbuka()
            ? '<button class="set-tbl" id="b-kunci-tutup">Kunci lagi sekarang</button>'
            : '<input class="set-input" id="set-sandi" type="password" placeholder="Sandi" autocomplete="off">' +
              '<button class="set-tbl emas" id="b-kunci-buka">Buka kunci</button>')
        : '<input class="set-input" id="set-sandi" type="password" placeholder="Sandi baru, minimal 6 huruf" autocomplete="off">' +
          '<button class="set-tbl emas" id="b-kunci-pasang">Pasang sandi</button>',
      '<div class="set-ket" id="kunci-ket"></div>',
      '</div>',

      '<div class="set-bagian">Arsip</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Yang sudah lewat, tapi tidak dibuang</div>',
      '<div class="set-ket">Geser kartu ke kiri di layar hasil untuk mengarsipkannya. Yang diarsipkan berhenti muncul di pencarian — datanya tetap utuh di sini, dan bisa dikembalikan kapan saja.</div>',
      '<div id="arsip-daftar"></div>',
      '</div>',

      '<div class="set-bagian">Bahaya</div>',
      '<div class="set-kotak awas">',
      '<div class="set-judul">Kosongkan semua data</div>',
      '<div class="set-ket">Semua entri dan berkas di perangkat ini hilang, tanpa urung. Yang sudah naik ke Drive tetap aman. Ketik <b>HAPUS</b> untuk membuka tombolnya.</div>',
      '<input class="set-input" id="set-hapus-ketik" placeholder="HAPUS" autocomplete="off">',
      '<button class="set-tbl bahaya" id="b-kosongkan" disabled>Kosongkan</button>',
      '</div>'
    ].join('');

    gambarArsip();
    pasangSetelan();
    perbaruiStatusSetelan();
  }

  /* Arsip TIDAK diberi pencariannya sendiri. Kalau arsipnya bisa dicari, dia
     jadi rak kedua yang harus diurus - dan mengurus dua rak adalah persis
     pekerjaan yang bikin semua sistem sebelumnya berhenti dipakai. Di sini dia
     cuma daftar: lihat, kembalikan kalau ternyata masih perlu. */
  function gambarArsip() {
    var wadah = $('#arsip-daftar');
    if (!wadah) return;
    /* Tugas yang dibuang juga ditandai pensiun - tapi arsip ini milik layar
       hasil, dan mengembalikan tugas dari sini akan memunculkannya di tempat
       yang salah. */
    var arsip = semuaEntri.filter(function (e) {
      return e.pensiun && !e.dihapus && e.jenis !== 'tugas';
    });

    if (!arsip.length) {
      wadah.innerHTML = '<div class="set-ket">Belum ada yang diarsipkan.</div>';
      return;
    }
    wadah.innerHTML = '<div class="set-ket">' + arsip.length + ' diarsipkan</div>' +
      arsip.slice(0, 50).map(function (e) {
        return '<div class="arsip-baris">' +
          '<div class="arsip-judul">' + H(e.judul || '(tanpa judul)') + '</div>' +
          '<button class="arsip-balik" data-balik="' + H(e.id) + '">Kembalikan</button></div>';
      }).join('') +
      (arsip.length > 50 ? '<div class="set-ket">…dan ' + (arsip.length - 50) + ' lagi</div>' : '');
  }

  function kembalikanArsip(id) {
    var e = null;
    semuaEntri.forEach(function (x) { if (x.id === id) e = x; });
    if (!e) return;
    e.pensiun = false;
    e.diubah = Date.now();
    TSimpan.taruh(e).then(function () {
      segarkanCache(e);
      perbaruiJumlah();
      gambarArsip();
      pesan('Dikembalikan');
    });
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

    var isianLabel = $('#set-label');
    if (isianLabel) {
      var tampilJumlahLabel = function () {
        var n = TOtak.uraiLabel(isianLabel.value).length;
        $('#label-jumlah').textContent = n ? n + ' label' : 'Belum ada label — barisannya cuma "Semua".';
      };
      tampilJumlahLabel();
      isianLabel.addEventListener('input', tampilJumlahLabel);
      isianLabel.addEventListener('change', function () {
        /* Ditulis ulang dari hasil uraian, bukan disimpan apa adanya: begitu
           dia kembali ke sini besok, yang dilihatnya persis yang dipakai
           aplikasinya - tidak ada baris yang diam-diam terbuang. */
        var daftar = TOtak.uraiLabel(isianLabel.value);
        isianLabel.value = TOtak.tulisLabel(daftar);
        tampilJumlahLabel();
        /* Label yang sedang menyaring bisa saja baru dihapus - kalau
           saringannya dibiarkan, hasilnya kosong tanpa sebab yang kelihatan. */
        labelDepan = null;
        simpanSetelan('label', isianLabel.value);
      });
    }

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

    var pasangSandi = $('#b-kunci-pasang');
    if (pasangSandi) {
      pasangSandi.addEventListener('click', function () {
        var nilai = $('#set-sandi').value;
        TKunci.pasang(setelanSaat, nilai).then(function () {
          pesan('Sandi terpasang · kuncinya terbuka');
          gambarSetelan();
        }, function (err) { $('#kunci-ket').textContent = err.message; });
      });
    }
    var bukaSandi = $('#b-kunci-buka');
    if (bukaSandi) {
      bukaSandi.addEventListener('click', function () {
        TKunci.buka(setelanSaat, $('#set-sandi').value).then(function () {
          pesan('Kuncinya terbuka');
          gambarSetelan();
          segarkanTampilan();
        }, function (err) { $('#kunci-ket').textContent = err.message; });
      });
    }
    var tutupSandi = $('#b-kunci-tutup');
    if (tutupSandi) {
      tutupSandi.addEventListener('click', function () {
        TKunci.tutup();
        pesan('Terkunci lagi');
        gambarSetelan();
      });
    }

    var arsip = $('#arsip-daftar');
    if (arsip) {
      arsip.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-balik]');
        if (b) kembalikanArsip(b.getAttribute('data-balik'));
      });
    }

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
    /* Tugas tidak pernah dilabeli AI, jadi diLabeliAI-nya tetap false
       selamanya - tanpa saringan ini antreannya kelihatan tidak pernah habis
       dan putarannya jalan terus tanpa ada yang bisa dikerjakan. */
    return semuaEntri.some(function (e) { return !e.diLabeliAI && catatanSaja(e); });
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
      if (n) muatSemua().then(function () { segarkanTampilan(); });
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
      segarkanTampilan();
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
    }, JEDA_BACA);
    $('#kotak').addEventListener('focus', function () {
      $('.kepala-tetap').classList.remove('ringkas');
    });
    $('#kotak').addEventListener('blur', function () {
      if (hasilDepanAktif()) $('.kepala-tetap').classList.add('ringkas');
    });
    $('#kotak').addEventListener('input', function () {
      bacaTertunda();
      /* Tanpa jeda: pencarian jalan di atas salinan lokal, jadi menundanya
         cuma menahan hasil yang sudah siap. Tebakan jenis tetap ditunda -
         dia menyusun judul dan itu memang lebih berat. */
      gambarHasilDepan();
    });

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
      /* Tidak ada lagi tempat lain untuk dituju: hasilnya sudah ada di bawah
         kotak ini dan sudah menyaring tiap huruf. Yang dibutuhkan cuma papan
         ketiknya minggir supaya hasilnya kelihatan utuh. */
      $('#kotak').blur();
    });

    $('#b-drop').addEventListener('click', drop);
    $('#b-label').addEventListener('click', function () { alihPanelLabel(); });
    $('#label-cari').addEventListener('input', gambarDaftarLabel);
    $('#label-daftar').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-label]');
      if (b) pilihLabelDepan(b.getAttribute('data-label'));
    });
    $('#b-tutup-hasil').addEventListener('click', tutupHasilDepan);



    /* Tugas dipinjami alat yang sudah ada di sini, bukan menyalinnya sendiri:
       satu tempat saja yang tahu cara menggambar pesan dan menyegarkan
       salinan lokal. */
    TTugas.pasang({
      $: $, H: H, pesan: pesan,
      entri: function () { return semuaEntri; },
      segarkan: function (e) { segarkanCache(e); perbaruiJumlah(); perbaruiJumlahTugas(); }
    });

    $$('[data-tab]').forEach(function (n) {
      n.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-tab-ke]');
        if (b) keTab(b.getAttribute('data-tab-ke'));
      });
    });

    $('#note-cari').addEventListener('input', function () {
      /* Mengetik menembus folder, jadi jejak foldernya dilepas - kalau tidak,
         kepalanya menyebut folder yang isinya bukan yang sedang ditampilkan. */
      gambarNote();
    });
    $('#note-isi').addEventListener('click', function (ev) {
      var f = ev.target.closest('[data-note-folder]');
      if (f) { noteFolder = f.getAttribute('data-note-folder'); gambarNote(); global.scrollTo(0, 0); return; }
      klikHasil(ev);
    });
    $('#note-alamat').addEventListener('click', function (ev) {
      if (!ev.target.closest('[data-note-akar]')) return;
      noteFolder = null;
      $('#note-cari').value = '';
      gambarNote();
    });
    pasangGeser($('#note-isi'));
    $('#tugas-saring').addEventListener('click', TTugas.tanganiKlik);
    $('#tugas-daftar').addEventListener('click', TTugas.tanganiKlik);
    $('#tugas-daftar').addEventListener('change', TTugas.tanganiUbah);
    $('#tugas-daftar').addEventListener('keydown', TTugas.tanganiTekan);

    function tambahTugas() {
      var isian = $('#tugas-baru');
      var teks = isian.value.trim();
      if (!teks) return;
      TTugas.tambah(teks).then(function () {
        isian.value = '';
        $('#tugas-tebak').classList.add('sembunyi');
        TTugas.gambar();
        isian.focus();
      });
    }
    /* Ditunjukkan sambil mengetik, bukan setelah disimpan: kalau tebakannya
       meleset, dia masih bisa membetulkan kalimatnya sebelum menekan Enter. */
    $('#tugas-baru').addEventListener('input', function () {
      var baca = TTugas.bacaTenggat($('#tugas-baru').value);
      var w = $('#tugas-tebak');
      w.classList.toggle('sembunyi', !baca.tenggat);
      if (baca.tenggat) {
        w.innerHTML = 'Tenggat <b>' + H(TTugas.tulisTenggat(baca.tenggat)) + '</b>' +
                      ' · tugasnya: ' + H(baca.teks || '(kosong)');
      }
    });
    $('#b-tugas-tambah').addEventListener('click', tambahTugas);
    $('#tugas-baru').addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      tambahTugas();
    });

    $('#b-setelan').addEventListener('click', function () {
      gambarSetelan();
      keLayar('l-setelan');
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

    $('#hasil-depan').addEventListener('click', klikHasil);
    pasangGeser($('#hasil-depan'));
    pasangSisanya();
  }

  /* Satu penangan untuk DUA wadah hasil - hasil di layar depan dan daftar di
     layar Note. Menyalinnya jadi dua berarti perbaikan di satu tempat diam-diam
     tidak sampai ke tempat lain, dan itu jenis bug yang paling lama tidak
     ketahuan. */
  function klikHasil(ev) {
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
      /* Kata itu ditaruh ke kotak drop, karena kotak itulah pencariannya
         sekarang - dan hasilnya menyusut di tempat, tanpa pindah layar. */
      var kata = cipTag.getAttribute('data-tag');
      if (layarSaat === 'l-note') { $('#note-cari').value = kata; gambarNote(); return; }
      labelDepan = null;
      $('#kotak').value = kata;
      gambarHasilDepan();
      global.scrollTo(0, 0);
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
  }

  function pasangSisanya() {
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
    $('#b-gembok').addEventListener('click', alihGembok);

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
      /* Minta status penyimpanan permanen sekali di awal: tanpa itu browser
         boleh membuang seluruh timbunan saat penyimpanan HP sesak, diam-diam. */
      mintaPermanen();
      perbaruiJumlahTugas();

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
    keCatat: keCatat, drop: drop,
    gambarMulai: gambarMulai, gambarSetelan: gambarSetelan,
    uraiTagFavorit: uraiTagFavorit, kartuHtmlUji: kartuHtml,
    pilihLabelUji: pilihLabelDepan,
    daftarLabelUji: daftarLabel,
    /* Cuma untuk uji: memindah layar tanpa lewat tombol, dan memuat ulang
       salinan lokal tanpa menyegarkan halaman - menyegarkan halaman membuang
       setelan yang cuma hidup di memori. */
    keLayarUji: keLayar,
    tutupHasilDepanUji: tutupHasilDepan,
    alamatNoteUji: alamatNote,
    muatUlangUji: muatSemua,
    semuaEntri: function () { return semuaEntri; }
  };
})(window);
