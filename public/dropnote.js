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
      kategori: '', label: [],
      berkasId: null, namaBerkas: '', tipeBerkas: '', ukuran: 0,
      dibuat: t, diubah: t, dipakai: 0,
      diLabeliAI: false, pensiun: false, riwayat: []
    };
  }

  /* ===================== keadaan ===================== */

  var semuaEntri = [];        /* salinan lokal; pencarian jalan di atas ini */
  var setelanSaat = {};
  var draf = null;            /* lampiran yang sudah siap tapi belum di-drop */
  var entriCatat = null;
  var saringJenis = 'semua';
  var saringKat = '';
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
    ['l-utama', 'l-hasil', 'l-catat', 'l-setelan'].forEach(function (x) {
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
      hitung[e.kategori] = (hitung[e.kategori] || 0) + 1;
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

  function perbaruiUsulKategori() {
    var wadah = $('#kat-usul');
    var sering = daftarKategori().slice(0, 3).map(function (r) { return r.kategori; });

    var contoh = { isi: $('#kotak').value, judul: '', namaBerkas: draf ? draf.namaBerkas : '' };
    var usul = TOtak.usulKategori(contoh, daftarKategori());
    if (usul && sering.indexOf(usul) < 0) sering.unshift(usul);

    wadah.innerHTML = sering.map(function (k) {
      return '<button class="cip" data-kat="' + H(k) + '">#' + H(k) + '</button>';
    }).join('');
  }

  /* Koreksi kategori sengaja DITAMPILKAN, tidak diam-diam. Tebakan yang tidak
     terlihat itu yang bikin sebuah alat terasa tidak bisa ditebak - dan alat
     yang tidak bisa ditebak akan ditinggalkan. */
  function benahiKotakKategori() {
    var kotak = $('#kat');
    var tanda = $('#kat-koreksi');
    var hasil = TOtak.benahiKategori(kotak.value, daftarKategori().map(function (r) { return r.kategori; }));

    if (hasil.dibetulkan) {
      kotak.value = hasil.kategori;
      tanda.innerHTML = '<s>' + H(hasil.asli) + '</s> → <b>' + H(hasil.kategori) + '</b>';
      tanda.classList.remove('sembunyi');
    } else {
      kotak.value = hasil.kategori;
      tanda.classList.add('sembunyi');
    }
    $('#b-kat-hapus').classList.toggle('sembunyi', !kotak.value);
    return hasil.kategori;
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
    }
    e.judul = TOtak.judulOtomatis(e);
    e.label = TOtak.labelOtomatis(e);

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

  function pasangBerkas(berkas, jenis) {
    var siap = jenis === 'gambar' ? kecilkanGambar(berkas) : Promise.resolve(berkas);
    return siap.then(function (blob) {
      var bid = idBaru('b');
      var nama = berkas.name || (jenis === 'suara' ? 'rekaman.webm' : 'berkas');
      return TSimpan.taruhBerkas(bid, blob, nama, blob.type || berkas.type).then(function () {
        draf = {
          jenis: jenis, berkasId: bid, namaBerkas: nama,
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

  function gambarSaringJenis() {
    $('#saring-jenis').innerHTML = JENIS_SARING.map(function (j) {
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

  function kartuHtml(e) {
    var b = [];
    if ((e.dipakai || 0) >= SERING) {
      b.push('<div class="kartu-cap"><svg viewBox="0 0 24 24" class="ik kilau">' +
             '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>' +
             '<span>sering dipakai</span></div>');
    }
    b.push('<div class="kartu-judul">' + H(e.judul || '(tanpa judul)') + '</div>');

    var cup = cuplikan(e);
    if (cup) b.push('<div class="kartu-cuplik">' + H(cup) + '</div>');

    if (e.jenis === 'tautan' && e.isi) {
      b.push('<a class="kartu-tautan" href="' + H(e.isi) + '" target="_blank" rel="noopener">' +
             H(e.isi) + '</a>');
    }
    if (e.jenis === 'gambar' && e.berkasId) {
      b.push('<img class="kartu-gambar" data-berkas="' + H(e.berkasId) + '" alt="">');
    }
    if (e.jenis === 'daftar' && (e.daftar || []).length) {
      b.push('<div class="kartu-daftar">' + e.daftar.slice(0, 3).map(function (r) {
        return '<div><span>' + (r.selesai ? '☑' : '☐') + '</span><span>' + H(r.teks) + '</span></div>';
      }).join('') + (e.daftar.length > 3 ? '<div><span></span><span>+' +
        (e.daftar.length - 3) + ' lagi</span></div>' : '') + '</div>');
    }
    if ((e.jenis === 'berkas' || e.jenis === 'suara') && e.namaBerkas) {
      b.push('<div class="kartu-cuplik">' + H(e.namaBerkas) + ' · ' + H(ukuranTeks(e.ukuran)) + '</div>');
    }

    var meta = [];
    if (e.kategori) meta.push('<span class="tanda-kat">#' + H(e.kategori) + '</span>');
    meta.push('<span class="tanda-waktu">' + H(TOtak.waktuPendek(e.diubah)) + '</span>');

    b.push('<div class="kartu-kaki"><div class="kartu-meta">' + meta.join('') + '</div>' +
      '<div class="kartu-aksi"><button class="aksi" data-salin aria-label="Salin">' +
      '<svg viewBox="0 0 24 24" class="ik"><rect x="9" y="9" width="12" height="12" rx="2"/>' +
      '<path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button></div></div>');

    return '<article class="kartu' + ((e.dipakai || 0) >= SERING ? ' sering' : '') +
           '" data-id="' + H(e.id) + '">' + b.join('') + '</article>';
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
    wadah.innerHTML = hasil.slice(0, 200).map(kartuHtml).join('');
    pasangGambarKartu(wadah);
  }

  function keHasil(kueri) {
    $('#cari-input').value = kueri || '';
    gambarSaringJenis();
    gambarSaringKategori();
    keLayar('l-hasil');
    jalankanCari();
    if (!kueri) $('#cari-input').focus();
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
    if (!e.berkasId) return;

    TSimpan.ambilBerkas(e.berkasId).then(function (r) {
      if (!r || !r.blob) return;
      var url = URL.createObjectURL(r.blob);
      urlSementara.push(url);
      var tubuh = '<div class="terpasang-tubuh"><div class="terpasang-nama">' +
        H(e.namaBerkas || 'Berkas') + '</div><div class="terpasang-ukuran">' +
        H(ukuranTeks(e.ukuran)) + '</div>' +
        (e.jenis === 'suara' ? '<audio controls src="' + url + '"></audio>' :
          '<a class="terpasang-unduh" href="' + url + '" download="' + H(e.namaBerkas || 'berkas') +
          '" target="_blank" rel="noopener">Buka berkas</a>') + '</div>';
      wadah.innerHTML = '<div class="terpasang">' +
        (e.jenis === 'gambar' ? '<img src="' + url + '" alt="">' : '') + tubuh + '</div>';
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

    tanda('menyimpan…');
    return TSimpan.taruh(e).then(function () {
      segarkanCache(e);
      tanda('tersimpan');
    }).catch(function (err) {
      tanda('gagal menyimpan');
      pesan('Gagal menyimpan: ' + err.message);
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

    $('#setelan-isi').innerHTML = [
      /* Cadangan ditaruh paling atas dengan sengaja. Ini satu-satunya bagian
         yang menjawab "kalau HP-nya hilang, hilang juga semuanya?" - dan itu
         pertanyaan yang lebih menentukan daripada kerapian label. */
      '<div class="set-bagian">Apps Script</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Satu alamat untuk dua-duanya</div>',
      '<div class="set-ket">Alamat <b>/exec</b> hasil deploy Apps Script-mu. Dipakai bersama oleh cadangan harian dan pelabelan AI. Sandinya wajib: alamat /exec yang di-deploy “Anyone” itu pintu terbuka, dan di baliknya ada catatanmu.</div>',
      '<input class="set-input" id="set-alamat" placeholder="https://script.google.com/macros/s/…/exec" value="' + H(s.alamatScript || '') + '">',
      '<input class="set-input" id="set-sandi" type="password" placeholder="Sandi (samakan dengan Script Property)" value="' + H(s.sandiScript || '') + '">',
      '<button class="set-tbl" id="b-uji-script">Uji sambungan</button>',
      '<div class="set-ket" id="uji-script-hasil"></div>',
      '</div>',

      '<div class="set-bagian">Cadangan harian</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Brankas di Google Sheets</div>',
      '<div class="set-ket">Berjalan saat aplikasi dibuka, di belakang layar, dan boleh gagal diam-diam. <b>Tidak pernah</b> di jalur drop. Yang naik cuma teksnya — isi gambar dan rekaman tetap hanya di HP ini.</div>',
      '<div class="set-pilih" id="set-cadangan">',
      '<button class="cip' + (s.cadanganNyala ? '' : ' nyala') + '" data-cadangan="mati">Mati</button>',
      '<button class="cip' + (s.cadanganNyala ? ' nyala' : '') + '" data-cadangan="nyala">Nyala</button>',
      '</div>',
      '<div class="set-ket" id="cadangan-status">…</div>',
      s.cadanganNyala ? '<button class="set-tbl" id="b-cadang-sekarang">Kirim sekarang</button>' : '',
      s.cadanganNyala ? '<button class="set-tbl" id="b-pulihkan">Pulihkan dari Sheet</button>' : '',
      '</div>',

      '<div class="set-bagian">Penyimpanan di perangkat</div>',
      '<div class="set-kotak" id="kotak-simpanan">',
      '<div class="set-judul">Timbunanmu ada di sini</div>',
      '<div class="set-ket" id="simpanan-ket">…</div>',
      '</div>',

      '<div class="set-bagian">Pelabelan otomatis</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Menambal konteks yang tidak sempat ditulis</div>',
      '<div class="set-ket">Catatan lahir dalam tiga detik, jadi konteksnya tidak ikut tertulis. ' +
        'Kartu <b>“Link dev photo studio”</b> nanti dicari dengan kata <b>“apps A”</b>. ' +
        'AI di sini cuma menambal selisih itu — sekali per catatan, di belakang layar. ' +
        'Aplikasinya jalan penuh tanpa ini.</div>',
      '<div class="set-pilih" id="set-mode">',
      ['mati', 'proxy', 'langsung'].map(function (m) {
        return '<button class="cip' + (mode === m ? ' nyala' : '') + '" data-mode="' + m + '">' +
          (m === 'mati' ? 'Mati' : (m === 'proxy' ? 'Proxy' : 'Langsung')) + '</button>';
      }).join(''),
      '</div>',
      mode === 'proxy' ? '<div class="set-ket">Memakai alamat Apps Script di atas.</div>' : '',
      mode === 'langsung' ? '<input class="set-input" id="set-kunci" type="password" placeholder="Kunci Gemini" value="' + H(s.kunciGemini || '') + '">' : '',
      mode !== 'mati' ? '<input class="set-input" id="set-model" placeholder="' + H(TPelabel.MODEL_BAWAAN) + '" value="' + H(s.model || '') + '">' : '',
      mode !== 'mati' ? '<button class="set-tbl" id="b-uji">Uji pelabelan</button><div class="set-ket" id="uji-hasil"></div>' : '',
      '</div>',

      /* Pertanyaannya pernah ditanyakan langsung, jadi dijawab jujur di sini
         juga - bukan disamarkan jadi UI yang seolah-olah aman. */
      mode === 'langsung' ? '<div class="set-kotak awas"><div class="set-judul">Kunci di HP tidak bisa disembunyikan</div>' +
        '<div class="set-ket">Di aplikasi yang seluruhnya jalan di browser, <b>kunci API tidak bisa benar-benar disembunyikan</b>. ' +
        'Siapa pun yang memegang HP ini bisa membacanya. Mode <b>Proxy</b> yang benar-benar menyembunyikan: ' +
        'kuncinya tinggal di Apps Script, aplikasi ini cuma tahu alamat proxy-nya. ' +
        'Kalau tetap memakai mode langsung, batasi kuncinya di Google Cloud Console sebagai lapis kedua.</div></div>' : '',

      '<div class="set-bagian">Cadangan manual</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Salinan teks ke berkas</div>',
      '<div class="set-ket">Isi berkas (gambar, rekaman) sengaja tidak ikut — satu cadangan bisa ratusan megabita dan gagal di tengah jalan. Yang diekspor teksnya, bagian yang tidak tergantikan.</div>',
      '<button class="set-tbl" id="b-ekspor">Ekspor</button>',
      '<button class="set-tbl" id="b-impor">Impor</button>',
      '</div>',

      '<div class="set-bagian">Bahaya</div>',
      '<div class="set-kotak awas">',
      '<div class="set-judul">Kosongkan semua data</div>',
      '<div class="set-ket">Semua entri dan berkas di perangkat ini hilang, tanpa urung. Ketik <b>HAPUS</b> untuk membuka tombolnya.</div>',
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
        kotak.textContent = s.cadanganNyala ? 'Isi dulu alamat Apps Script di atas.' : 'Mati — catatanmu cuma ada di HP ini.';
      } else {
        TSinkron.belumTerkirim(s).then(function (n) {
          kotak.innerHTML = 'Terakhir berhasil: <b>' + H(waktuPanjang(s.cadanganBerhasil)) + '</b>' +
            ' · belum terkirim: <b>' + n + '</b>' +
            (s.cadanganGalat ? '<br>Percobaan terakhir gagal: ' + H(s.cadanganGalat) : '');
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
    var alamat = $('#set-alamat');
    if (alamat) alamat.addEventListener('change', function () { simpanSetelan('alamatScript', alamat.value.trim()); });
    var sandi = $('#set-sandi');
    if (sandi) sandi.addEventListener('change', function () { simpanSetelan('sandiScript', sandi.value.trim()); });

    var ujiScript = $('#b-uji-script');
    if (ujiScript) ujiScript.addEventListener('click', function () {
      var ket = $('#uji-script-hasil');
      ket.textContent = 'Mencoba…';
      TSinkron.coba(setelanSaat).then(function (j) {
        ket.innerHTML = 'Tersambung. Sheet berisi <b>' + H(String(j.baris == null ? 0 : j.baris)) + '</b> baris.';
      }, function (err) {
        ket.textContent = 'Gagal: ' + err.message;
      });
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
        pesan(n ? n + ' catatan naik ke Sheet' : (setelanSaat.cadanganGalat || 'Semua sudah tersalin'));
        perbaruiStatusSetelan();
      });
    });

    var pulih = $('#b-pulihkan');
    if (pulih) pulih.addEventListener('click', function () {
      pulih.textContent = 'Menarik…';
      TSinkron.pulihkan(setelanSaat).then(function (n) {
        pulih.textContent = 'Pulihkan dari Sheet';
        return muatSemua().then(function () {
          pesan(n ? n + ' catatan dipulihkan' : 'Tidak ada yang perlu dipulihkan');
        });
      }, function (err) {
        pulih.textContent = 'Pulihkan dari Sheet';
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
        a.download = 'drop-note-' + new Date().toISOString().slice(0, 10) + '.json';
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

  function putaranLabel() {
    if (!TPelabel.siap(setelanSaat) || !adaAntrean()) return;
    TPelabel.putaran(setelanSaat).then(function (n) {
      if (n) muatSemua().then(function () { if (layarSaat === 'l-hasil') jalankanCari(); });
    });
  }

  function putaranCadangan() {
    TSinkron.putaran(setelanSaat).then(function () {
      if (layarSaat === 'l-setelan') perbaruiStatusSetelan();
    });
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

    $('#b-drop').addEventListener('click', drop);
    $('#b-cari').addEventListener('click', function () { keHasil($('#kotak').value.trim()); });
    $('#b-catat').addEventListener('click', function () {
      var e = entriBaru('catatan');
      e.isi = $('#kotak').value;
      e.kategori = benahiKotakKategori();
      kosongkanKotak();
      keCatat(e);
      $('#catat-isi').focus();
    });
    $('#b-setelan').addEventListener('click', function () {
      gambarSetelan();
      keLayar('l-setelan');
    });

    $('#kat').addEventListener('blur', benahiKotakKategori);
    $('#kat').addEventListener('input', function () {
      $('#b-kat-hapus').classList.toggle('sembunyi', !$('#kat').value);
    });
    $('#b-kat-hapus').addEventListener('click', function () {
      $('#kat').value = '';
      $('#kat-koreksi').classList.add('sembunyi');
      $('#b-kat-hapus').classList.add('sembunyi');
    });
    $('#kat-usul').addEventListener('click', function (ev) {
      var cip = ev.target.closest('[data-kat]');
      if (!cip) return;
      $('#kat').value = cip.getAttribute('data-kat');
      $('#kat-koreksi').classList.add('sembunyi');
      $('#b-kat-hapus').classList.remove('sembunyi');
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
      var kartu = ev.target.closest('.kartu');
      if (!kartu) return;
      var id = kartu.getAttribute('data-id');
      if (ev.target.closest('[data-salin]')) {
        var e = null;
        semuaEntri.forEach(function (x) { if (x.id === id) e = x; });
        if (e) salin(isiSalin(e));
        return;
      }
      if (ev.target.closest('a')) return;   /* tautan dibuka, bukan kartunya */
      bukaKartu(id);
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
    $('#b-buang').addEventListener('click', pensiunkan);

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
    semuaEntri: function () { return semuaEntri; }
  };
})(window);
