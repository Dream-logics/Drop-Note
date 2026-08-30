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
      /* Penanda ruang menulis. Bukan jenis tersendiri: kalau jenisnya beda,
         dia luput dari saringan, dari kartu, dan dari pemisahan elemen - dan
         tulisan berisi nomor rekening berhenti bisa disalin sendiri. */
      tulisan: false,
      /* Folder layar Note. Kolomnya sendiri, BUKAN menumpang kategori: rak
         gudang lahir dari catatan yang jatuh dan disortir mesin, folder lahir
         karena kamu memutuskan ada tempat yang perlu diisi. Dua hal berbeda,
         dan menyatukannya membuat lima belas rak Drop muncul sebagai folder
         kosong yang tidak pernah kamu buat. */
      folder: '',
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
  var temaSaat = 'teal';   /* warna aksen - dasarnya tetap putih di semua tema */
  var temaSendiri = '';
  /* TIGA KEADAAN, bukan dua - dan bedanya yang bikin ini benar:

       ''        belum memilih apa pun -> yang tampil TEKS
       '*semua'  memilih "Semua" -> semua jenis
       'gambar'  dan seterusnya -> jenis itu saja

     Kenapa tidak langsung menyimpan 'teks' sebagai bawaan: layar depan
     terbuka kalau ada saringan yang menyala, jadi bawaan 'teks' membuat layar
     depan tidak akan pernah kosong lagi - dan layar depan yang kosong itu
     seluruh gunanya aplikasi ini.

     Kenapa teks yang duluan: hasil yang langsung berisi dinding gambar
     memenuhi layar sebelum satu judul pun sempat terbaca. Gambar dicari
     dengan sengaja, lewat cip Gambar - dan di sana dia memang yang dicari. */
  var saringJenis = '';

  var gayaGambar = 'kecil';    /* besar | sedang | kecil | daftar */
  var laciBuka = '';       /* laci mana yang sedang terbuka: label | drop | filter */
  /* Doknya SELALU di bawah. Dulu ini pilihan di Setelan, dan pilihannya
     dihapus: yang di atas terbukti kalah enak dipakai satu tangan - jempol
     harus menyeberang layar tiap kali - dan dua tata letak berarti tiap
     suntingan gaya harus diperiksa dua kali. Kelasnya dipasang langsung di
     index.html, jadi tidak ada lagi yang perlu dinyalakan dari sini. */
  var urlSementara = [];
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
  /* Kabar yang sedang BERJALAN: tidak hilang sendiri, karena yang diberitakan
     belum selesai. Dia ditutup oleh yang menyalakannya - dan kalau lupa
     ditutup, kabar yang menggantung selamanya lebih buruk daripada tidak ada
     kabar sama sekali, jadi dia tetap punya batas waktu yang panjang. */
  function pesanJalan(teks) {
    var kotak = $('#pesan');
    kotak.textContent = teks;
    kotak.style.pointerEvents = 'none';
    kotak.classList.add('jalan', 'tampil');
    clearTimeout(pesanJam);
    pesanJam = setTimeout(sembunyikanPesan, 30000);
  }

  /* Dialog konfirmasi. SATU-SATUNYA di aplikasi ini, dan cuma untuk yang tidak
     bisa diurungkan dengan satu ketukan. Jalur masuk tidak pernah memakainya:
     bertanya di sana membunuh kebiasaannya. */
  var tanyaJalan = null;

  function tanya(judul, ket, jalan) {
    tanyaJalan = jalan;
    $('#tanya-judul').textContent = judul;
    $('#tanya-ket').textContent = ket || '';
    $('#tanya-isi').classList.add('sembunyi');
    $('#tanya').classList.remove('sembunyi');
  }

  /* Bentuk kedua dari dialog yang sama: yang ini menunggu satu kata diketik.
     Satu dialog untuk dua keperluan - dialog kedua yang rupanya sama persis
     akan berbeda sendiri begitu salah satunya disunting. */
  function tanyaKetik(judul, ket, awal, jalan) {
    tanya(judul, ket, function () { jalan($('#tanya-isi').value.trim()); });
    var isian = $('#tanya-isi');
    isian.value = awal || '';
    isian.classList.remove('sembunyi');
    setTimeout(function () { isian.focus(); isian.select(); }, 30);
  }

  /* Bentuk ketiga: satu daftar yang tinggal diketuk. Mengetik nama tujuan itu
     friksi yang tidak perlu ada - namanya sudah ada di layar sebelah, dan satu
     huruf salah ketik berarti pemindahan yang gagal tanpa sebab yang
     kelihatan. Memilih tidak bisa salah ketik. */
  function tanyaPilih(judul, ket, daftar, jalan) {
    tanya(judul, ket, null);
    var w = $('#tanya-pilih');
    w.innerHTML = daftar.map(function (x) {
      return '<button class="tanya-cip" data-pilih="' + H(x) + '" data-asli>' + H(x) + '</button>';
    }).join('');
    w.classList.remove('sembunyi');
    /* Tidak ada tombol "Lanjut": ketukan pada pilihannya ITU jawabannya, dan
       tombol kedua sesudahnya cuma menagih persetujuan untuk sesuatu yang
       sudah kamu putuskan. */
    $('#b-tanya-ya').classList.add('sembunyi');
    tanyaPilihJalan = jalan;
  }

  var tanyaPilihJalan = null;

  function tutupTanya() {
    $('#tanya').classList.add('sembunyi');
    $('#tanya-isi').classList.add('sembunyi');
    $('#tanya-pilih').classList.add('sembunyi');
    $('#b-tanya-ya').classList.remove('sembunyi');
    tanyaJalan = null;
    tanyaPilihJalan = null;
  }

  function pesan(teks, aksi) {
    var kotak = $('#pesan');
    kotak.textContent = teks;
    kotak.classList.remove('jalan');
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
    ['l-mulai', 'l-utama', 'l-tulis', 'l-tugas', 'l-note', 'l-catat', 'l-setelan'].forEach(function (x) {
      $('#' + x).classList.toggle('aktif', x === id);
    });
    layarSaat = id;
    /* Penjaga terakhir: layar yang tidak punya bilah pilih tidak boleh
       menampilkannya, dari jalan mana pun dia sampai ke sana. */
    if (id !== 'l-utama' && id !== 'l-tulis' && id !== 'l-note') batalPilih();
    if (id === 'l-utama') perbaruiJumlah();
    /* Digambar ulang tiap kali layarnya tampil, bukan cuma waktu pintunya
       diketuk: jalan pulang yang paling sering dari layar tulis adalah tombol
       kembali, dan daftar yang tidak ikut segar di situ memperlihatkan judul
       lama untuk tulisan yang baru saja kamu ubah. */
    if (id === 'l-tulis') gambarTulis();
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
      /* Cip saringan lahir dari salinan lokal ini - jenis yang isinya nol
         tidak ditampilkan, dan itu berubah tiap kali timbunannya berubah.
         Kalau tidak digambar ulang di sini, cipnya menyebut keadaan kemarin. */
      gambarCipSaring();
      return semuaEntri;
    });
  }

  function segarkanCache(e) {
    for (var i = 0; i < semuaEntri.length; i++) {
      if (semuaEntri[i].id === e.id) { semuaEntri[i] = e; return; }
    }
    semuaEntri.unshift(e);
  }

  /* Dulu di sini ada penghitung tugas tertunda untuk lencana di pintu To Do.
     Lencananya dibuang, jadi penghitungnya ikut - fungsi yang tidak dipakai
     siapa pun akan dipanggil lagi suatu hari oleh orang yang mengira dia masih
     berarti sesuatu. Yang tinggal cuma pemicu gambar ulang pintunya. */
  function perbaruiJumlahTugas() { gambarTab(); }

  /* TIGA PINTU, SATU BARIS, DI KEPALA - dan sama persis di ketiga layarnya.
     Digambar dari sini, bukan disalin tiga kali di HTML: baris yang disalin
     akan berbeda-beda begitu salah satunya disunting, dan bedanya baru
     ketahuan setelah dipakai berminggu-minggu.

     Namanya dipendekkan (Drop, To Do, Note) karena tiga kata panjang tidak
     muat sebaris di layar HP, dan yang tidak muat akan dipotong sendiri oleh
     browser di tempat yang tidak kamu pilih. */
  var TAB = [
    /* Pena, BUKAN panah ke bawah. Panahnya milik tombol Drop di bawah kotak -
       dua ikon yang sama persis di satu layar bikin orang mengira dua-duanya
       tombol yang sama. Yang di kepala itu TEMPAT (di sini kamu menulis), yang
       di bawah itu TINDAKAN (jatuhkan sekarang). */
    ['l-utama', 'Drop', '<path d="M4 20h16"/><path d="M14.5 4.5l5 5L8 21H3v-5z"/>'],
    /* Lembar bergaris, BUKAN pena - penanya milik Drop di sebelahnya. Yang
       dibedakan di sini bukan "menulis" lawan "tidak menulis" (dua-duanya
       menulis), melainkan POTONGAN lawan LEMBARAN: Drop menampung tiga detik
       yang berdiri sendiri, Note menampung sesuatu yang punya halaman dan
       didatangi lagi besok. */
    ['l-tulis', 'Note', '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>'],
    ['l-tugas', 'To Do', '<rect x="3" y="4" width="7" height="7" rx="1.5"/><path d="M5 7.5l1.5 1.5L9 6"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/><path d="M4 15h5"/><path d="M4 19h5"/>'],
    /* "Storage", bukan "Note". Layar ini memang gudang: dia memperlihatkan
       SEMUA yang pernah jatuh, tersusun di raknya masing-masing. Menulis punya
       tempatnya sendiri, dan menamai keduanya sama membuat yang mau menulis
       mendarat di gudang - lalu mengira aplikasinya tidak bisa menulis. */
    ['l-note', 'Storage', '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/>']
  ];

  /* LENCANA ANGKA DI PINTU TO DO DIBUANG, dan jangan dikembalikan. Dia
     memberitahu ada 15 tugas belum selesai - dan itu bukan kabar, itu tagihan
     yang menempel di layar sepanjang hari. Angka yang tidak pernah bisa jadi
     nol berhenti menggerakkan apa pun dan mulai membebani; yang benar-benar
     perlu dilihat sudah punya penandanya sendiri, dan cuma pada barisnya:
     titik "belum dibaca" dan tanggal yang lewat. */
  function gambarTab() {
    var isi = TAB.map(function (t) {
      return '<button class="tab' + (layarSaat === t[0] ? ' nyala' : '') +
             '" data-tab-ke="' + t[0] + '">' +
             '<svg viewBox="0 0 24 24" class="ik">' + t[2] + '</svg>' +
             H(t[1]) + '</button>';
    }).join('');
    $$('[data-tab]').forEach(function (n) { n.innerHTML = isi; });
  }

  /* ===================== GESER ANTAR PINTU =====================
     Empat pintu berjajar, dan memindahkannya cuma butuh satu ketukan - tapi
     ketukan itu di KEPALA layar, ujung terjauh dari jempol yang bertumpu di
     sudut kanan bawah. Menggeser layarnya sendiri membuat perpindahan bisa
     dilakukan dari mana pun jarimu kebetulan berada.

     Yang dijaga: geser TIDAK boleh merebut gerakan yang sudah punya arti.
     Menggulir daftar itu tegak, jadi yang mendatar saja yang dibaca; kartu
     yang digeser ke kiri untuk diarsipkan punya penangannya sendiri, jadi
     gerakan yang dimulai di atas kartu diabaikan di sini. */
  var GESER_PINTU = 70;      /* sependek ini masih bisa dilakukan satu jempol */
  var GESER_MIRING = 1.6;    /* mendatar harus jelas lebih panjang dari tegak */

  function pintuSebelah(arah) {
    var i = -1;
    TAB.forEach(function (t, n) { if (t[0] === layarSaat) i = n; });
    if (i < 0) return '';
    var j = i + arah;
    return (j >= 0 && j < TAB.length) ? TAB[j][0] : '';
  }

  /* Yang PUNYA arti lain untuk geser mendatar, dan cuma itu: kartu (geser ke
     kiri = arsip), kotak teks, dok dan lacinya, bilah cip yang memang
     menggulir mendatar sendiri, dan lapisan yang menutup layar.

     Baris tugas TIDAK termasuk lagi. Dia dulu dikecualikan tanpa alasan yang
     benar-benar ada - tidak ada gerakan mendatar yang berarti apa pun di atas
     baris tugas - dan akibatnya layar To Do jadi layar yang paling sulit
     ditinggalkan dengan geseran: hampir seluruh isinya baris tugas. */
  var GESER_LEWAT = '.kartu, input, textarea, .dok, .laci, ' +
                    '.saring-baris, .ruang-baris, .lampiran, .cip-gulir, ' +
                    '#petak-ai, .pilih-bilah, #tanya, #lihat, .tanya-pilih';

  function pasangGeserPintu() {
    var x0 = 0, y0 = 0, hidup = false;

    var mulai = function (x, y, sasaran) {
      hidup = false;
      /* SELAMA MEMILIH, PINTUNYA TIDAK BISA DIGESER. Bukan karena pilihannya
         berharga - tapi karena geser itu gerakan yang gampang terjadi tanpa
         diniatkan, dan tersesat ke layar lain di tengah pekerjaan membuat
         pekerjaannya bercabang. Pintunya masih bisa diketuk; yang diketuk
         memang diniatkan. */
      if (pilihNyala || jumlahPilih() || jumlahFolderPilih()) return;
      if (!pintuSebelah(1) && !pintuSebelah(-1)) return;
      if (sasaran && sasaran.closest && sasaran.closest(GESER_LEWAT)) return;
      x0 = x; y0 = y; hidup = true;
    };

    var selesai = function (x, y) {
      if (!hidup) return;
      hidup = false;
      var dx = x - x0, dy = y - y0;
      if (Math.abs(dx) < GESER_PINTU) return;
      if (Math.abs(dx) < Math.abs(dy) * GESER_MIRING) return;
      /* Geser ke KIRI membawa pintu di kanan mendekat - arah yang sama dengan
         membalik halaman, dan sama dengan yang dilakukan tiap aplikasi
         bertab. */
      var tujuan = pintuSebelah(dx < 0 ? 1 : -1);
      if (tujuan) keTab(tujuan);
    };

    /* SENTUHAN DULU, BARU PENUNJUK. Di Android, begitu browser memutuskan
       gerakanmu itu gulir, dia MEMBATALKAN aliran pointer - 'pointerup' tidak
       pernah datang, dan geserannya hilang tanpa jejak. 'touchend' selalu
       datang. Itu sebabnya geser antar pintu terasa mati di HP padahal jalan
       sempurna di tetikus. */
    document.addEventListener('touchstart', function (ev) {
      if (ev.touches.length !== 1) { hidup = false; return; }
      mulai(ev.touches[0].clientX, ev.touches[0].clientY, ev.target);
    }, { passive: true, capture: true });
    document.addEventListener('touchend', function (ev) {
      var s = ev.changedTouches && ev.changedTouches[0];
      if (s) selesai(s.clientX, s.clientY);
    }, { passive: true, capture: true });

    /* Tetikus tidak punya touchend, jadi jalur penunjuk tetap ada - dan dia
       yang dipakai uji terima. Sentuhan ikut memicu pointer di sebagian
       browser; 'hidup' yang sudah dimatikan touchend menjaga supaya satu
       geseran tidak dihitung dua kali. */
    document.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'touch') return;
      mulai(ev.clientX, ev.clientY, ev.target);
    }, true);
    document.addEventListener('pointerup', function (ev) {
      if (ev.pointerType === 'touch') return;
      selesai(ev.clientX, ev.clientY);
    }, true);
  }

  /* ===================== TINGGI LAYAR SAAT PAPAN KETIK NAIK =====================
     Papan ketik HP tidak mengubah tinggi halaman - dia cuma menutupi
     bagiannya. Jadi layar setinggi 100dvh tetap 100dvh, doknya tetap di dasar
     halaman DI BALIK papan ketik, dan browser menggulir halaman supaya kotak
     yang kamu ketik terlihat. Akibatnya hasil pencarian yang duduk di atas
     kotak tergulir keluar layar: kamu mengetik, dan yang terlihat cuma
     kekosongan sampai papan ketiknya ditutup.

     visualViewport tahu tinggi yang BENAR-BENAR terlihat. Dipakai sebagai
     tinggi layar, doknya duduk tepat di atas papan ketik dan hasilnya mengisi
     sisa ruang di atasnya - tanpa satu pun gulir yang perlu kamu lakukan. */
  function pasangTinggiTampak() {
    var vv = global.visualViewport;
    if (!vv) return;
    var pasang = function () {
      document.documentElement.style.setProperty('--tampak', Math.round(vv.height) + 'px');
      /* Halamannya dikembalikan ke puncak: sesudah tingginya menyusut, sisa
         gulir dari papan ketik yang baru naik tidak ada gunanya lagi, dan
         yang tertinggal justru hasil pertama yang setengah terpotong. */
      if (layarSaat === 'l-utama') global.scrollTo(0, 0);
    };
    /* CUMA 'resize', BUKAN 'scroll'. Yang menandai papan ketik naik atau turun
       itu perubahan TINGGI; 'scroll' juga menyala waktu kamu menggulir hasil
       sendiri, dan menggulirkannya balik ke puncak di situ berarti daftarnya
       menolak digulir. */
    vv.addEventListener('resize', pasang);
    pasang();
  }

  function keTab(id) {
    /* Pintu ITU pintu, titik. Dulu menekan pintu Drop yang sedang terbuka
       membuka laci cara-cara memasukkan, dan itu keliru dua kali: satu tombol
       yang berarti dua hal tergantung kamu sedang di mana, dan laci yang
       terbuka tanpa diminta waktu kamu cuma mau kembali ke layar Drop.
       Lacinya sudah punya pintunya sendiri - klip kertas di bilah bawah. */
    if (id === layarSaat) return;
    /* PINDAH PINTU MENYELESAIKAN PILIHANNYA DULU. Bilah pilih melayang di
       tingkat halaman, jadi tanpa ini dia ikut ke layar berikutnya - membawa
       enam folder yang tidak ada di sana, dan tombol Buang yang tidak lagi
       tahu apa yang dibuangnya. Dibatalkan, bukan dikunci: pintu yang menolak
       dibuka lebih menakutkan daripada pilihan yang hilang. */
    batalPilih();
    tutupLaci();
    if (id === 'l-tugas') TTugas.buka();
    if (id === 'l-tulis') gambarTulis();
    keLayar(id);
  }

  /* Tugas menumpang di toko yang sama, tapi dia bukan bagian dari timbunan
     catatan: dia tidak dihitung, tidak menyumbang rak, dan tidak pernah muncul
     di layar hasil. Satu-satunya tempatnya adalah layar to-do. */
  function catatanSaja(e) { return !e.pensiun && e.jenis !== 'tugas'; }

  /* ANGKA "N TERSIMPAN" DIBUANG DARI KEPALA, dan jangan dikembalikan. Dia
     tidak pernah mengubah satu keputusan pun - tahu ada 38 atau 380 tidak
     membuat apa pun jadi lebih mudah dikerjakan - dan tempatnya di kepala
     justru yang dibutuhkan Reset. Angka yang benar-benar menolong sudah ada
     di cip saringan: bukan "punyaku berapa", tapi "kata ini menemukan
     berapa". Fungsinya sendiri ditinggal supaya pemanggilnya tidak perlu
     tahu, dan supaya cip saringan ikut segar tiap kali timbunannya berubah. */
  function perbaruiJumlah() {
    gambarCipSaring();
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

  /* Kotak tempel link. Yang dipakai isinya, bukan kotak drop - jadi kamu bisa
     menempel sepuluh baris tanpa tiap barisnya memicu pencarian. */
  function ambilLink() {
    var k = $('#link-tempel');
    if (!k || $('#petak-link').classList.contains('sembunyi')) return [];
    return TOtak.semuaUrl(k.value);
  }

  function setelLinkNyala(nyala, diam) {
    if (nyala) setelDaftarNyala(false);
    $('#petak-link').classList.toggle('sembunyi', !nyala);
    $$('.lamp').forEach(function (b) {
      if (b.getAttribute('data-lamp') === 'link') b.classList.toggle('nyala', nyala);
    });
    if (!diam) setelSunyi(sedangMengisi());
    if (nyala) { tutupLaci(); $('#link-tempel').focus(); perbaruiLinkKet(); }
  }

  function perbaruiLinkKet() {
    var n = ambilLink().length;
    $('#link-ket').textContent = n
      ? n + (n > 1 ? ' link terbaca — tiap satunya bisa disalin sendiri' : ' link terbaca')
      : 'Belum ada alamat yang terbaca.';
  }

  /* MODE MENGISI: pencarian DIAM.

     Mengisi daftar itu satu pekerjaan yang berlangsung setengah menit, dan
     tiap huruf yang kamu ketik di sana tidak ada hubungannya dengan mencari.
     Tapi dulu kotak drop tetap hidup di bawahnya: hasil naik-turun, cip
     berkedip, layar berdenyut - lingkungan yang berisik untuk pekerjaan yang
     justru butuh tenang.

     Jadi selama kotak isian terbuka, hasil ditutup dan cip gudang disembunyikan.
     Bukan dinonaktifkan - cuma didiamkan; begitu kotaknya ditutup, semuanya
     kembali seperti semula tanpa kamu memulihkan apa pun. */
  function sedangMengisi() {
    return !$('#petak-daftar').classList.contains('sembunyi') ||
           !$('#petak-link').classList.contains('sembunyi');
  }

  function setelSunyi(sunyi) {
    $('#l-utama').classList.toggle('mode-isi', sunyi);
    if (sunyi) {
      tutupHasilDepan();
      $('#ruang-baris').classList.add('sembunyi');
    } else {
      gambarBayang();
      gambarHasilDepan();
    }
  }

  function setelDaftarNyala(nyala) {
    if (nyala) setelLinkNyala(false, true);
    $('#petak-daftar').classList.toggle('sembunyi', !nyala);
    $$('.lamp').forEach(function (b) {
      if (b.getAttribute('data-lamp') === 'daftar') b.classList.toggle('nyala', nyala);
    });
    if (nyala && !$$('#daftar-baris .baris-daftar').length) barisDaftarBaru('', false);
    setelSunyi(sedangMengisi());
    if (nyala) {
      tutupLaci();
      var isian = $$('#daftar-baris input[type=text]');
      if (isian.length) isian[isian.length - 1].focus();
    }
  }

  /* TINGGINYA MENGIKUTI ISINYA. Bawaannya satu baris - dan itu bentuk yang
     benar, karena hampir tiap kali kotak ini disentuh yang diketik cuma satu
     dua kata untuk mencari. Kotak tiga baris yang menganga sepanjang hari
     memakan tempat yang seharusnya jadi hasil, dan tidak menjanjikan apa pun
     yang tidak bisa dijanjikan satu baris.

     Yang panjang tetap dilayani: dia mengembang sampai batas, lalu menggulir
     di dalam dirinya sendiri. Batasnya ada supaya catatan sepuluh baris tidak
     mendorong tombol Drop keluar layar tepat saat mau ditekan. */
  var TINGGI_KOTAK_MAKS = 140;

  /* ===================== TEKS BAYANGAN & GUDANG =====================
     Melengkapi nama gudang sambil diketik, di dalam kotaknya. Yang dilengkapi
     cuma nama gudang yang SUDAH ada, dan cuma di dua kata pertama - sesudah
     itu kamu menulis isi, bukan alamat.

     Bayangannya disembunyikan begitu kursormu tidak di ujung teks: melengkapi
     sesuatu di tengah kalimat bukan bantuan, itu tebakan yang salah tempat.
     Papan ketik HP juga menyusun kata di tengah pengetikan (composition), dan
     selama itu berlangsung apa pun yang digambar di belakang pasti meleset. */
  var ruangSaat = null;      /* gudang yang akan menampung drop berikutnya */
  var lengkapSaat = null;    /* kelengkapan yang sedang ditawarkan */
  var sedangMenyusun = false;

  function daftarRuang() {
    return TOtak.pohonLabel(daftarLabel());
  }

  function gambarBayang() {
    var kotak = $('#kotak');
    var bayang = $('#kotak-bayang');
    if (!kotak || !bayang) return;
    /* Di mode AI kotaknya bukan alamat gudang, jadi tidak ada yang pantas
       dilengkapi - ekor abu-abu di belakang pertanyaan cuma salah tebak yang
       kelihatan. */
    if (modeAI) {
      bayang.innerHTML = '';
      lengkapSaat = null;
      if ($('#b-terima')) $('#b-terima').classList.add('sembunyi');
      return;
    }
    var teks = kotak.value;

    lengkapSaat = null;
    var diUjung = kotak.selectionStart === teks.length && kotak.selectionEnd === teks.length;
    if (!sedangMenyusun && diUjung) lengkapSaat = TOtak.lengkapiRuang(teks, daftarLabel());

    /* Penanda di ujung ekor: dari situlah letak panah penerima dihitung.
       Isinya spasi nol-lebar, supaya dia punya tinggi baris - tanda kosong
       melompong tidak punya ukuran yang bisa diukur. */
    bayang.innerHTML = H(teks) + (lengkapSaat
      ? '<span class="bayang-ekor">' + H(lengkapSaat.ekor) + '</span>' +
        '<span id="bayang-ujung">​</span>'
      : '');
    taruhTerima();

    /* Gudangnya dibaca dari teks yang SUDAH diketik, bukan dari yang sedang
       ditawarkan - kalau tawarannya ikut dihitung, cipnya menyala untuk gudang
       yang belum tentu kamu pilih. */
    ruangSaat = TOtak.bacaRuang(teks, daftarLabel());
    gambarCipRuang();
    /* Cip saringan TIDAK digambar di sini. Angkanya lahir dari pencarian yang
       berjalan sesudah ini, jadi menggambarnya lebih dulu berarti angkanya
       selalu tertinggal satu ketukan huruf. Yang menggambarnya
       gambarHasilDepan, di ujung, sesudah angkanya ada. */
  }

  /* Menaruh panah penerima tepat di ujung ekornya, diukur - bukan ditebak dari
     jumlah huruf. Lebar huruf tidak tetap, jadi menghitungnya dari panjang
     teks meleset makin jauh tiap kata. */
  function taruhTerima() {
    var b = $('#b-terima');
    if (!b) return;
    var ujung = $('#bayang-ujung');
    var bungkus = $('.kotak-bungkus');
    if (!lengkapSaat || !ujung || !bungkus) { b.classList.add('sembunyi'); return; }

    var w = bungkus.getBoundingClientRect();
    var u = ujung.getBoundingClientRect();
    var x = u.left - w.left + 6;
    var y = u.top - w.top + (u.height / 2) - 22;

    /* Ditarik masuk kalau ekornya sudah mepet pinggir: panah yang setengah
       badannya di luar kotak bukan cuma jelek, separuh sasaran sentuhnya
       hilang. */
    var maks = w.width - 30;
    if (x > maks) x = maks;
    if (x < 0) x = 0;

    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.classList.remove('sembunyi');
  }

  function terimaLengkap() {
    if (!lengkapSaat) return;
    var kotak = $('#kotak');
    kotak.value = lengkapSaat.nama + ' ';
    kotak.focus();
    kotak.setSelectionRange(kotak.value.length, kotak.value.length);
    setelTinggiKotak();
    gambarBayang();
    gambarHasilDepan();
  }

  var SERING_HARI = 30;
  var SERING_MAKS = 7;

  /* Gudang yang paling sering menampung sebulan terakhir.

     Dihitung dari catatan yang benar-benar jatuh, bukan dari daftar label:
     yang ada di daftar itu semua gudang yang pernah kamu buat, sementara yang
     berguna cuma yang sedang kamu pakai. Dan sengaja tidak ada cadangan kalau
     riwayatnya kosong - pemasangan baru berarti belum ada yang sering, dan
     menampilkan tujuh nama asal-asalan cuma mengajari orang mengabaikan baris
     ini sejak hari pertama. */
  function ruangSering() {
    var batas = Date.now() - SERING_HARI * 86400000;
    var punya = {};
    daftarLabel().forEach(function (l) { punya[TOtak.normal(l.nama)] = l.nama; });

    var hitung = {};
    semuaEntri.forEach(function (e) {
      if (e.pensiun || e.dihapus || e.jenis === 'tugas') return;
      if ((e.diubah || e.dibuat || 0) < batas) return;
      var nama = punya[TOtak.normal(e.kategori || '')];
      if (!nama) return;
      hitung[nama] = (hitung[nama] || 0) + 1;
    });

    return Object.keys(hitung)
      .sort(function (a, b) { return hitung[b] - hitung[a] || a.localeCompare(b); })
      .slice(0, SERING_MAKS);
  }

  /* Cip gudang: KABAR, bukan gerbang. Dia memberi tahu ke mana barangnya akan
     mendarat, dan kamu tidak perlu menyentuhnya sama sekali. Turunannya ikut
     tampil supaya kamu melihat pilihan yang ada tanpa harus mengingatnya. */
  function gambarCipRuang() {
    var wadah = $('#ruang-baris');
    if (!wadah) return;
    if (modeAI) { wadah.classList.add('sembunyi'); return; }
    var pohon = daftarRuang();
    var teks = $('#kotak').value;
    var cip = [];

    /* KOTAK KOSONG: gudang yang paling sering dipakai sebulan terakhir.
       Sebulan itu kira-kira selebar satu fokus - proyek yang sedang berjalan
       ada di situ, yang sudah lewat menghilang sendiri tanpa kamu merapikan
       apa pun. Sekali ketuk, kamu sudah di dalam ruangannya tanpa mengetik
       kata pertama.

       Ini TIDAK melanggar "layar depan kosong": yang dilarang di sana dinding
       kartu - isi timbunanmu yang menagih untuk dibaca. Ini kendali, bukan
       isi, dan dia menghilang begitu kamu mulai mengetik. */
    if (!teks.trim()) {
      ruangSering().forEach(function (nama) {
        cip.push('<button class="ruang-cip sering" data-ruang="' + H(nama) + '" data-asli>' +
                 H(nama) + '</button>');
      });
      var adaSering = !!cip.length;
      wadah.classList.toggle('sembunyi', !adaSering);
      wadah.innerHTML = adaSering ? cip.join('') : '';
      return;
    }

    if (ruangSaat) {
      cip.push('<span class="ruang-cip nyala" data-asli>' + H(ruangSaat.nama) + '</span>');
      /* Turunan gudang yang sedang menyala - inilah "ketik amara, muncul
         cip anaknya". Mengetuknya menuliskannya ke kotak, bukan membuka
         layar: drop harus tetap satu gerakan. */
      pohon.filter(function (l) { return l.induk === ruangSaat.nama; })
           .slice(0, 5).forEach(function (l) {
        cip.push('<button class="ruang-cip" data-ruang="' + H(l.nama) + '" data-asli>' + H(l.ekor) + '</button>');
      });
    }

    var ada = !!cip.length && !!teks.trim();
    wadah.classList.toggle('sembunyi', !ada);
    wadah.innerHTML = ada ? cip.join('') : '';
  }

  /* EMPAT IKON WAKTU DIAM, TIGA WAKTU MENGETIK - persis WhatsApp, dan bukan
     karena meniru: yang pergi selalu yang paling tidak mungkin dipakai saat
     itu. Orang yang sudah mengetik catatan tidak sedang mau bertanya ke AI,
     jadi ikon AI yang mengalah, dan kotaknya dapat tempat justru waktu isinya
     paling panjang. Di mode AI dia tidak pernah pergi - dia satu-satunya jalan
     pulang. */
  function setelIkonKotak() {
    var ada = !!$('#kotak').value.trim();
    $('#l-utama').classList.toggle('mengetik', ada && !modeAI);
  }

  function setelTinggiKotak() {
    var k = $('#kotak');
    if (!k) return;
    setelIkonKotak();
    k.style.height = 'auto';
    k.style.height = Math.min(k.scrollHeight, TINGGI_KOTAK_MAKS) + 'px';
    var b = $('#kotak-bayang');
    if (b) b.style.height = k.style.height;
  }

  function kosongkanKotak() {
    $('#kotak').value = '';
    setelTinggiKotak();
    if ($('#kotak-bayang')) { $('#kotak-bayang').innerHTML = ''; ruangSaat = null; lengkapSaat = null; }
    if ($('#b-terima')) $('#b-terima').classList.add('sembunyi');
    /* Digambar ulang, bukan disembunyikan: kotak yang baru dikosongkan justru
       keadaan yang paling pantas menawarkan gudang tersering. */
    gambarCipRuang();
    $('#daftar-baris').innerHTML = '';
    setelDaftarNyala(false);
    draf = null;
    $$('.lamp').forEach(function (b) { b.classList.remove('nyala'); });
    $('#tebakan').classList.add('sembunyi');
  }

  /* JALUR MASUK KEDUA: yang punya ACTION.

     Gudangnya ikut terbawa - kamu sudah menuliskannya di kotak yang sama, dan
     menanyakannya lagi di layar sebelah adalah menagih jawaban yang sudah kamu
     berikan. Sama seperti drop: tidak ada jaringan di sini, dan tugas tidak
     pernah dikirim ke AI. */
  function keTugas() {
    var teks = $('#kotak').value.trim();
    /* DAFTAR IKUT UTUH, bukan cuma judulnya. Dulu yang tertangkap cuma baris
       pertama, dan sepuluh baris yang barusan diketik hilang begitu saja -
       kehilangan diam-diam, tepat sesudah kerja yang paling banyak
       mengetiknya. Sekarang seluruhnya masuk sebagai LANGKAH di satu tugas. */
    var langkah = ambilDaftar();
    if (!teks && langkah.length) teks = langkah[0].teks;
    if (!teks) return;
    var ruang = TOtak.bacaRuang(teks, daftarLabel());
    TTugas.tambahDariDrop(teks, ruang ? ruang.nama : '', langkah).then(function (e) {
      if (!e) return;
      kosongkanKotak();
      tutupHasilDepan();
      /* Tenggatnya disebut kalau memang terbaca, supaya tebakan yang tidak
         terlihat tidak pernah jadi kejutan besok pagi. */
      var n = (e.daftar || []).length;
      pesan(e.tenggat ? 'Masuk To Do · ' + TTugas.tulisTenggat(e.tenggat)
                      : 'Masuk To Do' + (n ? ' · ' + n + ' langkah' : '') +
                        (e.kategori ? ' · ' + e.kategori : ''));
    });
  }

  /* JALUR MASUK. Tidak ada satu pun panggilan jaringan di sini, dan tidak
     boleh pernah ada. Pelabelan AI menyusul belakangan lewat antrean. */
  function drop() {
    var link = ambilLink();
    var teks = $('#kotak').value.trim();
    /* Yang ditempel di kotak link ikut jadi isi - tanpa itu, kartunya lahir
       tanpa satu pun kata yang bisa dicari. */
    if (link.length) teks = (teks ? teks + '\n' : '') + $('#link-tempel').value.trim();
    var daftar = ambilDaftar();
    var jenis = link.length ? 'tautan' : bacaDraf();

    if (!teks && !daftar.length && !draf) { pesan('Kotaknya masih kosong'); return; }

    var e = entriBaru(jenis);
    /* Gudangnya dibaca dari teksnya sendiri, bukan dari isian terpisah - kata
       yang kamu ketik toh sudah menyebutkannya. Kalau tidak menyebut apa pun,
       kategorinya kosong dan AI yang menyortirnya belakangan. */
    var ruang = TOtak.bacaRuang(teks, daftarLabel());
    if (ruang) e.kategori = ruang.nama;
    /* Isinya cuma dipangkas jadi URL telanjang kalau memang CUMA SATU. Dua
       alamat yang ditempel berdampingan dulu terbaca sebagai satu "tautan",
       dan yang kedua hilang tanpa jejak - kehilangan diam-diam, jenis paling
       buruk. */
    var urls = TOtak.semuaUrl(teks);
    e.isi = (jenis === 'tautan' && urls.length === 1) ? TOtak.ambilUrl(teks) : teks;
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
      gambarBayang();
      gambarHasilDepan();
      sundulLabel();
    }).catch(function (err) {
      pesan('Gagal menyimpan: ' + err.message);
    });
  }

  /* ===================== MODE AI =====================
     Satu-satunya tempat di aplikasi ini kamu MENUNGGU AI. Di mana pun yang
     lain dia bekerja di belakang - memberi judul, memisah elemen - dan boleh
     gagal diam-diam. Di sini dia yang diajak bicara, dan itu pekerjaan yang
     berbeda sifatnya, jadi dia punya modenya sendiri.

     Modenya dinyalakan dan dimatikan oleh SATU ikon yang sama. Selama menyala,
     kotak yang itu-itu juga berhenti mencari dan mulai bertanya, dan tombol
     Drop di bawah ikonnya berhenti menyimpan dan mulai mengirim. Tidak ada
     layar baru: layar kedua yang isinya kotak-dan-tombol yang sama cuma
     menyalin yang sudah ada, dan pintunya jadi langkah tambahan.

     RIWAYATNYA TINGGAL DI SETELAN, bukan di toko entri, dan itu keputusan yang
     paling banyak akibatnya di sini. Dari sana dia ikut berkas cadangan tanpa
     satu baris kode tambahan, DAN dia tidak pernah muncul di pencarian
     catatan, tidak ikut dihitung di "N tersimpan", dan tidak pernah dikirim
     balik ke AI sebagai bahan pelabelan. Obrolan itu percakapan; percakapan
     yang diam-diam jadi timbunan persis penyakit yang aplikasi ini obati.

     Yang memang layak jadi timbunan tetap bisa masuk - lewat tombol Drop di
     tiap jawaban, satu ketukan, ke rak yang sama dengan yang lain. */
  var modeAI = false;
  var modeGambar = false;      /* di dalam mode AI: menjawab, atau menggambar */
  var riwayatAI = [];
  var sedangTanyaAI = false;

  /* Dipotong, bukan disimpan seluruhnya. Percakapan bulan lalu hampir tidak
     pernah dibaca lagi, tapi dia ikut ke tiap berkas cadangan selamanya. */
  var OBROL_MAKS = 40;

  /* IKON TELANJANG, TANPA TULISAN. Dua kata di kepala layar obrolan menagih
     dibaca tiap kali layarnya dibuka, padahal isinya cuma dua keadaan yang
     sudah kelihatan dari mana yang menyala. Bentuknya sama persis dengan cip
     saringan di layar Drop - satu bahasa untuk satu arti. */
  var AI_MODE = [
    ['jawab', 'Jawab',
     '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 20.5l1.5-4.6A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/>'],
    ['gambar', 'Gambar',
     '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>']
  ];

  /* Dipotong SEBELUM digambar, bukan sesudahnya. Tombol Drop di tiap jawaban
     menunjuk pesan lewat nomor urutnya; kalau daftarnya menyusut sesudah
     layarnya digambar, nomor itu menunjuk pesan yang salah - dan yang tersimpan
     bukan yang kamu ketuk. */
  function potongObrolan() {
    if (riwayatAI.length > OBROL_MAKS) riwayatAI = riwayatAI.slice(-OBROL_MAKS);
  }

  function simpanObrolan() {
    potongObrolan();
    return TSimpan.setel('obrolan', JSON.stringify(riwayatAI));
  }

  function muatObrolan(s) {
    try {
      var d = JSON.parse((s && s.obrolan) || '[]');
      riwayatAI = Array.isArray(d) ? d.slice(-OBROL_MAKS) : [];
    } catch (e) { riwayatAI = []; }
  }

  function tulisPlaceholder() {
    $('#kotak').placeholder = modeAI
      ? (modeGambar ? 'Gambar apa?' : 'Tanya apa saja…')
      : 'Tulis atau cari…';
  }

  function setelModeAI(nyala) {
    modeAI = !!nyala;
    $('#l-utama').classList.toggle('mode-ai', modeAI);
    $('#b-ai').classList.toggle('nyala', modeAI);
    $('#b-ai').setAttribute('aria-pressed', modeAI ? 'true' : 'false');
    $('#petak-ai').classList.toggle('sembunyi', !modeAI);
    tulisPlaceholder();
    setelIkonKotak();
    if (modeAI) {
      /* Yang sedang setengah jalan ditutup dulu. Kotak isian daftar yang masih
         menganga di bawah obrolan bukan cuma berantakan - dia bikin ragu tombol
         Drop itu mengirim ke AI atau menyimpan daftarnya. */
      tutupLaci();
      setelDaftarNyala(false);
      setelLinkNyala(false);
      tutupHasilDepan();
      gambarObrolan();
      $('#kotak').focus();
    } else {
      gambarCipRuang();
      gambarBayang();
      gambarHasilDepan();
    }
  }

  function gambarCipModeAI() {
    $('#ai-mode').innerHTML = AI_MODE.map(function (m) {
      var nyala = (m[0] === 'gambar') === modeGambar;
      return '<button class="saring-cip' + (nyala ? ' nyala' : '') +
             '" data-ai-mode="' + m[0] + '" title="' + H(m[1]) +
             '" aria-label="' + H(m[1]) + '">' +
             '<svg viewBox="0 0 24 24" class="ik">' + m[2] + '</svg></button>';
    }).join('');
  }

  function pesanAiHtml(m, i) {
    var isi = m.berkasId
      ? '<img data-berkas="' + H(m.berkasId) + '" src="' + H(m.thumb || '') + '" alt="Gambar dari AI">'
      : H(m.teks || '');
    /* Cuma jawaban yang punya kaki. Menawarkan "Drop" pada kalimat yang baru
       saja kamu ketik sendiri adalah menawarkan menyimpan sesuatu yang sudah
       ada di kepalamu. */
    var kaki = m.dari === 'ai' && !m.galat
      ? '<div class="ai-kaki"><button data-ai-drop="' + i + '">Drop</button>' +
        (m.berkasId ? '' : '<button data-ai-salin="' + i + '">Salin</button>') + '</div>'
      : '';
    return '<div class="ai-pesan ' + (m.dari === 'aku' ? 'aku' : 'ai') + '">' +
           '<div class="ai-gelembung"><span data-asli>' + isi + '</span>' + kaki + '</div></div>';
  }

  function gambarObrolan() {
    if (!modeAI) return;
    potongObrolan();
    gambarCipModeAI();
    var wadah = $('#ai-isi');
    if (!riwayatAI.length && !sedangTanyaAI) {
      wadah.innerHTML = '<div class="kosong">Belum ada yang ditanyakan.<br>' +
        (TPelabel.siap(setelanSaat)
          ? 'Jawabannya bisa langsung di-drop jadi catatan.'
          : 'AI belum menyala — nyalakan di Setelan.') + '</div>';
      return;
    }
    wadah.innerHTML = riwayatAI.map(pesanAiHtml).join('') +
      (sedangTanyaAI ? '<div class="ai-pesan"><div class="ai-gelembung ai-tunggu">•••</div></div>' : '');
    pasangGambarKartu(wadah);
    /* YANG DIGULIR PETAKNYA, BUKAN HALAMANNYA. Sejak tinggi layar Drop
       dipatok, halamannya sengaja tidak bisa digulir sama sekali - jadi
       menyuruh window menggulir ke dasar tidak mengerjakan apa pun, dan
       jawaban yang baru datang tinggal di bawah garis pandang sampai kamu
       menggulirnya sendiri. Yang punya gulirannya sekarang petak obrolan. */
    var petak = $('#petak-ai');
    if (petak) petak.scrollTop = petak.scrollHeight;
  }

  function blobDariB64(b64, tipe) {
    var bin = atob(b64);
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: tipe || 'image/png' });
  }

  /* Gambarnya masuk ke toko berkas lewat jalan yang sama persis dengan gambar
     yang kamu lampirkan sendiri - jadi kalau nanti di-drop, kartunya tidak
     berbeda sedikit pun dari kartu gambar biasa. */
  function simpanGambarAI(g) {
    var blob = blobDariB64(g.data, g.tipe);
    var bid = idBaru('b');
    return TSimpan.taruhBerkas(bid, blob, 'gambar-ai.png', blob.type).then(function () {
      return buatThumb(blob);
    }).then(function (thumb) {
      return {
        dari: 'ai', teks: '', ts: Date.now(), berkasId: bid, thumb: thumb || '',
        tipeBerkas: blob.type, ukuran: blob.size
      };
    });
  }

  function kirimAI() {
    if (sedangTanyaAI) return;
    var teks = $('#kotak').value.trim();
    if (!teks) { pesan('Kotaknya masih kosong'); return; }
    if (!TPelabel.siap(setelanSaat)) { pesan('AI belum menyala — nyalakan di Setelan'); return; }

    riwayatAI.push({ dari: 'aku', teks: teks, ts: Date.now() });
    $('#kotak').value = '';
    setelTinggiKotak();
    sedangTanyaAI = true;
    simpanObrolan();
    gambarObrolan();

    var kerja = modeGambar
      ? TPelabel.gambarAI(setelanSaat, teks).then(simpanGambarAI)
      : TPelabel.obrolTeks(setelanSaat, riwayatAI).then(function (t) {
          return { dari: 'ai', teks: String(t || '').trim() || '(jawabannya kosong)', ts: Date.now() };
        });

    return kerja.then(function (m) {
      riwayatAI.push(m);
    }, function (err) {
      /* Gagalnya BERISIK di sini, dan cuma di sini. Pelabelan yang gagal boleh
         diam karena kamu tidak sedang menunggunya; jawaban yang tidak pernah
         datang tanpa sepatah kata pun terbaca sebagai aplikasi rusak. */
      riwayatAI.push({ dari: 'ai', teks: 'Gagal: ' + err.message, ts: Date.now(), galat: true });
    }).then(function () {
      sedangTanyaAI = false;
      var simpan = simpanObrolan();
      gambarObrolan();
      return simpan;
    });
  }

  function dropObrolan(i) {
    var m = riwayatAI[i];
    if (!m || m.dari !== 'ai') return;
    /* PERTANYAANNYA IKUT JADI JUDUL. Jawaban tanpa pertanyaannya adalah
       potongan yang enam bulan lagi tidak bisa ditempatkan lagi - persis
       lubang yang aplikasi ini ada untuk menambalnya. */
    var tanyaAsal = '';
    for (var k = i - 1; k >= 0; k--) {
      if (riwayatAI[k].dari === 'aku') { tanyaAsal = riwayatAI[k].teks; break; }
    }
    var e = entriBaru(m.berkasId ? 'gambar' : 'teks');
    if (m.berkasId) {
      e.berkasId = m.berkasId;
      e.thumb = m.thumb || '';
      e.namaBerkas = 'gambar-ai.png';
      e.tipeBerkas = m.tipeBerkas || 'image/png';
      e.ukuran = m.ukuran || 0;
      e.isi = tanyaAsal;
    } else {
      e.isi = m.teks;
    }
    var ruang = TOtak.bacaRuang(tanyaAsal, daftarLabel());
    if (ruang) e.kategori = ruang.nama;
    e.judul = tanyaAsal ? tanyaAsal.split('\n')[0].slice(0, 80) : TOtak.judulOtomatis(e);
    /* Judulnya kata-katamu sendiri, jadi AI tidak boleh menimpanya - aturan
       yang sama dengan judul yang diketik di layar tulis. */
    e.judulManual = !!tanyaAsal;
    e.label = TOtak.labelOtomatis(e);
    e.elemen = TOtak.elemenOtomatis(e);

    TSimpan.taruh(e).then(function () {
      segarkanCache(e);
      perbaruiJumlah();
      pesan('Tersimpan' + (e.kategori ? ' · #' + e.kategori : ''));
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
        /* Lacinya menutup sendiri: lampirannya sudah terpilih. */
        tutupLaci();
      });
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

  /* SATU LACI SAJA YANG BOLEH TERBUKA, dan dia menutup begitu kamu menyentuh
     hal lain. Layarnya sempit: laci yang menggantung terbuka menutupi kotak
     dan hasilnya sekaligus, dan yang menutupnya harus kamu sendiri - satu
     ketukan tambahan untuk membereskan sesuatu yang kamu tidak minta. */
  var LACI = {
    drop: ['#panel-drop', '#b-lampir']
  };

  function tutupLaci() {
    Object.keys(LACI).forEach(function (k) {
      $(LACI[k][0]).classList.add('sembunyi');
      if (LACI[k][1]) $(LACI[k][1]).setAttribute('aria-expanded', 'false');
    });
    laciBuka = '';
  }

  function alihLaci(nama, buka) {
    var mau = buka === undefined ? laciBuka !== nama : buka;
    tutupLaci();
    if (!mau) return;
    $(LACI[nama][0]).classList.remove('sembunyi');
    if (LACI[nama][1]) $(LACI[nama][1]).setAttribute('aria-expanded', 'true');
    laciBuka = nama;
  }

  function pilihLabelDepan(nama) {
    labelDepan = nama;
    tutupLaci();
    gambarHasilDepan();
  }

  /* Sisi KELUAR dari laci Drop, dan sengaja memakai ikon yang sama. Memilih
     "Gambar" berarti "perlihatkan gambar-gambarku" tanpa satu kata pun -
     pertanyaan yang tidak bisa dijawab kata kunci, karena gambar memang tidak
     punya kata sampai AI membacanya. */
  /* Enam cip, dan yang pertama BUKAN saringan.

     RESET mengembalikan layar ke keadaan baru dibuka: kotaknya kosong,
     saringannya lepas, hasilnya tertutup. Tanpa dia, membereskan tiga hal
     yang menyala butuh tiga ketukan di tiga tempat berbeda - dan yang paling
     sering terjadi bukan "aku mau melepas yang ini", tapi "aku mau mulai dari
     nol lagi". Dia ditaruh paling KIRI, sengaja jauh dari jempol: yang
     menghapus seluruh keadaan layar tidak pantas mudah tersenggol. */
  var JENIS_SARING = [
    ['*semua', 'Semua', '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
    ['teks', 'Teks', '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>'],
    ['gambar', 'Gambar', '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'],
    ['berkas', 'Berkas', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'],
    ['tautan', 'Link', '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'],
    /* Pin bukan jenis, tapi dia duduk di baris yang sama - karena
       pertanyaannya bentuknya sama: "perlihatkan yang ini saja". Tanpa dia,
       yang kamu pin cuma kelihatan kalau kebetulan ada pencarian yang
       memancingnya, dan pin yang harus dipancing bukan pin. */
    ['*pin', 'Pin', '<path d="M9 3h6l-1 6 4 4v2H6v-2l4-4z"/><path d="M12 15v6"/>'],
    /* Reset PALING KANAN, di ujung yang paling dekat jempol. Dia bukan
       saringan - dia menghapus keadaan, bukan menyempitkannya - tapi dia
       dipakai sepanjang hari, dan itu yang menentukan tempatnya. Sempat naik
       ke kepala layar dan itu keliru: kepala ada di ujung terjauh dari jempol
       yang bertumpu di sudut kanan bawah. */
    ['*reset', 'Reset', '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>']
  ];

  /* LINK DIBACA DARI ISINYA, BUKAN DARI BENTUK DROP-NYA.

     Dulu sebuah kartu berjenis 'tautan' cuma kalau yang kamu jatuhkan URL
     telanjang - dua kata atau kurang. Begitu kamu menulis "link dev photo
     studio https://..." dia jadi 'teks', dan cip Link tidak menemukannya.
     Jadi cip Link menjawab "mana yang dulu kudrop telanjang", bukan "mana
     link-ku" - dan yang kedua itulah yang kamu tanyakan.

     Sekarang: punya elemen tautan, ATAU jenisnya memang tautan. Elemennya
     sudah ditarik waktu kartunya masuk, jadi tidak ada yang perlu dihitung
     ulang. Akibatnya satu kartu bisa masuk dua cip - catatan berisi link itu
     Teks DAN Link. Itu benar: cip di sini pertanyaan, bukan kotak. */
  function punyaTautan(e) {
    if (e.jenis === 'tautan') return true;
    return (e.elemen || []).some(function (x) { return x.jenis === 'tautan'; });
  }

  /* Teks = yang bukan gambar dan bukan berkas. Bukan 'jenis === teks': kartu
     berisi link tetap catatan tulisan, dan menyembunyikannya dari bawaan
     berarti mencari "photo studio" menjawab kosong padahal barangnya ada. */
  function cocokJenis(e, j) {
    if (!j) return true;
    if (j === '*pin') return !!e.pin;
    if (j === 'teks') return e.jenis !== 'gambar' && e.jenis !== 'berkas';
    if (j === 'tautan') return punyaTautan(e);
    return e.jenis === j;
  }

  /* Yang benar-benar dipakai menyaring. '' berarti belum memilih, dan yang
     belum memilih dilayani TEKS - bukan semuanya. */
  function jenisEfektif() {
    if (saringJenis === '') return 'teks';
    if (saringJenis === '*semua') return '';
    return saringJenis;
  }

  /* Angka di tiap cip, dari pencarian yang sedang berjalan. Dihitung sekali
     di gambarHasilDepan; di sini cuma dibaca. */
  var hitungSaring = {};

  function gambarCipSaring() {
    var wadah = $('#saring-cip');
    if (!wadah) return;
    var hidup = semuaEntri.filter(catatanSaja);
    var adaHasil = hasilDepanAktif();
    var cip = JENIS_SARING.map(function (j) {
      /* Reset bukan saringan: dia tidak punya angka dan tidak pernah menyala.
         Garis putus-putus yang membedakannya - bentuk yang di aplikasi ini
         selalu berarti "ini jalan pintas, bukan keadaan". */
      if (j[0] === '*reset') {
        return '<button class="saring-cip reset" data-jenis="*reset" title="' + H(j[1]) +
               '" aria-label="' + H(j[1]) + '">' +
               '<svg viewBox="0 0 24 24" class="ik">' + j[2] + '</svg></button>';
      }
      /* ANGKANYA ANGKA HASIL PENCARIAN, bukan angka seluruh timbunan. Yang
         menolong waktu kamu mengetik bukan "aku punya berapa gambar", tapi
         "kata ini menemukan berapa gambar" - dan itu yang menjawab kenapa
         layarnya kosong sebelum kamu sempat bertanya. */
      var n = adaHasil ? (hitungSaring[j[0]] || 0)
        : (j[0] === '*semua' ? hidup.length
           : hidup.filter(function (e) { return cocokJenis(e, j[0]); }).length);
      /* CIPNYA TETAP ADA WAKTU NOL, ANGKANYA YANG PERGI. Cip yang
         muncul-hilang sambil kamu mengetik memindahkan tetangganya, dan jari
         yang sudah hafal tempatnya jadi salah tekan. Yang nol cuma diredupkan.

         Angkanya menumpang DI ATAS ikonnya, bukan di sebelahnya: di sebelah,
         enam saringan plus ikon AI tidak muat sebaris, dan yang melipat
         mendorong seluruh dok naik. */
      return '<button class="saring-cip' +
             (j[0] === '*semua' ? (saringJenis === '*semua' ? ' nyala' : '')
                                : (jenisEfektif() === j[0] ? ' nyala' : '')) +
             (n ? '' : ' sepi') +
             '" data-jenis="' + j[0] + '" title="' + H(j[1]) + '" aria-label="' + H(j[1]) + '">' +
             '<svg viewBox="0 0 24 24" class="ik">' + j[2] + '</svg>' +
             /* Angkanya dipatok di sisi KANAN cip, jadi angka ratusan tumbuh
                ke KIRI - menumpuk lebih dalam di atas ikonnya, bukan melebar
                keluar dan mendorong barisnya. Lebar layar tetap aman. */
             (n ? '<span class="saring-angka">' + (n > 999 ? '999+' : n) + '</span>' : '') +
             '</button>';
    }).filter(Boolean);

    /* JENIS ELEMEN TIDAK LAGI JADI CIP. Namanya panjang dan jumlahnya banyak -
       "No WhatsApp", "No Telepon", "No Rekening", "nama berkas" - jadi barisnya
       melipat jadi tiga baris dan menutupi setengah layar. Lebih buruk lagi,
       namanya mirip nama gudang di baris atasnya, jadi terbaca seperti gudang
       yang muncul dua kali. Mencarinya tetap bisa: ketik namanya. */
    wadah.innerHTML = cip.join('');
  }

  /* Laci jenis SENGAJA KOSONG untuk sekarang. Isinya sudah naik jadi cip di
     atas kotak - dua ketukan untuk hal yang dipakai tiap hari itu satu ketukan
     terlalu banyak. Tempatnya ditinggalkan untuk isian berikutnya, dan
     dikosongkan tiap kali dibuka supaya tidak ada sisa yang menyesatkan. */
  function gambarDaftarFilter() {
    $('#filter-daftar').innerHTML = '';
  }

  /* UKURAN THUMBNAIL ITU PERTANYAAN NYATA, dan jawabannya berubah menurut apa
     yang sedang dicari. Mencari satu desain yang diingat rupanya butuh petak
     besar; menyapu tiga ratus tangkapan layar butuh yang kecil supaya sebanyak
     mungkin masuk satu layar; mencari lewat judul butuh daftar. Pilihannya
     diingat, karena kebiasaan orang biasanya menetap di satu ukuran. */
  var GAYA_GAMBAR = [
    ['besar', 'Petak besar', '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>'],
    ['sedang', 'Petak sedang', '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="10" y="3" width="5" height="5" rx="1"/><rect x="17" y="3" width="4" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/><rect x="17" y="10" width="4" height="5" rx="1"/><rect x="3" y="17" width="5" height="4" rx="1"/><rect x="10" y="17" width="5" height="4" rx="1"/><rect x="17" y="17" width="4" height="4" rx="1"/>'],
    ['kecil', 'Petak kecil', '<rect x="3" y="3" width="3.6" height="3.6" rx=".8"/><rect x="8.4" y="3" width="3.6" height="3.6" rx=".8"/><rect x="13.8" y="3" width="3.6" height="3.6" rx=".8"/><rect x="19.2" y="3" width="1.8" height="3.6" rx=".8"/><rect x="3" y="8.4" width="3.6" height="3.6" rx=".8"/><rect x="8.4" y="8.4" width="3.6" height="3.6" rx=".8"/><rect x="13.8" y="8.4" width="3.6" height="3.6" rx=".8"/><rect x="19.2" y="8.4" width="1.8" height="3.6" rx=".8"/><rect x="3" y="13.8" width="3.6" height="3.6" rx=".8"/><rect x="8.4" y="13.8" width="3.6" height="3.6" rx=".8"/><rect x="13.8" y="13.8" width="3.6" height="3.6" rx=".8"/><rect x="19.2" y="13.8" width="1.8" height="3.6" rx=".8"/>'],
    ['daftar', 'Daftar', '<rect x="3" y="4" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="3" y="16" width="4" height="4" rx="1"/><path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/>']
  ];

  function gambarBarisTampilan() {
    var baris = $('#tampil-baris');
    baris.classList.toggle('sembunyi', jenisEfektif() !== 'gambar');
    if (jenisEfektif() !== 'gambar') { baris.innerHTML = ''; return; }
    baris.innerHTML = GAYA_GAMBAR.map(function (g) {
      return '<button class="tampil-tbl' + (gayaGambar === g[0] ? ' nyala' : '') +
             '" data-gaya="' + g[0] + '" title="' + H(g[1]) + '" aria-label="' + H(g[1]) + '">' +
             '<svg viewBox="0 0 24 24" class="ik">' + g[2] + '</svg></button>';
    }).join('');
  }

  function pilihGayaGambar(g) {
    gayaGambar = g;
    simpanSetelan('gayaGambar', g);
    gambarHasilDepan();
  }

  /* ===================== TEMA WARNA =====================
     Yang berganti CUMA AKSENNYA - dasarnya tetap putih redup di semua tema.
     Alasannya sama dengan alasan tema gelap dulu dibuang: dua alas berarti
     tiap suntingan gaya harus diperiksa dua kali, dan aksen sudah cukup untuk
     membuat aplikasi yang dibuka puluhan kali sehari terasa berganti baju.

     Empat pilihan, bukan dua puluh. Dua puluh warna itu keputusan; empat itu
     pilihan. Yang kelima "sendiri", untuk saat tidak ada satu pun yang cocok. */
  /* Nama bahasanya ditulis DALAM bahasanya sendiri - "Indonesia", bukan
     "Indonesian". Yang mencari bahasanya sendiri di daftar mencari kata yang
     dia kenali, bukan terjemahannya. */
  var BAHASA = [['en', 'English'], ['id', 'Indonesia']];

  function bahasaSaat() { return setelanSaat.bahasa || 'en'; }

  var TEMA = [
    ['teal',  'Teal',   '#0F766E'],
    ['nila',  'Nila',   '#4338CA'],
    ['plum',  'Plum',   '#9D174D'],
    ['tanah', 'Tanah',  '#92400E']
  ];

  function warnaTema(nama, sendiri) {
    if (nama === 'sendiri') return /^#[0-9a-f]{6}$/i.test(sendiri || '') ? sendiri : TEMA[0][2];
    for (var i = 0; i < TEMA.length; i++) if (TEMA[i][0] === nama) return TEMA[i][2];
    return TEMA[0][2];
  }

  /* Ditulis ke variabel CSS, bukan ke tiap aturan: seluruh gaya sudah memakai
     --a dan --ap, jadi satu baris di sini sudah cukup mengganti seluruh
     aplikasi. Warna bilah browser ikut diganti supaya HP tidak menyisipkan
     sepotong warna lama di atas layar. */
  function pasangTema(nama, sendiri) {
    var w = warnaTema(nama, sendiri);
    var akar = document.documentElement;
    akar.style.setProperty('--a', w);
    akar.style.setProperty('--ap', w);
  }

  /* Kembali ke keadaan baru dibuka: kotaknya kosong, saringannya lepas,
     hasilnya tertutup, lacinya tertutup, gulirnya di atas. */
  function resetLayar() {
    kosongkanKotak();
    tutupLaci();
    tutupHasilDepan();
    global.scrollTo(0, 0);
    $('#kotak').blur();
  }

  function pilihJenis(j) {
    if (j === '*reset') { resetLayar(); return; }
    /* Mengetuk yang sedang menyala mematikannya - tanpa itu, satu-satunya
       jalan keluar adalah menebak cip mana yang berarti "batal". */
    /* Mengetuk yang sedang menyala mengembalikannya ke bawaan, bukan ke
       "semua" - jalan pulangnya tetap satu tempat. */
    saringJenis = (saringJenis === j) ? '' : j;
    gambarHasilDepan();
    gambarCipSaring();
  }

  function tutupHasilDepan() {
    labelDepan = null;
    saringJenis = '';
    $('#petak-hasil-depan').classList.add('sembunyi');
    $('#hasil-depan').innerHTML = '';
    /* Cipnya ikut digambar ulang - saringan yang sudah dilepas tapi cipnya
       masih menyala adalah cara paling halus untuk membuat layar terlihat
       berbohong. */
    gambarCipSaring();
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
    return !!labelDepan || !!saringJenis || !!$('#kotak').value.trim();
  }

  function gambarHasilDepan() {
    /* Di mode AI kotaknya bertanya, bukan mencari - satu huruf tidak boleh
       memanggil daftar hasil yang tidak diminta siapa pun. */
    if (modeAI || !hasilDepanAktif()) { tutupHasilDepan(); return; }

    var istilah = null;
    if (labelDepan && labelDepan !== '*') {
      daftarLabel().forEach(function (l) { if (l.nama === labelDepan) istilah = l.istilah; });
      if (!istilah) istilah = [TOtak.normal(labelDepan)];
    }

    var kueri = $('#kotak').value.trim();
    bersihkanUrl();
    /* Dicari SEKALI tanpa saringan jenis, lalu disaring di sini - dari satu
       lintasan itu juga lahir angka di tiap cip. Menyaring di dalam cari()
       berarti lima pencarian untuk satu ketukan huruf. */
    var semuaHasil = TOtak.cari(semuaEntri, kueri, '', istilah || '');
    hitungSaring = {};
    JENIS_SARING.forEach(function (x) {
      if (x[0] === '*reset') return;
      hitungSaring[x[0]] = x[0] === '*semua' ? semuaHasil.length
        : semuaHasil.filter(function (e) { return cocokJenis(e, x[0]); }).length;
    });
    var jenisKini = jenisEfektif();
    var hasil = jenisKini
      ? semuaHasil.filter(function (e) { return cocokJenis(e, jenisKini); })
      : semuaHasil;
    $('#petak-hasil-depan').classList.remove('sembunyi');

    var ket = [];
    ket.push(hasil.length ? hasil.length + ' hasil' : 'Kosong');
    if (labelDepan && labelDepan !== '*') ket.push(labelDepan);
    JENIS_SARING.forEach(function (x) { if (x[0] === jenisEfektif() && x[0]) ket.push(x[1]); });
    /* Kata yang panjang dipotong di kepala: keterangan yang membungkus jadi
       dua baris mendorong hasil pertama ke bawah - dan hasil pertama itu yang
       dicari. Yang lengkap tetap terbaca di kotaknya sendiri, tepat di atas. */
    if (kueri) ket.push('“' + (kueri.length > 28 ? kueri.slice(0, 27) + '…' : kueri) + '”');
    $('#hasil-depan-ket').textContent = ket.join(' · ');
    gambarBarisTampilan();
    gambarCipSaring();

    var wadah = $('#hasil-depan');
    if (!hasil.length) {
      /* KOSONG YANG JUJUR. Bawaannya cuma teks, jadi mencari sesuatu yang
         ternyata sebuah gambar atau tautan akan menjawab "tidak ada yang
         cocok" - dan itu bohong. Saringan yang membuat pencarian TERLIHAT
         rusak adalah bug yang sama yang dulu sudah dibetulkan sekali; di sini
         dia dicegah dengan menyebut angkanya, bukan dengan membuang
         saringannya. */
      var lain = jenisEfektif() ? semuaHasil.length : 0;
      wadah.innerHTML = '<div class="kosong">' + (kueri
        ? (lain
            ? 'Tidak ada teks yang cocok.<br><b>' + lain + '</b> ketemu di jenis lain — ketuk <b>Semua</b> di atas.'
            : 'Tidak ada yang cocok.<br>Coba satu kata saja — pencarian ini memaafkan.')
        : lain
          ? 'Belum ada teks di sini.<br><b>' + lain + '</b> ada di jenis lain.'
          : saringJenis
            ? 'Belum ada yang berjenis ini.'
            : 'Belum ada yang masuk label ini.<br>Label diisi AI sesudah catatannya jatuh.') +
        '</div>';
      return;
    }

    /* Gambar digambar sebagai PETAK, bukan baris. Judul gambar hampir selalu
       nama berkas yang tidak berarti apa-apa; yang mengenalinya kembali adalah
       rupanya. Jenis lain tetap baris, karena di sana justru judulnya yang
       dikenali. */
    if (jenisEfektif() === 'gambar' && gayaGambar !== 'daftar') {
      wadah.innerHTML = '<div class="petak ' + gayaGambar + '">' + hasil.slice(0, 200).map(function (e) {
        var gambar = e.thumb
          ? '<img src="' + H(e.thumb) + '" alt="">'
          : (e.berkasId ? '<img data-berkas="' + H(e.berkasId) + '" alt="">' : '<span class="petak-kosong"></span>');
        return '<button class="petak-satu" data-buka="' + H(e.id) + '">' + gambar +
               '<span class="petak-nama">' + H(e.judul || e.namaBerkas || '(tanpa judul)') + '</span></button>';
      }).join('') + '</div>';
      pasangGambarKartu(wadah);
      return;
    }

    wadah.innerHTML = urutPin(hasil).slice(0, 200).map(kartuHtml).join('');
    pasangGambarKartu(wadah);
  }

  /* ===================== LAYAR NOTE: RUANG MENULIS =====================
     Pintu keempat, dan dia lahir dari satu penemuan yang tidak terduga:
     menulis panjang - brief, instruksi, rancangan - ternyata pekerjaan dua
     puluh menit yang ditinggal lalu didatangi lagi besok, sama sekali bukan
     pekerjaan tiga detik yang dilayani kotak Drop. Selama tidak ada tempatnya
     di sini, pekerjaan itu lari ke Notepad dan ke chat WhatsApp ke diri
     sendiri - dan dari sana tidak pernah kembali.

     PENCARIANNYA BERDIRI SENDIRI, dan itu bagian yang paling menentukan.
     Mencari satu tulisan di antara ribuan potongan drop berarti mengayak
     sesuatu yang kamu tahu persis ada; di layar ini yang dicari cuma tulisan,
     jadi ketikan tiga huruf sudah cukup.

     Ini TIDAK melanggar "satu pencarian untuk mengambilnya kembali": tulisan
     tetap ikut terjaring di kotak Drop seperti catatan lain. Yang ditambahkan
     di sini bukan dinding kedua, melainkan pintu yang lebih sempit ke rak yang
     sudah kamu tahu isinya.

     Penandanya satu kolom, 'tulisan'. BUKAN jenis tersendiri: kalau jenisnya
     berbeda, dia luput dari saringan, dari kartu, dan dari elemen - dan
     tulisan yang berisi nomor rekening berhenti bisa disalin sendiri. */
  /* Folder yang sedang dibuka di layar Note; null = daftar folder di akar. */
  var tulisFolder = null;

  function semuaTulisan() {
    return semuaEntri.filter(function (e) {
      return e.tulisan && !e.pensiun && !e.dihapus;
    });
  }

  /* FOLDER NOTE ITU DAFTARNYA SENDIRI, DIBUAT TANGAN.

     Dulu dia diturunkan dari daftar gudang, dan akibatnya lima belas rak yang
     dipakai kotak Drop tiba-tiba muncul di sini sebagai folder kosong - lima
     belas baris yang tidak pernah kamu buat, tidak pernah berisi, dan tidak
     bisa dihapus. Rak Drop dan folder Note memang dua hal berbeda: rak lahir
     dari catatan yang jatuh dan disortir mesin, folder lahir karena KAMU
     memutuskan ada tempat yang perlu diisi.

     Jadi daftarnya berdiri sendiri di setelan, dan tulisan menyimpan foldernya
     di kolomnya sendiri ('folder'), bukan menumpang kategori. */
  var folderDaftar = [];

  function muatFolder(s) {
    try {
      var d = JSON.parse((s && s.folderNote) || '[]');
      folderDaftar = Array.isArray(d) ? d.filter(function (x) { return !!x; }) : [];
    } catch (e) { folderDaftar = []; }
  }

  function simpanFolder() {
    return TSimpan.setel('folderNote', JSON.stringify(folderDaftar));
  }

  function folderTulis() {
    var punya = semuaTulisan();
    var isi = {};
    /* Yang KOSONG tetap ditampilkan, dan itu disengaja: kamu membuat folder
       justru supaya ada tempat menulis. Folder yang lenyap sedetik setelah
       dibuat, karena belum ada isinya, adalah tombol yang mengingkari dirinya
       sendiri. */
    folderDaftar.forEach(function (n) { isi[n] = []; });
    punya.forEach(function (e) {
      var nama = e.folder || '';
      /* Yang belum berfolder dikumpulkan di barisnya sendiri. Di akar yang
         tampil cuma folder, jadi tanpa baris ini tulisan yang belum kamu
         taruh di mana pun tidak punya satu jalan pun untuk dilihat lagi.
         Dia BUKAN folder buatan: dia tidak bisa dihapus dan tidak pernah
         muncul kalau memang kosong. */
      if (nama && (nama in isi)) isi[nama].push(e);
      else (isi[TANPA_FOLDER] = isi[TANPA_FOLDER] || []).push(e);
    });

    var nama = Object.keys(isi);
    var induk = {};
    nama.forEach(function (n) {
      var pilih = '';
      if (n === TANPA_FOLDER) { induk[n] = ''; return; }
      nama.forEach(function (c) {
        if (c === n || c === TANPA_FOLDER) return;
        if (normalFolder(n).indexOf(normalFolder(c) + ' ') !== 0) return;
        if (!pilih || c.length > pilih.length) pilih = c;
      });
      induk[n] = pilih;
    });
    var anak = {};
    nama.forEach(function (n) { if (induk[n]) anak[induk[n]] = (anak[induk[n]] || 0) + 1; });

    return nama.map(function (n) {
      return { nama: n, isi: isi[n], induk: induk[n] || '', anak: anak[n] || 0 };
    }).sort(function (a, b) {
      /* "Belum berfolder" selalu paling bawah: dia bukan tempat yang kamu
         pilih, dia sisa yang belum sempat ditaruh. */
      if ((a.nama === TANPA_FOLDER) !== (b.nama === TANPA_FOLDER)) {
        return a.nama === TANPA_FOLDER ? 1 : -1;
      }
      var na = a.isi.length + (a.anak ? 1000 : 0);
      var nb = b.isi.length + (b.anak ? 1000 : 0);
      if (nb !== na) return nb - na;
      return a.nama.localeCompare(b.nama);
    });
  }

  /* Bukan folder buatanmu - dia kumpulan yang belum kamu taruh di mana pun.
     Tidak bisa dihapus, dan tidak pernah tampil kalau memang kosong. */
  var TANPA_FOLDER = 'Belum berfolder';

  function daftarTulisan() {
    var kueri = ($('#tulis-cari') ? $('#tulis-cari').value : '').trim();
    var punya = semuaTulisan();
    /* Mengetik selalu MENEMBUS folder - kalau pencarian cuma berlaku di folder
       yang sedang dibuka, kamu harus tahu dulu barangnya di mana, dan kalau
       sudah tahu kamu tidak perlu mencari. */
    if (!kueri && tulisFolder) {
      punya = punya.filter(function (e) {
        return tulisFolder === TANPA_FOLDER ? !e.folder : (e.folder || '') === tulisFolder;
      });
    }
    var hasil = kueri ? TOtak.cari(punya, kueri, '', '') : punya.slice();
    /* Tanpa kueri: yang PALING BARU DISENTUH di atas. Itu jawaban untuk
       satu-satunya pertanyaan yang benar-benar sering muncul di layar ini -
       "yang tadi kutulis mana" - dan menjawabnya tanpa mengetik apa pun. */
    if (!kueri) {
      hasil.sort(function (a, b) { return (b.diubah || 0) - (a.diubah || 0); });
    }
    return urutPin(hasil);
  }

  /* Baris folder yang RAPAT. Dulu tiap folder setinggi dua baris teks dengan
     jarak longgar di antaranya, dan sepuluh folder sudah memakan seluruh layar
     - padahal isinya cuma nama dan satu angka. Yang dibaca di sini namanya,
     dan nama tidak butuh ruang sebanyak itu. */
  function folderTulisHtml(f) {
    var n = f.isi.length;
    return '<button class="folder-baris" data-tulis-folder="' + H(f.nama) + '">' +
      '<svg viewBox="0 0 24 24" class="ik"><path d="M4 6a2 2 0 0 1 2-2h3.5l2 2.5H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>' +
      '<span class="folder-nama" data-asli>' + H(f.nama) + '</span>' +
      (f.anak ? '<span class="folder-anak">' + f.anak + ' rak</span>' : '') +
      /* Angka nol tidak digambar untuk folder yang isinya ada di rak-rak
         anaknya - "1 rak · 0" membaca seperti folder kosong, padahal isinya
         justru satu tingkat di bawah. */
      (n || !f.anak ? '<span class="folder-hitung">' + n + '</span>' : '') +
      '</button>';
  }

  /* TOMBOL KEMBALI, bukan cuma jejaknya. Jejak folder itu KABAR - dia
     memberitahu kamu sedang di mana - dan kabar ditulis kecil supaya tidak
     berebut dengan isinya. Tapi kecil berarti tidak muat jempol, dan satu-
     satunya jalan pulang yang muat jempol jadi tombol Kembali bawaan HP -
     yang di sini justru menutup aplikasinya.

     Jadi jalan pulangnya berdiri sendiri: satu panah 40px di kiri jejaknya,
     cuma muncul kalau kamu memang sedang di dalam sesuatu. */
  function panahKembali(tanda) {
    return '<button class="folder-balik" ' + tanda + ' aria-label="Kembali">' +
      '<svg viewBox="0 0 24 24" class="ik"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>' +
      '</button>';
  }

  function gambarJejakTulis() {
    var w = $('#tulis-alamat');
    if (!w) return;
    var kueri = $('#tulis-cari').value.trim();
    if (kueri) {
      w.innerHTML = panahKembali('data-tulis-akar') +
        '<span class="note-jejak-kini">“' + H(kueri) + '”</span>';
      return;
    }
    w.innerHTML = tulisFolder
      ? panahKembali('data-tulis-akar') +
        '<span class="note-jejak-kini">' + H(tulisFolder) + '</span>'
      : '<span class="note-jejak-kini">Semua folder</span>';
  }

  function gambarTulis() {
    var wadah = $('#tulis-isi');
    if (!wadah) return;
    gambarJejakTulis();
    var daftar = daftarTulisan();
    var kueri = $('#tulis-cari').value.trim();

    /* SATU TINGKAT, SATU JENIS ISI. Di akar yang tampil FOLDER SAJA; isinya
       baru terlihat sesudah foldernya dibuka. Menampilkan keduanya sekaligus
       memperlihatkan tulisan yang sama dua kali - sekali di dalam angka
       foldernya, sekali sebagai baris di bawahnya - dan yang membaca harus
       menebak sendiri mana yang mana.

       Yang belum berfolder punya barisnya sendiri, karena tanpa itu dia tidak
       punya satu pun jalan untuk dilihat lagi. */
    var folderHtml2 = '';
    var tampilDaftar = daftar;
    if (!kueri) {
      var semuaF = folderTulis();
      var tampil = tulisFolder
        ? semuaF.filter(function (f) { return f.induk === tulisFolder; })
        : semuaF.filter(function (f) { return !f.induk; });
      folderHtml2 = tampil.map(folderTulisHtml).join('');
      /* Di akar, tulisannya TIDAK ikut digambar - kecuali kalau memang tidak
         ada folder sama sekali, karena layar yang seluruhnya kosong padahal
         tulisanmu ada adalah kebohongan yang paling mahal di sini. */
      if (!tulisFolder && folderHtml2) tampilDaftar = [];
    }

    if (!tampilDaftar.length && !folderHtml2) {
      wadah.innerHTML = '<div class="kosong">' + (kueri
        ? 'Tidak ada tulisan yang cocok.'
        : 'Belum ada tulisan.<br>Yang panjang — brief, instruksi, rancangan — ditulis di sini,<br>bukan di kotak Drop.') +
        '</div>';
      return;
    }
    wadah.innerHTML = folderHtml2 + tampilDaftar.slice(0, 200).map(function (e) {
      return kartuHtml(e, { jamPenuh: true });
    }).join('');
    pasangGambarKartu(wadah);
    segarPilih();
  }

  /* ===================== EKOR JUDUL YANG DIINGAT =====================
     Di dalam satu folder, kata yang menyusul nama foldernya itu-itu saja:
     "prompt", "brief", "galat", "rapat". Mengetiknya ulang tiap kali adalah
     pekerjaan yang persis sama tiap kali - dan itu jenis pekerjaan yang
     aplikasi ini ada untuk menghapus.

     Yang ditawarkan cuma yang KAMU sendiri pernah pakai di folder itu. Bukan
     tebakan, bukan kamus: kalau daftarnya berisi kata yang tidak pernah kamu
     ketik, dia berhenti dipercaya sesudah dua kali salah. */
  var EKOR_MAKS = 6;
  var ekorJudul = {};

  function muatEkor(s) {
    try {
      var d = JSON.parse((s && s.ekorJudul) || '{}');
      ekorJudul = (d && typeof d === 'object') ? d : {};
    } catch (e) { ekorJudul = {}; }
  }

  function catatEkor(folder, ekor) {
    var kata = String(ekor || '').trim();
    if (!folder || !kata || kata.length > 40) return Promise.resolve();
    var daftar = (ekorJudul[folder] || []).filter(function (x) {
      return TOtak.normal(x) !== TOtak.normal(kata);
    });
    /* Yang terbaru di depan: kebiasaan berpindah, dan yang dipakai bulan lalu
       tidak pantas mengalahkan yang dipakai kemarin. */
    daftar.unshift(kata);
    ekorJudul[folder] = daftar.slice(0, EKOR_MAKS);
    return TSimpan.setel('ekorJudul', JSON.stringify(ekorJudul));
  }

  function gambarEkorCatat() {
    var w = $('#catat-ekor');
    if (!w) return;
    var judul = $('#catat-judul').value;
    var folder = (entriCatat && entriCatat.folder) || '';
    var daftar = (folder && ekorJudul[folder]) || [];
    /* Cuma waktu judulnya masih SEBATAS nama foldernya. Sesudah kamu mengetik
       kata berikutnya, tawaran ini sudah tidak menjawab apa pun - dan cip yang
       tidak menjawab apa pun cuma menutupi tulisanmu. */
    var sisa = folder ? judul.trim().slice(folder.length).trim() : judul.trim();
    if (!daftar.length || sisa) { w.classList.add('sembunyi'); w.innerHTML = ''; return; }
    w.classList.remove('sembunyi');
    w.innerHTML = daftar.map(function (x) {
      return '<button class="ekor-cip" data-ekor="' + H(x) + '" data-asli>' + H(x) + '</button>';
    }).join('');
  }

  /* Entrinya BELUM disimpan di sini. simpanCatat sudah menolak menyimpan
     catatan yang masih kosong, jadi membuka lalu keluar tanpa mengetik apa pun
     tidak meninggalkan baris kosong di timbunan - dan itu penting, karena
     tombol ini akan sering ditekan lalu diurungkan. */
  function tulisBaru() {
    var e = entriBaru('teks');
    e.tulisan = true;
    keCatat(e);
    /* JUDULNYA SUDAH TERISI NAMA FOLDERNYA. Kamu masuk ke folder itu justru
       untuk menulis sesuatu miliknya - mengetik namanya lagi adalah menjawab
       pertanyaan yang sudah kamu jawab dengan membuka foldernya. */
    var isian = $('#catat-judul');
    if (tulisFolder && tulisFolder !== TANPA_FOLDER) {
      isian.value = tulisFolder + ' ';
      e.folder = tulisFolder;
      gambarRuangCatat();
      gambarEkorCatat();
    }
    isian.focus();
    isian.setSelectionRange(isian.value.length, isian.value.length);
  }

  function folderBaru() {
    tanyaKetik('Folder baru', 'Namanya boleh dua kata — "Cortex Apps" otomatis jadi rak di dalam "Cortex".',
      '', function (nama) {
        if (!nama) return;
        var punya = folderDaftar.some(function (n) {
          return TOtak.normal(n) === TOtak.normal(nama);
        });
        if (punya) { pesan('Folder itu sudah ada'); tulisFolder = nama; gambarTulis(); return; }
        folderDaftar.push(nama);
        simpanFolder();
        tulisFolder = nama;
        gambarTulis();
        pesan('Folder “' + nama + '” dibuat');
      });
  }

  /* MEMBUANG FOLDER TIDAK MEMBUANG ISINYA. Foldernya cuma nama tempat; yang di
     dalamnya tetap tulisan yang kamu ketik sendiri, dan aturan nomor empat
     berlaku juga di sini. Yang tadinya di dalam naik ke "Belum berfolder", dan
     dari sana bisa dipindahkan lagi ke mana pun. */
  function buangFolderTerpilih(daftar) {
    var isi = [];
    daftar.forEach(function (n) { isi = isi.concat(isiFolder(n)); });
    tanya('Hapus ' + daftar.length + ' folder?',
      isi.length
        ? isi.length + ' catatan di dalamnya TIDAK ikut terhapus — mereka cuma keluar dari foldernya.'
        : 'Foldernya kosong, jadi tidak ada yang ikut hilang.',
      function () {
        /* Folder Note punya daftarnya sendiri, jadi namanya ikut dicoret dari
           sana. Folder Storage tidak: dia lahir dari rak tiap catatan, jadi
           dia hilang sendiri begitu tidak ada lagi yang menunjuk ke situ. */
        if (diLayarTulis()) {
          folderDaftar = folderDaftar.filter(function (n) { return daftar.indexOf(n) < 0; });
          simpanFolder();
          if (daftar.indexOf(tulisFolder) >= 0) tulisFolder = null;
        } else if (daftar.indexOf(noteFolder) >= 0) {
          noteFolder = null;
        }
        pindahkanEntri(isi, '', daftar.length + ' folder dihapus');
        if (!isi.length) { batalPilih(); segarkanTampilan(); pesan(daftar.length + ' folder dihapus'); }
      });
  }

  /* ===================== LAYAR STORAGE =====================
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

  /* Diambil apa adanya, bukan lewat normal(): normal() menurunkan semua huruf,
     dan folder bernama "projectspace" di sebelah "AmaraLiving" (yang datang
     dari tag) terbaca seperti dua sistem yang berbeda. */
  function ruangNote(e) {
    var kat = String(e.kategori || '').trim();
    if (!kat) return '';
    /* Nama gudang yang KAMU daftarkan dipakai UTUH: "Amara Sales" itu satu
       ruangan, dan memotongnya jadi "Amara" membuang divisi yang justru kamu
       susun sendiri. Kata pertama cuma dipakai kalau isinya bukan nama gudang
       - kategori lama boleh berisi beberapa keyword berpisah spasi, dan
       memakainya utuh melahirkan folder sepanjang kalimat. */
    var cocok = TOtak.bacaRuang(kat, daftarLabel());
    if (cocok) return cocok.nama;
    return kat.split(/\s+/).filter(Boolean)[0] || '';
  }

  /* FOLDER DIPILIH DARI TEMANNYA, BUKAN DARI URUTAN TAG.

     Dulu yang dipakai tag PERTAMA, dan urutan tag itu acak - jadi lahir folder
     "No", "catatan", "daftar", masing-masing berisi satu-dua keping, sementara
     "Telepon" yang punya lima teman tercecer. Sebelas folder berisi satu keping
     itu bukan sistem arsip, itu serpihan.

     Sekarang tiap keping mendarat di calon yang punya PALING BANYAK teman.
     Folder yang cuma punya satu anggota lenyap sendiri karena anggotanya pindah
     ke folder yang lebih ramai - tanpa daftar kata terlarang yang harus
     dirawat, dan makin rapi sendiri makin banyak yang kamu simpan.

     Gudang yang KAMU tulis selalu menang. Itu keputusanmu, bukan tebakan. */
  /* "WhatsApp" dan "Telepon" itu satu benda, dan dua rak untuk satu benda
     membuat dua-duanya setengah isi. Daftar istilah yang sudah dipakai
     menyusun judul tahu keduanya sama - jadi dia yang menyatukannya di sini,
     bukan daftar kedua yang harus dirawat sendiri. */
  function bakuFolder(nama) {
    return TOtak.bakuIstilah(nama) || nama;
  }

  function normalFolder(n) { return TOtak.normal(n); }

  function petaAlamatNote(hidup) {
    var hitung = {};
    hidup.forEach(function (e) {
      var calon = {};
      var r = ruangNote(e);
      if (r) calon[r] = true;
      (e.tag || []).filter(Boolean).forEach(function (t) { calon[bakuFolder(t)] = true; });
      Object.keys(calon).forEach(function (k) { hitung[k] = (hitung[k] || 0) + 1; });
    });

    /* Calon yang menempel di hampir semua keping bukan ruangan - dia cuma kata
       yang dipakai AI di mana-mana. Folder yang isinya seluruh timbunan tidak
       memisahkan apa pun. Batasnya baru berlaku sesudah timbunannya cukup
       besar; di delapan keping pertama, "banyak" belum berarti apa-apa. */
    var luas = hidup.length >= 8 ? hidup.length * 0.5 : Infinity;

    var peta = {};
    hidup.forEach(function (e) {
      var r = ruangNote(e);
      if (r) { peta[e.id] = r; return; }
      var terbaik = '';
      (e.tag || []).filter(Boolean).forEach(function (t) {
        var b = bakuFolder(t);
        if (hitung[b] > luas) return;
        if (!terbaik || hitung[b] > hitung[terbaik]) terbaik = b;
      });
      peta[e.id] = terbaik || TANPA_RAK;
    });
    return peta;
  }

  /* Alamat satu keping sendirian - dipakai kartu di layar hasil. Dihitung atas
     seluruh timbunan supaya jawabannya sama persis dengan yang di layar Note;
     dua jawaban berbeda untuk keping yang sama lebih buruk daripada tidak
     menjawab sama sekali. */
  function alamatNote(e) {
    var hidup = semuaEntri.filter(catatanSaja);
    if (hidup.indexOf(e) < 0) hidup = hidup.concat([e]);
    return petaAlamatNote(hidup)[e.id] || TANPA_RAK;
  }

  function folderNote() {
    var hidup = semuaEntri.filter(catatanSaja);
    var peta = petaAlamatNote(hidup);
    var isi = {};
    hidup.forEach(function (e) {
      var a = peta[e.id] || TANPA_RAK;
      (isi[a] = isi[a] || []).push(e);
    });
    /* Induknya dibaca dari namanya sendiri, sama seperti gudang: folder yang
       namanya diawali nama folder lain otomatis jadi anaknya. "Amara Sales"
       masuk ke dalam "Amara" tanpa satu pun tanda khusus yang harus diingat.

       Induk yang belum punya foldernya sendiri tetap dibuatkan - kalau tidak,
       "Amara Sales" jadi yatim dan naik ke akar, dan susunan yang kamu buat
       lenyap justru di layar yang tugasnya memperlihatkannya. */
    /* Induk yang belum punya foldernya sendiri tetap DIBUATKAN, kosong. Kalau
       tidak, "Amara Sales" jadi yatim dan naik sejajar dengan "Amara" - dan
       susunan yang kamu buat sendiri lenyap justru di layar yang tugasnya
       memperlihatkan susunan. Induknya dicari di daftar gudangmu, bukan cuma
       di antara folder yang kebetulan sudah terisi. */
    var pohon = TOtak.pohonLabel(daftarLabel());
    Object.keys(isi).forEach(function (n) {
      pohon.forEach(function (l) {
        if (l.nama === n && l.induk && !isi[l.induk]) isi[l.induk] = [];
      });
    });

    var nama = Object.keys(isi);
    var induk = {};
    nama.forEach(function (n) {
      var pilih = '';
      nama.forEach(function (c) {
        if (c === n) return;
        if (normalFolder(n).indexOf(normalFolder(c) + ' ') !== 0) return;
        /* Yang terpanjang menang: "Amara Apps Satu" milik "Amara Apps". */
        if (!pilih || c.length > pilih.length) pilih = c;
      });
      induk[n] = pilih;
    });
    var anak = {};
    nama.forEach(function (n) { if (induk[n]) anak[induk[n]] = (anak[induk[n]] || 0) + 1; });

    return nama.map(function (n) {
      return { nama: n, isi: isi[n], induk: induk[n] || '', anak: anak[n] || 0 };
    }).sort(function (a, b) {
      /* Yang belum berlabel selalu paling bawah: dia bukan folder, dia
         tumpukan yang belum sempat dinilai AI. */
      if ((a.nama === TANPA_RAK) !== (b.nama === TANPA_RAK)) return a.nama === TANPA_RAK ? 1 : -1;
      /* Induk diurut menurut SELURUH isinya, anak-anaknya sekalian - induk
         yang isinya sendiri kosong tapi memuat tiga rak bukan folder sepi. */
      var na = a.isi.length + (a.anak ? 1000 : 0);
      var nb = b.isi.length + (b.anak ? 1000 : 0);
      if (nb !== na) return nb - na;
      return a.nama.localeCompare(b.nama);
    });
  }

  /* ===================== PILIH BANYAK DI LAYAR NOTE =====================
     Catatan lima tahun lalu yang sudah tidak berarti apa-apa tetap muncul tiap
     hari, dan tiap satunya harus dilewati mata. Peringkat menenggelamkan yang
     basi, tapi menenggelamkan bukan membuang - dan gudang yang isinya sepuluh
     ribu keping tetap gudang yang berat walau yang basi sudah diam.

     Jadi membuang massal itu WAJIB ADA. Yang tidak boleh cuma satu: membuang
     tanpa kamu sengaja. Karena itu memilih dimulai dengan MENAHAN satu kartu,
     bukan dengan kotak centang yang menganga sepanjang hari - dan yang terbuang
     tetap bisa dikembalikan dari arsip di Setelan. */
  var pilihNote = {};
  /* Folder ikut bisa dipilih - dan itu yang dulu tidak ada: mengetuk folder di
     mode pilih tidak menghasilkan apa pun sama sekali, jadi tombol Pilih
     terbaca rusak justru di layar yang paling butuh membereskan. */
  var pilihFolder = {};
  /* Keadaannya sendiri, TERPISAH dari "ada yang dipilih". Tanpa ini, menekan
     tombol Pilih tidak menghasilkan apa-apa yang kelihatan - belum ada yang
     terpilih, jadi bilahnya belum muncul, dan tombolnya terbaca rusak. */
  var pilihNyala = false;

  function jumlahPilih() { return Object.keys(pilihNote).length; }
  function jumlahFolderPilih() { return Object.keys(pilihFolder).length; }

  function alihPilihFolder(nama) {
    pilihNyala = true;
    if (pilihFolder[nama]) delete pilihFolder[nama]; else pilihFolder[nama] = true;
    gambarBilahPilih();
    tandaiPilih();
  }

  /* Ada kartu yang bisa ditunjuk atau tidak - bukan "ada isinya atau tidak".
     Di halaman depan Storage isinya penuh, tapi semuanya folder. */
  function adaKartuNote() {
    var w = wadahPilih();
    return !!w && !!w.querySelector('.kartu, [data-tulis-folder], [data-note-folder]');
  }

  function mulaiPilih(nyala) {
    pilihNyala = !!nyala;
    if (!pilihNyala) { pilihNote = {}; pilihFolder = {}; }
    gambarBilahPilih();
    tandaiPilih();
  }

  /* SATU MESIN PILIH UNTUK DUA LAYAR. Note dan Storage sama-sama memilih
     banyak lalu membuang atau memindahkan; menyalinnya jadi dua berarti
     perbaikan di satu tempat diam-diam tidak sampai ke tempat lain. Yang
     membedakan cuma wadah kartunya. */
  function wadahPilih() {
    if (layarSaat === 'l-tulis') return $('#tulis-isi');
    if (layarSaat === 'l-utama') return $('#hasil-depan');
    return $('#note-isi');
  }

  function tandaiPilih() {
    var w = wadahPilih();
    if (!w) return;
    $$('.kartu', w).forEach(function (k) {
      k.classList.toggle('dipilih', !!pilihNote[k.getAttribute('data-id')]);
    });
    $$('[data-tulis-folder], [data-note-folder]', w).forEach(function (f) {
      var nama = f.getAttribute('data-tulis-folder') || f.getAttribute('data-note-folder');
      f.classList.toggle('dipilih', !!pilihFolder[nama]);
    });
  }

  /* Dipakai tiap kali daftar Storage digambar ulang: tandanya menempel lagi
     ke kartu yang sama, DAN tombol Pilih menyesuaikan diri dengan apa yang
     sekarang ada di layar - folder atau kartu. */
  function segarPilih() {
    tandaiPilih();
    gambarBilahPilih();
  }

  function gambarBilahPilih() {
    var n = jumlahPilih();
    var hidup = pilihNyala || !!n || !!jumlahFolderPilih();
    $('#pilih-bilah').classList.toggle('sembunyi', !hidup);
    $('#l-note').classList.toggle('mode-pilih', hidup && layarSaat === 'l-note');
    $('#l-tulis').classList.toggle('mode-pilih', hidup && layarSaat === 'l-tulis');
    /* Layar Drop ikut, dan di sana pintunya CUMA tekan-lama: tombol Pilih yang
       menganga di dok akan menagih tempat dari kotak yang dipakai puluhan kali
       sehari, untuk pekerjaan sebulan sekali. */
    $('#l-utama').classList.toggle('mode-pilih', hidup && layarSaat === 'l-utama');
    /* DI LAYAR DROP, BILAHNYA NAIK KE ATAS DOK. Bilahnya melayang di tingkat
       halaman - bukan di dalam layarnya - jadi aturan gaya yang bersarang di
       bawah #l-utama tidak pernah mengenainya. Tingginya diukur dari doknya
       sendiri, bukan ditebak: dok itu tumbuh dan menyusut mengikuti isi
       kotaknya, dan angka tetap apa pun akan meleset di salah satu keadaan. */
    var bilah = $('#pilih-bilah');
    if (hidup && layarSaat === 'l-utama') {
      var dok = $('#dok');
      var tinggiDok = dok ? Math.round(dok.getBoundingClientRect().height) : 110;
      bilah.style.bottom = 'calc(env(safe-area-inset-bottom) + ' + (tinggiDok + 12) + 'px)';
    } else {
      bilah.style.bottom = '';
    }
    var tombol = layarSaat === 'l-tulis' ? $('#b-tulis-pilih')
               : layarSaat === 'l-note' ? $('#b-pilih-mulai') : null;
    [$('#b-pilih-mulai'), $('#b-tulis-pilih')].forEach(function (b) {
      if (b) b.classList.toggle('nyala', hidup && b === tombol);
    });
    /* Di halaman depan Storage yang tampil cuma FOLDER, tidak ada satu kartu
       pun yang bisa ditunjuk - jadi tombolnya ikut hilang di sana. Tombol yang
       ada tapi tidak menghasilkan apa-apa lebih buruk daripada tombol yang
       tidak ada: yang pertama terbaca sebagai rusak. */
    if (tombol) tombol.classList.toggle('sembunyi', !adaKartuNote());
    /* Waktu belum ada yang ditunjuk, bilahnya menyebutkan apa yang harus
       dilakukan - bukan "0 dipilih", yang cuma mengabarkan keadaan tanpa
       memberi tahu jalan keluarnya. */
    var nf = jumlahFolderPilih();
    var sebut = [];
    if (n) sebut.push(n + ' catatan');
    if (nf) sebut.push(nf + ' folder');
    $('#pilih-jumlah').textContent = sebut.length ? sebut.join(' · ') + ' dipilih'
                                                  : 'Ketuk yang mau dipilih';
    /* Folder yang dipilih MENDAHULUI catatan: begitu ada folder di antaranya,
       Gabung dan Pindah bekerja pada foldernya - karena memindahkan folder dan
       memindahkan satu catatan di dalamnya adalah dua maksud yang berbeda, dan
       yang lebih besar yang dimaksud orang. Tombol yang tidak berlaku
       disembunyikan, bukan dimatikan: tombol mati masih menagih dibaca. */
    $('#b-pilih-gabung').classList.toggle('sembunyi', nf ? nf < 2 : n < 2);
    $('#b-pilih-buang').classList.toggle('sembunyi', !n && !nf);
    $('#b-pilih-pindah').classList.toggle('sembunyi', !n && !nf);
  }

  function alihPilih(id) {
    pilihNyala = true;
    if (pilihNote[id]) delete pilihNote[id]; else pilihNote[id] = true;
    gambarBilahPilih();
    tandaiPilih();
  }

  function batalPilih() {
    pilihNote = {};
    pilihFolder = {};
    pilihNyala = false;
    gambarBilahPilih();
    tandaiPilih();
  }

  function entriPilih() {
    return semuaEntri.filter(function (e) { return pilihNote[e.id]; });
  }

  /* MEMBUANG MASSAL. Yang dibuang diarsipkan, bukan dilenyapkan - "tidak ada
     yang benar-benar terhapus" tetap berlaku, dan itulah yang membuat tombol
     ini boleh ada sama sekali. */
  function buangPilih() {
    var folderPilih = folderTerpilih();
    /* Folder dulu, sendirian: menghapusnya bukan mengarsipkan apa pun, dan
       menggabungkan dua pertanyaan yang berbeda akibatnya jadi satu dialog
       adalah cara tercepat membuat orang menekan "Lanjut" tanpa membaca. */
    if (folderPilih.length) { buangFolderTerpilih(folderPilih); return; }

    var dipilih = entriPilih();
    if (!dipilih.length) return;
    var n = dipilih.length;
    tanya('Buang ' + n + ' catatan?',
      'Masuk arsip, bukan hilang — masih bisa dikembalikan dari Setelan.',
      function () {
        Promise.all(dipilih.map(function (e) {
          e.pensiun = true;
          e.diubah = Date.now();
          segarkanCache(e);
          return TSimpan.taruh(e);
        })).then(function () {
          batalPilih();
          return muatSemua();
        }).then(function () {
          segarkanTampilan();
          pesan(n + ' catatan masuk arsip');
        });
      });
  }

  /* MENGGABUNG. Yang jadi wadah kartu yang PALING BARU disentuh - dia yang
     paling mungkin masih kamu ingat, dan judulnya yang paling mungkin masih
     benar. Sisanya jadi baris di dalamnya, lalu diarsipkan. Nama wadahnya
     ditawarkan, bukan ditanyakan kosong: mengetik judul untuk sesuatu yang
     baru saja kamu tunjuk sendiri adalah pertanyaan yang jawabannya sudah ada
     di layar. */
  /* ===================== FOLDER: DUA LAYAR, DUA ARTI =====================
     Note dan Storage sama-sama punya folder, tapi foldernya BUKAN benda yang
     sama. Folder Note kamu buat sendiri dan tersimpan di daftarnya sendiri;
     folder Storage lahir dari rak yang dibaca mesin dari tiap catatan. Yang
     dulu keliru di sini: satu daftar dipakai untuk dua layar, jadi memindah
     catatan di Storage menawarkan folder milik Note - nama yang tidak ada
     hubungannya sama sekali dengan yang sedang dilihat. */
  function diLayarTulis() { return layarSaat === 'l-tulis'; }

  function folderLayar() {
    return diLayarTulis()
      ? folderTulis().filter(function (f) { return f.nama !== TANPA_FOLDER; })
      : folderNote().filter(function (f) { return f.nama !== TANPA_RAK; });
  }

  function namaFolderLayar() {
    return folderLayar().map(function (f) { return f.nama; });
  }

  /* Satu-satunya tempat yang tahu kolom mana yang menyimpan foldernya. */
  function taruhFolder(e, nama) {
    if (diLayarTulis()) e.folder = nama; else e.kategori = nama;
  }

  function isiFolder(nama) {
    var f = folderLayar().filter(function (x) { return x.nama === nama; })[0];
    return f ? f.isi.slice() : [];
  }

  function folderTerpilih() { return Object.keys(pilihFolder); }

  /* Menuliskan perpindahan sekelompok catatan, lalu menyegarkan layarnya.
     Dipakai tiga tempat - pindah, gabung, dan buang folder - dan ketiganya
     memang pekerjaan yang sama persis di bawahnya. */
  function pindahkanEntri(daftar, tujuan, kabar) {
    if (!daftar.length) { batalPilih(); return Promise.resolve(); }
    return Promise.all(daftar.map(function (e) {
      taruhFolder(e, tujuan);
      e.diubah = Date.now();
      segarkanCache(e);
      return TSimpan.taruh(e);
    })).then(function () {
      batalPilih();
      return muatSemua();
    }).then(function () {
      segarkanTampilan();
      if (kabar) pesan(kabar);
    });
  }

  function pindahPilih() {
    var folderPilih = folderTerpilih();
    var semuaNama = namaFolderLayar();

    /* FOLDER YANG DIPILIH: isinya yang pindah, bukan foldernya sendiri.
       Foldernya cuma nama tempat - yang benar-benar berpindah selalu isinya. */
    if (folderPilih.length) {
      var tujuanBoleh = semuaNama.filter(function (x) { return folderPilih.indexOf(x) < 0; });
      if (!tujuanBoleh.length) { pesan('Tidak ada folder lain untuk dituju'); return; }
      tanyaPilih('Pindahkan isi ' + folderPilih.length + ' folder ke mana?',
        'Ketuk folder tujuannya. Foldernya sendiri hilang begitu kosong.',
        tujuanBoleh, function (tujuan) {
          if (!tujuan) return;
          var isi = [];
          folderPilih.forEach(function (n) { isi = isi.concat(isiFolder(n)); });
          pindahkanEntri(isi, tujuan, isi.length + ' catatan pindah ke “' + tujuan + '”');
        });
      return;
    }

    var dipilih = entriPilih();
    if (!dipilih.length) return;
    if (!semuaNama.length) { pesan('Belum ada folder — buat satu dulu'); return; }
    var sedang = diLayarTulis() ? tulisFolder : noteFolder;
    tanyaPilih('Pindahkan ' + dipilih.length + ' catatan ke mana?',
      'Ketuk folder tujuannya.',
      semuaNama.filter(function (x) { return x !== sedang; }),
      function (tujuan) {
        if (!tujuan) return;
        pindahkanEntri(dipilih, tujuan,
          dipilih.length + ' catatan pindah ke “' + tujuan + '”');
      });
  }

  /* MENGGABUNG FOLDER. Bedanya dengan Pindah cuma DARI MANA tujuannya diambil:
     di sini dari antara yang kamu pilih sendiri, jadi dua rak yang ternyata
     benda yang sama bisa dilebur tanpa mengetik satu nama pun. */
  function gabungFolder() {
    var folderPilih = folderTerpilih();
    if (folderPilih.length < 2) return;
    tanyaPilih('Gabung ' + folderPilih.length + ' folder jadi satu?',
      'Ketuk yang mau dipertahankan — isi yang lain pindah ke sana.',
      folderPilih, function (tujuan) {
        if (!tujuan) return;
        var isi = [];
        folderPilih.forEach(function (n) {
          if (n !== tujuan) isi = isi.concat(isiFolder(n));
        });
        pindahkanEntri(isi, tujuan, folderPilih.length + ' folder digabung jadi “' + tujuan + '”');
      });
  }

  function gabungPilih() {
    var dipilih = entriPilih().slice().sort(function (a, b) {
      return (b.diubah || 0) - (a.diubah || 0);
    });
    if (dipilih.length < 2) return;
    var wadah = dipilih[0];
    var sisa = dipilih.slice(1);

    tanya('Gabung ' + dipilih.length + ' catatan?',
      'Semuanya masuk ke “' + (wadah.judul || 'tanpa judul') + '” — yang paling baru kamu sentuh. ' +
      'Yang lain masuk arsip, tidak hilang.',
      function () {
        var potong = [wadah.isi || ''];
        sisa.forEach(function (e) {
          potong.push('— ' + (e.judul || 'tanpa judul'));
          if (e.isi) potong.push(e.isi);
          wadah.elemen = TOtak.gabungElemen(wadah.elemen, e.elemen || []);
          (e.tag || []).forEach(function (t) {
            if ((wadah.tag || []).indexOf(t) < 0) wadah.tag = (wadah.tag || []).concat([t]);
          });
        });
        wadah.isi = potong.filter(Boolean).join('\n\n');
        wadah.diubah = Date.now();
        /* Judulnya dilepas dari penanda manual supaya AI boleh menamai ulang
           gabungannya - isinya sudah bukan isi yang dulu dinamai. */
        wadah.judulManual = false;
        wadah.diLabeliAI = false;
        segarkanCache(wadah);

        Promise.all([TSimpan.taruh(wadah)].concat(sisa.map(function (e) {
          e.pensiun = true;
          e.diubah = Date.now();
          segarkanCache(e);
          return TSimpan.taruh(e);
        }))).then(function () {
          batalPilih();
          return muatSemua();
        }).then(function () {
          segarkanTampilan();
          pesan(dipilih.length + ' catatan digabung');
        });
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
      $('#note-alamat').innerHTML = panahKembali('data-note-akar') +
        '<span class="note-jejak-kini">“' + H(kueri) + '”</span>' +
        '<span class="note-hitung">' + hasil.length + '</span>';
      /* Petanya dihitung SEKALI untuk seluruh daftar, bukan sekali per kartu:
         menghitungnya di dalam map() berarti seluruh timbunan disapu ulang
         untuk tiap baris yang digambar - tidak terasa di dua puluh catatan,
         mematikan di sepuluh ribu. */
      var petaCari = petaAlamatNote(semuaEntri.filter(catatanSaja));
      $('#note-isi').innerHTML = hasil.length
        ? urutPin(hasil).slice(0, 200).map(function (e) {
            /* Alamatnya ditulis di atas judulnya, bukan dikirim sebagai
               argumen kedua ke kartuHtml: kartu itu dipakai di tiga tempat,
               dan menambah parameter di sana berarti map() yang memanggilnya
               diam-diam mengoper nomor urut sebagai alamat. */
            return '<div class="note-alamat-kecil" data-asli>' + H(petaCari[e.id] || TANPA_RAK) + ' /</div>' +
                   kartuHtml(e, { jamPenuh: true });
          }).join('')
        : '<div class="kosong">Tidak ada yang cocok.<br>Coba satu kata saja — pencarian ini memaafkan.</div>';
      pasangGambarKartu($('#note-isi'));
      segarPilih();
      return;
    }

    if (noteFolder) {
      var semuaF = folderNote();
      var f = semuaF.filter(function (x) { return x.nama === noteFolder; })[0];
      var daftar = f ? urutPin(f.isi.slice().sort(function (a, b) {
        return (b.diubah || 0) - (a.diubah || 0);
      })) : [];
      /* Anak folder digambar DI ATAS isinya sendiri: masuk "Amara" lalu
         langsung melihat Sales dan Apps adalah cara orang membaca lemari -
         rak dulu, baru barang lepas yang belum masuk rak. */
      var anak = semuaF.filter(function (x) { return x.induk === noteFolder; });
      /* Induknya disebut kalau ada - "Amara / Sales" memberitahu kamu sedang di
         tingkat berapa, dan panahnya membawamu pulang ke akar sekali tekan. */
      $('#note-alamat').innerHTML = panahKembali('data-note-akar') +
        (f && f.induk ? '<span class="note-jejak-induk">' + H(f.induk) + ' /</span>' : '') +
        '<span class="note-jejak-kini">' + H(noteFolder) + '</span>' +
        '<span class="note-hitung">' + daftar.length + '</span>';
      $('#note-isi').innerHTML = (anak.map(folderHtml).join('') || '') + (daftar.length
        ? daftar.map(function (e) { return kartuHtml(e, { jamPenuh: true }); }).join('')
        : (anak.length ? '' : '<div class="kosong">Folder ini sudah kosong.</div>'));
      pasangGambarKartu($('#note-isi'));
      segarPilih();
      return;
    }

    var folder = folderNote();
    /* Di akar cuma INDUK yang tampil. "Amara Sales" ada di dalam "Amara",
       bukan berdiri sejajar dengannya - kalau sejajar, hierarki yang kamu susun
       sendiri lenyap justru di layar yang tugasnya memperlihatkan susunan. */
    var akar = folder.filter(function (f) { return !f.induk; });
    $('#note-alamat').innerHTML = '<span class="note-jejak-kini">Semua folder</span>' +
      '<span class="note-hitung">' + akar.length + '</span>';
    $('#note-isi').innerHTML = akar.length
      ? akar.map(folderHtml).join('')
      : '<div class="kosong">Belum ada catatan.<br>Jatuhkan sesuatu dulu lewat Drop.</div>';
    segarPilih();
  }

  function folderHtml(f) {
    /* Jumlah anaknya disebut, bukan disembunyikan: folder berisi "2" yang
       ternyata memuat tiga rak lagi di dalamnya adalah kejutan, dan kejutan di
       layar arsip terbaca sebagai catatan yang hilang. */
    /* Induk yang isinya sendiri kosong cuma menyebut raknya - "0 · 2 rak"
       membaca seperti folder kosong, padahal isinya justru dua rak penuh. */
    var ket = f.anak
      ? (f.isi.length ? f.isi.length + ' · ' : '') + f.anak + ' rak'
      : String(f.isi.length);
    return '<button class="note-folder' + (f.nama === TANPA_RAK ? ' sepi' : '') +
           '" data-note-folder="' + H(f.nama) + '">' +
           '<svg viewBox="0 0 24 24" class="ik"><path d="M4 5a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>' +
           '<span class="note-folder-nama" data-asli>' + H(f.nama) + '</span>' +
           '<span class="note-hitung">' + ket + '</span></button>';
  }

  /* Satu pintu untuk menggambar ulang apa pun yang sedang tampil. Hasil
     sekarang bisa berada di DUA tempat, dan tiap pemanggil yang memilih
     sendiri mana yang disegarkan pasti akan melupakan salah satunya. */
  function segarkanTampilan() {
    /* Layar Note ikut, dan dulu TIDAK - itu sebabnya melepas pin di sana tidak
       mengubah apa pun sampai layarnya ditinggal lalu didatangi lagi. Satu
       ketukan yang tidak menghasilkan apa-apa terbaca sebagai tombol rusak. */
    if (layarSaat === 'l-tulis') gambarTulis();
    if (layarSaat === 'l-note') gambarNote();
    if (hasilDepanAktif()) gambarHasilDepan();
    gambarCipSaring();
    /* Gudang tersering dihitung dari salinan lokal, jadi dia ikut disegarkan
       tiap kali salinan itu berubah - termasuk sesudah cadangan menyunting
       entri di belakang layar. */
    gambarCipRuang();
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
  /* Argumen keduanya OBJEK, bukan bendera - karena kartu ini dipakai lewat
     .map(kartuHtml) di tiga tempat, dan map() mengoper nomor urut sebagai
     argumen kedua. Angka tidak punya properti, jadi nomor urut yang nyasar ke
     sini otomatis terbaca sebagai "tidak ada pilihan". */
  function kartuHtml(e, opsi) {
    var sering = (e.dipakai || 0) >= SERING;
    var jamPenuh = !!(opsi && opsi.jamPenuh);
    var b = [];

    /* PIN SELALU TERLIHAT, tidak disembunyikan di dalam rincian. Yang dipin
       itu justru yang paling sering dipanggil, dan menyembunyikan tombolnya di
       balik satu ketukan berarti kamu harus membuka kartunya dulu untuk
       melepasnya - dua ketukan untuk membatalkan satu. */
    b.push('<div class="kartu-atas">' +
      '<div class="kartu-judul" data-asli>' + (sering ? '<span class="titik" title="sering dipakai"></span>' : '') +
      H(e.judul || '(tanpa judul)') + '</div>' +
      '<button class="kartu-pin' + (e.pin ? ' nyala' : '') + '" data-pin' +
      ' aria-label="' + (e.pin ? 'Lepas pin' : 'Pin ke atas') + '">' +
      '<svg viewBox="0 0 24 24" class="ik"><path d="M9 3h6l-1 6 4 4v2H6v-2l4-4z"/>' +
      '<path d="M12 15v6"/></svg></button>' +
      '<span class="kartu-waktu">' +
      H(jamPenuh ? TOtak.waktuLengkap(e.diubah) : TOtak.waktuRingkas(e.diubah)) +
      '</span></div>');

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
      b.push('<div class="kartu-cuplik" data-asli>' + H(cup) + '</div>');
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

    return '<article class="kartu' + (sering ? ' sering' : '') + (e.pin ? ' terpin' : '') +
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
    nomor: 'No', alamat: 'alamat', berkas: 'berkas', nama: 'nama',
    jadwal: 'jadwal', harga: 'harga', prompt: 'prompt', lainnya: 'catatan'
  };

  function elemenBaris(x, i) {
    /* Disingkat saat DITAMPILKAN juga, bukan cuma saat disimpan: yang
       terlanjur tersimpan sebagai "Nomor WhatsApp" ikut rapi tanpa satu pun
       barisnya disentuh. */
    var nama = TOtak.pendekkanNama(x.nama || NAMA_JENIS[x.jenis] || 'elemen');
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
             '" data-tag="' + H(t) + '" data-asli>#' + H(t) + '</button>';
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

  /* ===================== PRATINJAU GAMBAR =====================
     Menyentuh sebuah gambar hampir selalu berarti "aku mau LIHAT ini", bukan
     "aku mau menyuntingnya" - dan petak kecil memang terlalu kecil untuk
     menjawabnya. Jadi gambarnya yang membesar, dan sisa kartunya tetap
     membuka layar tulis seperti biasa. */
  var lihatUrl = '';

  function lihatGambar(e) {
    var lapis = $('#lihat');
    var img = $('#lihat-isi');
    if (!lapis || !img) return;
    tutupLihat();
    /* Thumbnail-nya dipasang DULU: dia sudah ada di memori, jadi layarnya
       terisi seketika. Yang penuh menggantikannya begitu siap - kalau
       menunggu, yang terlihat cuma kotak hitam kosong selama sekejap, dan
       sekejap itu terbaca sebagai macet. */
    img.src = e.thumb || '';
    lapis.classList.remove('sembunyi');

    var pasang = function (blob) {
      if (!blob) return;
      lihatUrl = URL.createObjectURL(blob);
      img.src = lihatUrl;
    };
    if (e.berkasId) {
      TSimpan.ambilBerkas(e.berkasId).then(function (r) { pasang(r && r.blob); });
    } else if (e.driveId) {
      TAwan.unduhBerkas(setelanSaat, e.driveId).then(pasang, function () { /* thumbnail-nya sudah cukup */ });
    }
  }

  function tutupLihat() {
    var lapis = $('#lihat');
    if (lapis) lapis.classList.add('sembunyi');
    if (lihatUrl) { URL.revokeObjectURL(lihatUrl); lihatUrl = ''; }
  }

  /* PIN: yang dipin selalu di paling atas.

     Ini BUKAN pengganti peringkat. Peringkat menjawab "apa yang biasanya
     kupakai" dan bekerja tanpa kamu memutuskan apa pun; pin menjawab "yang ini
     sedang kubutuhkan terus, sekarang" - dan itu memang cuma kamu yang tahu.
     Satu ketukan memasang, satu ketukan yang sama melepas: kalau melepasnya
     lebih sulit daripada memasang, sebulan lagi separuh timbunanmu terpin. */
  function alihPin(e) {
    e.pin = !e.pin;
    e.diubah = e.diubah || Date.now();
    TSimpan.taruh(e);
    segarkanCache(e);
    segarkanTampilan();
    pesan(e.pin ? 'Dipin ke atas' : 'Pin dilepas');
  }

  /* Yang dipin naik ke atas, urutan aslinya di antara mereka dipertahankan.
     Dipakai di layar depan DAN di layar Note - kalau cuma di satu tempat, pin
     yang sama terbaca beda tergantung dari mana kamu melihatnya. */
  function urutPin(daftar) {
    var pin = [], sisa = [];
    (daftar || []).forEach(function (e) { (e.pin ? pin : sisa).push(e); });
    return pin.concat(sisa);
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
    TAwan.unduhBerkas(setelanSaat, e.driveId).then(beri, function () {
      if (tombol) tombol.textContent = 'Unduh berkas';
      /* Pesannya tidak pernah menyebut kode status. "401" tidak memberi tahu
         apa pun yang bisa dikerjakan pemakainya, dan yang tersisa cuma kesan
         bahwa aplikasinya rusak. Yang salah hampir selalu jaringannya. */
      pesan('Berkasnya belum bisa diambil. Coba lagi sebentar.');
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

  /* Gudang yang sudah ada, ditawarkan di kolom kategori. Diisi ulang tiap
     kali layarnya dibuka, karena daftarnya bisa berubah di Setelan sementara
     halaman ini tidak pernah dimuat ulang.

     Ini satu-satunya cara memindahkan barang yang mendarat di gudang yang
     salah - dan sengaja cuma sebuah tawaran, bukan daftar tertutup: kategori
     tidak harus nama gudang. */
  /* KABAR, BUKAN GERBANG - persis seperti cip gudang di layar Drop. Dia cuma
     memberi tahu ke rak mana tulisan ini akan mendarat, dibaca dari judulnya.
     Tidak bisa diketuk: kalau raknya salah, yang dibetulkan judulnya, dan
     dengan begitu cuma ada SATU tempat yang menentukan - bukan dua yang
     diam-diam bisa berbeda. */
  function gambarRuangCatat() {
    var w = $('#catat-ruang');
    if (!w) return;
    var ruang = TOtak.bacaRuang($('#catat-judul').value.trim(), daftarLabel());
    var rak = ruang ? ruang.nama : (entriCatat && entriCatat.kategori) || '';
    var folder = (entriCatat && entriCatat.folder) || '';
    /* Dua kabar yang berbeda, dan keduanya pantas disebut: FOLDER itu tempat
       yang kamu pilih sendiri di layar Note, RAK itu tempat yang dibaca dari
       judulnya untuk pencarian Drop. Menyembunyikan salah satunya membuat
       orangnya mengira yang satu menggantikan yang lain. */
    var b = [];
    if (folder) b.push('<span class="catat-ruang-cip folder" data-asli>' + H(folder) + '</span>');
    if (rak) b.push('<span class="catat-ruang-cip" data-asli>#' + H(rak) + '</span>');
    w.innerHTML = b.length ? b.join('')
      : '<span class="catat-ruang-sepi">Belum berlabel — AI menyortirnya nanti</span>';
  }

  function keCatat(e) {
    entriCatat = e;
    $('#catat-judul').value = e.judul || '';
    gambarRuangCatat();
    gambarEkorCatat();
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
    /* GUDANGNYA DIBACA DARI JUDUL, aturan yang sama persis dengan kotak Drop.
       Kalau judulnya tidak menyebut satu gudang pun, raknya yang lama DIPEGANG
       - bukan dikosongkan. Menghapus satu kata dari judul tidak pernah boleh
       berarti "keluarkan tulisan ini dari raknya"; itu kehilangan diam-diam,
       dan yang kehilangan tidak akan pernah tahu sebabnya. */
    var ruang = TOtak.bacaRuang(judul, daftarLabel());
    var kat = ruang ? ruang.nama : (e.kategori || '');
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
    /* Ekor judulnya diingat per folder - tapi cuma untuk tulisan, dan cuma
       kalau judulnya memang diawali nama foldernya. Yang di-drop tidak ikut:
       judulnya disusun mesin, bukan kebiasaanmu. */
    if (e.tulisan && e.folder && judul) {
      var ekor = TOtak.normal(judul).indexOf(TOtak.normal(e.folder)) === 0
        ? judul.slice(e.folder.length).trim() : '';
      if (ekor) catatEkor(e.folder, ekor);
    }

    /* Isi yang berubah artinya penilaian lamanya sudah tidak menggambarkan
       catatan ini lagi. Judul, elemen, dan tag disusun ulang - dan judul yang
       diketik sendiri tetap tidak ikut ditimpa, karena judulManual yang
       menjaganya, bukan penanda ini. */
    if (isi !== isiSebelum) {
      /* TULISAN TIDAK PUNYA ELEMEN. Di kartu drop, elemen itu gunanya besar:
         satu nomor rekening yang bisa disalin sendiri tanpa menyorot apa pun.
         Di tulisan panjang dia justru salah tangkap - satu alamat yang
         kebetulan disebut di paragraf ketiga naik jadi label "LINK" di kepala
         kartunya, dan tetap di sana walau kalimatnya sudah kamu hapus. Yang
         disalin dari tulisan itu SELURUHNYA, dan tombolnya sudah ada. */
      e.elemen = e.tulisan ? [] : TOtak.gabungElemen([], TOtak.elemenOtomatis(e));
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

      '<div class="set-bagian">Tampilan</div>',
      /* BAHASA DI ATAS WARNA. Yang tidak mengerti kalimatnya tidak akan pernah
         sampai ke pilihan warna - jadi yang membuka jalan berdiri lebih dulu. */
      '<div class="set-kotak">',
      '<div class="set-judul">Bahasa</div>',
      '<div class="tema-baris" id="bahasa-baris">' +
        BAHASA.map(function (b) {
          return '<button class="tema-cip' + (bahasaSaat() === b[0] ? ' nyala' : '') +
                 '" data-bahasa="' + b[0] + '">' + H(b[1]) + '</button>';
        }).join('') +
      '</div>',
      '<div class="set-ket">Bahasa layar. Nama pintu — Drop, Note, To Do, Storage — sengaja tidak ikut diterjemahkan: itu nama tempat, dan nama tempat yang berganti bahasa membuat jarimu harus belajar ulang.</div>',
      '</div>',
      '<div class="set-kotak">',
      '<div class="set-judul">Warna aksen</div>',
      '<div class="set-ket">Yang berganti cuma aksennya — dasarnya tetap putih redup. Aplikasi yang dibuka puluhan kali sehari selama bertahun-tahun boleh sesekali ganti baju.</div>',
      '<div class="tema-baris" id="set-tema">',
      TEMA.map(function (t) {
        return '<button class="tema-cip' + (temaSaat === t[0] ? ' nyala' : '') +
               '" data-tema="' + t[0] + '" aria-label="' + H(t[1]) + '">' +
               '<span class="tema-bulat" style="background:' + t[2] + '"></span>' +
               H(t[1]) + '</button>';
      }).join('') +
      '<button class="tema-cip' + (temaSaat === 'sendiri' ? ' nyala' : '') +
        '" data-tema="sendiri" aria-label="Sendiri">' +
        '<span class="tema-bulat" style="background:' + H(warnaTema('sendiri', temaSendiri)) + '"></span>' +
        'Sendiri</button>',
      '</div>',
      temaSaat === 'sendiri'
        ? '<div class="kat-baris rapat"><span class="kat-pagar">#</span>' +
          '<input id="set-tema-warna" class="kat-input" type="color" value="' +
          H(warnaTema('sendiri', temaSendiri)) + '"></div>'
        : '',
      '</div>',

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
    /* MENGOSONGKAN ARSIP itu satu-satunya tempat di aplikasi ini yang
       benar-benar MENGHAPUS. Aturan nomor empat tetap utuh: yang diarsipkan
       tidak pernah hilang sendiri, dan yang menghapusnya harus kamu, sengaja,
       dari layar yang memang dibuat untuk itu. Tanpa jalan ini arsip cuma
       gudang kedua yang ikut membengkakkan tiap cadangan selamanya.

       Tombolnya menyebut ANGKANYA, bukan "Kosongkan" saja: yang menahan orang
       menekan tombol seperti ini adalah tidak tahu seberapa banyak yang akan
       lenyap. */
    wadah.innerHTML = '<div class="arsip-kepala">' +
      '<span class="set-ket">' + arsip.length + ' diarsipkan</span>' +
      '<button class="arsip-bersih" id="b-arsip-bersih">Hapus semua</button></div>' +
      arsip.slice(0, 50).map(function (e) {
        return '<div class="arsip-baris">' +
          '<div class="arsip-judul" data-asli>' + H(e.judul || '(tanpa judul)') + '</div>' +
          '<button class="arsip-balik" data-balik="' + H(e.id) + '">Kembalikan</button></div>';
      }).join('') +
      (arsip.length > 50 ? '<div class="set-ket">…dan ' + (arsip.length - 50) + ' lagi</div>' : '');
  }

  function bersihkanArsip() {
    var arsip = semuaEntri.filter(function (e) {
      return e.pensiun && !e.dihapus && e.jenis !== 'tugas';
    });
    if (!arsip.length) return;
    tanya('Hapus ' + arsip.length + ' catatan dari arsip?',
      'Ini yang terakhir — sesudah ini benar-benar hilang, tidak bisa dikembalikan.',
      function () {
        Promise.all(arsip.map(function (e) {
          e.dihapus = true;
          e.pensiun = true;
          e.diubah = Date.now();
          segarkanCache(e);
          return TSimpan.taruh(e);
        })).then(function () { return muatSemua(); })
          .then(function () {
            gambarArsip();
            perbaruiJumlah();
            pesan(arsip.length + ' catatan dihapus permanen');
          });
      });
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
      /* Satu-satunya penyimpanan di aplikasi ini yang benar-benar makan waktu
         dan tidak punya tanda lain. Sisanya menulis ke perangkat sendiri dan
         sudah selesai sebelum sempat diberitakan. */
      pesanJalan('Menyalin ke Drive…');
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

    var tema = $('#set-tema');
    if (tema) tema.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-tema]');
      if (!b) return;
      temaSaat = b.getAttribute('data-tema');
      pasangTema(temaSaat, temaSendiri);
      simpanSetelan('tema', temaSaat);
      gambarSetelan();
    });
    var temaWarna = $('#set-tema-warna');
    if (temaWarna) temaWarna.addEventListener('input', function () {
      temaSendiri = temaWarna.value;
      pasangTema('sendiri', temaSendiri);
      simpanSetelan('temaSendiri', temaSendiri);
    });

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
        if (b) { kembalikanArsip(b.getAttribute('data-balik')); return; }
        if (ev.target.closest('#b-arsip-bersih')) bersihkanArsip();
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
      setelTinggiKotak();
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
    /* Papan ketik HP menyusun kata di tengah pengetikan. Selama itu
       berlangsung, apa pun yang digambar di lapisan belakang pasti meleset -
       jadi bayangannya diam dulu. */
    $('#kotak').addEventListener('compositionstart', function () { sedangMenyusun = true; });
    $('#kotak').addEventListener('compositionend', function () {
      sedangMenyusun = false;
      gambarBayang();
    });
    $('#kotak').addEventListener('keyup', gambarBayang);
    $('#kotak').addEventListener('click', gambarBayang);
    /* Papan ketik: Tab, atau panah kanan saat kursornya sudah di ujung -
       menekan panah kanan di ujung teks tidak ada gunanya yang lain, jadi
       tidak ada yang direbut. */
    $('#kotak').addEventListener('keydown', function (ev) {
      if (!lengkapSaat) return;
      var kotak = $('#kotak');
      var diUjung = kotak.selectionStart === kotak.value.length &&
                    kotak.selectionEnd === kotak.value.length;
      if (ev.key === 'Tab' || (ev.key === 'ArrowRight' && diUjung)) {
        ev.preventDefault();
        terimaLengkap();
      }
    });
    /* mousedown, bukan click: menekan tombol membuat kotaknya kehilangan
       fokus, dan di HP papan ketiknya ikut turun sebelum ketukannya selesai.
       Dicegat sebelum itu terjadi, jadi papan ketiknya tidak pernah berkedip. */
    $('#b-terima').addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      terimaLengkap();
    });
    $('#b-terima').addEventListener('click', function (ev) { ev.preventDefault(); });

    $('#saring-baris').addEventListener('click', function (ev) {
      var j = ev.target.closest('[data-jenis]');
      if (j) { pilihJenis(j.getAttribute('data-jenis')); return; }
    });

    $('#ruang-baris').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ruang]');
      if (!b) return;
      var kotak = $('#kotak');
      var sisa = kotak.value.slice((ruangSaat ? ruangSaat.nama.length : 0)).replace(/^\s+/, '');
      kotak.value = b.getAttribute('data-ruang') + (sisa ? ' ' + sisa : ' ');
      kotak.focus();
      kotak.setSelectionRange(kotak.value.length, kotak.value.length);
      setelTinggiKotak();
      gambarBayang();
      gambarHasilDepan();
    });

    $('#link-tempel').addEventListener('input', perbaruiLinkKet);

    $('#kotak').addEventListener('input', function () {
      setelTinggiKotak();
      if (modeAI || sedangMengisi()) return;
      gambarBayang();
      bacaTertunda();
      /* Tanpa jeda: pencarian jalan di atas salinan lokal, jadi menundanya
         cuma menahan hasil yang sudah siap. Tebakan jenis tetap ditunda -
         dia menyusun judul dan itu memang lebih berat. */
      gambarHasilDepan();
    });

    /* ENTER ITU BARIS BARU. Titik.

       Dulu Enter dipakai untuk "cari", dan itu masuk akal waktu pencarian
       masih perlu dipicu. Sekarang tidak: tiap huruf sudah menyaring daftar di
       bawahnya, jadi tidak ada yang tersisa untuk dipicu. Yang tertinggal cuma
       kerugiannya - catatan berbaris-baris jadi tidak bisa ditulis di kotak
       yang justru pintu masuk utamanya. Jadi tidak ada penangan Enter di sini
       sama sekali, dan itu memang bentuk yang benar. */

    /* SATU TOMBOL, DUA ARTI - dan yang menentukan artinya bukan mode
       tersembunyi, melainkan ikon AI yang menyala tepat di atasnya plus panah
       kirim yang menggantikan panah jatuh di tombolnya sendiri. */
    $('#b-drop').addEventListener('click', function () {
      if (modeAI) kirimAI(); else drop();
    });
    $('#b-ai').addEventListener('click', function () { setelModeAI(!modeAI); });
    $('#ai-mode').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ai-mode]');
      if (!b) return;
      modeGambar = b.getAttribute('data-ai-mode') === 'gambar';
      tulisPlaceholder();
      gambarCipModeAI();
      $('#kotak').focus();
    });
    /* Mengosongkan obrolan itu satu-satunya tindakan di layar ini yang tidak
       bisa diurungkan, jadi dia bertanya dulu - dan pertanyaannya menyebutkan
       bahwa yang sudah kamu Drop tidak ikut hilang, karena itu justru
       ketakutan yang menahan orang menekannya. */
    $('#b-ai-bersih').addEventListener('click', function () {
      if (!riwayatAI.length) return;
      tanya('Kosongkan obrolan?',
            riwayatAI.length + ' pesan hilang dari layar ini. Yang sudah kamu Drop tetap tersimpan.',
            function () {
              riwayatAI = [];
              simpanObrolan().then(gambarObrolan);
            });
    });
    $('#ai-isi').addEventListener('click', function (ev) {
      var d = ev.target.closest('[data-ai-drop]');
      if (d) { dropObrolan(Number(d.getAttribute('data-ai-drop'))); return; }
      var s = ev.target.closest('[data-ai-salin]');
      if (s) {
        var m = riwayatAI[Number(s.getAttribute('data-ai-salin'))];
        if (m) salin(m.teks);
        return;
      }
      var g = ev.target.closest('img[data-berkas]');
      if (g) lihatGambar({ berkasId: g.getAttribute('data-berkas'), thumb: g.getAttribute('src') || '' });
    });
    $('#b-lampir').addEventListener('click', function () { alihLaci('drop'); });
    $('#b-tugas').addEventListener('click', keTugas);
    /* RUANGNYA TERBATAS: laci yang menggantung terbuka menutupi kotak dan
       hasilnya sekaligus. Jadi dia menutup sendiri begitu kamu menyentuh hal
       lain - mengetuk kotak, menggulir hasil, apa pun di luar lacinya. Kalau
       menutupnya harus kamu sendiri, itu satu ketukan untuk membereskan
       sesuatu yang tidak kamu minta. */
    $('#kotak').addEventListener('focus', tutupLaci);
    document.addEventListener('pointerdown', function (ev) {
      if (!laciBuka) return;
      if (ev.target.closest('#panel-drop, #panel-filter')) return;
      /* Tombol Drop ikut dikecualikan. Tanpa itu, menekan Drop saat lacinya
         terbuka menutup lacinya duluan - doknya bergeser turun, dan ketukan
         yang sudah dimulai mendarat di tempat kosong. Yang menutup lacinya
         nanti kosongkanKotak, sesudah barangnya benar-benar tersimpan. */
      if (ev.target.closest('#b-lampir, #b-tugas, #b-drop, #b-ai, [data-tab-ke="l-utama"]')) return;
      tutupLaci();
    }, true);
    $('#b-tutup-hasil').addEventListener('click', tutupHasilDepan);
    $('#tampil-baris').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-gaya]');
      if (b) pilihGayaGambar(b.getAttribute('data-gaya'));
    });



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

    $('#b-tulis-baru').addEventListener('click', tulisBaru);
    $('#b-folder-baru').addEventListener('click', folderBaru);
    $('#b-tulis-pilih').addEventListener('click', function () {
      mulaiPilih(!(pilihNyala || jumlahPilih()));
    });
    $('#tulis-cari').addEventListener('input', gambarTulis);
    $('#tulis-alamat').addEventListener('click', function (ev) {
      if (!ev.target.closest('[data-tulis-akar]')) return;
      tulisFolder = null;
      $('#tulis-cari').value = '';
      batalPilih();
      gambarTulis();
    });
    $('#tulis-isi').addEventListener('click', function (ev) {
      var f = ev.target.closest('[data-tulis-folder]');
      if (f) {
        /* Selama mode pilih hidup, mengetuk folder berarti MEMILIHNYA - bukan
           membukanya. Dua arti untuk satu ketukan adalah cara tercepat membuat
           orang ragu, dan di sini yang kedua yang tidak pernah ada. */
        if (pilihNyala || jumlahPilih() || jumlahFolderPilih()) {
          alihPilihFolder(f.getAttribute('data-tulis-folder'));
          return;
        }
        batalPilih();
        tulisFolder = f.getAttribute('data-tulis-folder');
        gambarTulis();
        global.scrollTo(0, 0);
        return;
      }
      if (pilihNyala || jumlahPilih() || jumlahFolderPilih()) {
        var k = ev.target.closest('.kartu');
        if (k) { alihPilih(k.getAttribute('data-id')); return; }
      }
      klikHasil(ev);
    });
    pasangTekanLama($('#tulis-isi'));
    pasangGeser($('#tulis-isi'));
    /* Cip ekor judul: satu ketukan menambahkan kata yang memang itu-itu saja
       di folder ini, lalu kursornya menunggu di ujung. */
    $('#catat-ekor').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ekor]');
      if (!b) return;
      var isian = $('#catat-judul');
      isian.value = isian.value.replace(/\s+$/, '') + ' ' + b.getAttribute('data-ekor');
      if (entriCatat) entriCatat.judulManual = true;
      gambarRuangCatat();
      gambarEkorCatat();
      isian.focus();
      isian.setSelectionRange(isian.value.length, isian.value.length);
      tanda('menyimpan…');
      simpanCatat();
    });
    $$('[data-ke-setelan]').forEach(function (b) {
      b.addEventListener('click', function () { gambarSetelan(); keLayar('l-setelan'); });
    });

    /* SIMPAN YANG BISA DITEKAN. Layar tulis menyimpan sendiri tiap kali kamu
       berhenti mengetik, jadi tombol ini tidak menambah satu pun kemampuan.
       Yang ditambahkannya bukti - dan yang menahan orang menulis dua puluh
       menit di sini bukan kehilangan yang pernah terjadi, melainkan tidak
       adanya satu pun tanda bahwa tulisannya aman. */
    $('#b-simpan').addEventListener('click', function () {
      simpanCatat().then(function () {
        pesan(entriCatat && (entriCatat.judul || entriCatat.isi) ? 'Tersimpan' : 'Belum ada yang ditulis');
      });
    });

    $('#note-cari').addEventListener('input', function () {
      /* Mengetik menembus folder, jadi jejak foldernya dilepas - kalau tidak,
         kepalanya menyebut folder yang isinya bukan yang sedang ditampilkan. */
      gambarNote();
    });
    $('#note-isi').addEventListener('click', function (ev) {
      var f = ev.target.closest('[data-note-folder]');
      if (f) {
        /* Selama mode pilih hidup, mengetuk folder berarti MEMILIHNYA - bukan
           membukanya. Tanpa ini, folder di halaman depan Storage tidak punya
           satu pun cara untuk dibereskan: yang bisa dipilih cuma isinya, dan
           isinya baru kelihatan sesudah foldernya dibuka satu-satu. */
        if (pilihNyala || jumlahPilih() || jumlahFolderPilih()) {
          alihPilihFolder(f.getAttribute('data-note-folder'));
          return;
        }
        batalPilih();
        noteFolder = f.getAttribute('data-note-folder');
        gambarNote(); global.scrollTo(0, 0); return;
      }
      /* Begitu ada yang dipilih, MENYENTUH KARTU BERARTI MEMILIH. Dua arti
         untuk satu ketukan adalah cara tercepat membuat orang ragu, jadi
         selama mode pilih hidup, membuka kartunya ditunda. */
      if (pilihNyala || jumlahPilih() || jumlahFolderPilih()) {
        var k = ev.target.closest('.kartu');
        if (k) { alihPilih(k.getAttribute('data-id')); return; }
      }
      klikHasil(ev);
    });

    /* MENAHAN satu kartu memulai memilih. Bukan kotak centang yang menganga
       sepanjang hari: memilih banyak itu pekerjaan sebulan sekali, dan kotak
       centang di tiap kartu adalah ongkos yang dibayar tiap hari untuk itu. */
    pasangTekanLama($('#note-isi'));
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

    /* Berganti bahasa MEMUAT ULANG halaman. Sumbernya memang Indonesia, jadi
       menggambar semuanya dari nol lebih jujur daripada menyimpan kamus
       terbalik yang harus dijaga tetap sepadan - dan kamus terbalik yang
       meleset sedikit meninggalkan satu kalimat Inggris di layar Indonesia,
       persis jenis kerusakan yang paling lama tidak ketahuan. */
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-bahasa]');
      if (!b) return;
      var kode = b.getAttribute('data-bahasa');
      if (kode === bahasaSaat()) return;
      setelanSaat.bahasa = kode;
      TSimpan.setel('bahasa', kode).then(function () { global.location.reload(); });
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
      /* Kamera memakai jalur yang sama persis dengan Gambar - bedanya cuma
         atribut capture, yang menyuruh HP membuka kamera alih-alih galeri.
         Sesudahnya sama: dikecilkan, disimpan lokal, dicadangkan belakangan. */
      else if (apa === 'kamera') $('#pilih-kamera').click();
      else if (apa === 'berkas') $('#pilih-berkas').click();
      else if (apa === 'daftar') setelDaftarNyala($('#petak-daftar').classList.contains('sembunyi'));
      else if (apa === 'link') setelLinkNyala($('#petak-link').classList.contains('sembunyi'));
    });

    $('#pilih-gambar').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) pasangBerkas(f, 'gambar');
      ev.target.value = '';
    });
    $('#pilih-kamera').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) pasangBerkas(f, 'gambar');
      ev.target.value = '';
    });
    $('#pilih-berkas').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) pasangBerkas(f, 'berkas');
      ev.target.value = '';
    });

    $('#tanya-pilih').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pilih]');
      if (!b) return;
      var j = tanyaPilihJalan;
      var nilai = b.getAttribute('data-pilih');
      tutupTanya();
      if (j) j(nilai);
    });
    $('#b-tanya-batal').addEventListener('click', tutupTanya);
    $('#b-tanya-ya').addEventListener('click', function () {
      var j = tanyaJalan;
      tutupTanya();
      if (j) j();
    });
    /* Menyentuh alasnya = batal. Dialog yang cuma bisa ditutup lewat satu
       tombol kecil terasa seperti jebakan. */
    $('#tanya').addEventListener('click', function (ev) {
      if (ev.target === $('#tanya')) tutupTanya();
    });

    $('#b-pilih-mulai').addEventListener('click', function () {
      mulaiPilih(!(pilihNyala || jumlahPilih()));
    });
    $('#b-pilih-batal').addEventListener('click', batalPilih);
    $('#b-pilih-buang').addEventListener('click', buangPilih);
    $('#b-pilih-gabung').addEventListener('click', function () {
      if (jumlahFolderPilih()) gabungFolder(); else gabungPilih();
    });
    $('#b-pilih-pindah').addEventListener('click', pindahPilih);

    $('#lihat').addEventListener('click', tutupLihat);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') tutupLihat();
    });
    $('#hasil-depan').addEventListener('click', function (ev) {
      if (pilihNyala || jumlahPilih()) {
        var k = ev.target.closest('.kartu');
        if (k) { alihPilih(k.getAttribute('data-id')); return; }
      }
      klikHasil(ev);
    });
    /* Hasil pencarian ikut bisa dipilih berbanyak, dan pintunya CUMA
       tekan-lama: tombol Pilih yang menganga di dok akan menagih tempat dari
       kotak yang dipakai puluhan kali sehari, untuk pekerjaan sebulan sekali. */
    pasangTekanLama($('#hasil-depan'));
    pasangGeser($('#hasil-depan'));
    pasangGeserPintu();
    pasangTinggiTampak();
    pasangSisanya();
  }

  /* Satu penangan untuk DUA wadah hasil - hasil di layar depan dan daftar di
     layar Note. Menyalinnya jadi dua berarti perbaikan di satu tempat diam-diam
     tidak sampai ke tempat lain, dan itu jenis bug yang paling lama tidak
     ketahuan. */
  /* MENAHAN satu kartu memulai memilih. Bukan kotak centang yang menganga
     sepanjang hari: memilih banyak itu pekerjaan sebulan sekali, dan kotak
     centang di tiap kartu adalah ongkos yang dibayar tiap hari untuk itu.
     Dipakai di Note DAN di Storage - satu penangan, bukan dua salinan. */
  function pasangTekanLama(akar) {
    if (!akar) return;
    var jam = null, mulaiKerja = null;
    var batal = function () { clearTimeout(jam); jam = null; };
    akar.addEventListener('pointerdown', function (ev) {
      /* FOLDER IKUT, bukan cuma kartu. Menahan itu SATU kebiasaan, bukan dua:
         yang menahan folder mengharapkan hal yang sama persis dengan yang
         menahan kartu. Foldernya dibaca DULU - baris folder itu sendiri sebuah
         tombol, jadi penjaga "jangan di atas tombol" di bawah akan menolaknya
         mentah-mentah kalau urutannya dibalik. */
      var f = ev.target.closest('[data-tulis-folder], [data-note-folder]');
      var k = f ? null : ev.target.closest('.kartu');
      if (!f && !k) return;
      if (!f && ev.target.closest('button, a')) return;
      var nama = f && (f.getAttribute('data-tulis-folder') ||
                       f.getAttribute('data-note-folder'));
      var id = k && k.getAttribute('data-id');
      mulaiKerja = f ? function () { alihPilihFolder(nama); }
                     : function () { alihPilih(id); };
      batal();
      jam = setTimeout(function () {
        jam = null;
        if (!pilihNyala && !jumlahPilih() && !jumlahFolderPilih()) {
          mulaiKerja();
          if (navigator.vibrate) navigator.vibrate(12);
        }
      }, 450);
    });
    ['pointerup', 'pointermove', 'pointercancel', 'pointerleave']
      .forEach(function (n) { akar.addEventListener(n, batal); });
  }

  function klikHasil(ev) {
    /* Gambarnya dibaca LEBIH DULU daripada kartunya: menyentuh gambar berarti
       "perbesar ini", bukan "buka layar tulisnya". Sisa kartunya tetap
       membuka layar tulis seperti biasa. */
    var gbr = ev.target.closest('img.kartu-gambar, .petak-satu img');
    if (gbr) {
      /* Petak memakai data-buka, kartu memakai data-id - dua penanda karena
         yang satu tombol dan yang lain artikel. Keduanya dicari di sini
         supaya gambarnya membesar dari mana pun dia disentuh. */
      var wadah = gbr.closest('[data-buka], [data-id]');
      var idG = wadah ? (wadah.getAttribute('data-buka') || wadah.getAttribute('data-id')) : '';
      var eG = null;
      semuaEntri.forEach(function (x) { if (x.id === idG) eG = x; });
      if (eG) { ev.stopPropagation(); lihatGambar(eG); return; }
    }
    var petak = ev.target.closest('[data-buka]');
    if (petak) { bukaKartu(petak.getAttribute('data-buka')); return; }
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
      setelTinggiKotak();
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

    if (ev.target.closest('[data-pin]')) { if (e) alihPin(e); return; }
    if (ev.target.closest('[data-salin]')) { if (e) salin(isiSalin(e)); return; }
    if (ev.target.closest('[data-sunting]')) { bukaKartu(id); return; }
    if (ev.target.closest('[data-pensiun]')) { if (e) pensiunkanKartu(e); return; }

    if (ev.target.closest('a')) return;   /* tautan dibuka, bukan kartunya */

    /* DI LAYAR NOTE, MENYENTUH KARTU BERARTI LANJUT MENULIS. Di layar hasil
       dan di Storage kamu sedang MEMINDAI - membuka rincian di tempat menjaga
       posisi gulirmu, dan itu benar di sana. Di sini kamu datang untuk
       menulis, dan pratinjau yang mengembang cuma satu ketukan yang berdiri di
       antara kamu dan tulisanmu sendiri. */
    if (layarSaat === 'l-tulis') { bukaKartu(id); return; }

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
      /* Kabarnya menyusul tiap huruf, bukan sesudah disimpan: yang menolong di
         sini justru melihat raknya berubah SEBELUM kamu berhenti mengetik. */
      gambarRuangCatat();
      gambarEkorCatat();
      tanda('menyimpan…');
      simpanTertunda();
    });
    $('#b-salin-catat').addEventListener('click', function () {
      var judul = $('#catat-judul').value.trim();
      var isi = $('#catat-isi').value;
      if (!judul && !isi.trim()) { pesan('Belum ada yang ditulis'); return; }
      salin(judul && isi.trim() ? judul + '\n\n' + isi : (judul || isi));
    });
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
    /* Taglinenya sengaja TIDAK ikut di sini. Slogan di layar yang dibuka
       puluhan kali sehari berhenti dibaca setelah hari kedua, dan yang tersisa
       cuma dua baris yang memakan tempat. Yang tinggal cuma janji yang
       benar-benar perlu diketahui: ini tersimpan tanpa jaringan. */
    $('#kaki-utama').textContent = 'Tersimpan langsung di perangkat, tanpa menunggu jaringan.';

    pasang();

    daftarSW();

    TSimpan.semuaSetelan().then(function (s) {
      setelanSaat = s || {};
      /* Ukuran petak yang dipilih ikut dibawa ke pembukaan berikutnya:
         kebiasaan orang menetap di satu ukuran, dan memilihnya lagi tiap kali
         adalah keputusan berulang tanpa guna. */
      if (setelanSaat.gayaGambar) gayaGambar = setelanSaat.gayaGambar;
      /* BAHASA DIPASANG SEBELUM APA PUN DIGAMBAR. Kalau sesudah, layarnya
         berkedip dari Indonesia ke Inggris tiap kali aplikasinya dibuka - dan
         kedipan itu terbaca sebagai aplikasi yang salah pasang. */
      TBahasa.pilih(setelanSaat.bahasa || 'en');
      TBahasa.amati();
      TBahasa.pasang();
      /* Obrolan dimuat SEBELUM apa pun digambar: riwayat yang muncul sedetik
         sesudah layarnya terbuka terbaca sebagai obrolan yang sempat hilang. */
      muatObrolan(setelanSaat);
      muatEkor(setelanSaat);
      muatFolder(setelanSaat);
      /* Temanya dipasang SEBELUM apa pun digambar - kalau sesudah, warnanya
         berkedip dari teal ke pilihanmu tiap kali aplikasinya dibuka. */
      temaSaat = setelanSaat.tema || 'teal';
      temaSendiri = setelanSaat.temaSendiri || '';
      pasangTema(temaSaat, temaSendiri);
      return muatSemua();
    }).then(function () {
      return ambilBagikan();
    }).then(function () {
      /* Minta status penyimpanan permanen sekali di awal: tanpa itu browser
         boleh membuang seluruh timbunan saat penyimpanan HP sesak, diam-diam. */
      setelTinggiKotak();
      mintaPermanen();
      perbaruiJumlahTugas();

      /* Layar pemasangan cuma muncul sekali, dan hanya kalau kotaknya masih
         benar-benar kosong. Kalau sudah ada isinya - misalnya masuk lewat
         tombol Bagikan - jangan pernah menghalangi jalan masuk. */
      if (!sudahDipasang() && !semuaEntri.length && !$('#kotak').value) {
        gambarMulai();
        tampilkanLayar('l-mulai');
      }

      /* Token Google dihangatkan di latar, sebelum ada yang diketuk. Tokennya
         tidak pernah disimpan ke disk, jadi tiap kali halaman dimuat harganya
         harus dibayar sekali - dan yang membayarnya jangan sampai klik pertama
         pemakainya, karena galat di ketukan pertama terbaca sebagai aplikasi
         rusak. Boleh gagal, dan gagalnya diam. */
      TAwan.hangatkan(setelanSaat);

      /* Baris gudang tersering digambar sekali di awal - kotaknya masih kosong,
         dan justru itu keadaan yang dilayaninya. */
      gambarCipRuang();
      gambarCipSaring();

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
    tutupLaciUji: tutupLaci,
    muatUlangUji: muatSemua,
    jenisSaringUji: function () { return JENIS_SARING; },
    /* Cuma untuk uji: setelan yang HIDUP di memori, bukan salinannya - menulis
       ke basis data saja tidak mengubah apa yang sedang dipakai layar. */
    setelanUji: function () { return setelanSaat; },
    setelModeAIUji: setelModeAI,
    kirimAIUji: kirimAI,
    riwayatAIUji: function () { return riwayatAI; },
    dropObrolanUji: dropObrolan,
    jenisEfektifUji: jenisEfektif,
    semuaEntri: function () { return semuaEntri; }
  };
})(window);
