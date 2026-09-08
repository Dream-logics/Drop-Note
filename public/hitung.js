/* ============================================================================
   Hitung — mesin kalkulator ilmiah
   ============================================================================
   BUKAN eval(), dan itu bukan kehati-hatian yang berlebihan. eval menjalankan
   apa pun yang bentuknya JavaScript, dan yang mengetik di sini duduk di
   halaman yang sama dengan seluruh catatannya - satu tempelan dari luar yang
   kebetulan masuk ke kotak ini menjadi kode yang berjalan penuh. Penguraiannya
   ditulis sendiri: dua ratus baris untuk menutup seluruh kelas cacat itu, dan
   sebagai bonus dia mengerti hal-hal yang JavaScript sendiri tidak mengerti -
   "2(3+4)", "45°", dan pangkat yang mengikat ke kanan.

   BERDIRI SENDIRI, TANPA DOM. Seluruh berkas ini fungsi murni: satu teks
   masuk, satu angka keluar. Itu yang membuatnya bisa diuji tanpa membuka satu
   layar pun - dan kalkulator yang salah hitung adalah cacat yang paling tidak
   mungkin ketahuan dari melihat layarnya.
   ============================================================================ */
(function (global) {
  'use strict';

  /* Derajat, bukan radian, dan itu memang keputusan. Yang mengetik "sin 30" di
     sela pekerjaan memaksudkan tiga puluh derajat; radian itu jawaban yang
     benar untuk pertanyaan yang tidak dia ajukan. Yang butuh radian menuliskan
     kelipatan pi sendiri, dan itu jauh lebih jarang. */
  var DERAJAT = Math.PI / 180;

  var TETAP = { pi: Math.PI, 'π': Math.PI, e: Math.E };

  /* Satu argumen, ditulis di depan angkanya. 'ln' HARUS diperiksa sebelum
     'log' tidak akan pernah bentrok, tapi urutan di daftar ini tetap dijaga
     dari yang panjang ke yang pendek: 'asin' yang dibaca sesudah 'sin' akan
     terurai jadi 'a' dikali 'sin', dan hasilnya galat yang menyesatkan. */
  var FUNGSI = {
    asin: function (x) { return Math.asin(x) / DERAJAT; },
    acos: function (x) { return Math.acos(x) / DERAJAT; },
    atan: function (x) { return Math.atan(x) / DERAJAT; },
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sin: function (x) { return Math.sin(x * DERAJAT); },
    cos: function (x) { return Math.cos(x * DERAJAT); },
    tan: function (x) { return Math.tan(x * DERAJAT); },
    ln: Math.log,
    log: function (x) { return Math.log(x) / Math.LN10; },
    sqrt: Math.sqrt, abs: Math.abs,
    exp: Math.exp
  };
  var NAMA_FUNGSI = Object.keys(FUNGSI).sort(function (a, b) {
    return b.length - a.length;
  });

  /* Pangkat MENGIKAT KE KANAN: 2^3^2 itu 2^(3^2) = 512, bukan (2^3)^2 = 64.
     Yang salah di sini tidak pernah kelihatan sebagai galat, cuma sebagai
     angka yang meleset - dan angka yang meleset diam-diam lebih buruk
     daripada kalkulator yang menolak menghitung. */
  var OP = {
    '+': { tingkat: 1, kanan: false, jalan: function (a, b) { return a + b; } },
    '-': { tingkat: 1, kanan: false, jalan: function (a, b) { return a - b; } },
    '*': { tingkat: 2, kanan: false, jalan: function (a, b) { return a * b; } },
    '/': { tingkat: 2, kanan: false, jalan: function (a, b) { return a / b; } },
    '%': { tingkat: 2, kanan: false, jalan: function (a, b) { return a % b; } },
    '^': { tingkat: 4, kanan: true, jalan: function (a, b) { return Math.pow(a, b); } }
  };

  function salah(pesan) { throw new Error(pesan); }

  /* ------------------------------------------------------------ pemenggalan */

  /* Tanda yang diketuk jari ditukar dengan padanannya di sini, sekali, di
     ambang pintu - supaya sisa berkas ini cuma mengenal satu bentuk. Koma
     jadi titik: papan angka Indonesia menulis desimal dengan koma, dan
     menolaknya berarti kalkulator yang salah menurut negaranya sendiri. */
  function bakukan(teks) {
    return String(teks)
      .replace(/[×✕✖]/g, '*')
      .replace(/[÷∕]/g, '/')
      .replace(/[−–—]/g, '-')
      .replace(/,/g, '.')
      .replace(/√/g, 'sqrt')
      .replace(/\s+/g, '');
  }

  function penggal(teks) {
    var t = bakukan(teks);
    var potong = [];
    var i = 0;
    while (i < t.length) {
      var c = t[i];
      if (c >= '0' && c <= '9' || c === '.') {
        var j = i;
        while (j < t.length && (t[j] >= '0' && t[j] <= '9' || t[j] === '.')) j++;
        var angka = t.slice(i, j);
        if (angka.split('.').length > 2) salah('Angka tidak jelas: ' + angka);
        potong.push({ jenis: 'angka', nilai: Number(angka) });
        i = j;
        continue;
      }
      if (c === '(' || c === ')') { potong.push({ jenis: c }); i++; continue; }
      if (OP[c]) { potong.push({ jenis: 'op', nilai: c }); i++; continue; }
      /* Faktorial ditulis SESUDAH angkanya, jadi dia bukan fungsi biasa. */
      if (c === '!') { potong.push({ jenis: 'faktorial' }); i++; continue; }
      if (c === '°') { potong.push({ jenis: 'derajat' }); i++; continue; }

      var sisa = t.slice(i);
      var nf = null;
      for (var k = 0; k < NAMA_FUNGSI.length; k++) {
        if (sisa.indexOf(NAMA_FUNGSI[k]) === 0) { nf = NAMA_FUNGSI[k]; break; }
      }
      if (nf) { potong.push({ jenis: 'fungsi', nilai: nf }); i += nf.length; continue; }

      var nt = null;
      Object.keys(TETAP).forEach(function (nama) {
        if (!nt && sisa.indexOf(nama) === 0) nt = nama;
      });
      if (nt) { potong.push({ jenis: 'angka', nilai: TETAP[nt] }); i += nt.length; continue; }

      salah('Tidak dikenali: ' + c);
    }
    return potong;
  }

  /* ----------------------------------------------------------- penyusunan */

  /* MINUS DI DEPAN ITU BUKAN PENGURANGAN, dan membedakannya cuma bisa dari
     apa yang ada SEBELUMNYA: di awal, sesudah '(' , atau sesudah operator
     lain, dia tanda negatif. "-2^2" jadi -(2^2) = -4, sama dengan yang
     dilakukan kalkulator ilmiah mana pun. */
  function awalanNegatif(sebelum) {
    return !sebelum || sebelum.jenis === '(' || sebelum.jenis === 'op' ||
           sebelum.jenis === 'fungsi';
  }

  /* PERKALIAN TERSIRAT: "2(3+4)", "2pi", "3sin30". Yang mengetik cepat
     memang menuliskannya begitu, dan menolaknya berarti dia harus
     membetulkan sesuatu yang menurutnya sudah benar. */
  function butuhKali(sebelum, kini) {
    if (!sebelum) return false;
    var tutup = sebelum.jenis === 'angka' || sebelum.jenis === ')' ||
                sebelum.jenis === 'faktorial' || sebelum.jenis === 'derajat';
    var buka = kini.jenis === 'angka' || kini.jenis === '(' ||
               kini.jenis === 'fungsi';
    return tutup && buka;
  }

  function faktorial(n) {
    if (n < 0 || Math.floor(n) !== n) salah('Faktorial cuma untuk bilangan bulat tak negatif');
    if (n > 170) return Infinity;
    var h = 1;
    for (var i = 2; i <= n; i++) h *= i;
    return h;
  }

  /* Shunting-yard: satu lintasan, dua tumpukan. Dipilih karena dia satu-satunya
     cara menghormati tingkat DAN arah ikatan tanpa menulis parser bersarang
     yang panjangnya berlipat. */
  function nilai(teks) {
    var potong = penggal(teks);
    if (!potong.length) salah('Kosong');

    var angka = [];
    var kerja = [];

    function terapkan() {
      var o = kerja.pop();
      if (o.jenis === 'fungsi') {
        if (!angka.length) salah('Kurang angka untuk ' + o.nilai);
        angka.push(FUNGSI[o.nilai](angka.pop()));
        return;
      }
      if (o.jenis === 'negatif') {
        if (!angka.length) salah('Kurang angka');
        angka.push(-angka.pop());
        return;
      }
      if (angka.length < 2) salah('Kurang angka untuk ' + o.nilai);
      var b = angka.pop(), a = angka.pop();
      angka.push(OP[o.nilai].jalan(a, b));
    }

    var sebelum = null;
    for (var i = 0; i < potong.length; i++) {
      var p = potong[i];

      if (butuhKali(sebelum, p)) {
        while (kerja.length && kerja[kerja.length - 1].jenis !== '(' &&
               tingkatnya(kerja[kerja.length - 1]) >= 2) terapkan();
        kerja.push({ jenis: 'op', nilai: '*' });
      }

      if (p.jenis === 'angka') { angka.push(p.nilai); sebelum = p; continue; }
      if (p.jenis === 'derajat') { angka.push(angka.pop() * DERAJAT); sebelum = p; continue; }
      if (p.jenis === 'faktorial') { angka.push(faktorial(angka.pop())); sebelum = p; continue; }
      if (p.jenis === 'fungsi') { kerja.push(p); sebelum = p; continue; }
      if (p.jenis === '(') { kerja.push(p); sebelum = p; continue; }
      if (p.jenis === ')') {
        while (kerja.length && kerja[kerja.length - 1].jenis !== '(') terapkan();
        if (!kerja.length) salah('Kurung tutup tanpa pembuka');
        kerja.pop();
        /* Fungsi yang menempel di kurungnya dijalankan begitu kurungnya
           selesai: "sin(30)" bukan "sin" lalu "(30)" yang berdiri sendiri. */
        if (kerja.length && kerja[kerja.length - 1].jenis === 'fungsi') terapkan();
        sebelum = p;
        continue;
      }
      if (p.jenis === 'op') {
        if (p.nilai === '-' && awalanNegatif(sebelum)) {
          kerja.push({ jenis: 'negatif' });
          sebelum = { jenis: 'op' };
          continue;
        }
        if (p.nilai === '+' && awalanNegatif(sebelum)) { sebelum = { jenis: 'op' }; continue; }
        var o = OP[p.nilai];
        while (kerja.length && kerja[kerja.length - 1].jenis !== '(') {
          var atas = kerja[kerja.length - 1];
          var ta = tingkatnya(atas);
          if (ta > o.tingkat || (ta === o.tingkat && !o.kanan)) terapkan();
          else break;
        }
        kerja.push(p);
        sebelum = p;
        continue;
      }
    }

    while (kerja.length) {
      if (kerja[kerja.length - 1].jenis === '(') salah('Kurung buka tanpa penutup');
      terapkan();
    }
    if (angka.length !== 1) salah('Belum lengkap');
    var h = angka[0];
    if (typeof h !== 'number' || !isFinite(h)) {
      if (h === Infinity || h === -Infinity) salah('Terlalu besar');
      salah('Bukan angka');
    }
    return h;
  }

  /* Negatif dan fungsi mengikat lebih kuat daripada pangkat: "-2" di dalam
     "3^-2" harus selesai sebelum pangkatnya, dan "sin30^2" itu (sin30)^2. */
  function tingkatnya(o) {
    if (o.jenis === 'fungsi') return 5;
    if (o.jenis === 'negatif') return 3;
    return OP[o.nilai].tingkat;
  }

  /* PEMBULATAN MENGAMBANG, dan ini menutup satu-satunya cacat kalkulator
     desimal yang pasti dilihat orang: 0.1 + 0.2 yang menjawab
     0.30000000000000004. Dibulatkan ke 12 angka berarti yang tersisa cuma
     galat pembulatan yang memang di bawah ketelitian yang dipakai manusia. */
  function rapikan(n) {
    if (!isFinite(n)) return String(n);
    var b = Number(n.toPrecision(12));
    if (Math.abs(b) >= 1e15 || (b !== 0 && Math.abs(b) < 1e-9)) {
      return b.toExponential(6).replace(/e([+-])/, 'e$1');
    }
    return String(b);
  }

  function hitung(teks) {
    try { return { ok: true, nilai: nilai(teks), teks: rapikan(nilai(teks)) }; }
    catch (e) { return { ok: false, pesan: e.message }; }
  }

  global.THitung = { hitung: hitung, nilai: nilai, rapikan: rapikan };
})(window);
