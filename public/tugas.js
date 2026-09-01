/* ============================================================================
   Tugas — to-do yang berdiri sendiri
   ============================================================================
   Kenapa layarnya BEDA SENDIRI, bukan menempel di pencarian:

   Catatan dan tugas dilihat dengan pertanyaan yang berbeda. Catatan ditanya
   "di mana ya yang dulu itu" - jawabannya pencarian. Tugas ditanya "apa yang
   harus kukerjakan sekarang" - jawabannya daftar yang urut sendiri. Satu
   layar yang melayani dua pertanyaan itu akan buruk untuk dua-duanya.

   DAFTAR GANDA, TAPI TIDAK PERNAH WAJIB.
   Di Microsoft To Do, tiap tugas baru menuntut satu keputusan lebih dulu:
   "masuk daftar mana?". Keputusan berulang itu ongkos yang mahal di sini.
   Tapi membuang daftar sama sekali juga salah - memisahkan urusan kantor dari
   urusan rumah memang menolong, dan menolaknya cuma karena aturan berarti
   mengorbankan yang berguna demi kemurnian.

   Jalan tengahnya: daftar itu keyword yang sudah ada. Kosong artinya tidak
   masuk daftar mana pun, dan itu keadaan yang sah - jadi jalan masuknya tetap
   nol keputusan. Daftarnya lahir sendiri begitu satu tugas diberi keyword;
   tidak ada layar "buat daftar baru".

   Disimpan sebagai entri biasa berjenis 'tugas', bukan di tempat sendiri.
   Sekali putuskan begitu, tugas ikut naik ke cadangan Drive, ikut ditemukan
   pencarian, dan ikut dinilai AI - tanpa satu baris pun kode tambahan.

   Yang dipakai dari Microsoft To Do, karena memang terbukti:
     centang, bintang penting, Hari Ini, tenggat, ulang, langkah, catatan.
   Yang ditinggalkan: penugasan ke orang lain, tema, dan pengingat berbunyi -
   yang terakhir butuh izin notifikasi, dan izin yang diminta terlalu dini
   membuat orang menolak seluruh aplikasinya.
   ============================================================================ */
(function (global) {
  'use strict';

  /* Urutannya bukan selera: Semua duluan karena itu yang dibuka, lalu
     penyempitan dari yang paling sering ke yang paling jarang. */
  var SARING = [
    ['semua', 'Semua'], ['hariini', 'Hari ini'],
    ['penting', 'Penting'], ['ulang', 'Berulang'], ['selesai', 'Selesai']
  ];

  /* BAWAANNYA "SEMUA", bukan "Hari ini". Tugas tanpa tenggat itu sah - itu
     justru bentuk yang paling sering - dan kalau layar ini dibuka langsung di
     "Hari ini", semua yang tanpa tanggal tidak kelihatan sama sekali. Daftar
     yang menyembunyikan sebagian besar isinya waktu dibuka akan berhenti
     dipercaya, lalu berhenti dibuka. */
  var saringSaat = 'semua';
  var daftarSaat = '';      /* '' = semua daftar */
  var terbukaId = '';
  var alat = null;          /* dipinjamkan alur.js: $, H, pesan, muat, dll */

  function pasang(kait) { alat = kait; }

  /* ------------------------------------------------------------- keadaan */

  function tugasBaru(teks) {
    var t = Date.now();
    return {
      id: 't_' + t + '_' + Math.random().toString(36).slice(2, 6),
      jenis: 'tugas',
      judul: String(teks || '').trim().slice(0, 200),
      judulManual: true, isi: '', daftar: [],
      kategori: '', label: [], elemen: [],
      berkasId: null, driveId: null, thumb: '',
      namaBerkas: '', tipeBerkas: '', ukuran: 0,
      dibuat: t, diubah: t, dipakai: 0,
      diLabeliAI: false, diBacaAI: false,
      rahasia: false, elemenTerkunci: '',
      /* Kolomnya sendiri, semuanya ditambahkan di ekor supaya baris cadangan
         yang sudah ada tidak bergeser. */
      selesai: false, selesaiPada: 0, penting: false, hariIni: 0,
      tenggat: 0, ulang: '',
      /* Bawaannya SUDAH DIBACA. Yang belum dibaca cuma yang masuk lewat jalur
         lain - dari layar Drop - dan jalur itu yang menyetelnya sendiri.
         Kalau bawaannya "belum", tugas yang barusan kamu ketik sendiri lahir
         bertanda tebal, dan tanda yang menyala untuk hal yang jelas-jelas kamu
         tahu berhenti berarti apa-apa. */
      dibaca: true,
      pensiun: false, dihapus: false, riwayat: []
    };
  }

  /* Tugas lama tidak punya kolom ini sama sekali, dan mereka TIDAK boleh
     tiba-tiba menyala semua di pembukaan berikutnya. Jadi yang dihitung belum
     dibaca cuma yang tegas bernilai false. */
  function belumDibaca(e) { return e.dibaca === false; }

  function hariMulai(ts) {
    var d = new Date(ts || Date.now());
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function semuaTugas() {
    return alat.entri().filter(function (e) {
      return e.jenis === 'tugas' && !e.dihapus && !e.pensiun;
    });
  }

  /* Daftar tidak pernah dibuat - dia lahir dari keyword yang dipakai, dan mati
     sendiri saat tugas terakhirnya selesai. Tidak ada daftar kosong yang harus
     dirapikan nanti. */
  function daftarYangAda() {
    var hitung = {};
    semuaTugas().forEach(function (e) {
      if (!e.selesai && e.kategori) hitung[e.kategori] = (hitung[e.kategori] || 0) + 1;
    });
    return Object.keys(hitung).sort(function (a, b) {
      if (hitung[b] !== hitung[a]) return hitung[b] - hitung[a];
      return a.localeCompare(b);
    }).map(function (k) { return { nama: k, jumlah: hitung[k] }; });
  }

  /* "Hari ini" itu penanda harian, bukan penanda permanen. Kalau tidak
     dibersihkan tiap hari, daftarnya menumpuk jadi daftar kedua yang isinya
     sama - dan kehilangan seluruh gunanya sebagai "yang kupilih untuk hari
     ini". Microsoft membersihkannya tiap pagi, dan itu benar. */
  function ikutHariIni(e) {
    return e.hariIni === hariMulai(Date.now());
  }

  function tertunggak(e) {
    return !e.selesai && e.tenggat && e.tenggat < hariMulai(Date.now());
  }

  function tersaring() {
    var semua = semuaTugas();
    if (saringSaat === 'selesai') {
      return semua.filter(function (e) { return e.selesai; })
                  .sort(function (a, b) { return (b.selesaiPada || 0) - (a.selesaiPada || 0); });
    }
    var pakai = semua.filter(function (e) { return !e.selesai; });
    if (daftarSaat) {
      pakai = pakai.filter(function (e) { return e.kategori === daftarSaat; });
    }
    if (saringSaat === 'hariini') {
      pakai = pakai.filter(function (e) {
        return ikutHariIni(e) || tertunggak(e) || (e.tenggat && e.tenggat <= hariMulai(Date.now()));
      });
    } else if (saringSaat === 'penting') {
      pakai = pakai.filter(function (e) { return e.penting; });
    } else if (saringSaat === 'ulang') {
      pakai = pakai.filter(function (e) { return !!e.ulang; });
    }

    /* DUA URUTAN, DAN PEMBAGINYA JELAS.

       "Semua" itu riwayat masuk, jadi urutannya YANG TERBARU DI ATAS - titik.
       Pertanyaan yang paling sering ditanyakan di layar ini adalah "yang
       barusan kudrop mana", dan urutan berprioritas menjawabnya dengan
       melempar tugas baru ke tengah daftar, ke tempat yang tidak bisa ditebak.
       Urutan yang tidak bisa ditebak sama saja dengan tidak berurut.

       Yang mendesak punya rumahnya sendiri: "Hari ini" sudah mengumpulkan yang
       tertunggak dan yang jatuh tempo. Di sana - dan di Penting dan Berulang -
       urutan berprioritas memang yang benar: tertunggak dulu, lalu yang
       penting, lalu tenggat terdekat. */
    if (saringSaat === 'semua' || !saringSaat) {
      return pakai.sort(function (a, b) { return (b.dibuat || 0) - (a.dibuat || 0); });
    }
    return pakai.sort(function (a, b) {
      var ta = tertunggak(a) ? 0 : 1, tb = tertunggak(b) ? 0 : 1;
      if (ta !== tb) return ta - tb;
      if (!!b.penting !== !!a.penting) return b.penting ? 1 : -1;
      var da = a.tenggat || Infinity, db = b.tenggat || Infinity;
      if (da !== db) return da - db;
      return (b.dibuat || 0) - (a.dibuat || 0);
    });
  }

  /* ===================== TENGGAT DARI KALIMAT =====================
     Yang paling menolong di aplikasi tugas bukan tombol tanggal - itu masih
     satu ketukan lagi, dan ketukan itu ditagih tiap kali menambah tugas.
     Todoist dan TickTick sudah membuktikan jalan yang lebih murah: tanggalnya
     DIKETIK DI DALAM KALIMATNYA, lalu dicabut dari judulnya.

     "bayar sewa ruko besok" -> tugas "Bayar sewa ruko", tenggat besok.

     Yang ditangkap sengaja cuma bentuk yang benar-benar dipakai sehari-hari.
     Penanggalan pintar yang menebak terlalu jauh lebih menakutkan daripada
     menolong: satu salah tebak, dan orangnya berhenti memercayai seluruh
     isian ini.

     DUA BAHASA SEKALIGUS, BUKAN MENGIKUTI SETELAN. Setelan bahasa mengubah
     yang DIBACA mata; yang diketik jari tidak ikut berganti sekaligus - orang
     yang memakai antarmuka Inggris tetap mengetik "besok" waktu buru-buru,
     dan sebaliknya. Menyambungkan pembaca ini ke setelan berarti separuh
     kebiasaan mengetiknya mati tiap kali setelannya digeser, tanpa satu pun
     pesan yang menjelaskan kenapa. Jadi keduanya selalu dikenali. */

  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  /* Nama hari Inggris ditulis LENGKAP saja. Singkatan tiga huruf ("sat",
     "wed", "mon", "sun") adalah kata biasa dalam kalimat Inggris, dan tugas
     "get the sun shade" yang tiba-tiba bertenggat Minggu depan adalah persis
     salah tebak yang membuat orang berhenti percaya. Sisi Indonesianya juga
     tidak pernah punya singkatan hari. */
  var HARI_CARI = [
    ['minggu', 'sunday'], ['senin', 'monday'], ['selasa', 'tuesday'],
    ['rabu', 'wednesday'], ['kamis', 'thursday'], ['jumat', 'friday'],
    ['sabtu', 'saturday']
  ];

  function tambahHari(n) { return hariMulai(Date.now() + n * 86400000); }

  /* Hari bernama selalu yang AKAN DATANG. "senin" yang diketik hari Senin
     berarti Senin depan, bukan hari ini - kalau maksudnya hari ini, yang
     diketik orang adalah "hari ini". */
  function hariBerikut(indeks) {
    var kini = new Date().getDay();
    var maju = (indeks - kini + 7) % 7;
    return tambahHari(maju === 0 ? 7 : maju);
  }

  /* Tanggal yang sudah lewat berarti bulan depan - orang menulis "tgl 3" di
     tanggal 28 dengan maksud bulan berikutnya, bukan 25 hari yang lalu. */
  function tanggalBulanIni(angka) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var n = Number(angka);
    if (n < d.getDate()) d.setMonth(d.getMonth() + 1);
    d.setDate(n);
    return d.getTime();
  }

  function bacaTenggat(teks) {
    var t = ' ' + String(teks || '') + ' ';
    var hasil = { tenggat: 0, teks: String(teks || '') };

    function kena(pola, hitung) {
      if (hasil.tenggat) return;
      var m = t.match(pola);
      if (!m) return;
      hasil.tenggat = hitung(m);
      hasil.teks = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length))
                     .replace(/\s+/g, ' ').trim();
    }

    /* "tonight" ikut hari ini: yang menulisnya sedang memikirkan malam nanti,
       dan aplikasi ini tidak menyimpan jam - cuma hari. */
    kena(/\s(hari ini|hr ini|today|tonight)\s/i, function () { return tambahHari(0); });
    /* Inggris tidak punya satu kata untuk "lusa", jadi bentuk panjangnya
       dipakai apa adanya - dan DIBACA DULUAN. "day after tomorrow" berisi kata
       "tomorrow" utuh; kalau urutannya dibalik, lusa selamanya jadi besok dan
       sisa judulnya "day after". */
    kena(/\s(lusa|day after tomorrow)\s/i, function () { return tambahHari(2); });
    kena(/\s(besok|bsk|besuk|tomorrow|tmr|tmrw)\s/i, function () { return tambahHari(1); });
    /* "in 3 days" dan "3 days" sekaligus - awalan "in" opsional supaya
       "deadline 3 days" ikut terbaca. */
    kena(/\s(\d{1,3})\s?(hari|hr)\s?(lagi|kedepan|ke depan)\s/i,
         function (m) { return tambahHari(Number(m[1])); });
    kena(/\s(?:in\s)?(\d{1,3})\s?days?\s/i,
         function (m) { return tambahHari(Number(m[1])); });
    kena(/\s(?:(minggu|pekan)\s?depan|next\s?week)\s/i, function () { return tambahHari(7); });
    kena(/\s(?:bulan\s?depan|next\s?month)\s/i, function () {
      var d = new Date(); d.setMonth(d.getMonth() + 1); return hariMulai(d.getTime());
    });
    /* Tanggal telanjang. Sisi Inggrisnya WAJIB berakhiran urutan (25th, 3rd):
       "on 25" saja terlalu dekat dengan angka biasa - "pay 25 sacks of cement"
       bukan tenggat tanggal 25. Kata "on" boleh ada boleh tidak. */
    kena(/\s(?:tgl|tanggal)\s?(\d{1,2})\s/i, function (m) { return tanggalBulanIni(m[1]); });
    kena(/\s(?:on\s)?(?:the\s)?(\d{1,2})(?:st|nd|rd|th)\s/i,
         function (m) { return tanggalBulanIni(m[1]); });
    for (var i = 0; i < HARI_CARI.length; i++) {
      (function (idx) {
        kena(new RegExp('\\s(?:' + HARI_CARI[idx].join('|') + ')\\s', 'i'),
             function () { return hariBerikut(idx); });
      })(i);
    }
    return hasil;
  }

  /* -------------------------------------------------------------- tulisan */

  function tulisTenggat(ts) {
    if (!ts) return '';
    var hari = hariMulai(Date.now());
    var beda = Math.round((hariMulai(ts) - hari) / 86400000);
    if (beda === 0) return 'Hari ini';
    if (beda === 1) return 'Besok';
    if (beda === -1) return 'Kemarin';
    if (beda < 0) return Math.abs(beda) + ' hari lewat';
    if (beda < 7) return HARI[new Date(ts).getDay()];
    return TOtak.tanggalPendek(ts);
  }

  /* --------------------------------------------------------------- simpan */

  function simpan(e) {
    e.diubah = Date.now();
    return TSimpan.taruh(e).then(function () { alat.segarkan(e); });
  }

  function tambah(teks) {
    if (!String(teks || '').trim()) return Promise.resolve(null);
    var baca = bacaTenggat(teks);
    var e = tugasBaru(baca.teks || teks);
    if (baca.tenggat) e.tenggat = baca.tenggat;
    /* Ditambah sambil berdiri di layar Berulang berarti memang berulang -
       menanyakan iramanya lagi sesudahnya adalah menagih jawaban yang sudah
       diberikan. Bulanan yang dipilih duluan karena itu yang paling sering:
       tagihan, sewa, laporan. Tinggal diketuk kalau ternyata bukan. */
    if (saringSaat === 'ulang') {
      e.ulang = 'bulanan';
      if (!e.tenggat) e.tenggat = hariMulai(Date.now());
    }
    /* Ditambah dari layar "Hari ini" berarti memang untuk hari ini. Menanyakan
       ulang setelah orangnya sudah berdiri di layar itu adalah pertanyaan yang
       jawabannya sudah dia berikan. */
    if (saringSaat === 'hariini') e.hariIni = hariMulai(Date.now());
    if (saringSaat === 'penting') e.penting = true;
    /* Ditambah sambil melihat satu daftar berarti masuk daftar itu. Menanyakan
       ulang setelah orangnya sudah berdiri di sana adalah pertanyaan yang
       jawabannya sudah dia berikan. */
    if (daftarSaat) e.kategori = daftarSaat;
    return simpan(e).then(function () { return e; });
  }

  /* JALUR MASUK KEDUA: dari layar Drop, lewat cip Todo.

     Pembedanya ACTION, bukan tenggat. "Uji cortex ke staff" itu tugas walau
     tidak punya tanggal, dan memaksanya punya tanggal cuma melahirkan tanggal
     kamuflase - besok penuh barang yang sebenarnya tidak harus besok, dan
     seminggu kemudian daftarnya berhenti dipercaya. Jadi tenggat, prioritas,
     dan pengingat itu ATRIBUT yang ditambahkan belakangan di dalam daftarnya,
     bukan syarat masuk.

     Bedanya dengan tambah(): yang ini tidak mewarisi keadaan layar To Do.
     "Hari ini" dan "penting" itu jawaban yang diberikan orangnya dengan berdiri
     di layar itu; dari layar Drop dia tidak pernah menjawabnya, jadi tidak
     boleh dijawabkan. Yang diwarisi cuma gudangnya - dan itu memang sudah dia
     tulis sendiri di kotaknya. */
  function tambahDariDrop(teks, kategori, langkah) {
    if (!String(teks || '').trim()) return Promise.resolve(null);
    var baca = bacaTenggat(teks);
    var e = tugasBaru(baca.teks || teks);
    /* BELUM DIBACA. Yang masuk lewat layar Drop dijatuhkan dalam tiga detik,
       sering sambil mengerjakan hal lain, dan tidak pernah dilihat lagi di
       layar To Do sampai kamu sengaja ke sana. Tanpa penanda, dia mendarat di
       tengah puluhan baris yang rupanya sama persis - dan yang barusan masuk
       jadi yang paling sulit ditemukan. */
    e.dibaca = false;
    /* Daftar yang barusan diketik masuk UTUH sebagai langkah. Kalau judulnya
       kebetulan sama dengan baris pertama - dan itu yang terjadi kalau kotak
       dropnya kosong - baris itu tidak ditulis dua kali. */
    if (langkah && langkah.length) {
      var judulKecil = String(e.judul || '').trim().toLowerCase();
      e.daftar = langkah.filter(function (x, i) {
        return !(i === 0 && String(x.teks || '').trim().toLowerCase() === judulKecil);
      });
    }
    /* Tanggal yang KEBETULAN ditulis tetap dibaca - mengabaikan "besok" yang
       sudah terlanjur diketik bukan kesederhanaan, itu pura-pura tidak lihat. */
    if (baca.tenggat) e.tenggat = baca.tenggat;
    if (kategori) e.kategori = kategori;
    return simpan(e).then(function () { return e; });
  }

  /* Menyelesaikan tugas berulang tidak mencoretnya - dia melahirkan tugas
     berikutnya. Kalau cuma dicoret, tiap minggu kamu harus mengetiknya lagi,
     dan itu pekerjaan yang justru mau dihapus. */
  function selesaikan(e) {
    if (e.selesai) {
      e.selesai = false;
      e.selesaiPada = 0;
      return simpan(e);
    }
    var lanjutan = null;
    if (e.ulang) {
      lanjutan = tugasBaru(e.judul);
      lanjutan.isi = e.isi;
      lanjutan.kategori = e.kategori;
      lanjutan.penting = e.penting;
      lanjutan.ulang = e.ulang;
      lanjutan.daftar = (e.daftar || []).map(function (b) {
        return { teks: b.teks, selesai: false };
      });
      lanjutan.tenggat = tenggatBerikut(e);
    }
    e.selesai = true;
    e.selesaiPada = Date.now();
    e.hariIni = 0;
    return simpan(e).then(function () {
      return lanjutan ? simpan(lanjutan) : null;
    });
  }

  function tenggatBerikut(e) {
    var d = new Date(e.tenggat || Date.now());
    if (e.ulang === 'harian') d.setDate(d.getDate() + 1);
    else if (e.ulang === 'mingguan') d.setDate(d.getDate() + 7);
    else if (e.ulang === 'bulanan') d.setMonth(d.getMonth() + 1);
    return hariMulai(d.getTime());
  }

  /* -------------------------------------------------------------- gambar */

  function gambar() {
    var H = alat.H;
    var $ = alat.$;

    $('#tugas-saring').innerHTML = SARING.map(function (s) {
      return '<button class="cip' + (saringSaat === s[0] ? ' nyala' : '') +
             '" data-tsaring="' + s[0] + '">' + H(s[1]) + '</button>';
    }).join('');

    /* BARIS RAK DIBUANG. Dia lahir dari keyword yang kebetulan dipakai, jadi
       isinya satu-dua rak berisi satu tugas - baris kedua yang harus dilewati
       tiap kali layar ini dibuka, untuk menyaring sesuatu yang seluruhnya
       sudah kelihatan. Raknya sendiri tetap ada di tiap tugas, dan tetap bisa
       dicari; yang dibuang cuma barisnya. */
    $('#tugas-daftar-rak').innerHTML = '';

    var daftar = tersaring();
    var belum = semuaTugas().filter(function (e) { return !e.selesai; }).length;
    $('#tugas-ket').textContent = belum ? belum + ' belum selesai' : 'Tidak ada yang tertunda';

    if (!daftar.length) {
      $('#tugas-daftar').innerHTML = '<div class="kosong">' +
        (saringSaat === 'selesai' ? 'Belum ada yang diselesaikan.'
          /* Apa yang dikumpulkan "Hari ini" disebutkan di sini, karena
             namanya sendiri punya dua bacaan yang sama masuk akal - yang
             tenggatnya hari ini, atau yang dibuat hari ini. Yang benar yang
             pertama, dan menyebutkannya sekali di layar yang kosong jauh lebih
             murah daripada membiarkan orangnya menebak tiap pagi. */
          : saringSaat === 'hariini' ? 'Tidak ada yang jatuh tempo hari ini.<br>' +
              'Yang muncul di sini: tenggatnya hari ini atau sudah lewat, plus yang kamu tandai sendiri untuk hari ini.'
          : 'Belum ada tugas.') + '</div>';
      return;
    }

    /* SATU DAFTAR, TIDAK DIBAGI DUA LAGI.

       Dulu yang berulang dipisah ke bagian sendiri di BAWAH, supaya daftarnya
       tidak terlihat "tidak pernah berkurang". Alasannya masih benar - tapi
       pemisahan itu lahir SEBELUM Berulang punya saringannya sendiri di baris
       atas. Sekarang dia punya, dan dua tempat untuk satu hal yang sama itu
       satu tempat terlalu banyak: yang di bawah selalu tertimbun tugas sekali
       jalan, jadi bagian yang gunanya memperlihatkan justru yang paling jarang
       terlihat.

       Yang tinggal: satu daftar, urut seperti yang sudah diputuskan di
       tersaring(). Yang berulang tetap ditandai di bulatannya sendiri. */
    $('#tugas-daftar').innerHTML = daftar.map(function (e) { return barisHtml(e, H); }).join('');
  }

  /* IRAMA DIPILIH DI LAYARNYA SENDIRI, bukan di dalam rincian tiap tugas.
     Di sana dia satu bagian dari tujuh yang hampir tidak pernah disentuh; di
     sini dia satu-satunya pertanyaan yang tersisa, dan jawabannya satu ketukan.

     Ditulis di bawah judulnya, bukan di balik "Lainnya": begitu kamu berdiri
     di layar Berulang, mengubah iramanya justru pekerjaan yang paling mungkin
     kamu datangi. */
  function iramaHtml(e, H) {
    var pilih = function (nilai, label) {
      return '<button class="cip' + (e.ulang === nilai ? ' nyala' : '') +
             '" data-ulang="' + nilai + '">' + H(label) + '</button>';
    };
    return '<div class="cip-baris irama">' +
      pilih('harian', 'Harian') + pilih('mingguan', 'Mingguan') +
      pilih('bulanan', 'Bulanan') + pilih('', 'Berhenti') +
    '</div>';
  }

  function barisHtml(e, H) {
    var b = [];
    var langkah = e.daftar || [];
    var kelar = langkah.filter(function (x) { return x.selesai; }).length;

    var ket = [];
    if (e.tenggat) {
      /* Tiga keadaan, tiga warna - dan cuma tiga. Tertunggak merah, hari ini
         beraksen, sisanya redup. Kalau tiap tanggal punya warnanya sendiri,
         tidak ada yang menonjol lagi dan yang tertunggak ikut tenggelam. */
      var kelas = tertunggak(e) ? ' lewat'
                : (e.tenggat <= hariMulai(Date.now()) + 86400000 ? ' dekat' : '');
      ket.push('<span class="tugas-tenggat' + kelas + '">' +
               '<svg viewBox="0 0 24 24" class="ik"><rect x="3" y="5" width="18" height="16" rx="2"/>' +
               '<path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/></svg>' +
               H(tulisTenggat(e.tenggat)) + '</span>');
    }
    /* Panah berulang TIDAK ditulis dua kali. Bulatannya sendiri sudah membawa
       panah melingkar, dan mengulanginya di baris keterangan melahirkan baris
       kedua yang isinya cuma satu ikon - persis kepadatan yang mau dibuang. */
    if (langkah.length) ket.push('<span>' + kelar + '/' + langkah.length + ' langkah</span>');
    if (e.kategori) ket.push('<span>#' + H(e.kategori) + '</span>');


    /* BULATAN YANG BERULANG BUKAN KOTAK CENTANG KOSONG.

       Bulatan kosong berjanji "centang aku, aku hilang" - dan itu bohong untuk
       tugas berulang: mencentangnya tidak menghapusnya, dia lahir lagi dengan
       tanggal berikutnya. Todoist dan Things menyelesaikannya dengan cara yang
       sama: bulatannya diberi panah melingkar, jadi bentuknya sendiri sudah
       mengatakan "ini kembali lagi". Tetap bisa dicentang, dan artinya tetap
       "yang ini beres" - yang berubah cuma janjinya. */
    var isiCentang = e.selesai
      ? '<svg viewBox="0 0 24 24" class="ik"><path d="M5 12.5l5 5L19 7"/></svg>'
      : (e.ulang
          ? '<svg viewBox="0 0 24 24" class="ik ulang"><path d="M17 9a6 6 0 0 0-10.5-3L5 7.5"/>' +
            '<path d="M5 4v3.5h3.5"/><path d="M7 15a6 6 0 0 0 10.5 3L19 16.5"/>' +
            '<path d="M19 20v-3.5h-3.5"/></svg>'
          : '');

    b.push('<div class="tugas-atas">' +
      '<button class="tugas-centang' + (e.selesai ? ' kena' : '') +
        (!e.selesai && e.ulang ? ' berulang' : '') + '" data-centang aria-label="Selesai">' +
        isiCentang +
      '</button>' +
      '<div class="tugas-teks">' +
        '<div class="tugas-baris1">' +
          '<div class="tugas-judul" data-asli>' + H(e.judul || '(tanpa judul)') + '</div>' +
          /* Tanggal dibuat naik ke BARIS JUDUL, tidak lagi punya barisnya
             sendiri. Dulu dia selalu ada, jadi tiap tugas - termasuk yang cuma
             satu kalimat tanpa tenggat - memakan dua baris penuh, dan daftar
             yang barisnya setinggi dua baris berhenti bisa dipindai sekali
             lihat. Yang dipakai tanggal DIBUAT, bukan diubah: yang menolong di
             sini "sudah berapa lama ini menganggur", dan mencentang satu
             langkah tidak boleh membuat tugas lama tampak baru. */
          '<span class="tugas-dibuat">' + H(TOtak.waktuRingkas(e.dibuat)) + '</span>' +
        '</div>' +
        /* Baris kedua cuma lahir kalau memang ada isinya. */
        (ket.length ? '<div class="tugas-ket">' +
          ket.join('<span class="titik-pisah">·</span>') + '</div>' : '') +
      '</div>' +
      '<button class="tugas-bintang' + (e.penting ? ' nyala' : '') + '" data-penting aria-label="Penting">' +
        '<svg viewBox="0 0 24 24" class="ik"><path d="M12 3l2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L12 17l-5.6 3 1.4-6.2L3 9.5l6.4-.7z"/></svg>' +
      '</button></div>');

    if (saringSaat === 'ulang') b.push(iramaHtml(e, H));
    if (terbukaId === e.id) b.push(rinciHtml(e, H));

    return '<article class="tugas' + (e.selesai ? ' kelar' : '') +
           (belumDibaca(e) ? ' belum' : '') +
           (terbukaId === e.id ? ' terbuka' : '') + '" data-id="' + H(e.id) + '">' +
           b.join('') + '</article>';
  }

  function rinciHtml(e, H) {
    var hari = hariMulai(Date.now());
    var cip = function (nilai, label, nyala) {
      return '<button class="cip' + (nyala ? ' nyala' : '') + '" data-tenggat="' + nilai + '">' +
             H(label) + '</button>';
    };
    var ulangCip = function (nilai, label) {
      return '<button class="cip' + (e.ulang === nilai ? ' nyala' : '') +
             '" data-ulang="' + nilai + '">' + H(label) + '</button>';
    };

    /* YANG TERBUKA DULUAN CUMA YANG DIPAKAI, dan yang dipakai cuma tenggat.

       Dulu membuka satu tugas menurunkan tujuh bagian sekaligus - langkah,
       kapan, tanggal, ulang, hari ini, daftar, catatan - dan enam di antaranya
       hampir tidak pernah disentuh. Layar penuh untuk satu keputusan yang
       sebenarnya satu ketukan. Sisanya pindah ke balik "Lainnya", dan yang
       tidak pernah dibuka tidak pernah memakan tempat.

       ULANG DIBUANG DARI SINI seluruhnya: dia sudah punya tempatnya sendiri -
       bagian Berulang di daftarnya, dan tombol tambahnya di sana. */
    var adaLain = (e.daftar || []).length || e.kategori || (e.isi || '').trim() || ikutHariIni(e);

    return '<div class="tugas-rinci">' +
      '<div class="cip-baris">' +
        cip(hari, 'Hari ini', e.tenggat === hari) +
        cip(hari + 86400000, 'Besok', e.tenggat === hari + 86400000) +
        cip(hari + 7 * 86400000, 'Pekan depan', e.tenggat === hari + 7 * 86400000) +
        cip(0, 'Tanpa tenggat', !e.tenggat) +
        '<button class="cip" data-tanggal-buka>Tanggal…</button>' +
      '</div>' +
      '<input class="tugas-input kecil sembunyi" type="date" data-tanggal value="' +
        (e.tenggat ? new Date(e.tenggat).toISOString().slice(0, 10) : '') + '">' +

      '<button class="tugas-lain" data-lain>' +
        '<span>Lainnya</span>' +
        '<svg viewBox="0 0 24 24" class="ik"><path d="M6 9l6 6 6-6"/></svg></button>' +

      '<div class="tugas-lain-isi' + (adaLain ? '' : ' sembunyi') + '">' +
        '<div class="tugas-label">Langkah</div>' +
        '<div class="tugas-langkah" id="langkah-' + H(e.id) + '">' +
          (e.daftar || []).map(function (x, i) {
            return '<div class="langkah-baris">' +
              '<button class="tugas-centang kecil' + (x.selesai ? ' kena' : '') + '" data-langkah="' + i + '">' +
                (x.selesai ? '<svg viewBox="0 0 24 24" class="ik"><path d="M5 12.5l5 5L19 7"/></svg>' : '') +
              '</button><span>' + H(x.teks) + '</span>' +
              '<button class="langkah-buang" data-buang-langkah="' + i + '" aria-label="Buang langkah">' +
                '<svg viewBox="0 0 24 24" class="ik"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button></div>';
          }).join('') +
        '</div>' +
        '<input class="tugas-input kecil" data-langkah-baru placeholder="+ langkah">' +

        '<div class="cip-baris">' +
          '<button class="cip' + (ikutHariIni(e) ? ' nyala' : '') + '" data-hariini>' +
            (ikutHariIni(e) ? 'Ada di Hari ini' : 'Tambahkan ke Hari ini') + '</button>' +
          ulangCip('', 'Tidak berulang') +
        '</div>' +

        '<div class="tugas-label">Daftar</div>' +
        '<input class="tugas-input kecil" data-rak value="' + H(e.kategori || '') +
          '" placeholder="kosongkan kalau tidak perlu">' +

        '<div class="tugas-label">Catatan</div>' +
        '<textarea class="tugas-input catatan" data-catatan placeholder="Catatan kecil…">' +
          H(e.isi || '') + '</textarea>' +

        '<button class="set-tbl bahaya" data-buang-tugas>Buang tugas ini</button>' +
      '</div>' +
    '</div>';
  }

  /* -------------------------------------------------------------- kelakuan */

  function cari(id) {
    var hasil = null;
    semuaTugas().forEach(function (e) { if (e.id === id) hasil = e; });
    return hasil;
  }

  function tanganiKlik(ev) {
    var saring = ev.target.closest('[data-tsaring]');
    if (saring) {
      saringSaat = saring.getAttribute('data-tsaring');
      terbukaId = '';
      gambar();
      return;
    }
    var rak = ev.target.closest('[data-trak]');
    if (rak) {
      daftarSaat = rak.getAttribute('data-trak');
      terbukaId = '';
      gambar();
      return;
    }

    var baris = ev.target.closest('.tugas');
    if (!baris) return;
    var e = cari(baris.getAttribute('data-id'));
    if (!e) return;

    /* Dua penyingkap yang tidak menyentuh data: dibuka langsung di layar,
       tanpa menyimpan apa pun. Menyimpan "lagi terbuka" ke entri berarti
       cadangan ikut berubah cuma karena kamu melihat sesuatu. */
    var lain = ev.target.closest('[data-lain]');
    if (lain) {
      var isi = baris.querySelector('.tugas-lain-isi');
      if (isi) isi.classList.toggle('sembunyi');
      lain.classList.toggle('buka');
      return;
    }
    if (ev.target.closest('[data-tanggal-buka]')) {
      var tgl = baris.querySelector('[data-tanggal]');
      if (tgl) { tgl.classList.remove('sembunyi'); tgl.focus(); }
      return;
    }

    if (ev.target.closest('[data-centang]')) { selesaikan(e).then(gambar); return; }
    if (ev.target.closest('[data-penting]')) {
      e.penting = !e.penting;
      simpan(e).then(gambar);
      return;
    }

    var langkah = ev.target.closest('[data-langkah]');
    if (langkah) {
      var i = Number(langkah.getAttribute('data-langkah'));
      if (e.daftar[i]) e.daftar[i].selesai = !e.daftar[i].selesai;
      simpan(e).then(gambar);
      return;
    }
    var buangL = ev.target.closest('[data-buang-langkah]');
    if (buangL) {
      e.daftar.splice(Number(buangL.getAttribute('data-buang-langkah')), 1);
      simpan(e).then(gambar);
      return;
    }

    var tenggat = ev.target.closest('[data-tenggat]');
    if (tenggat) {
      e.tenggat = Number(tenggat.getAttribute('data-tenggat')) || 0;
      simpan(e).then(gambar);
      return;
    }
    var ulang = ev.target.closest('[data-ulang]');
    if (ulang) {
      e.ulang = ulang.getAttribute('data-ulang');
      /* Berulang tanpa tenggat tidak punya arti - tanggal berikutnya dihitung
         dari tanggal sekarang, jadi kalau kosong dia diisi hari ini. */
      if (e.ulang && !e.tenggat) e.tenggat = hariMulai(Date.now());
      simpan(e).then(gambar);
      return;
    }
    if (ev.target.closest('[data-hariini]')) {
      e.hariIni = ikutHariIni(e) ? 0 : hariMulai(Date.now());
      simpan(e).then(gambar);
      return;
    }
    if (ev.target.closest('[data-buang-tugas]')) {
      /* Aturan nomor empat tetap berlaku: yang dibuang cuma berhenti muncul. */
      e.pensiun = true;
      simpan(e).then(function () {
        terbukaId = '';
        gambar();
        alat.pesan('Dibuang', {
          teks: 'Urungkan',
          jalan: function () { e.pensiun = false; simpan(e).then(gambar); }
        });
      });
      return;
    }

    if (ev.target.closest('input') || ev.target.closest('textarea')) return;
    terbukaId = terbukaId === e.id ? '' : e.id;
    /* MEMBUKANYA BERARTI MEMBACANYA. Tidak perlu tombol "tandai sudah dibaca":
       tanda itu ada untuk menjawab "mana yang belum kulihat", dan begitu kamu
       melihatnya pertanyaannya sudah terjawab. */
    if (terbukaId === e.id && belumDibaca(e)) {
      e.dibaca = true;
      simpan(e).then(gambar);
      return;
    }
    gambar();
  }

  function tanganiUbah(ev) {
    var baris = ev.target.closest('.tugas');
    if (!baris) return;
    var e = cari(baris.getAttribute('data-id'));
    if (!e) return;

    /* Dua penyingkap yang tidak menyentuh data: dibuka langsung di layar,
       tanpa menyimpan apa pun. Menyimpan "lagi terbuka" ke entri berarti
       cadangan ikut berubah cuma karena kamu melihat sesuatu. */
    var lain = ev.target.closest('[data-lain]');
    if (lain) {
      var isi = baris.querySelector('.tugas-lain-isi');
      if (isi) isi.classList.toggle('sembunyi');
      lain.classList.toggle('buka');
      return;
    }
    if (ev.target.closest('[data-tanggal-buka]')) {
      var tgl = baris.querySelector('[data-tanggal]');
      if (tgl) { tgl.classList.remove('sembunyi'); tgl.focus(); }
      return;
    }

    if (ev.target.hasAttribute('data-catatan')) { e.isi = ev.target.value; simpan(e); return; }
    if (ev.target.hasAttribute('data-rak')) {
      /* Dibetulkan ke daftar yang sudah ada, seperti keyword di layar drop:
         satu salah ketik yang melahirkan daftar baru adalah awal dari daftar
         yang harus dirapikan nanti. */
      var h = TOtak.benahiKategori(ev.target.value.trim(),
                                   daftarYangAda().map(function (r) { return r.nama; }));
      e.kategori = h.kategori;
      simpan(e).then(gambar);
      return;
    }
    if (ev.target.hasAttribute('data-tanggal')) {
      e.tenggat = ev.target.value ? hariMulai(new Date(ev.target.value + 'T00:00:00').getTime()) : 0;
      simpan(e).then(gambar);
    }
  }

  function tanganiTekan(ev) {
    if (ev.key !== 'Enter') return;
    if (ev.target.hasAttribute('data-langkah-baru')) {
      var baris = ev.target.closest('.tugas');
      var e = baris && cari(baris.getAttribute('data-id'));
      var teks = ev.target.value.trim();
      if (!e || !teks) return;
      ev.preventDefault();
      e.daftar = (e.daftar || []).concat([{ teks: teks, selesai: false }]);
      simpan(e).then(gambar);
    }
  }

  function buka() {
    saringSaat = saringSaat || 'hariini';
    terbukaId = '';
    gambar();
  }

  global.TTugas = {
    pasang: pasang, buka: buka, gambar: gambar, tambah: tambah,
    tambahDariDrop: tambahDariDrop,
    tanganiKlik: tanganiKlik, tanganiUbah: tanganiUbah, tanganiTekan: tanganiTekan,
    saring: function (s) { if (s) saringSaat = s; return saringSaat; },
    rak: function (r) { if (r != null) daftarSaat = r; return daftarSaat; },
    daftarYangAda: daftarYangAda,
    hariMulai: hariMulai, tulisTenggat: tulisTenggat, tugasBaru: tugasBaru,
    bacaTenggat: bacaTenggat,
    selesaikan: selesaikan, tersaring: tersaring, belumDibaca: belumDibaca
  };
})(window);
