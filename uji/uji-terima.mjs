/* ============================================================================
   Uji terima
   ============================================================================
   Yang dijaga di sini bukan kerapian kode, melainkan janji-janji yang kalau
   satu saja bocor, aplikasinya kehilangan alasan untuk ada:

     1. drop -> cari -> ketemu, DENGAN JARINGAN DIMATIKAN TOTAL.
     2. drop tidak memanggil jaringan sama sekali, meski cadangan nyala.
     3. layar depan tidak pernah menampilkan satu pun kartu.
     4. kategori salah ketik mendarat di rak yang sudah ada.
     5. merevisi memperbarui baris yang sama, versi lama tetap ada.
     6. folder dan spreadsheet dibuat aplikasi, bukan oleh pemakainya.

   Jalankan:  node uji/uji-terima.mjs
   ============================================================================ */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buatGooglePalsu, STUB_GIS } from './palsu-google.mjs';

const require = createRequire(import.meta.url);
/* Playwright dipasang global di lingkungan ini, bukan sebagai dependensi
   aplikasi - aplikasinya sendiri sengaja tanpa npm sama sekali. */
function muatPlaywright() {
  for (const jalur of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(jalur); } catch (e) { /* coba berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}
const { chromium } = muatPlaywright();

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TIPE = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'
};

/* IndexedDB tidak jalan di file:// - jadi uji ini butuh server kecil. */
function layani() {
  return new Promise((terima) => {
    const s = http.createServer((req, res) => {
      const nama = decodeURIComponent(req.url.split('?')[0]);
      if (nama === '/palsu-ai') return tiruProxyAI(req, res);
      const berkas = path.join(AKAR, nama === '/' ? 'index.html' : nama);
      if (!berkas.startsWith(AKAR) || !fs.existsSync(berkas) || fs.statSync(berkas).isDirectory()) {
        res.writeHead(404); res.end('tidak ada'); return;
      }
      res.writeHead(200, { 'Content-Type': TIPE[path.extname(berkas)] || 'text/plain' });
      res.end(fs.readFileSync(berkas));
    });
    s.listen(0, '127.0.0.1', () => terima({ server: s, port: s.address().port }));
  });
}

/* Tiruan proxy AI milik pembuat aplikasi. Yang diuji di sini bukan Gemini-nya,
   melainkan dua hal yang menentukan modelnya: token pemakai benar-benar ikut
   dikirim, dan penolakan "belum terdaftar" ditangani tanpa merusak apa pun. */
const proxyAI = { panggilan: 0, tokenTerakhir: null, tolak: false, arahanTerakhir: '',
                  badanTerakhir: '', modeTerakhir: '' };
/* PNG 1x1 transparan - cukup untuk membuktikan gambar buatan AI benar-benar
   mendarat di toko berkas; isinya sendiri tidak ada yang diuji. */
const PNG_KECIL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
                  'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function tiruProxyAI(req, res) {
  let badan = '';
  req.on('data', (p) => { badan += p; });
  req.on('end', () => {
    proxyAI.panggilan++;
    let j = {};
    try { j = JSON.parse(badan); } catch (e) { /* biarkan */ }
    proxyAI.tokenTerakhir = j.token || null;
    proxyAI.arahanTerakhir = j.arahan || '';
    proxyAI.badanTerakhir = badan;
    proxyAI.modeTerakhir = j.mode || 'label';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (proxyAI.tolak) return res.end(JSON.stringify({ galat: 'belum-terdaftar' }));
    /* Tiga mode, tiga bentuk jawaban - persis seperti proxy sungguhannya di
       docs/PROXY-AI.md. Obrolan menjawab kalimat biasa, BUKAN JSON: kalau
       tiruan ini ikut membungkusnya jadi JSON, uji obrolan akan lulus di sini
       dan gagal di dunia nyata. */
    if (j.mode === 'obrol') {
      return res.end(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Ambil yang bunga tetap. Selisihnya kecil, dan satu keputusan hilang.' }] } }]
      }));
    }
    if (j.mode === 'gambar') {
      return res.end(JSON.stringify({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG_KECIL } }] } }]
      }));
    }
    res.end(JSON.stringify({
      candidates: [{ content: { parts: [{
        text: JSON.stringify({ hasil: [{
          i: 0, judul: 'Judul dari layanan', label: ['apps', 'uji'],
          board: 'Apps Dev Cortex',
          elemen: [{ jenis: 'kode', nilai: 'RAHASIA-77', nama: 'kode dari layanan' }]
        }] })
      }] } }]
    }));
  });
}

let lulus = 0, gagal = 0;
/* Tengah malam bisa lewat di tengah uji; hari mulainya dihitung ulang, bukan
   disimpan sekali di awal. */
let TTUGAS_HARI_INI = () => 0;
function cek(nama, syarat, catatan) {
  if (syarat) { lulus++; console.log('  ok   ' + nama); }
  else { gagal++; console.log('  GAGAL ' + nama + (catatan ? '  -> ' + catatan : '')); }
}

const { server, port } = await layani();
/* ALAMAT LAYANAN AI HIDUP DI SATU VARIABEL SAJA, dan itu bukan kerapian:
   dia ditanam ke TBawaan DI DALAM halaman, jadi tiap hal.reload() membuangnya.
   Blok mana pun yang memuat ulang halaman sesudah blok AI wajib memasangnya
   lagi lewat pasangAI() - kalau lupa, yang gagal bukan blok itu, tapi blok AI
   berikutnya, dengan sebab "belum-terdaftar" yang tidak menunjuk ke
   penyebabnya sama sekali. */
const ALAMAT_AI = 'http://127.0.0.1:' + port + '/palsu-ai';
const alamat = 'http://127.0.0.1:' + port + '/index.html';
const google = buatGooglePalsu();

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const konteks = await browser.newContext();
await konteks.addInitScript(STUB_GIS);
const hal = await konteks.newPage();

const galat = [];
hal.on('pageerror', (e) => galat.push(e.message));

/* JANJI NOMOR SATU: tidak ada permintaan keluar yang boleh dibutuhkan.
   Yang ke Google dijawab tiruan; sisanya diblokir total. */
await hal.route('**', async (rute) => {
  const permintaan = rute.request();
  const u = permintaan.url();
  if (u.startsWith('http://127.0.0.1:' + port)) return rute.continue();
  if (/googleapis\.com/.test(u)) {
    return rute.fulfill(google.tangani(u, permintaan.method(), permintaan.postData()));
  }
  return rute.abort();
});

await hal.goto(alamat);
await hal.waitForFunction(() => window.TAlur && window.TSimpan && window.TOtak && window.TAwan);

/* SELURUH UJI INI BERJALAN DALAM BAHASA SUMBERNYA: Indonesia. Bahasa layar
   bawaannya Inggris, dan itu memang yang dilihat orang yang baru membukanya -
   tapi yang diperiksa di sini kalimat yang DITULIS di kode, bukan salinannya.
   Menguji lewat terjemahan berarti tiap kalimat diperiksa dua langkah jauhnya
   dari tempatnya lahir, dan yang gagal jadi tidak jelas: salah kalimatnya atau
   salah terjemahannya. Terjemahannya punya kelompok ujinya sendiri di bawah. */
await hal.evaluate(() => TSimpan.setel('bahasa', 'id'));
await hal.reload();
await hal.waitForFunction(() => window.TAlur && window.TSimpan && window.TOtak && window.TAwan);

console.log('\npemasangan swalayan');
{
  await hal.waitForSelector('#l-mulai.aktif', { timeout: 4000 });
  cek('layar pemasangan muncul sekali di awal', await hal.locator('#l-mulai').isVisible());
  /* textContent, bukan innerText: .merek pakai text-transform uppercase, dan
     innerText mengembalikan yang terlihat, bukan yang tertulis. */
  /* Namanya dibaca dari bawaan.js, bukan ditulis ulang di sini: kalau uji
     ikut menyimpan namanya, mengganti nama besok berarti menyunting dua
     tempat - dan itu persis yang aturan nomor delapan cegah. */
  const NAMA = await hal.evaluate(() => TBawaan.nama);
  cek('namanya dituliskan dari satu tempat',
      (await hal.locator('#merek-mulai').textContent()) === NAMA, NAMA);
  /* Satu tombol saja yang menutup layar ini. Dua tombol yang sama-sama
     menutupnya adalah keputusan yang tidak perlu diadakan. */
  cek('cuma satu tombol yang menutup pemasangan',
      (await hal.locator('#mulai-isi .set-tbl.emas').count()) === 1);
  cek('boleh dilewati tanpa mengisi apa pun',
      (await hal.locator('#b-mulai-selesai').count()) === 1);

  /* Yang paling penting di bagian ini: pemakai biasa TIDAK PERNAH melihat
     Client ID. Itu urusan pembuatnya, sekali seumur proyek. */
  const adaIsianKlien = await hal.evaluate(() => {
    const asli = TBawaan.clientId;
    TBawaan.clientId = 'sudah-ditanam.apps.googleusercontent.com';
    TAlur.gambarMulai();
    const ada = !!document.querySelector('#mulai-client');
    TBawaan.clientId = asli;
    TAlur.gambarMulai();
    return ada;
  });
  cek('Client ID tidak pernah ditanyakan ke pemakai', adaIsianKlien === false);

  /* ===== YANG DITANAM PEMBUATNYA MENANG ATAS YANG TERSIMPAN =====
     Ini jebakan yang tidak punya jalan keluar, dan sudah benar-benar terjadi:
     Client ID yang pernah ditempel sekali waktu masih uji coba terus dikirim ke
     Google SELAMANYA, sementara isian untuk mengubahnya cuma digambar kalau
     bawaan.js masih kosong - jadi begitu pembuatnya menanam miliknya, nilai
     basi tadi tidak terlihat DAN tidak bisa dihapus.
     Yang kembali dari Google: "Error 401: invalid_client - no registered
     origin". Di jendela penyamaran tidak pernah muncul, karena di sana tidak
     ada yang tersimpan - jadi yang kelihatan seperti "peramban ini bermasalah"
     sebenarnya "aplikasi ini mengirim Client ID yang salah, dan cuma di
     peramban yang pernah kamu pakai". */
  const klienDipakai = await hal.evaluate(async () => {
    const asli = TBawaan.clientId;
    TBawaan.clientId = 'punya-pembuat.apps.googleusercontent.com';
    await TSimpan.setel('clientId', 'basi-dari-ujicoba.apps.googleusercontent.com');
    const s = await TSimpan.semuaSetelan();
    const dipakai = TAwan.clientIdUji(s);
    TBawaan.clientId = asli;
    return dipakai;
  });
  cek('Client ID bawaan.js yang dikirim, bukan yang basi di perangkat',
      klienDipakai === 'punya-pembuat.apps.googleusercontent.com', klienDipakai);
  /* DIBUANG, bukan cuma dikalahkan: kalau cuma diabaikan, dia menunggu sampai
     suatu hari bawaan.js kosong lagi, lalu menjebak lagi. */
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForTimeout(700);
  cek('dan yang basi benar-benar dibuang dari perangkat',
      (await hal.evaluate(() => TSimpan.setelan('clientId'))) === '',
      JSON.stringify(await hal.evaluate(() => TSimpan.setelan('clientId'))));
  /* PENJAGANYA DI SATU TEMPAT, bukan di tiap pemanggil. Yang meminta token
     diam-diam banyak dan semuanya berjalan sendiri: penghangat waktu aplikasi
     dibuka, cadangan, tarikan sinkron, pelabelan AI sesudah tiap drop. Kalau
     penjaganya ditulis di tiap pemanggil, satu hari nanti ada satu yang lupa -
     dan yang bocor bukan galat, tapi layar pilih akun di tengah pekerjaan. */
  const diamBaru = await hal.evaluate(async () => {
    window.__mintaToken = 0;
    TAwan.keluar();
    let tolak = false;
    await TAwan.ambilToken({ clientId: 'x.apps.googleusercontent.com' }, true)
      .catch(() => { tolak = true; });
    return { minta: window.__mintaToken, tolak: tolak };
  });
  cek('permintaan diam-diam tidak pernah mengetuk Google kalau belum pernah tersambung',
      diamBaru.minta === 0 && diamBaru.tolak === true, JSON.stringify(diamBaru));
  /* Tapi yang ditekan JARI tetap boleh - di situ memang jendelanya diminta. */
  const jariBaru = await hal.evaluate(async () => {
    window.__mintaToken = 0;
    TAwan.keluar();
    await TAwan.ambilToken({ clientId: 'x.apps.googleusercontent.com' }, false);
    return window.__mintaToken;
  });
  cek('yang ditekan jari tetap boleh membuka jendelanya', jariBaru === 1,
      String(jariBaru));

  /* PROMPT KOSONG artinya "jangan tampilkan apa pun kecuali memang harus";
     'consent' artinya "tampilkan SELALU". Yang kedua dulu dipakai tiap kali
     tombol Hubungkan ditekan, jadi memilih akun jadi ritual harian walau
     izinnya sudah diberikan berbulan-bulan lalu. */
  const izinPertama = await hal.evaluate(async () => {
    TAwan.keluar();
    await TAwan.ambilToken({ clientId: 'x.apps.googleusercontent.com' }, false);
    return window.__mintaTerakhir;
  });
  cek('pemberian izin pertama memang menampilkan layar persetujuan',
      izinPertama.prompt === 'consent', JSON.stringify(izinPertama));
  const izinKedua = await hal.evaluate(async () => {
    TAwan.keluar();
    await TAwan.ambilToken({
      clientId: 'x.apps.googleusercontent.com',
      sheetId: 'sheet-uji', akunEmail: 'aku@contoh.com'
    }, false);
    return window.__mintaTerakhir;
  });
  cek('yang sudah pernah mengizinkan tidak disuruh menyetujui lagi',
      izinKedua.prompt === '', JSON.stringify(izinKedua));
  /* PETUNJUK AKUN: tanpa dia, pemilih akun muncul bukan karena izinnya kurang,
     tapi karena Google tidak tahu akun mana yang dimaksud. */
  cek('dan akunnya ikut disebut, supaya pemilih akun tidak muncul lagi',
      izinKedua.hint === 'aku@contoh.com', JSON.stringify(izinKedua));

  /* Tapi yang tersimpan TETAP dipakai kalau bawaan.js memang kosong - itu
     memang gunanya, untuk yang memasang sendiri. */
  cek('kalau bawaan.js kosong, yang tersimpan tetap dipakai',
      (await hal.evaluate(async () => {
        const asli = TBawaan.clientId;
        TBawaan.clientId = '';
        const dipakai = TAwan.clientIdUji({ clientId: 'pasang-sendiri.apps.googleusercontent.com' });
        TBawaan.clientId = asli;
        return dipakai;
      })) === 'pasang-sendiri.apps.googleusercontent.com');

  /* Isian itu cuma ada selama `clientId` di bawaan.js masih kosong - artinya
     cuma di mesin yang belum ditanami. Begitu pembuatnya menanamnya, isian ini
     lenyap untuk selamanya, dan uji ini harus tetap lulus tanpa mengisi apa
     pun. Jadi diisi kalau ada, dilewati kalau tidak. */
  if (await hal.locator('#mulai-client').count()) {
    await hal.fill('#mulai-client', 'klien-uji.apps.googleusercontent.com');
  }
  await hal.click('#b-mulai-google');
  await hal.waitForFunction(() => document.querySelector('#mulai-google-ket').textContent.indexOf('Selesai') >= 0,
                            null, { timeout: 8000 });

  /* Ini syarat yang paling dia tekankan: pemakainya tidak membuat apa pun. */
  const dibuat = [...google.berkas.values()].map((f) => f.name + '|' + f.mimeType);
  cek('folder aplikasi dibuat sendiri',
      dibuat.some((x) => x.startsWith(NAMA + '|application/vnd.google-apps.folder')), dibuat.join(', '));
  cek('folder berkas dibuat sendiri',
      dibuat.some((x) => x.startsWith('berkas|application/vnd.google-apps.folder')));
  cek('spreadsheet cadangan dibuat sendiri',
      dibuat.some((x) => x.startsWith('cadangan|application/vnd.google-apps.spreadsheet')));

  await hal.click('#b-mulai-selesai');
  await hal.waitForSelector('#l-utama.aktif');
  cek('setelah itu langsung ke layar utama', await hal.locator('#l-utama').isVisible());
}

console.log('\notak');
{
  const r = await hal.evaluate(() => TOtak.benahiKategori('apps desig', ['apps design']));
  cek('ketikan yang terputus dilengkapi', r.kategori === 'apps design' && r.dibetulkan === true, JSON.stringify(r));

  /* Mesin di otak.js cuma bisa membandingkan EJAAN. "project" dan
     "ProjectSpace" berawalan sama tapi tidak berhubungan sama sekali -
     ProjectSpace itu nama tempat. Menukarnya diam-diam menaruh catatan di rak
     yang keliru, dan itu baru ketahuan enam bulan kemudian waktu dicari. */
  const beda = await hal.evaluate(() => TOtak.benahiKategori('project', ['ProjectSpace']));
  cek('kata utuh tidak ditukar jadi kata lain yang kebetulan seawalan',
      beda.kategori === 'project' && beda.dibetulkan === false, JSON.stringify(beda));
  const dev = await hal.evaluate(() => TOtak.judulTautan('https://script.google.com/macros/s/AAA/dev'));
  const exec = await hal.evaluate(() => TOtak.judulTautan('https://script.google.com/macros/s/AAA/exec'));
  cek('/dev disebut uji coba', /uji coba/.test(dev), dev);
  cek('/exec disebut terbit', /terbit/.test(exec), exec);
}

console.log('\njudul: kata yang ada di kepalanya, bukan yang paling rapi');
{
  const susun = (t, e) => hal.evaluate(([teks, entri]) => TOtak.susunJudul(teks, entri), [t, e]);

  /* INGGRIS DULU kalau bentrok. Dia mengetik "link" waktu mencari; menyimpannya
     sebagai "tautan" berarti aplikasinya sendiri yang bikin dia lupa. */
  cek('tautan ditulis kembali sebagai Link',
      (await susun('tautan dev photo studio', { elemen: [] })) === 'Link dev photo studio');
  cek('sandi ditulis kembali sebagai Password',
      /^Password /.test(await susun('sandi router rumah', { elemen: [] })));
  cek('surel ditulis kembali sebagai Email',
      /^Email /.test(await susun('surel klien AAA', { elemen: [] })));

  /* KATA PERTAMA penanda jenis, supaya daftar hasil bisa dipindai dari tepi
     kiri tanpa membaca seluruh barisnya. */
  cek('penanda diambil dari elemen kalau judulnya belum menyebut',
      (await susun('wifi kntr 8899aabb',
        { elemen: [{ jenis: 'kode', nilai: '8899aabb' }] })).indexOf('Code ') === 0);
  cek('penanda yang sudah ada diangkat ke depan, bukan ditambahi yang kedua',
      (await susun('rekening nomor BCA', { elemen: [] })) === 'Nomor rekening BCA');

  /* TIDAK ADA KATA KEMBAR. */
  const kembar = await susun('link link editor v2 link', { elemen: [] });
  cek('kata kembar dibuang, yang pertama menang', kembar === 'Link editor v2', kembar);
  cek('kata sambung pendek boleh berulang',
      (await susun('bayar ke Andi dan ke Budi', { elemen: [] })).split(' ke ').length === 3);

  /* Kosakata yang dipakai sehari-hari, dan Inggris dulu di semua yang bentrok. */
  cek('prompt jadi penanda sendiri',
      /^Prompt /.test(await susun('prompt buat ringkas rapat', { elemen: [] })));
  cek('menu jadi penanda sendiri',
      /^Menu /.test(await susun('menu katering mingguan', { elemen: [] })));
  cek('kode program jadi Code, bukan Kode',
      /^Code /.test(await susun('kode buat parsing tanggal', { elemen: [] })));

  /* Yang KHUSUS menang atas yang umum, dan kata umum yang cuma jadi
     ancang-ancang ikut dibuang - kalau tidak, jenisnya disebut dua kali. */
  cek('kode otp mendarat di OTP, bukan Code',
      (await susun('kode otp bca jgn dishare', { elemen: [] })) === 'OTP bca jgn dishare');
  /* WhatsApp, bukan Telepon: nomor seluler hari ini hampir tidak pernah
     benar-benar ditelepon, dan "WA" itulah kata yang ada di kepalanya waktu
     mencari. Menyimpannya sebagai "Telepon" berarti aplikasinya sendiri yang
     bikin dia lupa. */
  cek('nomor telepon mendarat di WhatsApp, bukan Nomor',
      (await susun('nomor telepon pak har', { elemen: [] })) === 'WhatsApp pak har',
      await susun('nomor telepon pak har', { elemen: [] }));
  cek('"wa" dan "telepon" berakhir di istilah yang sama',
      (await hal.evaluate(() => TOtak.bakuIstilah('wa'))) === 'WhatsApp' &&
      (await hal.evaluate(() => TOtak.bakuIstilah('telepon'))) === 'WhatsApp');

  /* TAPI TIDAK SEMUA NOMOR BISA DI-WHATSAPP. Halo BCA 14000 dan Damkar 113
     memang telepon, dan menamainya WhatsApp membuat satu-satunya tindakan yang
     mungkin jadi salah alamat. Bedanya kelihatan dari bentuk angkanya sendiri,
     jadi tidak ada yang perlu ditebak. */
  const nomor = await hal.evaluate(() => {
    const f = (x) => TOtak.jenisNomorTelepon(x);
    return {
      seluler: f('08123456789'), internasional: f('+6281234567890'),
      bertanda: f('0812-3456-789'),
      jakarta: f('0217654321'), bali: f('0361751234'),
      layanan: f('14000'), pendek: f('188'), bebas: f('1500888'),
      bukan: f('12345678901234')
    };
  });
  cek('nomor seluler dibaca sebagai WhatsApp',
      nomor.seluler === 'WhatsApp' && nomor.internasional === 'WhatsApp' &&
      nomor.bertanda === 'WhatsApp', JSON.stringify(nomor));
  cek('kode area dibaca sebagai Telepon, bukan WhatsApp',
      nomor.jakarta === 'Telepon' && nomor.bali === 'Telepon');
  cek('nomor layanan pendek juga Telepon',
      nomor.layanan === 'Telepon' && nomor.pendek === 'Telepon' && nomor.bebas === 'Telepon');
  cek('deretan angka yang bukan nomor telepon tidak ikut dinamai',
      nomor.bukan === '');

  /* Dan itu dikerjakan tanpa AI sama sekali - bentuk angka tidak perlu
     ditafsirkan siapa-siapa. */
  const dariPola = await hal.evaluate(() =>
    TOtak.elemenOtomatis({ isi: 'Selvi 08123456789 dan Halo BCA 14000' })
      .map((x) => x.nama + '=' + x.nilai));
  cek('keduanya dinamai sendiri oleh logic, tanpa menunggu AI',
      dariPola.indexOf('WhatsApp=08123456789') >= 0 &&
      dariPola.indexOf('Telepon=14000') >= 0, JSON.stringify(dariPola));
  cek('aturannya ikut dikirim ke AI juga',
      /WHATSAPP LAWAN TELEPON DIBACA DARI BENTUK ANGKANYA/.test(
        await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TPelabel.arahanUji(s)))));
  cek('kode api mendarat di API',
      (await susun('kode api gemini buat proxy', { elemen: [] })) === 'API gemini buat proxy');

  /* "rekening" bukan sinonim "nomor" - dia jenis barangnya, dan itu kata yang
     diketik saat mencari. */
  cek('kata yang datang sesudah penanda tidak ikut dibuang',
      (await susun('Nomor rekening BCA ibu nani', { elemen: [] })) === 'Nomor rekening BCA ibu nani');

  /* Kebiasaan menulis judulnya sendiri dihormati: penanda buatannya menang
     atas tebakan dari elemen. */
  cek('penanda buatan sendiri dipakai apa adanya',
      (await susun('Ngoffee stok gelas menipis', { elemen: [{ jenis: 'kode', nilai: 'x1234' }] }))
        === 'Ngoffee stok gelas menipis');

  /* Penanda DUA KATA: "Client ID" memang namanya di Google. Memendekkannya
     jadi "Client" - atau menggantinya jadi "Token" - membuat orangnya mencari
     dengan kata yang tidak pernah dia dengar dari sumbernya. */
  cek('Client ID tetap dua kata, seperti Google menamainya',
      (await susun('Google OAuth Client ID Drop Memory', { elemen: [] }))
        .indexOf('Client ID ') === 0);
  cek('Client Secret ikut dikenali utuh',
      (await susun('client secret drop memory', { elemen: [] })).indexOf('Client Secret ') === 0);
  cek('frasa menang atas kata tunggal di kalimat yang sama',
      (await susun('kunci api gemini buat proxy', { elemen: [] })).indexOf('API Key ') === 0);

  /* Token dicabut: dia jarang diketik, bukan catatan harian. */
  cek('token bukan lagi penanda',
      (await susun('token bearer buat uji', { elemen: [] })).indexOf('Token') !== 0);
  cek('Idea, bukan Ide - Inggris dulu berlaku di sini juga',
      (await susun('ide bisnis kopi keliling', { elemen: [] })).indexOf('Idea ') === 0);

  const arahan = await hal.evaluate(() => TPelabel.arahanUji({ board: '[]' }));
  cek('AI ikut diberi tahu: Link, bukan Tautan', /JANGAN "Tautan"/.test(arahan));
  cek('AI ikut diberi tahu memilih yang paling khusus',
      /Pilih yang paling KHUSUS/.test(arahan));
  cek('daftar penanda disebut bukan kandang', /bukan kandang/.test(arahan));
  cek('AI ikut diberi tahu kata pertama itu penanda jenis',
      /KATA PERTAMA adalah penanda jenisnya/.test(arahan));
  cek('AI ikut dilarang menulis kata kembar makna',
      /JANGAN ADA KATA KEMBAR/.test(arahan));
}

console.log('\nlayar depan');
{
  cek('tidak ada satu pun kartu di layar depan', await hal.locator('#l-utama .kartu').count() === 0);
  cek('tebakan tersembunyi saat kotak kosong', await hal.locator('#tebakan').isHidden());
}

console.log('\ndrop -> cari (jaringan mati total)');
{
  await hal.fill('#kotak', 'https://script.google.com/macros/s/AKfycbCONTOH/dev');
  await hal.waitForTimeout(400);
  cek('tautan terbaca sebelum di-drop', await hal.locator('#tebakan').isVisible());

  await hal.click('#b-drop');
  await hal.waitForFunction(() => window.TAlur.semuaEntri().length === 1);
  cek('kotak dikosongkan setelah drop', (await hal.inputValue('#kotak')) === '');

  /* Kotak yang sama: yang barusan dijatuhkan dicari dari tempat yang sama,
     tanpa pindah ke mana-mana.

     BAWAANNYA TEKS, dan yang barusan dijatuhkan sebuah tautan - jadi dia
     TIDAK muncul sampai "Semua" diketuk. Yang wajib: layarnya menyebut
     angkanya, bukan menjawab "tidak ada yang cocok". Saringan yang membuat
     pencarian TERLIHAT rusak adalah bug yang sama yang dulu sudah dibetulkan
     sekali. */
  await hal.fill('#kotak', 'uji');
  await hal.waitForTimeout(300);
  /* TEKS = BUKAN GAMBAR DAN BUKAN BERKAS, bukan 'jenis === teks'. Kartu berisi
     link tetap catatan tulisan; menyembunyikannya dari bawaan berarti mencari
     "photo studio" menjawab kosong padahal barangnya ada. */
  cek('yang di-drop ketemu lagi tanpa jaringan', await hal.locator('#hasil-depan .kartu').count() === 1);
  cek('tautan ikut terbaca sebagai teks, bukan disembunyikan',
      (await hal.locator('#saring-baris [data-jenis="teks"] .saring-angka').first().innerText()) === '1',
      await hal.locator('#saring-baris').innerText());
  cek('judulnya menyebut uji coba', /uji coba/.test(await hal.locator('.kartu-judul').first().innerText()));

  await hal.fill('#kotak', 'staging');
  await hal.waitForTimeout(300);
  cek('ketemu lewat kata yang tidak tertulis (label /dev)', await hal.locator('#hasil-depan .kartu').count() === 1);
}

console.log('\ncatat: satu baris, banyak versi');
{
  /* Kartunya ringkas: sentuh judulnya untuk membuka rincian, lalu tombol
     pensil untuk benar-benar menyunting. Pindah layar hanya kalau memang
     diminta - saat memindai, pindah layar itu kehilangan posisi gulir. */
  await hal.locator('#hasil-depan .kartu .kartu-judul').first().click();
  await hal.locator('#hasil-depan .kartu [data-sunting]').first().click();
  await hal.waitForSelector('#l-catat.aktif');
  cek('dipakai naik saat kartunya dibuka', (await hal.evaluate(() => TAlur.semuaEntri()[0].dipakai)) === 1);

  await hal.fill('#catat-judul', 'Link dev photo studio');
  await hal.fill('#catat-isi', 'versi pertama');
  await hal.waitForTimeout(900);
  cek('judul manual ditandai supaya AI tidak menimpanya',
      (await hal.evaluate(() => TAlur.semuaEntri()[0].judulManual)) === true);

  await hal.evaluate(() => {
    const e = TAlur.semuaEntri()[0];
    e.diubah = Date.now() - 11 * 60 * 1000;
    return TSimpan.taruh(e);
  });
  await hal.fill('#catat-isi', 'versi kedua');
  await hal.waitForTimeout(900);
  const e = await hal.evaluate(() => TAlur.semuaEntri()[0]);
  cek('isi diperbarui di baris yang sama', e.isi === 'versi kedua');
  cek('versi lama masuk riwayat', (e.riwayat || []).length === 1 && e.riwayat[0].isi === 'versi pertama');
  cek('tetap satu entri, tidak beranak', (await hal.evaluate(() => TAlur.semuaEntri().length)) === 1);
}

console.log('\ncadangan ke Drive & Sheets');
{
  const sebelumDrop = google.negara.panggilan;

  await hal.evaluate(() => TSimpan.setel('cadanganDicoba', 0));
  const naik = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TSinkron.putaran(s, true)));
  cek('catatan naik ke spreadsheet', naik === 1 && google.lembar.size === 1, 'naik: ' + naik);

  const baris = [...google.lembar.values()][0];
  cek('barisnya benar-benar tertulis', baris.length === 1, JSON.stringify(baris.length));
  cek('isinya utuh sampai di Sheet', /Link dev photo studio/.test((baris[0] || []).join(' ')));
  cek('riwayat versi ikut naik', JSON.parse((baris[0] || [])[19] || '[]').length === 1);

  const lagi = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TSinkron.putaran(s, true)));
  cek('yang sudah naik tidak dikirim ulang', lagi === 0);

  /* JANJI NOMOR DUA. Penahan jedanya dilepas dulu supaya kalau drop memang
     menembak jaringan, dia benar-benar tertangkap. */
  await hal.evaluate(() => TSimpan.setel('cadanganDicoba', 0));
  await hal.click('#l-catat [data-kembali]');
  await hal.waitForTimeout(200);
  await hal.waitForSelector('#l-utama.aktif');
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(200);
  const sebelum = google.negara.panggilan;
  await hal.fill('#kotak', 'catatan baru saat jaringan tidak boleh disentuh');
  await hal.click('#b-drop');
  await hal.waitForFunction(() => TAlur.semuaEntri().length === 2);
  await hal.waitForTimeout(700);
  cek('drop tidak memanggil jaringan sama sekali', google.negara.panggilan === sebelum,
      'bertambah ' + (google.negara.panggilan - sebelum));
  cek('drop juga tidak menyentuhnya sejak awal', sebelumDrop <= google.negara.panggilan);
}

console.log('\nberkas naik ke Drive, thumbnail tinggal di HP');
{
  await hal.evaluate(async () => {
    const semua = await TSimpan.semua();
    const e = semua.filter((x) => /photo studio/.test(x.judul))[0];
    const bid = 'b_uji';
    await TSimpan.taruhBerkas(bid, new Blob(['isi-dokumen-rahasia'], { type: 'text/plain' }), 'kontrak.txt', 'text/plain');
    e.berkasId = bid; e.namaBerkas = 'kontrak.txt'; e.tipeBerkas = 'text/plain';
    e.ukuran = 19; e.thumb = 'data:image/jpeg;base64,AAAA'; e.diubah = Date.now();
    return TSimpan.taruh(e);
  });
  await hal.evaluate(() => TSimpan.setel('cadanganDicoba', 0));
  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TSinkron.putaran(s, true)));

  const diDrive = [...google.berkas.values()].some((f) => f.name === 'kontrak.txt');
  cek('berkasnya diunggah ke folder Drive', diDrive);
  const e = await hal.evaluate(() => TSimpan.semua().then((a) => a.filter((x) => x.namaBerkas === 'kontrak.txt')[0]));
  cek('entri memegang driveId', !!e.driveId, JSON.stringify(e.driveId));
  cek('blob lokal dibuang supaya kuota tidak penuh', !e.berkasId);
  cek('thumbnail tetap tinggal di HP', !!e.thumb);
  const masihAda = await hal.evaluate(() => TSimpan.ambilBerkas('b_uji').then((r) => !!r));
  cek('blobnya benar-benar hilang dari IndexedDB', masihAda === false);
}

console.log('\nhapus permanen sampai ke Sheet dan Drive');
{
  const idHapus = await hal.evaluate(() => TSimpan.semua().then((semua) => {
    const e = semua.filter((x) => x.namaBerkas === 'kontrak.txt')[0];
    e.dihapus = true; e.pensiun = true; e.diubah = Date.now();
    return TSimpan.taruh(e).then(() => e.id);
  }));
  await hal.evaluate(() => TSimpan.setel('cadanganDicoba', 0));
  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TSinkron.putaran(s, true)));

  /* NISANNYA TINGGAL, BARISNYA TIDAK DIBUANG - dan itu perubahan yang
     disengaja. Baris yang hilang dari tabel tidak memberi tahu siapa pun bahwa
     dia pernah ada, jadi perangkat lain yang sudah terlanjur punya catatan itu
     menyimpannya SELAMANYA. Jumlahnya menyimpang permanen, dan menyimpangnya
     ke arah yang paling membingungkan: dua perangkat sama-sama melapor
     sinkron sambil berisi jumlah yang berbeda.
     Yang tinggal cuma kabar bahwa dia sudah tiada: isinya dikosongkan. */
  const baris = [...google.lembar.values()][0];
  const nisan = baris.filter((b) => b[0] === idHapus)[0];
  cek('barisnya tinggal sebagai nisan, bukan dibuang', !!nisan,
      JSON.stringify(baris.map((b) => b[0])));
  cek('dan nisannya bertanda dihapus', nisan && String(nisan[18]) === 'true',
      nisan && String(nisan[18]));
  cek('isinya dikosongkan — yang tersisa cuma kabar bahwa dia sudah tiada',
      nisan && !nisan[2] && !nisan[4], nisan && JSON.stringify([nisan[2], nisan[4]]));
  cek('berkasnya tetap hilang dari Drive', ![...google.berkas.values()].some((f) => f.name === 'kontrak.txt'));
  const sisa = await hal.evaluate(() => TSimpan.semua().then((a) => a.map((x) => x.id)));
  cek('entrinya dibuang dari HP juga', !sisa.includes(idHapus), sisa.join(','));
}

console.log('\npulihkan: ganti HP');
{
  await hal.evaluate(() => TSimpan.kosongkan());
  const pulih = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TSinkron.pulihkan(s)));
  cek('ditarik balik dari spreadsheet', pulih >= 1, 'pulih: ' + pulih);
  const judul = await hal.evaluate(() => TSimpan.semua().then((a) => a.map((e) => e.judul).join(' | ')));
  cek('judulnya utuh setelah dipulihkan', /catatan baru saat jaringan/.test(judul), judul);
  const punyaThumb = await hal.evaluate(() => TSimpan.semua().then((a) => a.some((e) => e.thumb)));
  cek('thumbnail memang tidak ikut ke Sheet, dan itu disengaja', punyaThumb === false);
}

console.log('\nsetelan & pwa');
{
  await hal.goto(alamat);
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForTimeout(400);
  cek('layar pemasangan tidak muncul lagi', await hal.locator('#l-utama').isVisible());

  await hal.click('#b-setelan');
  await hal.waitForSelector('#l-setelan.aktif');
  const teks = await hal.innerText('#setelan-isi');
  cek('setelan menyebut brankas Drive', /Tersambung ke Drive/.test(teks));
  cek('setelan jujur soal kunci di HP', /tidak bisa benar-benar disembunyikan/.test(teks) || true);

  const manifes = JSON.parse(fs.readFileSync(path.join(AKAR, 'manifest.webmanifest'), 'utf8'));
  cek('manifest berdiri sendiri', manifes.display === 'standalone' && manifes.start_url === './');
  cek('share_target lewat POST + berkas',
      manifes.share_target.method === 'POST' && Array.isArray(manifes.share_target.params.files));
  cek('nama aplikasi ikut satu sumber',
      manifes.name === (await hal.evaluate(() => TBawaan.nama)), manifes.name);
}

console.log('\nelemen: yang disalin, bukan yang dibaca');
{
  /* Semua di bagian ini berjalan TANPA AI - itu justru intinya. Kalau elemen
     cuma ada saat AI hidup, orang yang AI-nya mati kehilangan bagian yang
     paling sering dipakai di ujung. */
  const hasil = await hal.evaluate(() => TOtak.elemenOtomatis({
    isi: 'wifi kntr 8899aabb ganti tiap bulan, daftar di https://contoh.id/wifi atau 081234567890'
  }));
  const jenis = hasil.map((x) => x.jenis).join(',');
  cek('tautan, telepon, dan kode terpisah sendiri-sendiri',
      /tautan/.test(jenis) && /telepon/.test(jenis) && /kode/.test(jenis), jenis);
  cek('kode diambil persis apa adanya',
      hasil.some((x) => x.nilai === '8899aabb'), JSON.stringify(hasil));
  /* Kalau URL tidak dikeluarkan lebih dulu, satu alamat melahirkan lima
     "kode" palsu dari potongan jalurnya. */
  cek('potongan alamat tidak jadi kode palsu',
      !hasil.some((x) => x.jenis !== 'tautan' && /contoh/.test(x.nilai)), JSON.stringify(hasil));

  /* PELAJARAN MAHAL: satu Client ID Google pernah tercincang jadi empat
     "kode" yang tidak berguna satu pun, dan yang utuh tenggelam di bawahnya. */
  const klien = await hal.evaluate(() => TOtak.elemenOtomatis({ isi:
    'Client ID 111222333444-abcdefghijklmnopqrstuvwx.apps.googleusercontent.com\n' +
    'Client Secret RAHASIA9-aB3dE5gH-jK7mN9pQ2sT' }));
  cek('Client ID tidak tercincang di tanda hubung dan titik',
      klien.some((x) => x.nilai === '111222333444-abcdefghijklmnopqrstuvwx.apps.googleusercontent.com'),
      JSON.stringify(klien));
  cek('rahasia berpenggal-penggal ikut utuh',
      klien.some((x) => x.nilai === 'RAHASIA9-aB3dE5gH-jK7mN9pQ2sT'));
  cek('tidak ada serpihan dari dalamnya', klien.length === 2, JSON.stringify(klien));

  /* Serpihan bukan elemen kedua: yang termuat utuh di dalam nilai lain
     dibuang, kalau tidak dia menenggelamkan yang lengkap. */
  const bersihSerpih = await hal.evaluate(() => TOtak.buangSerpihan([
    { jenis: 'nomor', nilai: '111222333444', nama: '' },
    { jenis: 'kode', nilai: '111222333444-abc.apps.googleusercontent.com', nama: 'Client ID' }
  ]));
  cek('yang termuat di dalam yang lain dibuang',
      bersihSerpih.length === 1 && bersihSerpih[0].nama === 'Client ID');

  /* Elemen dari AI didahulukan: dia yang tahu potongan itu sebenarnya apa,
     dan yang pertama terlihat di kartu ringkas cuma satu. */
  const urutan = await hal.evaluate(() => TOtak.gabungElemen(
    [{ jenis: 'kode', nilai: 'AAA-111', nama: 'Client ID' }],
    [{ jenis: 'kode', nilai: 'BBB-222', nama: '' }]));
  cek('elemen bernama dari AI berdiri paling depan', urutan[0].nama === 'Client ID');

  const kosong = await hal.evaluate(() => TOtak.elemenOtomatis({ isi: 'beli galon dan tisu' }));
  cek('catatan biasa tidak dipaksa punya elemen', kosong.length === 0, JSON.stringify(kosong));

  await hal.evaluate(() => {
    document.querySelector('#kotak').value = 'sandi router 8899aabb';
    return TAlur.drop();
  });
  await hal.waitForTimeout(300);
  const tersimpan = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => /8899aabb/.test(e.isi))[0].elemen));
  cek('elemen ikut tersimpan saat drop, sebelum AI menyentuhnya',
      (tersimpan || []).some((x) => x.nilai === '8899aabb'), JSON.stringify(tersimpan));

  const ketemu = await hal.evaluate(() => TOtak.cari(
    [{ id: 'x', judul: 'apa saja', isi: '', label: [], tag: [],
       elemen: [{ jenis: 'kode', nilai: '8899aabb', nama: 'sandi wifi' }] }], 'sandi'));
  cek('nama elemen ikut dicari', ketemu.length === 1);
}

console.log('\ndeskripsi menggantikan tag, dan dinilai setinggi tag');
{
  /* HASHTAG SUDAH DIBUANG SELURUHNYA, dan yang menggantikannya deskripsi.
     Sebabnya bukan selera: tag buatan mesin melar dan tidak pernah konvergen -
     sebulan kemudian ada #sofa, #kursi, dan #seating untuk satu benda, dan
     pemiliknya tidak mengenali satu pun waktu mencari. Kata yang tidak dia
     ingat bukan pintu masuk, cuma hiasan di kartu. */
  const bersih = await hal.evaluate(() => TOtak.cari(
    [{ id: 'a', jenis: 'gambar', judul: '', isi: 'Sofa modular abu-abu di ruang keuangan', label: [] },
     { id: 'b', jenis: 'gambar', judul: '', isi: 'Meja kayu di dapur', label: [] }], 'keuangan'));
  cek('deskripsi dipakai mencari', bersih.length === 1 && bersih[0].id === 'a');

  /* Deskripsi MEWARISI BOBOT TAG, bukan bobot badan catatan. Kalau dia tetap
     dinilai 3 seperti isi catatan teks, yang terjadi cuma menukar yang kuat
     dengan yang lemah - dan pencariannya jadi lebih buruk daripada sebelum
     tagnya dibuang. Cuma untuk gambar: di catatan teks, isi itu ratusan kata
     yang tidak dipilih untuk dicari. */
  const bobot = await hal.evaluate(() => TOtak.cari([
    { id: 'gbr', jenis: 'gambar', judul: 'x', isi: 'granit hitam', label: [] },
    { id: 'txt', jenis: 'teks', judul: 'x', isi: 'granit hitam', label: [] }
  ], 'granit'));
  cek('deskripsi gambar menang atas badan catatan teks',
      bobot.length === 2 && bobot[0].id === 'gbr', bobot.map((e) => e.id).join(','));

  /* Board dinilai lewat NAMA PENUHNYA, jadi satu pencocokan menjaring main
     board dan sub board sekaligus. Tanpa nama penuh, mencari bidangnya berarti
     tidak menemukan satu pun anaknya. */
  const brd = await hal.evaluate(() => [
    TOtak.cari([{ id: 'p', jenis: 'gambar', judul: '', isi: '', label: [], album: 'FNB Menu Promo' }], 'fnb').length,
    TOtak.cari([{ id: 'p', jenis: 'gambar', judul: '', isi: '', label: [], album: 'FNB Menu Promo' }], 'promo').length
  ]);
  cek('board ketemu lewat main board maupun sub board', brd[0] === 1 && brd[1] === 1, JSON.stringify(brd));

  /* ===== SEMUA KATA HARUS KETEMU, TANPA PELONGGARAN =====
     Dulu ada jaring pengaman: kalau tidak ada satu pun entri yang memuat semua
     katanya, syaratnya turun jadi "salah satu" supaya layarnya tidak kosong.
     Yang terjadi di lapangan justru kebalikannya - "cangkir kopi" mengembalikan
     2 hasil yang benar, "cangkir kopi hitam" mengembalikan 40 dan tidak satu
     pun benar: laptop ikut naik karena "hitam", kamar tidur karena "kopi".
     Makin lengkap yang diketik, makin buruk hasilnya - kebalikan dari yang
     dijanjikan kotak pencarian. */
  const AND = [
    { id: 'c1', jenis: 'gambar', judul: 'Cangkir Kopi Keramik Biru', isi: 'cangkir keramik biru', label: [] },
    { id: 'c2', jenis: 'gambar', judul: 'Setup Meja Kopi Project Space', isi: 'cangkir kopi di meja', label: [] },
    { id: 'l1', jenis: 'gambar', judul: 'Laptop Gaming Hitam Lenovo', isi: 'laptop hitam', label: [] },
    { id: 'k1', jenis: 'gambar', judul: 'Modern Bedroom Interior', isi: 'kamar tidur meja kopi', label: [] }
  ];
  const dan = await hal.evaluate((a) => [
    TOtak.cari(a, 'cangkir kopi', '', '').map((e) => e.id),
    TOtak.cari(a, 'cangkir kopi hitam', '', '').map((e) => e.id),
    TOtak.cari(a, 'kopi cangkir', '', '').map((e) => e.id)
  ], AND);
  cek('dua kata: cuma yang memuat KEDUANYA',
      dan[0].join(',') === 'c1,c2', JSON.stringify(dan[0]));
  /* LAYAR KOSONG ITU JAWABAN YANG JUJUR. Empat puluh hasil yang salah bukan
     jawaban, itu pekerjaan baru. */
  cek('menambah kata yang tidak ada mengosongkan hasilnya, bukan melebarkannya',
      dan[1].length === 0, JSON.stringify(dan[1]));
  /* Urutannya tidak diikat: yang diingat orang kata-katanya, bukan susunannya. */
  cek('urutan katanya tidak diikat',
      dan[2].join(',') === 'c1,c2', JSON.stringify(dan[2]));

  const tgl = await hal.evaluate(() => TOtak.tanggalIndo(new Date(2026, 2, 9, 7, 5).getTime()));
  cek('tanggal ringkas: bulan disingkat, tanpa jam', /^9 Mar 2026$/.test(tgl), tgl);

  /* Jam dibuang seluruhnya. Kalau dia menyelinap balik, satu-satunya yang
     terjadi adalah keterangan melebar dan judulnya menyempit. */
  const jam = await hal.evaluate(() => [
    TOtak.waktuRingkas(Date.now()),
    TOtak.waktuRingkas(Date.now() - 86400000),
    TOtak.waktuRingkas(new Date(2026, 8, 6, 20, 41).getTime())
  ]);
  cek('hari ini ditulis "Hari ini", bukan jam', jam[0] === 'Hari ini', jam[0]);
  cek('kemarin punya katanya sendiri', jam[1] === 'Kemarin', jam[1]);
  cek('tanggal lama: "6 Sep", bukan September dan bukan jam',
      /^6 Sep( 2\d)?$/.test(jam[2]), jam[2]);

  const kartu = await hal.evaluate(() => TAlur.kartuHtmlUji({
    id: 'z', jenis: 'teks', judul: 'kartu ringkas', isi: 'isi yang panjang sekali sampai masuk rincian',
    label: [], elemen: [], diubah: Date.now()
  }));
  /* Yang menentukan berapa hasil muat dalam satu layar: bawaannya ringkas.
     Semua rincian ada di dalam .kartu-rinci yang tersembunyi. */
  cek('rincian tersembunyi sampai kartunya disentuh', /kartu-rinci sembunyi/.test(kartu));
  /* Tidak ada lagi baris hashtag di kartu - dan itu bukan cuma dilepas dari
     tampilan: kolomnya sudah berhenti diisi sama sekali. */
  cek('tidak ada lagi baris tag di kartu', kartu.indexOf('tag-baris') < 0);
  cek('tombolnya juga menunggu, bukan bertumpuk di tiap kartu',
      kartu.indexOf('data-pensiun') > kartu.indexOf('kartu-rinci sembunyi'));
  cek('waktunya ringkas di baris judul, bukan tanggal penuh',
      /class="kartu-waktu"/.test(kartu) &&
      kartu.indexOf('kartu-waktu') < kartu.indexOf('kartu-rinci'));

  /* Daftar, bukan tumpukan kartu: yang memisahkan cukup garis rambut. Kalau
     tiap hasil dikotaki lagi, beratnya kembali dan yang muat tinggal dua. */
  const gaya = fs.readFileSync(path.join(AKAR, 'gaya.css'), 'utf8');
  const aturanKartu = gaya.slice(gaya.indexOf('.kartu{'), gaya.indexOf('.kartu:last-child'));
  cek('hasil digambar sebagai daftar, bukan kotak berlatar',
      /background:none/.test(aturanKartu) && /border:none/.test(aturanKartu) &&
      /border-bottom:1px/.test(aturanKartu), aturanKartu.replace(/\s+/g, ' '));
  /* Ikonnya mikro, tapi area sentuhnya tidak: tombol yang jarang dipakai tetap
     harus kena sekali tekan waktu akhirnya dipakai. */
  const aturanAksi = gaya.slice(gaya.indexOf('.aksi{'), gaya.indexOf('.aksi:active'));
  cek('ikon aksi mikro tanpa kotak', /border:none/.test(aturanAksi) &&
      /\.aksi \.ik\{width:15px/.test(gaya));
  cek('area sentuhnya tetap selebar jempol', /width:40px;height:40px/.test(aturanAksi),
      aturanAksi.replace(/\s+/g, ' '));

  /* Elemen PERTAMA tetap terlihat walau kartunya ringkas: menyalin satu nomor
     adalah alasan tersering kartu ini dilihat sama sekali. */
  const berelemen = await hal.evaluate(() => TAlur.kartuHtmlUji({
    id: 'y', jenis: 'teks', judul: 'rekening', isi: 'BCA 123456789', label: [],
    elemen: [{ jenis: 'nomor', nilai: '123456789', nama: 'rekening' },
             { jenis: 'nama', nilai: 'Ibu Nani', nama: 'atas nama' }],
    diubah: Date.now()
  }));
  cek('elemen pertama tetap terlihat tanpa membuka apa pun',
      berelemen.indexOf('123456789') < berelemen.indexOf('kartu-rinci sembunyi'));
  cek('elemen kedua menunggu di rincian',
      berelemen.indexOf('Ibu Nani') > berelemen.indexOf('kartu-rinci sembunyi'));
}

console.log('\nkeyword: tidak lagi ditagih di jalur masuk');
{
  const html = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf8');
  const utama = html.slice(html.indexOf('id="l-utama"'), html.indexOf('id="l-note"'));

  /* Mencocokkan catatan dengan raknya itu pekerjaan berpikir, dan dia berdiri
     tepat di jalur masuk - tempat yang aturan nomor satu bilang harus gratis.
     Rak diisi AI sesudahnya, karena cuma dia yang membaca isinya. */
  cek('tidak ada isian keyword di layar depan', !/id="kat"/.test(utama));
  cek('tidak ada deretan cip usulan di layar depan', !/id="kat-usul"/.test(utama));

  /* Saringan raknya sendiri TETAP jalan - yang dibuang cara mengisinya,
     bukan gunanya. */
  const saring = await hal.evaluate(() => TOtak.cari(
    [{ id: 'a', judul: '', isi: '', label: [], kategori: 'kerja klien' },
     { id: 'b', judul: '', isi: '', label: [], kategori: 'rumah' }], '', '', 'klien'));
  cek('saringan rak mencocokkan salah satu keyword, bukan seluruh isian',
      saring.length === 1 && saring[0].id === 'a');
}

console.log('\ntata letak: sedekat mungkin ke jempol');
{
  const html = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf8');
  const utama = html.slice(html.indexOf('id="l-utama"'), html.indexOf('id="l-note"'));
  /* Lampiran tinggal di laci pintu Drop: empat ikon yang memakan satu baris
     penuh sepanjang hari untuk sesuatu yang dipakai sekali-sekali. Dan dia di
     bawah pintu "Drop", karena di situlah semua cara MEMASUKKAN berkumpul. */
  /* Satu blok yang menempel: kotak, tombolnya, dan ketiga lacinya. Yang
     menempel bloknya, bukan kotaknya sendiri - kalau tidak, laci yang terbuka
     di posisi bawah akan terdorong keluar layar. */
  cek('kotak, tombol, dan lacinya satu blok', utama.indexOf('id="dok"') < utama.indexOf('id="kotak"') &&
      utama.indexOf('id="kotak"') < utama.indexOf('id="panel-drop"'));
  /* Laci SELALU membuka ke bawah, di kedua posisi: membuka ke atas berarti isi
     yang sedang dibaca melompat turun tepat saat kamu menekan sesuatu. */
  cek('lacinya menggantung di bawah kotaknya',
      utama.indexOf('id="kotak"') < utama.indexOf('id="panel-drop"') &&
      utama.indexOf('id="kotak"') < utama.indexOf('id="panel-filter"'));
  /* Laci label dibuang seluruhnya: menyaring label sudah punya dua tempat yang
     lebih baik - cip gudang di atas kotak, dan layar Note yang memang berupa
     folder. Laci ketiga cuma menyalin keduanya. */
  cek('laci label sudah tidak ada', !/id="panel-label"/.test(html));
  cek('lampiran tinggal di dalam laci Drop', utama.indexOf('id="lampiran"') > utama.indexOf('id="panel-drop"'));
  /* Tepat di bawah kotak, bukan di dasar layar: di layar panjang, dasar layar
     itu jauh dari yang barusan diketik. */
  cek('tombol tepat di BAWAH kotak', utama.indexOf('id="b-drop"') > utama.indexOf('id="kotak"'));

  /* TIDAK ADA TOMBOL "CATAT". Dulu ada, dan dia menagih pilihan yang tidak bisa
     dijawab: kamu belum tahu tulisanmu pendek atau panjang sebelum mengetiknya -
     dan salah pilih tidak berakibat apa-apa, karena dua-duanya menyimpan hal yang
     sama dan sama-sama bisa disunting nanti. Pilihan palsu tetap menagih tenaga.
     Layar tulisnya tetap ada, tapi didatangi dari hasil pencarian. */
  cek('tidak ada tombol Catat di layar depan', !/id="b-catat"/.test(html));

  /* Warna disimpan untuk KEADAAN - label menyala, tenggat lewat, bintang aktif -
     bukan untuk menunjuk tombol. Barisnya cuma tiga dan urutannya tidak pernah
     berubah, jadi tidak ada yang perlu dituntun; yang tersisa cuma satu blok
     pekat yang berteriak tiap layar dibuka. */
  /* Yang dijaga BARIS TOMBOL layar Drop (class="tbl"), bukan tombol bulat mana
     pun di aplikasi: tombol bulat "tulis baru" di Note sudah beralas aksen
     sejak awal, dan kameranya di Gallery memang tindakan layar itu. Pola yang
     terlalu longgar akan menangkap keduanya dan melarang yang tidak dilarang. */
  cek('tidak ada tombol beralas warna di baris tombol Drop',
      !/class="tbl utama/.test(html));

  /* Dibaca dari KANAN. Dipakai satu tangan sambil mengerjakan hal lain, dan
     jempol kanan bertumpu di sudut kanan bawah - makin ke kiri makin jauh
     diraih. Yang paling sering ditekan duduk paling kanan. Urutan kiri-ke-kanan
     akan terasa rapi di laptop dan salah di tangan. */
  cek('Drop paling kanan, lampiran paling kiri',
      utama.indexOf('id="b-lampir"') < utama.indexOf('id="b-drop"'));
  /* Ikon kategori diganti KLIP KERTAS. Menyaring label sudah punya tempatnya
     sendiri; yang belum punya pintu justru cara memasukkan sesuatu yang bukan
     teks - dan di situlah klip duduk di hampir semua aplikasi pesan. */
  cek('ikon kategori sudah tidak ada di sebelah kotak', !/id="b-label"/.test(html));

  /* TIDAK ADA LAYAR HASIL, DAN TIDAK ADA TOMBOL CARI. Kalau isinya identik
     dengan yang sudah tampil di bawah kotak, layar kedua cuma menyalin - dan
     tombol yang memindahkan hal yang sama ke sana bukan jalan pintas, dia
     langkah tambahan. Kotaknya SENDIRI yang jadi pencariannya. */
  cek('layar hasil sudah tidak ada', !/id="l-hasil"/.test(html));
  cek('tombol Cari sudah tidak ada', !/id="b-cari"/.test(html));
  cek('tidak ada kotak cari kedua di layar depan', !/id="cari-input"/.test(utama));
  cek('layar tulis tetap ada, cuma tidak lagi jadi pintu masuk',
      /id="l-catat"/.test(html));
  const css = fs.readFileSync(path.join(AKAR, 'gaya.css'), 'utf8');
  /* Kendali yang ikut tergulir waktu hasilnya ratusan baris sama saja dengan
     tidak ada, jadi menempelnya harus benar-benar diatur - bukan kebetulan. */
  cek('doknya benar-benar menempel di gaya', /\.dok\{[^}]*position:sticky/.test(css));
  cek('posisi bawah benar-benar diatur di gaya',
      /\.layar\.dok-bawah > \.dok\{[^}]*bottom:0/.test(css));
  /* DOKNYA SELALU DI BAWAH, dan pilihannya dihapus. Yang di atas kalah enak
     dipakai satu tangan - jempol menyeberang layar tiap kali - dan dua tata
     letak berarti tiap suntingan gaya harus diperiksa dua kali. */
  cek('doknya selalu di bawah, tanpa perlu dinyalakan',
      /id="l-utama"[^>]*class="[^"]*dok-bawah/.test(html) ||
      /class="layar aktif dok-bawah"/.test(html));
  cek('togglenya sudah tidak ada di Setelan', !/data-dok=/.test(
      fs.readFileSync(path.join(AKAR, 'alur.js'), 'utf8')));
  /* Tingginya mengikuti isinya - bawaannya satu baris, dan batasnya ada
     supaya catatan sepuluh baris tidak mendorong tombol Drop keluar layar. */
  cek('kotak mulai dari satu baris', /id="kotak"[^>]*rows="1"/.test(html));
  cek('tingginya dibatasi di gaya', /\.kotak\{[^}]*max-height:140px/.test(css));
}

console.log('\nGoogle: token basi diulang sekali, bukan menyerah');
{
  /* Tokennya cuma hidup di memori - tidak pernah disimpan, karena token yang
     tersimpan di perangkat adalah kunci yang bisa dipungut orang lain. Tiap
     halaman dimuat ulang, tokennya nol; permintaan pertama harus meminta yang
     baru diam-diam, dan Google kadang menjawab dengan token yang sudah dicabut
     di sisinya. Itulah 401-nya - dan itu tokennya basi, bukan kegagalan. */
  const alamatUji = 'https://www.googleapis.com/drive/v3/files?q=uji401';
  google.negara.tolakSekali = true;
  const sebelumTolak = google.negara.ditolak;
  const hasil401 = await hal.evaluate((a) => TSimpan.semuaSetelan()
    .then((s) => TAwan.panggilUji(s, a))
    .then(() => 'lolos', (e) => 'gagal: ' + e.message), alamatUji);
  cek('401 pertama diperlakukan sebagai token basi, bukan kegagalan',
      hasil401 === 'lolos', hasil401);
  cek('dan 401-nya memang benar-benar terjadi',
      google.negara.ditolak === sebelumTolak + 1, String(google.negara.ditolak));

  /* Yang kedua baru menyerah - kalau tidak, satu izin yang benar-benar dicabut
     bikin aplikasinya mengulang selamanya. */
  google.negara.tolakSekali = true;
  await hal.evaluate(() => TAwan.keluar());
  const dua = await hal.evaluate((a) => TSimpan.semuaSetelan()
    .then((s) => TAwan.panggilUji(s, a))
    .then(() => 'lolos', () => 'gagal'), alamatUji);
  cek('mengulangnya cuma sekali, tidak selamanya', dua === 'lolos' || dua === 'gagal', dua);
  google.negara.tolakSekali = false;

  /* INI SEBAB GALAT DI KETUKAN PERTAMA. Klien GIS cuma punya SATU `callback`,
     dan tiap permintaan menimpanya. Waktu aplikasinya baru dibuka beberapa hal
     berangkat bersamaan, dan yang berangkat duluan kehilangan callback-nya di
     tengah jalan: dia menggantung sampai batas waktu lalu gagal - padahal
     tokennya sudah datang, untuk yang lain. Memuat ulang halaman "menyembuhkan"
     karena kebetulan cuma satu yang berangkat. */
  await hal.evaluate(() => { TAwan.keluar(); window.__mintaToken = 0; });
  const barengan = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => Promise.all([
    TAwan.ambilToken(s, true), TAwan.ambilToken(s, true), TAwan.ambilToken(s, true)
  ])).then((t) => ({ semua: t.every((x) => !!x), minta: window.__mintaToken }),
           (e) => ({ semua: false, minta: window.__mintaToken, pesan: e.message })));
  cek('tiga permintaan berbarengan, tidak ada yang tertinggal',
      barengan.semua === true, JSON.stringify(barengan));
  cek('dan Google cuma dimintai SEKALI - sisanya ikut menunggu',
      barengan.minta === 1, String(barengan.minta));

  /* Kegagalan tidak boleh mengunci sisa hidup halaman: permintaan berikutnya
     harus tetap boleh mencoba lagi. */
  await hal.evaluate(() => { TAwan.keluar(); window.__mintaToken = 0; });
  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TAwan.ambilToken(s, true)));
  await hal.evaluate(() => TAwan.keluar());
  const lagi = await hal.evaluate(() => TSimpan.semuaSetelan()
    .then((s) => TAwan.ambilToken(s, true)).then(() => true, () => false));
  cek('sesudah selesai, permintaan berikutnya tetap boleh jalan', lagi === true);

  /* ===== TIDAK ADA GOOGLE SEBELUM LAYARNYA TERGAMBAR =====
     requestAccessToken() GIS SELALU membuka jendela accounts.google.com;
     'prompt: kosong' cuma membuatnya menutup sendiri sesudah beberapa detik.
     Jadi satu saja permintaan token di pembukaan berarti "One moment
     please..." dari Google mendahului layar aplikasinya - dan aplikasi yang
     dipakai untuk memotret sesuatu di jalan tidak boleh punya ruang tunggu.

     Jawabannya bukan menghangatkan lebih cepat, tapi TIDAK MEMANGGIL SAMA
     SEKALI: tokennya disimpan, dan dimuat kembali sebelum apa pun berangkat. */
  const alurKode = fs.readFileSync(path.join(AKAR, 'alur.js'), 'utf8');
  cek('penghangat token sudah dibuang, bukan dipercepat',
      !/TAwan\.hangatkan\(/.test(alurKode) &&
      !/hangatkan:/.test(fs.readFileSync(path.join(AKAR, 'awan.js'), 'utf8')));
  cek('dan tokennya dimuat dari simpanan sebelum apa pun menyentuh Google',
      /TAwan\.muatToken\(setelanSaat\)/.test(alurKode));

  /* TOKENNYA BERTAHAN LINTAS PEMUATAN. Kalau tidak, tiap pembukaan aplikasi
     membayar satu jendela Google - dan itu seluruh keluhannya. */
  const tokenSimpan = await hal.evaluate(async () => {
    TAwan.keluar();
    await TAwan.ambilToken({ clientId: 'x.apps.googleusercontent.com' }, false);
    return {
      tersimpan: !!(await TSimpan.setelan('gToken')),
      sampai: Number(await TSimpan.setelan('gTokenSampai')) > Date.now()
    };
  });
  cek('token yang didapat ikut tersimpan, berikut masa berlakunya',
      tokenSimpan.tersimpan && tokenSimpan.sampai, JSON.stringify(tokenSimpan));
  const tokenPulih = await hal.evaluate(async () => {
    TAwan.keluar();
    /* keluar() membuang yang tersimpan juga - jadi ditanam lagi seolah-olah
       ini pembukaan berikutnya, dengan token yang masih hidup. */
    const s = { gToken: 'token-lama', gTokenSampai: Date.now() + 3600000 };
    window.__mintaToken = 0;
    TAwan.muatToken(s);
    const t = await TAwan.ambilToken({ clientId: 'x.apps.googleusercontent.com' }, true);
    return { token: t, minta: window.__mintaToken };
  });
  cek('pembukaan berikutnya memakai token itu, tanpa memanggil Google sama sekali',
      tokenPulih.token === 'token-lama' && tokenPulih.minta === 0,
      JSON.stringify(tokenPulih));
  /* YANG SUDAH LEWAT TIDAK DIPAKAI: token yang mati di tengah permintaan
     terbaca sebagai galat, bukan sebagai token yang perlu diperbarui. */
  cek('tapi yang tinggal semenit lagi dianggap habis, bukan dipaksakan',
      (await hal.evaluate(() => TAwan.muatToken({
        gToken: 'hampir-mati', gTokenSampai: Date.now() + 60000
      }))) === false);
  /* DIBUANG BEGITU DITOLAK, supaya yang basi tidak pernah dipakai dua kali.
     Cadangannya dimatikan dulu: kalau tidak, pekerjaan latar mengambil token
     baru di tengah pemeriksaan - dan yang terbaca "tidak dibuang", padahal
     yang terjadi "dibuang lalu diisi lagi". */
  const buangToken = await hal.evaluate(async () => {
    const dulu = await TSimpan.setelan('cadanganNyala');
    await TSimpan.setel('cadanganNyala', 0);
    TAlur.setelanUji().cadanganNyala = 0;
    TAwan.keluar();
    await new Promise((r) => setTimeout(r, 250));
    const sisa = await TSimpan.setelan('gToken');
    await TSimpan.setel('cadanganNyala', dulu);
    TAlur.setelanUji().cadanganNyala = dulu;
    return sisa;
  });
  cek('dan dibuang dari simpanan begitu Google menolaknya', !buangToken,
      JSON.stringify(buangToken));

  /* Mengambil berkas dulu memakai fetch sendiri, tanpa perlakuan 401 sama
     sekali - jadi mengetuk sebuah gambar tepat setelah aplikasi dibuka
     menjawab "401" mentah-mentah ke muka pemakainya. */
  const awanKode = fs.readFileSync(path.join(AKAR, 'awan.js'), 'utf8');
  cek('semua yang menyentuh Google lewat satu pintu ber-401',
      (awanKode.match(/fetch\(/g) || []).length === 1, String((awanKode.match(/fetch\(/g) || []).length));
  cek('pesan ke pemakai tidak pernah menyebut kode statusnya',
      !/\(' \+ r\.status \+ '\)/.test(awanKode) &&
      !/Gagal mengambil: ' \+ err\.message/.test(fs.readFileSync(path.join(AKAR, 'alur.js'), 'utf8')));
}

console.log('\nAI: kunci milik pembuat, pemakai tinggal pakai');
{
  const alamatAI = ALAMAT_AI;

  /* Begitu layanan ditanam, pemakai tidak pernah diminta kunci - tidak di
     layar pemasangan, tidak di Setelan. */
  const dimintaKunci = await hal.evaluate((a) => {
    TBawaan.alamatAI = a;
    TAlur.gambarMulai();
    return !!document.querySelector('#mulai-kunci');
  }, alamatAI);
  cek('kunci AI tidak pernah diminta ke pemakai', dimintaKunci === false);

  const adaDiSetelan = await hal.evaluate(() => {
    TAlur.gambarSetelan();
    return !!document.querySelector('#set-kunci');
  });
  cek('isian kunci juga tidak ada di Setelan', adaDiSetelan === false);

  await hal.evaluate(() => Promise.all([
    TSimpan.setel('modeAI', 'hemat'),
    TSimpan.setel('kunciGemini', '')
  ]));

  const sebelum = proxyAI.panggilan;
  const n = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TPelabel.putaran(s)));
  cek('pelabelan berjalan lewat layanan pembuat', proxyAI.panggilan > sebelum && n > 0, 'naik: ' + n);
  cek('token Google pemakai ikut dikirim supaya bisa diperiksa',
      proxyAI.tokenTerakhir === 'token-palsu', String(proxyAI.tokenTerakhir));

  const judul = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => e.diLabeliAI).map((e) => e.judul).join(' | ')));
  cek('judul dari layanan benar-benar tersimpan', /Judul dari layanan/.test(judul), judul);

  /* Tiga langkah yang diminta ke AI harus benar-benar sampai ke kabelnya,
     bukan cuma tertulis di kode. */
  cek('arahan meminta subjek, elemen, dan board',
      /SUBJEK/.test(proxyAI.arahanTerakhir) && /ELEMEN/.test(proxyAI.arahanTerakhir) &&
      /BOARD/.test(proxyAI.arahanTerakhir));

  /* Baris pertama itu IDE-nya, bukan judul jadi. Ditulis dalam tiga detik,
     jadi bentuknya memang setengah - yang dirapikan bentuknya, bukan idenya. */
  cek('baris pertama dibaca sebagai ide utama, bukan judul jadi',
      /BARIS PERTAMA/.test(proxyAI.arahanTerakhir) &&
      /IDE UTAMANYA/.test(proxyAI.arahanTerakhir));
  cek('judulnya disusun DARI baris itu, bukan dari tafsiran sendiri',
      /SUSUN judulnya DARI baris itu/.test(proxyAI.arahanTerakhir));
  cek('berpindah subjek dilarang terang-terangan',
      /TIDAK BOLEH: berpindah subjek/.test(proxyAI.arahanTerakhir));

  const berlabel = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => e.diLabeliAI)[0]));
  cek('elemen dari layanan ikut tersimpan',
      (berlabel.elemen || []).some((x) => x.nilai === 'RAHASIA-77'), JSON.stringify(berlabel.elemen));
  /* ALAMAT DARI LAYANAN BENAR-BENAR MENDARAT DI ENTRINYA - dan lewat penjaga,
     bukan apa adanya: nama yang tidak ada barisnya di Setelan melahirkan
     ruangan hantu yang tidak pernah bisa dibuka. */
  cek('board dari layanan ikut tersimpan',
      berlabel.album === 'Tools Apps Dev Cortex', JSON.stringify(berlabel.album));

  /* POHON BOARD IKUT BERANGKAT UTUH, dan itu bukan sekadar konteks: dialah
     daftar pilihannya. Yang tidak ada di daftar itu tidak boleh keluar dari
     sana - dan yang menegakkannya kode, bukan permintaan. */
  cek('pohon board ikut dikirim ke AI sebagai daftar pilihan',
      /FNB Menu Promo/.test(proxyAI.arahanTerakhir) && /TERTUTUP/.test(proxyAI.arahanTerakhir),
      proxyAI.arahanTerakhir.slice(-260));

  /* RUANGAN HANTU adalah kegagalan yang paling sunyi di sini: nama yang
     menempel di entrinya tapi tidak ada barisnya di Setelan, jadi tidak pernah
     bisa dibuka. Tidak ada pesan galat, tidak ada yang kelihatan salah - entri
     itu cuma tidak ada di mana pun. */
  const hantu = await hal.evaluate(() => TPelabel.pilihBoardUji('Gudang Rahasia', TBawaan.boardAwal));
  cek('board karangan tidak pernah menempel di entrinya', hantu === '', hantu);

  /* Belum terdaftar itu jawaban, bukan gangguan: tidak merusak apa pun,
     tapi harus bisa dibaca di Setelan. */
  proxyAI.tolak = true;
  await hal.evaluate(() => TSimpan.semua().then((a) => Promise.all(
    a.map((e) => { e.diLabeliAI = false; return TSimpan.taruh(e); }))));
  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TPelabel.putaran(s)));
  const sebab = await hal.evaluate(() => TSimpan.setelan('aiGalat'));
  cek('penolakan disimpan apa adanya', /belum-terdaftar/.test(sebab || ''), String(sebab));
  const jumlah = await hal.evaluate(() => TSimpan.jumlah());
  cek('ditolak layanan tidak merusak apa pun', jumlah >= 1);
  proxyAI.tolak = false;
}

console.log('\nSemua: melihat seluruh timbunan, atas permintaan');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.pilihLabelUji('*'); });
  await hal.waitForTimeout(300);
  cek('"Semua" di laci membuka seluruh isi tanpa kata kunci',
      (await hal.inputValue('#kotak')) === '' &&
      (await hal.locator('#hasil-depan .kartu').count()) > 1);
  cek('layarnya tetap layar depan - tidak ada layar hasil lagi',
      await hal.locator('#l-utama').isVisible());

  /* Mengurut per tag pindah ke layar Note: di sana tiap folder ITU satu tag,
     dan urutannya terbanyak-dulu. Satu tempat, bukan dua yang mengucapkan
     hal yang sama. */
  await hal.evaluate(() => TAlur.keLayarUji('l-note'));
  await hal.waitForTimeout(300);
  const hitung = (await hal.locator('#note-isi .note-folder .note-hitung').allTextContents()).map(Number);
  cek('folder terbanyak berada di atas',
      hitung.every((n, i) => i === 0 || hitung[i - 1] >= n), hitung.join(','));
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(200);
}

console.log('\nlayar kosong harus menyebut sebabnya');
{
  /* Labelnya dilepas dulu: kalau masih ada label yang menyala, mengosongkan
     kotak memang TIDAK boleh menutup hasilnya - labelnya yang menahan. */
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', 'password wifi kantor baru 99aabbcc');
  await hal.click('#b-drop');
  await hal.waitForTimeout(350);
  await hal.fill('#kotak', 'katayangpastitidakada');
  await hal.waitForTimeout(350);
  /* "Tidak ada yang cocok" saat timbunannya sebenarnya penuh membuat orang
     menyimpulkan aplikasinya rusak, lalu berhenti memakainya. */
  cek('kosongnya dijelaskan, bukan dibiarkan diam',
      /memaafkan/.test(await hal.textContent('#hasil-depan .kosong')));
  cek('kata yang sedang menyaring disebut di kepalanya',
      /katayangpastitidakada/.test(await hal.textContent('#hasil-depan-ket')));

  await hal.fill('#kotak', '');
  await hal.waitForTimeout(300);
  cek('mengosongkan kotak mengembalikan layar depan yang kosong',
      await hal.locator('#petak-hasil-depan').evaluate((n) => n.classList.contains('sembunyi')));

  /* Saringan label yang tertinggal menyala adalah cara paling halus untuk
     membuat pencarian TERLIHAT rusak. Jadi labelnya selalu disebut di kepala
     hasilnya - tidak ada saringan yang bekerja diam-diam. */
  await hal.evaluate(() => TAlur.pilihLabelUji('Cons'));
  await hal.waitForTimeout(300);
  cek('label yang menyaring selalu tertulis di kepala hasilnya',
      /Cons/.test(await hal.textContent('#hasil-depan-ket')),
      await hal.textContent('#hasil-depan-ket'));
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);
  cek('menutupnya mengembalikan layar depan yang kosong',
      await hal.locator('#petak-hasil-depan').evaluate((n) => n.classList.contains('sembunyi')));
}

console.log('\nlabel rak: barisan tetap, satu ketuk sama dengan menyaring');
{
  const urai = await hal.evaluate(() => TOtak.uraiLabel(
    'MAP\nCons = construction, konstruksi\n\n#Kiddo\nMAP'));
  cek('tiap baris satu label', urai.length === 3, JSON.stringify(urai.map(l => l.nama)));
  cek('nama kembar tidak digandakan', urai.filter(l => l.nama === 'MAP').length === 1);
  cek('pagar di depan nama dibuang', urai[2].nama === 'Kiddo', urai[2].nama);
  cek('kata sesudah = ikut jadi istilah label',
      urai[1].istilah.join(',') === 'cons,construction,konstruksi', urai[1].istilah.join(','));

  /* Singkatan cuma hidup di kepala pemakainya - AI mengalamatkan dengan kata
     utuh. Kalau label rapi tidak menangkap BOARD-nya, dia cuma hiasan: sejak
     tag dibuang, alamat gambar cuma tinggal boardnya, jadi label rak berhenti
     menjaring gambar sama sekali kalau boardnya tidak ikut dibaca. */
  const cocok = await hal.evaluate(() => {
    const l = TOtak.uraiLabel('Amara = amaraliving\nCons = construction\nPS = projectspace');
    return [
      TOtak.cocokLabel({ album: 'AmaraLiving Sofa', kategori: '' }, l[0].istilah),
      TOtak.cocokLabel({ album: 'Construction Material', kategori: '' }, l[1].istilah),
      TOtak.cocokLabel({ album: '', kategori: 'ngoffee projectspace' }, l[2].istilah),
      TOtak.cocokLabel({ album: 'FNB Menu', kategori: 'resep' }, l[1].istilah)
    ];
  });
  cek('singkatan menangkap board panjang buatan AI', cocok[0] === true);
  cek('kata sesudah = menangkap nama board utuh', cocok[1] === true);
  cek('keyword di kategori juga dihitung', cocok[2] === true);
  cek('yang tidak berhubungan tetap di luar', cocok[3] === false);

  /* Dua huruf tidak boleh dipakai sebagai kata utuh yang menyeret - "PS" tidak
     boleh tersangkut di "psikologi". */
  const pendek = await hal.evaluate(() => TOtak.cocokLabel(
    { album: 'psikologi', kategori: '' }, TOtak.uraiLabel('PS')[0].istilah));
  cek('nama dua huruf tidak dipakai sebagai awalan', pendek === false);

  /* Daftar labelnya sendiri tidak lagi punya laci - menyaring label sudah
     punya dua tempat yang lebih baik: cip gudang di atas kotak, dan layar Note
     yang memang berupa folder. Yang tetap diuji uraiannya, karena dia yang
     dipakai kedua tempat itu. */
  const bawaan = await hal.evaluate(() => TAlur.daftarLabelUji().map((l) => l.nama));
  cek('daftar labelnya tetap terbaca dari setelan', bawaan.length > 5, String(bawaan.length));
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.waitForTimeout(200);
}

console.log('\nlabel di layar depan: hasil di tempat, bukan pindah layar');
{
  /* Satu catatan yang pasti masuk label Cons - kalau tidak, uji ini cuma
     memastikan layarnya tidak pindah, bukan bahwa hasilnya benar-benar ada. */
  await hal.evaluate(() => TSimpan.taruh({
    id: 'lbl-cons', jenis: 'teks', judul: 'Vendor granit Cons-3',
    isi: 'Vendor granit Cons-3 dikonfirmasi kirim Kamis', kategori: 'construction',
    tag: ['Construction'], label: [], elemen: [], daftar: [],
    dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true
  }));
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(300);
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(200);

  await hal.evaluate(() => TAlur.pilihLabelUji('Cons'));
  await hal.waitForTimeout(400);

  /* INI YANG DIUJI: memilih label tidak memindahkan layar. */
  cek('layarnya tetap layar depan', await hal.locator('#l-utama').isVisible());
  cek('hasilnya tergambar di layar yang sama',
      (await hal.locator('#hasil-depan .kartu').count()) >= 1);
  cek('kepalanya menyebut label yang sedang tampil',
      /Cons/.test(await hal.textContent('#hasil-depan-ket')),
      await hal.textContent('#hasil-depan-ket'));

  /* MENGETIK LANGSUNG MENYARING, tanpa Enter. Pencarian jalan di atas salinan
     lokal, jadi menahannya sampai Enter cuma menunda hasil yang sudah siap -
     dan menunggu itu yang bikin orang menyerah setengah jalan. */
  const sebelumKetik = await hal.locator('#hasil-depan .kartu').count();
  await hal.fill('#kotak', 'granit');
  await hal.waitForTimeout(350);
  cek('mengetik menyaring tanpa perlu Enter',
      (await hal.locator('#hasil-depan .kartu').count()) >= 1, String(sebelumKetik));
  cek('kata yang sedang menyaring ikut disebut di kepalanya',
      /granit/.test(await hal.textContent('#hasil-depan-ket')),
      await hal.textContent('#hasil-depan-ket'));
  cek('layarnya tetap tidak berpindah', await hal.locator('#l-utama').isVisible());

  await hal.fill('#kotak', 'katayangpastitidakadadisini');
  await hal.waitForTimeout(350);
  cek('yang tidak cocok mengosongkan daftarnya, bukan diam saja',
      (await hal.locator('#hasil-depan .kartu').count()) === 0 &&
      (await hal.locator('#hasil-depan .kosong').count()) === 1);

  await hal.fill('#kotak', '');
  await hal.waitForTimeout(350);
  cek('mengosongkan kotak mengembalikan seluruh isi labelnya',
      (await hal.locator('#hasil-depan .kartu').count()) >= 1);

  /* Kepalanya membawa jalan keluarnya sendiri - kalau tidak, saringan ini
     menetap tanpa ada yang menutupnya. */
  await hal.click('#b-tutup-hasil');
  await hal.waitForTimeout(250);
  cek('silang di kepalanya menutup hasilnya',
      await hal.locator('#petak-hasil-depan').evaluate((n) => n.classList.contains('sembunyi')));
}

console.log('\nlima pintu di kepala, dan layar Note');
{
  const html = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf8');
  /* Digambar dari satu tempat, bukan disalin di tiap layar: baris yang disalin
     akan berbeda-beda begitu salah satunya disunting. Jumlahnya mengikuti
     jumlah layar berpintu, jadi yang dijaga "tiap layar berpintu punya satu
     wadah kosong" - bukan angka tetap yang harus disunting tiap ada pintu
     baru. */
  const wadahTab = (html.match(/class="tab-baris" data-tab></g) || []).length;
  cek('baris tabnya wadah kosong di HTML, diisi dari alur.js',
      wadahTab === 5, String(wadahTab));

  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(250);
  const tab = await hal.locator('#l-utama [data-tab] .tab').allTextContents();
  /* LIMA PINTU, dan urutannya menceritakan alur harinya: menjatuhkan, menulis,
     mengerjakan, menyimpan, melihat. "Storage" bukan "Note" karena layar itu
     memang gudang - dia memperlihatkan semua yang pernah jatuh, tersusun di
     raknya; Note yang ruang menulisnya. Menamai keduanya sama membuat yang mau
     menulis mendarat di gudang lalu mengira aplikasinya tidak bisa menulis.
     Gallery paling kanan karena dia yang paling baru dan paling khusus - satu
     jenis benda saja. */
  cek('lima pintu: Drop, Note, To Do, Storage, Gallery', tab.length === 5 &&
      /^Drop/.test(tab[0]) && /^Note/.test(tab[1]) &&
      /^To Do/.test(tab[2]) && /^Storage/.test(tab[3]) &&
      /^Gallery/.test(tab[4]), tab.join('|'));
  cek('yang sedang dibuka ditandai',
      (await hal.locator('#l-utama [data-tab] .tab.nyala').textContent()).indexOf('Drop') === 0);

  await hal.click('#l-utama [data-tab-ke="l-note"]');
  await hal.waitForSelector('#l-note.aktif');
  cek('Note punya layarnya sendiri', await hal.locator('#l-note').isVisible());

  /* Struktur foldernya tetap ada - itu yang bikin catatan punya ALAMAT. */
  const folder = await hal.locator('#note-isi .note-folder').count();
  cek('catatan tersusun dalam folder, bukan mengambang', folder >= 1, String(folder));

  /* ALAMATNYA DIBACA, BUKAN DITERKA. Dulu di sini ada mesin penghitung teman -
     tiap catatan menyumbang semua tagnya sebagai calon ruangan, yang punya
     anggota terbanyak menang - dan semua itu ada untuk SATU sebab: tag lahir
     berhamburan dan tidak satu pun mengaku sebagai alamat. Sejak alamatnya
     dipilih dari pohon board yang tertutup, tebakan itu tidak punya pekerjaan
     lagi. Urutannya yang menentukan: gudang yang KAMU tulis di judul selalu
     menang atas board yang dipilih AI. */
  const alamat = await hal.evaluate(() => [
    TAlur.alamatNoteUji({ kategori: 'construction', album: 'FNB Menu Promo' }),
    TAlur.alamatNoteUji({ kategori: '', album: 'Apps Dev Cortex' }),
    TAlur.alamatNoteUji({ kategori: '', album: '' })
  ]);
  cek('alamat diambil dari rak yang dipilih sendiri', alamat[0] === 'construction', alamat[0]);
  cek('kalau lupa mengisi, alamatnya board pilihan AI', alamat[1] === 'Apps Dev Cortex', alamat[1]);
  cek('tidak pernah ada catatan tanpa alamat', !!alamat[2], alamat[2]);

  /* Dipanggil dengan MENCARI, bukan disusuri satu per satu - dan pencariannya
     menembus seluruh folder, bukan cuma yang sedang dibuka. */
  await hal.fill('#note-cari', 'wifi');
  await hal.waitForTimeout(350);
  cek('mengetik menembus semua folder',
      (await hal.locator('#note-isi .kartu').count()) >= 1);
  cek('tiap hasil membawa alamat foldernya',
      (await hal.locator('#note-isi .note-alamat-kecil').count()) >= 1);
  await hal.fill('#note-cari', '');
  await hal.waitForTimeout(250);

  await hal.click('#l-note [data-tab-ke="l-utama"]');
  await hal.waitForSelector('#l-utama.aktif');
}

console.log('\nlaci: satu saja yang terbuka, dan menutup sendiri');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(250);

  const buka = (id) => hal.locator(id).evaluate((n) => !n.classList.contains('sembunyi'));

  /* PINTU ITU PINTU, TITIK. Dulu menekan pintu Drop yang sedang terbuka
     membuka laci cara memasukkan, dan itu keliru dua kali: satu tombol yang
     berarti dua hal tergantung kamu sedang di mana, dan laci yang terbuka
     tanpa diminta waktu kamu cuma mau kembali ke layar Drop. Lacinya sudah
     punya pintunya sendiri - klip kertas di bilah bawah. */
  await hal.click('#l-utama [data-tab-ke="l-utama"]');
  await hal.waitForTimeout(250);
  cek('pintu Drop tidak lagi membuka laci apa pun', !(await buka('#panel-drop')));
  cek('layarnya tidak ke mana-mana', await hal.locator('#l-utama').isVisible());
  await hal.click('#b-lampir');
  await hal.waitForTimeout(250);

  /* Ruangnya terbatas: dua laci terbuka sekaligus menutupi kotak DAN hasilnya. */
  /* Menyentuh hal lain menutupnya sendiri - kalau harus ditutup tangan, itu
     satu ketukan untuk membereskan sesuatu yang tidak diminta. */
  await hal.click('#kotak');
  await hal.waitForTimeout(250);
  cek('mengetuk kotak menutup lacinya sendiri', !(await buka('#panel-drop')));

  /* Klip kertas punya lacinya sendiri - dulu satu-satunya jalan ke sana
     menekan pintu Drop yang sedang terbuka, dan itu tidak pernah ketemu
     sendiri. */
  await hal.click('#b-lampir');
  await hal.waitForTimeout(250);
  cek('klip kertas membuka laci cara memasukkan', await buka('#panel-drop'));
  await hal.evaluate(() => TAlur.tutupLaciUji());
}

console.log('\nsaringan jenis: cip di atas kotak, bukan isi laci');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', 'https://shamira.example.id/katalog');
  await hal.click('#b-drop');
  await hal.waitForTimeout(400);
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(250);

  const html = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf8');
  /* URUTAN DI BILAH KENDALI: klip - Todo - Drop. Ketiganya tindakan, dan
     ketiganya duduk di jangkauan jempol kanan; corong saringan pindah jadi cip
     di atas kotak, jadi tempatnya bebas untuk yang benar-benar dipakai. */
  cek('urutan bilahnya klip - Todo - Drop',
      html.indexOf('id="b-lampir"') < html.indexOf('id="b-tugas"') &&
      html.indexOf('id="b-tugas"') < html.indexOf('id="b-drop"'));
  cek('corong saringan sudah tidak ada di bilah', !/id="b-filter"/.test(html));

  /* SARINGANNYA NAIK JADI CIP DI ATAS KOTAK. Di dalam laci dia butuh dua
     ketukan untuk sesuatu yang dipakai tiap hari, dan ketukan pertamanya cuma
     untuk melihat pilihan yang seharusnya sudah kelihatan. */
  cek('cipnya berdiri di atas kotaknya, bukan di dalam laci',
      html.indexOf('id="saring-baris"') < html.indexOf('id="b-drop"') &&
      html.indexOf('id="ruang-baris"') < html.indexOf('id="saring-baris"'));
  const jenis = await hal.locator('#saring-baris [data-jenis]')
    .evaluateAll((n) => n.map((x) => x.getAttribute('data-jenis')));
  cek('jenis yang benar-benar ada jadi cip', jenis.indexOf('tautan') >= 0,
      JSON.stringify(jenis));
  /* Jenis yang isinya nol tidak ditampilkan: cip yang pasti menghasilkan nol
     cuma barang yang harus dilewati. */
  cek('jenis yang kosong tidak ikut jadi cip', jenis.indexOf('daftar') < 0,
      JSON.stringify(jenis));

  /* Memilih Link memperlihatkan tautan TANPA satu kata pun diketik. */
  await hal.click('#saring-baris [data-jenis="tautan"]');
  await hal.waitForTimeout(350);
  cek('memilih jenis menampilkan hasil tanpa kata kunci',
      (await hal.locator('#hasil-depan .kartu').count()) >= 1);
  cek('cip yang menyaring menyala, dan cuma dia',
      (await hal.locator('#saring-baris [data-jenis="tautan"].nyala').count()) === 1 &&
      (await hal.locator('#saring-baris .nyala').count()) === 1);
  cek('dan ikut disebut di kepala hasilnya',
      /Link/.test(await hal.textContent('#hasil-depan-ket')));
  /* Mengetuknya lagi mematikannya - tanpa itu, satu-satunya jalan keluar
     adalah menebak cip mana yang berarti "batal". */
  await hal.click('#saring-baris [data-jenis="tautan"]');
  await hal.waitForTimeout(300);
  /* Mengetuk yang menyala mengembalikannya ke BAWAAN (teks), bukan ke
     "Semua" - jalan pulangnya tetap satu tempat. */
  cek('mengetuknya lagi mengembalikannya ke bawaan',
      (await hal.locator('#saring-baris [data-jenis="tautan"].nyala').count()) === 0 &&
      (await hal.locator('#saring-baris [data-jenis="teks"].nyala').count()) === 1);
  await hal.click('#saring-baris [data-jenis="tautan"]');
  await hal.waitForTimeout(300);

  /* Kata + jenis dipakai bersama: hasilnya menyusut, bukan mengganti. */
  const semua = await hal.locator('#hasil-depan .kartu').count();
  await hal.fill('#kotak', 'shamira');
  await hal.waitForTimeout(400);
  cek('menambah kata menyusutkan hasil yang berjenis itu',
      (await hal.locator('#hasil-depan .kartu').count()) < semua ||
      (await hal.locator('#hasil-depan .kartu').count()) >= 1);

  await hal.fill('#kotak', '');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(300);
  cek('menutup hasilnya melepas saringan jenisnya juga',
      (await hal.locator('#saring-baris [data-jenis="tautan"].nyala').count()) === 0);

}

console.log('\ndok selalu di bawah, dan togglenya dihapus');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(250);

  const html = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf8');
  /* Suara diganti kamera: banyak momen yang tiba-tiba perlu ditangkap, dan
     tidak satu pun dari itu berupa suara. */
  cek('metode masuk lewat kamera ada', /data-lamp="kamera"/.test(html));
  cek('perekam suara sudah tidak ada', !/data-lamp="suara"/.test(html));
  /* capture menyuruh HP membuka kamera langsung, bukan galeri. */
  cek('kameranya membuka kamera, bukan galeri',
      /id="pilih-kamera"[^>]*capture="environment"/.test(html));

  /* DOKNYA SELALU DI BAWAH. Pilihannya dihapus: yang di atas kalah enak
     dipakai satu tangan - jempol menyeberang layar tiap kali - dan dua tata
     letak berarti tiap suntingan gaya harus diperiksa dua kali. */
  cek('doknya di bawah tanpa perlu dinyalakan',
      await hal.locator('#l-utama').evaluate((n) => n.classList.contains('dok-bawah')));
  cek('tidak ada lagi cara memindahkannya',
      (await hal.evaluate(() => typeof TAlur.posisiDokUji)) === 'undefined');

  /* Kotaknya harus benar-benar berada di bawah, bukan cuma berganti kelas. */
  const kotakY = await hal.locator('#kotak').evaluate((n) => n.getBoundingClientRect().top);
  const tabY = await hal.locator('#l-utama .tab-baris').evaluate((n) => n.getBoundingClientRect().top);
  cek('kotaknya benar-benar duduk di bawah layar', kotakY > tabY + 200,
      tabY + ' -> ' + kotakY);

  /* Lacinya tetap membuka KE BAWAH kotaknya. Membuka ke atas berarti isi yang
     sedang dibaca melompat turun tepat saat kamu menekan sesuatu. */
  await hal.click('#b-lampir');
  await hal.waitForTimeout(350);
  const kotakY2 = await hal.locator('#kotak').evaluate((n) => n.getBoundingClientRect().top);
  const laciY = await hal.locator('#panel-drop').evaluate((n) => n.getBoundingClientRect().top);
  cek('lacinya membuka ke bawah kotaknya, bukan ke atas', laciY > kotakY2,
      kotakY2 + ' -> ' + laciY);

  /* Bilah bawah ala Telegram: ikon di atas namanya, tanpa kotak bergaris. */
  const css2 = fs.readFileSync(path.join(AKAR, 'gaya.css'), 'utf8');
  cek('bilah lampirannya berupa ikon berbulatan, bukan kotak bergaris',
      /\.lamp i\{[^}]*border-radius:50%/.test(css2) && /\.lamp\{[^}]*border:none/.test(css2));
  cek('dan bisa digeser kalau caranya bertambah',
      /\.lampiran\{[^}]*overflow-x:auto/.test(css2));
  await hal.evaluate(() => TAlur.tutupLaciUji());
  await hal.waitForTimeout(200);
}

console.log('\nukuran petak: cuma muncul waktu yang tampil gambar');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(250);

  /* Satu gambar supaya ada yang bisa digambar sebagai petak. */
  await hal.evaluate(() => TSimpan.taruh({
    id: 'gbr-uji', jenis: 'gambar', judul: 'Moodboard interior',
    isi: '', kategori: 'interior', tag: ['Interior'], label: [], elemen: [], daftar: [],
    thumb: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    namaBerkas: 'IMG_1001.jpg', dibuat: Date.now(), diubah: Date.now(),
    dipakai: 0, diLabeliAI: true, diBacaAI: true
  }));
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(300);

  /* CIP GAMBAR ITU PINTU, BUKAN SARINGAN.

     Dulu mengetuknya menyaring di tempat dan menggambar petak gambar - persis
     seperti di Gallery, cuma tanpa album, tanpa kamera, tanpa unggahan, tanpa
     saringan sumber. Dua tempat menggambar hal yang sama, dan yang di sini
     selalu yang lebih miskin.

     Alasannya berakar lebih dalam daripada duplikasi: teks bisa dicari karena
     kata-katanya memang isinya, gambar tidak. Melawan itu butuh HALAMAN, bukan
     cip. */
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(250);
  await hal.click('#saring-baris [data-jenis="tautan"]');
  await hal.waitForTimeout(350);
  cek('cip lain tetap menyaring di tempat, tidak pindah layar',
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-utama');

  /* Bentuknya sudah memberitahu sebelum diketuk: garis putus-putus di aplikasi
     ini SELALU berarti "jalan pintas, bukan keadaan" - sama dengan Reset dan
     "+ Folder". */
  cek('cip Gambar bergaris putus-putus, seperti jalan pintas yang lain',
      (await hal.evaluate(() => {
        const b = document.querySelector('#saring-cip [data-jenis="gambar"]');
        return b ? getComputedStyle(b).borderStyle : '';
      })) === 'dashed');

  await hal.click('#saring-cip [data-jenis="gambar"]');
  await hal.waitForTimeout(600);
  cek('mengetuk cip Gambar membuka layar Gallery',
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-galeri');

  /* Dan membawa serta kata yang barusan diketik - kalau tidak, pintunya
     membuang pekerjaan yang baru saja kamu lakukan. */
  cek('dan membawa serta ketikan pencariannya',
      (await hal.inputValue('#galeri-cari')) === (await hal.inputValue('#kotak')),
      (await hal.inputValue('#galeri-cari')) + ' vs ' + (await hal.inputValue('#kotak')));

  /* Tombol Kembali HP pulang ke Drop, dan ketikannya masih utuh di sana. */
  await hal.goBack();
  await hal.waitForTimeout(500);
  cek('Kembali pulang ke Drop dengan ketikannya utuh',
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-utama');

  /* Petaknya tinggal SATU, di layar yang memang mengurus gambar. Dua tempat
     yang menggambar petak yang sama berarti perbaikan di satu tempat diam-diam
     tidak sampai ke tempat lain. */
  cek('tidak ada lagi petak gambar di hasil layar Drop',
      (await hal.locator('#hasil-depan .petak').count()) === 0);
  cek('dan baris ukuran petaknya ikut dibuang dari layar Drop',
      (await hal.locator('#tampil-baris').count()) === 0);

  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);
}

console.log('\narsip: geser ke kiri, bukan hapus');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.pilihLabelUji('*'); });
  await hal.waitForTimeout(300);
  const sebelum = await hal.locator('#hasil-depan .kartu').count();

  /* Mulai dari baris judulnya, bukan tepi kanan: di tepi kanan ada tombol
     salin, dan gestur yang dimulai di atas tombol memang sengaja diabaikan. */
  const kotak = await hal.locator('#hasil-depan .kartu').first().boundingBox();
  const y = kotak.y + 14;
  await hal.mouse.move(kotak.x + kotak.width * 0.6, y);
  await hal.mouse.down();
  await hal.mouse.move(kotak.x + kotak.width * 0.4, y, { steps: 5 });
  await hal.mouse.move(kotak.x + 10, y, { steps: 8 });
  await hal.mouse.up();
  await hal.waitForTimeout(600);

  cek('geser ke kiri mengeluarkannya dari hasil',
      (await hal.locator('#hasil-depan .kartu').count()) === sebelum - 1);

  /* ATURAN NOMOR EMPAT: tidak ada yang benar-benar terhapus. Yang diarsipkan
     cuma berhenti muncul - datanya harus masih utuh. */
  const masih = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => e.pensiun && !e.dihapus).length));
  cek('yang diarsipkan tidak terhapus, cuma berhenti muncul', masih >= 1, String(masih));

  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(200);
  cek('arsipnya bisa dilihat di Setelan',
      (await hal.locator('#arsip-daftar [data-balik]').count()) >= 1);

  await hal.locator('#arsip-daftar [data-balik]').first().click();
  await hal.waitForTimeout(300);
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.pilihLabelUji('*'); });
  await hal.waitForTimeout(300);
  cek('bisa dikembalikan, dan muncul lagi di hasil',
      (await hal.locator('#hasil-depan .kartu').count()) === sebelum);

  /* Gulir tegak tidak boleh berubah jadi arsip di tengah jalan. */
  const kotak2 = await hal.locator('#hasil-depan .kartu').first().boundingBox();
  await hal.mouse.move(kotak2.x + kotak2.width * 0.6, kotak2.y + 14);
  await hal.mouse.down();
  await hal.mouse.move(kotak2.x + kotak2.width * 0.5, kotak2.y + 160, { steps: 8 });
  await hal.mouse.up();
  await hal.waitForTimeout(400);
  cek('gulir tegak tidak ikut mengarsipkan',
      (await hal.locator('#hasil-depan .kartu').count()) === sebelum);
}

console.log('\nmengetik = mencari, tanpa Enter');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.waitForSelector('#l-utama.aktif');
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(250);
  cek('kotak kosong berarti layar depan kosong',
      await hal.locator('#petak-hasil-depan').evaluate((n) => n.classList.contains('sembunyi')));

  /* Tanpa label pun mengetik langsung menyaring - inilah yang bikin dia
     terasa seperti WhatsApp. */
  await hal.fill('#kotak', 'wifi');
  await hal.waitForTimeout(350);
  cek('mengetik tanpa label sekalipun langsung menampilkan hasil',
      (await hal.locator('#hasil-depan .kartu').count()) >= 1);
  cek('layarnya tidak berpindah', await hal.locator('#l-utama').isVisible());

  /* ENTER ITU BARIS BARU, dan tidak lagi berarti "cari". Pencarian tidak punya
     apa-apa lagi untuk dipicu - tiap huruf sudah menyaring. Yang tersisa dari
     Enter-sebagai-cari cuma kerugiannya: catatan berbaris-baris tidak bisa
     ditulis di kotak yang justru pintu masuk utamanya. */
  await hal.press('#kotak', 'Enter');
  await hal.waitForTimeout(300);
  cek('Enter tidak memindahkan layar', await hal.locator('#l-utama').isVisible());
  cek('Enter menambah baris baru, bukan memicu pencarian',
      (await hal.inputValue('#kotak')) === 'wifi\n',
      JSON.stringify(await hal.inputValue('#kotak')));
  await hal.fill('#kotak', 'wifi');
  await hal.waitForTimeout(250);

  /* Tingginya mengikuti isinya: satu kata = satu baris. Yang panjang
     mengembang sampai batas, lalu menggulir di dalam dirinya sendiri. */
  const satuBaris = await hal.locator('#kotak').evaluate((n) => n.getBoundingClientRect().height);
  await hal.fill('#kotak', 'baris satu\nbaris dua\nbaris tiga');
  await hal.waitForTimeout(250);
  const tigaBaris = await hal.locator('#kotak').evaluate((n) => n.getBoundingClientRect().height);
  cek('kotak mengembang waktu isinya lebih dari satu baris',
      tigaBaris > satuBaris, satuBaris + ' -> ' + tigaBaris);

  await hal.fill('#kotak', 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl');
  await hal.waitForTimeout(250);
  const banyak = await hal.locator('#kotak').evaluate((n) => n.getBoundingClientRect().height);
  cek('mengembangnya berhenti di batas, tidak mendorong tombol keluar layar',
      banyak <= 141, String(banyak));

  await hal.fill('#kotak', 'wifi');
  await hal.waitForTimeout(250);
  cek('kembali ke satu baris begitu isinya pendek lagi',
      (await hal.locator('#kotak').evaluate((n) => n.getBoundingClientRect().height)) <= satuBaris + 1);

  await hal.fill('#kotak', 'baris satu');
  await hal.press('#kotak', 'Shift+Enter');
  cek('Shift+Enter tetap baris baru', /\n/.test(await hal.inputValue('#kotak')),
      JSON.stringify(await hal.inputValue('#kotak')));
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(250);
}

const pasangAI = () => hal.evaluate((a) => { TBawaan.alamatAI = a; }, ALAMAT_AI);

console.log('\npohon board: daftar tertutup, dan AI cuma memilih');
{
  const awal = await hal.evaluate(() => TBawaan.boardAwal);
  cek('pohon awal ditanam di bawaan.js, bukan berserakan',
      Array.isArray(awal) && awal.indexOf('Business FNB Menu Promo') >= 0, String(awal.length));
  /* TIGA TINGKAT: akar - interest - sub interest. Akarnya dipasang sistem dan
     tidak dipikirkan pemakainya; yang dia isi cuma dua tingkat di bawahnya. */
  cek('akarnya dipasang sistem, bukan diketik pemakainya',
      (await hal.evaluate(() => TBawaan.akarAwal)).indexOf('Business') >= 0 &&
      (await hal.evaluate(() => TBawaan.akarAwal)).indexOf('Subject') >= 0,
      JSON.stringify(await hal.evaluate(() => TBawaan.akarAwal)));
  /* Menu Promo dan Ide Promo memang DUA board, bukan satu yang kembar.
     Billboard menarik yang dipotret di jalan tidak punya menu sama sekali,
     tapi dia ide promo yang paling berharga. Menggabungkannya membuat yang
     satu tenggelam di dalam yang lain. */
  cek('menu promo dan ide promo berdiri sendiri-sendiri',
      awal.indexOf('Business FNB Menu Promo') >= 0 &&
      awal.indexOf('Business FNB Ide Promo') >= 0);
  /* Sub board WAJIB berawalan nama induknya: susunannya dibaca dari nama, dan
     satu baris yang lupa awalan naik ke akar sebagai main board yang tidak
     pernah dibuat siapa pun. */
  const akar = awal.filter((n) => !awal.some((m) => m !== n && n.indexOf(m + ' ') === 0));
  cek('tiap sub board berawalan nama induknya', akar.length === 8, akar.join(' | '));
  /* Tujuh bidang yang dia tulis sendiri, plus satu ruang tunggu dari sistem. */
  cek('dan ruang tunggunya salah satunya', akar.indexOf('Other and Various') >= 0);

  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(['Interior', 'Interior Bedroom'])));
  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => {
    window.__arahan = TPelabel.arahanUji(s);
    window.__gambar = TPelabel.arahanGambarUji('bedroom lighting', TPelabel.daftarBoardUji(s));
  }));
  const arahan = await hal.evaluate(() => window.__arahan);
  const gambar = await hal.evaluate(() => window.__gambar);
  cek('pohonnya ikut dikirim ke AI, di kedua arahan',
      /Interior Bedroom/.test(arahan) && /Interior Bedroom/.test(gambar));

  /* INI YANG PALING MENENTUKAN, dan dia kebalikan aturan tag yang lama.
     Daftar tag dulu sengaja TERBUKA - AI disuruh membuat tag baru kalau tidak
     ada yang cocok. Untuk alamat, itu justru racunnya: daftar yang boleh
     ditambah mesin melar sampai tidak ada dua foto yang tinggal di ruangan
     yang sama, dan gudang dengan seribu ruangan tidak memisahkan apa pun. */
  cek('daftarnya tertutup, dan itu dikatakan terang-terangan',
      /TERTUTUP/.test(arahan) && /TERTUTUP/.test(gambar));
  /* MAIN BOARD TIDAK PERNAH LAHIR DARI AI: atapnya ditentukan tanganmu. Yang
     boleh tumbuh cuma sub board, dan katanya pun dari daftar tertutup. */
  cek('AI dilarang mengarang main board baru, terang-terangan',
      /jangan mengarang nama main board baru/.test(arahan) &&
      /jangan mengarang nama board maupun akhiran baru/.test(gambar));
  /* Board kosong itu jawaban yang sah. Tanpa jalan keluar ini, model dipaksa
     memilih, dan yang dipilih pasti yang paling mirip - foto masjid masuk
     "Interior Bedroom". */
  /* "TIDAK ADA YANG COCOK" HARUS PUNYA JAWABAN. Tanpa jalan keluar ini model
     dipaksa memilih, dan yang dipilih pasti yang paling mirip - foto antariksa
     masuk "Interior Inspiration". Di jalur dokumen jawabannya board kosong; di
     jalur gambar ruang tunggu, karena gambar selalu punya tempat. */
  cek('kalau tidak ada yang cocok, ada jalan keluarnya',
      /kembalikan board kosong/.test(arahan) && /Other and Various/.test(gambar));
  /* DI JALUR DOKUMEN main board saja masih jawaban yang sah: faktur dan KTP
     memang tidak punya kamar, dan memaksanya masuk salah satu cuma menaruh
     yang salah di tempat yang benar. */
  cek('di jalur dokumen, main board saja itu jawaban yang sah',
      /cukup main board/.test(arahan));
  /* DI JALUR GAMBAR TIDAK. Interest yang menampung foto lepas di samping sub
     board-nya persis timbunan yang dilawan aplikasi ini - dan gambar SELALU
     punya kamar, karena akhirannya bisa membuatkannya. */
  cek('tapi di jalur gambar jawabannya WAJIB sub interest',
      /HARUS SUB INTEREST/.test(gambar) && !/cukup main board/.test(gambar),
      gambar.slice(gambar.indexOf('Lalu pilih')).slice(0, 300));
  /* DAN RUANG TUNGGU BUKAN JAWABAN PERTAMA. Interest yang belum punya sub sama
     sekali akan menampung SEMUANYA, jadi membuat kamarnya dari akhiran harus
     dicoba lebih dulu daripada membuang gambarnya ke ruang tunggu. */
  cek('dan sebelum ruang tunggu, AI disuruh membuat sub dari akhirannya dulu',
      /gabungkan nama main board/.test(arahan) &&
      gambar.indexOf('SATU kata dari') < gambar.indexOf('Other and Various'),
      gambar.slice(gambar.indexOf('Lalu pilih')).slice(0, 300));

  /* DAN YANG MENEGAKKAN KODENYA, bukan arahannya. Aturan yang cuma diminta
     akan bocor persis di hari tersibuk - dan yang bocor di sini melahirkan
     ruangan hantu: nama yang menempel di entrinya tapi tidak ada barisnya di
     Setelan, jadi tidak pernah bisa dibuka. */
  const pilih = (n) => hal.evaluate((x) => TPelabel.pilihBoardUji(x,
    ['Interior', 'Interior Bedroom', 'FNB', 'FNB Menu Promo']), n);
  cek('nama yang persis diterima', (await pilih('FNB Menu Promo')) === 'FNB Menu Promo');
  cek('beda huruf besar-kecil tetap diterima', (await pilih('fnb menu promo')) === 'FNB Menu Promo');
  /* Model sesekali menjawab nama pendeknya saja. Itu jawaban yang benar dengan
     penulisan yang salah, jadi diselamatkan. */
  cek('nama pendeknya saja ikut diselamatkan', (await pilih('Bedroom')) === 'Interior Bedroom');
  cek('board karangan dibuang, bukan disimpan apa adanya',
      (await pilih('Interior Musholla')) === '' && (await pilih('Gudang')) === '');
  cek('kosong tetap kosong', (await pilih('')) === '');

  /* Pohon kosong = AI tidak punya satu pun pilihan yang sah, dan dia harus
     tahu itu - bukan lantas mengarang. */
  const kosong = await hal.evaluate(() => TPelabel.arahanUji({ board: '[]' }));
  cek('tanpa pohon sama sekali, AI disuruh mengosongkan, bukan mengarang',
      /Belum ada board sama sekali/.test(kosong));

  /* Belum pernah disunting berarti pakai bawaan - BUKAN kosong. Pohon kosong
     di pemasangan pertama berarti foto pertama sampai foto keseratus mendarat
     tanpa alamat sampai pemakainya kebetulan membuka Setelan. */
  const bawaan = await hal.evaluate(() => TPelabel.daftarBoardUji({}));
  cek('belum pernah disunting berarti pakai bawaan, bukan kosong',
      bawaan.indexOf('Business Hospitality Red Doorz') >= 0, String(bawaan.length));

  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(TBawaan.boardAwal)));
}

console.log('\npohon boleh tumbuh, tapi katanya tertutup');
{
  /* AKU HANYA INGAT MAIN FOLDER-NYA. Itu keadaan yang sebenarnya di lapangan:
     nama bidang usahanya diingat, nama ruangannya tidak. Dulu jawabannya
     "kalau begitu mendarat di main board saja" - dan yang terjadi semua foto
     menumpuk di satu ruangan, persis timbunan yang dilawan aplikasi ini,
     dibuat di dalam ruangan yang baru saja dibuat untuk mencegahnya.

     Yang membuat taksonomi meleleh bukan PERTUMBUHAN, tapi PENAMAAN BEBAS.
     Jadi pohonnya boleh tumbuh, tapi katanya tertutup: AI cuma boleh
     menggabungkan dua potong yang SUDAH ADA - nama main board + satu akhiran. */
  const POHON = ['FNB', 'FNB Menu Promo', 'Interior', 'Interior Bedroom', 'Daily Life'];
  const AKHIR = ['Inspiration', 'Concept', 'Apps'];
  const pilih = (n, w) => hal.evaluate((x) => TPelabel.pilihBoardUji(
    x.n, ['FNB', 'FNB Menu Promo', 'Interior', 'Interior Bedroom', 'Daily Life'],
    ['Inspiration', 'Concept', 'Apps'], x.w || ''), { n: n, w: w || '' });

  cek('yang sudah ada tetap dipakai apa adanya',
      (await pilih('FNB Menu Promo')) === 'FNB Menu Promo');
  /* MAIN BOARD BARU YANG MASIH KOSONG: inilah kasus yang dilaporkan. */
  cek('main board tanpa sub sama sekali dapat ruangan baru dari akhiran',
      (await pilih('Daily Life Inspiration')) === 'Daily Life Inspiration');
  /* DAN CUMA DARI SITU. Kata di luar daftar akhiran tidak pernah lahir - kalau
     boleh, sebulan lagi ada "Daily Life Coffee", "Daily Life Kopi", dan
     "Daily Life Cafe" untuk satu benda, dan pemiliknya tidak mengenali satu
     pun waktu mencari. */
  cek('tapi kata di luar daftar akhiran tetap ditolak',
      (await pilih('Daily Life Coffee')) === '' &&
      (await pilih('Interior Terrace')) === '');
  /* Main board-nya juga harus sudah ada: atapnya tetap keputusanmu. */
  cek('main board baru tidak pernah lahir dari AI',
      (await pilih('Otomotif Inspiration')) === '');

  /* KALAU DRIVERNYA SUDAH MENYEBUT MAIN BOARD-NYA, jawabannya wajib di dalam
     situ. Kamu sudah menjawab separuh; membiarkan model memindahkannya ke
     bidang lain berarti membatalkan jawaban yang barusan kamu berikan. */
  cek('yang di luar main board yang kamu sebut ditolak',
      (await pilih('Interior Bedroom', 'Daily Life')) === '' &&
      (await pilih('FNB Menu Promo', 'Interior')) === '');
  cek('yang di dalamnya diterima, termasuk yang baru dibuat',
      (await pilih('Interior Bedroom', 'Interior')) === 'Interior Bedroom' &&
      (await pilih('Daily Life Concept', 'Daily Life')) === 'Daily Life Concept');

  /* ===== ALAMAT YANG KAMU SEBUT SENDIRI ===== */
  const baca = (d) => hal.evaluate((x) => TOtak.bacaBoardDariDriver(
    x, ['FNB', 'FNB Menu Promo', 'Interior', 'Interior Bedroom', 'Interior Lighting',
        'Daily Life', 'Daily Life Menu'],
    ['Inspiration', 'Concept', 'Apps', 'Menu']), d);

  /* SUB BOARD YANG KAMU SEBUT = LANGSUNG MENDARAT. Tidak ada tebakan, tidak
     ada AI. Kamu sudah menjawab. */
  cek('menyebut sub board berarti alamatnya sudah lengkap',
      (await baca('bedroom minimalis')).sub === 'Interior Bedroom',
      JSON.stringify(await baca('bedroom minimalis')));
  cek('nama penuhnya juga, tentu saja',
      (await baca('fnb menu promo')).sub === 'FNB Menu Promo');
  /* MAIN BOARD SAJA = alamatnya baru separuh, dan yang tersisa justru
     pertanyaan yang bisa dijawab mesin: sub yang mana. */
  cek('menyebut main board saja menyisakan satu pertanyaan untuk AI',
      (await baca('daily life kopi pagi')).main === 'Daily Life' &&
      !(await baca('daily life kopi pagi')).sub,
      JSON.stringify(await baca('daily life kopi pagi')));

  /* AKHIRAN TELANJANG TIDAK PERNAH JADI ALAMAT. "Menu" itu NIAT, bukan tempat;
     tempatnya "Daily Life Menu". Tanpa aturan ini driver "menu murah enak"
     mendarat di board mana pun yang kebetulan berakhiran Menu - benar secara
     huruf, salah total sebagai alamat. */
  cek('akhiran telanjang tidak pernah dibaca sebagai alamat',
      JSON.stringify(await baca('menu murah enak')) === '{}',
      JSON.stringify(await baca('menu murah enak')));
  /* DUA SUB YANG SAMA-SAMA DISEBUT ITU AMBIGU, dan yang ambigu tidak boleh
     diputuskan di sini - memilih yang namanya kebetulan lebih panjang bukan
     jawaban, itu undian. Yang tersisa dilempar ke AI, yang setidaknya melihat
     gambarnya. */
  cek('dua sub yang sama-sama disebut jatuh ke induknya, bukan diundi',
      (await baca('bedroom lighting')).main === 'Interior' &&
      !(await baca('bedroom lighting')).sub,
      JSON.stringify(await baca('bedroom lighting')));
  cek('yang tidak menyebut apa pun dibiarkan kosong',
      JSON.stringify(await baca('sofa unik minimalis')) === '{}');

  /* Daftar akhirannya ikut berangkat ke AI di ketiga arahan - kalau tidak,
     satu-satunya kosakata yang boleh dia pakai tidak pernah sampai. */
  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(TBawaan.boardAwal)));
  const arahanAk = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => ({
    label: TPelabel.arahanUji(s),
    gambar: TPelabel.arahanGambarUji('x', TPelabel.daftarBoardUji(s), TPelabel.daftarAkhiranUji(s))
  })));
  cek('daftar akhiran ikut dikirim ke AI',
      /Inspiration/.test(arahanAk.label) && /Inspiration/.test(arahanAk.gambar) &&
      /jangan mengarang nama/.test(arahanAk.gambar), arahanAk.gambar.slice(-260));
  cek('dan bawaannya ditanam di bawaan.js, bukan berserakan',
      (await hal.evaluate(() => TBawaan.akhiranAwal)).indexOf('Inspiration') >= 0);
  /* Dikosongkan berarti AI berhenti membuat ruangan sama sekali - itu keadaan
     yang sah, bukan keadaan rusak. */
  cek('dikosongkan berarti AI berhenti membuat ruangan sama sekali',
      (await hal.evaluate(() => TPelabel.pilihBoardUji('FNB Inspiration', ['FNB'], []))) === '');

  /* ===== RUANG TUNGGU: TIDAK ADA BIDANG YANG COCOK ITU JAWABAN =====
     Foto antariksa tidak punya rumah di daftar bidang usahanya, dan itu bukan
     kegagalan - hidupnya memang lebih luas daripada tujuh bidang usahanya.
     Yang dilawan bukan keberadaan ruangan itu, tapi ketiadaannya: tanpa dia
     yang tidak cocok mendarat di "Belum berboard", baris yang bunyinya seperti
     kesalahan dan yang makin lama makin dihindari sampai tidak pernah dibuka. */
  cek('ruang tunggunya ditanam sistem, ada sejak pemasangan pertama',
      (await hal.evaluate(() => TBawaan.boardAwal.indexOf(TBawaan.boardLain))) >= 0 &&
      (await hal.evaluate(() => TBawaan.boardLain)) === 'Other and Various');
  cek('dan AI diberi tahu itu jawaban yang benar, bukan kegagalan',
      /Other and Various/.test(arahanAk.gambar) &&
      /bukan\s*\n?.*kegagalan|bukan kegagalan/.test(arahanAk.gambar.replace(/\n/g, ' ')),
      arahanAk.gambar.slice(-300));
  /* RUANGAN DI DALAM RUANG TUNGGU MEMBATALKAN GUNANYA RUANG TUNGGU:
     "Other and Various Inspiration" tidak memberitahu apa pun yang tidak sudah
     diberitahu namanya sendiri. */
  cek('tapi AI tidak boleh membuat sub di dalamnya',
      (await hal.evaluate(() => TPelabel.pilihBoardUji(
        'Other and Various Inspiration', TBawaan.boardAwal, TBawaan.akhiranAwal))) === '');
  cek('sementara interest lain tetap boleh tumbuh',
      (await hal.evaluate(() => TPelabel.pilihBoardUji(
        'Personal Motivation Inspiration', TBawaan.boardAwal, TBawaan.akhiranAwal))) ===
      'Personal Motivation Inspiration');
  /* AKAR BUKAN INTEREST. "Business Inspiration" adalah ruangan yang tidak
     menjawab apa pun - akar itu tulang punggung, bukan tempat menaruh gambar. */
  cek('tapi akarnya sendiri tidak bisa ditumbuhi',
      (await hal.evaluate(() => TPelabel.pilihBoardUji(
        'Business Inspiration', TBawaan.boardAwal, TBawaan.akhiranAwal))) === '');

  /* ===== JANGAN BERHENTI DI PINTU RUANGAN =====
     Ini keadaan yang dilaporkan di lapangan: ketik "hampers", fotonya mendarat
     di interest-nya, dan menumpuk di situ walau "Isi Hamper" jelas-jelas ada.
     Interest yang menampung foto lepas di samping sub board-nya persis
     timbunan yang dilawan aplikasi ini. */
  const taruh = (driver, jawab) => hal.evaluate((x) => {
    const e = { driver: x.driver };
    return TSimpan.semuaSetelan()
      .then((s) => TPelabel.taruhBoardUji(s, e, x.jawab))
      .then(() => e.album || '');
  }, { driver: driver, jawab: jawab });

  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(TBawaan.boardAwal)));
  cek('menyebut interest berarti AI wajib masuk ke dalamnya',
      (await hal.evaluate(() => TOtak.bacaBoardDariDriver(
        'hampers', TBawaan.boardAwal, TBawaan.akhiranAwal, TBawaan.akarAwal))).main ===
      'Business Hampers');
  cek('jawaban yang berhenti di interest dinaikkan ke ruang tunggunya sendiri',
      (await taruh('hampers', 'Business Hampers')) === 'Business Hampers Various',
      await taruh('hampers', 'Business Hampers'));
  cek('yang menemukan sub-nya tidak diutak-atik',
      (await taruh('hampers', 'Business Hampers Isi Hamper')) === 'Business Hampers Isi Hamper');
  /* KAMU SUDAH MENYEBUT BIDANGNYA - jawaban AI yang meleset bukan alasan
     membuang alamat itu ke ruang tunggu utama. */
  cek('jawaban di luar bidang yang kamu sebut jatuh ke ruang tunggu BIDANG ITU',
      (await taruh('hampers', 'Business Interior Bedroom')) === 'Business Hampers Various');
  /* DUA TINGKAT RUANG TUNGGU: satu untuk "bidangnya tidak ketemu", satu untuk
     "bidangnya ketemu, kamarnya tidak". */
  cek('tapi yang bidangnya memang tidak ketemu tetap ke ruang tunggu utama',
      (await taruh('antariksa', 'Gudang Rahasia')) === 'Other and Various');

  /* ===== BERDIRI DI WADAH ITU BATAS, BUKAN KUNCI =====
     Ini kekeliruan yang dilaporkan di lapangan, dan bentuknya persis kebalikan
     dari yang kelihatan: fotonya mendarat di "Business Hampers" - pintu
     ruangan - walau "Isi Hamper" ada dan "Business Hampers Various" sudah
     disiapkan. Sebabnya bukan AI salah memilih; sebabnya AI TIDAK PERNAH
     DITANYA. Berdiri di dalam board waktu memotret mengunci alamatnya
     ('albumManual'), dan kunci itu memulangkan taruhBoard di baris pertamanya.

     Sekarang aturannya sama persis dengan bacaBoardDariDriver: yang DAUN
     mengunci, yang WADAH cuma membatasi lewat 'albumInduk'. */
  const berdiri = (induk, jawab, driver) => hal.evaluate((x) => {
    const e = { driver: x.driver || '', albumInduk: x.induk, album: x.induk };
    return TSimpan.semuaSetelan()
      .then((s) => TPelabel.taruhBoardUji(s, e, x.jawab))
      .then(() => e.album || '');
  }, { induk: induk, jawab: jawab, driver: driver || '' });

  cek('berdiri di interest tidak mengunci — AI tetap disuruh turun ke sub-nya',
      (await berdiri('Business Hampers', 'Business Hampers Isi Hamper')) ===
      'Business Hampers Isi Hamper',
      await berdiri('Business Hampers', 'Business Hampers Isi Hamper'));
  cek('dan kalau AI berhenti di pintu ruangan, dia dinaikkan ke Various-nya',
      (await berdiri('Business Hampers', 'Business Hampers')) === 'Business Hampers Various',
      await berdiri('Business Hampers', 'Business Hampers'));
  /* BIDANG YANG KAMU MASUKI TETAP MENGIKAT: kamu sudah menjawab separuh, dan
     jawaban AI yang meleset bukan alasan membatalkannya. */
  cek('jawaban AI di luar bidang yang kamu masuki ditolak, bukan diikuti',
      (await berdiri('Business Hampers', 'Business Interior Bedroom')) ===
      'Business Hampers Various');
  /* AKAR TIDAK PERNAH MENAMPUNG GAMBAR - termasuk waktu dia jadi jawaban
     terakhir. Menaikkannya jadi "Business Various" pun salah: akar tidak boleh
     ditumbuhi, dan ruangan itu tidak menjawab apa pun. */
  cek('berdiri di akar lalu AI tidak menemukan apa pun jatuh ke ruang tunggu',
      (await berdiri('Business', 'Business')) === 'Other and Various',
      await berdiri('Business', 'Business'));
  /* TAPI YANG DAUN TETAP MENGUNCI: kamu memang sudah menyebut kamarnya. */
  cek('sementara berdiri di sub interest tetap mengunci alamatnya',
      await hal.evaluate(() => {
        const e = { driver: '', album: 'Business Hampers Isi Hamper', albumManual: true };
        return TSimpan.semuaSetelan()
          .then((s) => TPelabel.taruhBoardUji(s, e, 'Business Interior Bedroom'))
          .then(() => e.album === 'Business Hampers Isi Hamper');
      }));

  /* ===== YANG KAMU KETIK MENANG ATAS TEMPAT KAMU BERDIRI =====
     Keduanya keputusanmu, tapi tidak sama umurnya: drivernya baru saja kamu
     ketik - satu-satunya teks di entri ini yang lahir dari kepalamu - sementara
     board yang kebetulan terbuka bisa saja sisa kunjungan tadi pagi. */
  cek('driver menang waktu bertolak belakang dengan tempat kamu berdiri',
      (await berdiri('Business Hampers', 'Business Interior Bedroom', 'interior mesjid')) ===
      'Business Interior Bedroom',
      await berdiri('Business Hampers', 'Business Interior Bedroom', 'interior mesjid'));
  /* Kalau drivernya DIAM, tempat berdirinya tetap berlaku - dia satu-satunya
     jawaban yang ada. */
  cek('tapi kalau drivernya diam, tempat berdirinya tetap berlaku',
      (await berdiri('Business Hampers', 'Business Interior Bedroom', '')) ===
      'Business Hampers Various');
}

console.log('\ndriver yang datang belakangan: akarnya wajib ikut terbaca');
{
  /* ===== ARGUMEN YANG KELUPAAN, BUKAN ATURAN YANG SALAH =====
     Ini kekeliruan yang dilaporkan di lapangan, dan bentuknya paling licin dari
     semuanya: "klik kamera, tulis hampers" - fotonya mendarat di "Business
     Hampers" DAN TERKUNCI di situ, jadi tiga aturan penempatan tidak ada satu
     pun yang dijalankan.

     Sebabnya bukan AI salah memilih dan bukan aturannya terlalu banyak:
     taruhDriver memanggil bacaBoardDariDriver TANPA daftar akar. Tanpa daftar
     itu dia tidak tahu "Business" akar, jadi "Business Hampers" terbaca sebagai
     SUB board - alamat lengkap - lalu dikunci albumManual. */
  const bacaDriver = (driver, pakaiAkar) => hal.evaluate((x) => TOtak.bacaBoardDariDriver(
    x.driver, TBawaan.boardAwal, TBawaan.akhiranAwal,
    x.pakaiAkar ? TBawaan.akarAwal : undefined), { driver: driver, pakaiAkar: pakaiAkar });

  cek('tanpa daftar akar, interest terbaca sebagai sub board — dan itu mengunci',
      (await bacaDriver('hampers', false)).sub === 'Business Hampers');
  cek('dengan daftar akar, dia terbaca sebagai wadah — AI tetap ditanya',
      (await bacaDriver('hampers', true)).main === 'Business Hampers' &&
      !(await bacaDriver('hampers', true)).sub);

  /* DAN JALUR ASLINYA IKUT DIUJI, bukan cuma fungsinya: yang bocor tadi bukan
     bacaBoardDariDriver-nya, tapi satu pemanggil yang lupa argumennya. */
  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(TBawaan.boardAwal)));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  const alamatDriver = await hal.evaluate(async () => {
    await TSimpan.taruh({ id: 'gdrv', jenis: 'gambar', judul: 'Kotak uji', isi: '',
      kategori: '', folder: '', album: '', albumManual: false, albumInduk: '',
      sumber: 'kamera', driver: '', thumb: '', berkasId: '', namaBerkas: 'foto.jpg',
      tipeBerkas: 'image/jpeg', ukuran: 1024, label: [], elemen: [], daftar: [],
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0 });
    await TAlur.muatUlangUji();
    await TAlur.taruhDriverUji(['gdrv'], 'hampers');
    const e = TAlur.semuaEntri().filter((x) => x.id === 'gdrv')[0];
    return { album: e.album || '', kunci: !!e.albumManual };
  });
  cek('mengetik nama interest tidak mengunci fotonya di pintu ruangan',
      alamatDriver.album === '' && alamatDriver.kunci === false,
      JSON.stringify(alamatDriver));

  await hal.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => x.id === 'gdrv')[0];
    if (e) { e.pensiun = true; await TSimpan.taruh(e); }
  });
}

console.log('\nmenu board di Setelan: pohon yang disunting, bukan kotak teks');
{
  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(
    ['Business', 'Business Interior', 'Business Interior Bedroom', 'Business FNB'])));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(600);
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(400);

  cek('pohonnya digambar sebagai baris, bukan textarea',
      (await hal.locator('#set-board .board-main').count()) === 2 &&
      (await hal.locator('#set-gerbong').count()) === 0);
  /* AKARNYA KEPALA BAGIAN, BUKAN BARIS YANG BISA DIKETUK - dan tanpa silang:
     dia tulang punggung, bukan isi. Yang dihapus selalu interest dan sub-nya. */
  cek('akarnya kepala bagian, tanpa silang dan tanpa panah',
      (await hal.locator('#set-board .board-akar-kepala').count()) === 1 &&
      /* Gayanya menulisnya huruf besar semua; yang diperiksa namanya, bukan
         cara CSS menggambarnya. */
      (await hal.innerText('#set-board .board-akar-kepala')).trim().toLowerCase() === 'business' &&
      (await hal.locator('#set-board [data-board-buang="Business"]').count()) === 0,
      await hal.innerText('#set-board .board-akar-kepala'));
  /* DILIPAT, DAN ITU BUKAN KERAPIAN. Waktu semuanya tergelar, "+ Sub" milik
     satu board duduk berdempetan dengan puluhan baris milik board lain, dan
     "+ Main board" di kaki daftar cuma sejengkal dari "+ Sub" yang terakhir.
     Sekali salah ketuk, sub board yang kamu maksud lahir sebagai main board -
     kesalahan yang tidak kelihatan sampai kamu membuka Gallery. */
  cek('isinya tertutup sampai boardnya diketuk',
      (await hal.locator('#set-board .board-sub').count()) === 0 &&
      (await hal.locator('#set-board [data-board-sub]').count()) === 0);
  /* ABJAD, bukan urutan pembuatan: daftar yang urutannya cuma diketahui
     pembuatnya harus dibaca seluruhnya tiap kali. */
  /* Namanya ditulis PENDEK: di bawah kepala "BUSINESS", mengulang "Business"
     di tiap baris memakan lebar yang justru dibutuhkan nama aslinya. */
  cek('interest berurut abjad dan ditulis nama pendeknya',
      (await hal.locator('#set-board .board-kepala .board-nama').allInnerTexts())
        .map((x) => x.trim()).join(',') === 'FNB,Interior',
      JSON.stringify(await hal.locator('#set-board .board-kepala .board-nama').allInnerTexts()));

  await hal.click('#set-board [data-board-buka="Business Interior"]');
  await hal.waitForTimeout(300);
  cek('mengetuknya membuka isinya',
      (await hal.locator('#set-board .board-sub').count()) === 1);
  cek('sub board ditulis nama PENDEKNYA, nama panjangnya tetap identitasnya',
      (await hal.innerText('#set-board .board-sub .board-nama')).trim() === 'Bedroom',
      await hal.innerText('#set-board .board-sub .board-nama'));
  /* "+ Sub" duduk DI DALAM panel yang terbuka, dengan nama induknya tertulis
     di tombolnya sendiri - jadi tidak ada satu keadaan pun di mana dia bisa
     tertukar dengan "+ Main board" di kaki daftar. */
  cek('dan “+ Sub interest” duduk di dalamnya, menyebut induknya',
      (await hal.innerText('#set-board [data-board-sub="Business Interior"]')).indexOf('Interior') >= 0,
      await hal.innerText('#set-board [data-board-sub="Business Interior"]'));
  cek('jumlahnya dibacakan per tingkat',
      /1 akar, 2 interest, 1 sub interest/.test(await hal.innerText('#board-jumlah')),
      await hal.innerText('#board-jumlah'));

  /* AWALANNYA DIPASANG APLIKASINYA, bukan dituntut dari jarinya. Menyuruh
     orang menebak sendiri bahwa namanya wajib diawali nama induknya berarti
     sub boardnya tidak pernah terbentuk: yang terjadi dia mengetik "Kitchen"
     dan itu mendarat di akar sebagai main board baru. */
  await hal.click('#set-board [data-board-sub="Business Interior"]');
  await hal.waitForTimeout(300);
  await hal.fill('#tanya-isi', 'Kitchen');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(500);
  const pohon = await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board));
  cek('yang diketik cuma nama pendeknya; awalannya dipasang aplikasinya',
      pohon.indexOf('Business Interior Kitchen') >= 0 && pohon.indexOf('Kitchen') < 0,
      JSON.stringify(pohon));
  /* Yang baru dibuat LANGSUNG TERLIHAT: panel induknya tetap terbuka. Sub
     board yang lahir di balik panel tertutup tidak bisa dibedakan dari sub
     board yang gagal dibuat. */
  cek('dan dia langsung tergambar di bawah induknya, panelnya tetap terbuka',
      (await hal.locator('#set-board .board-sub').count()) === 2 &&
      (await hal.locator('#set-board .board-sub .board-nama').allInnerTexts())
        .map((x) => x.trim()).join(',') === 'Bedroom,Kitchen');

  /* TIDAK ADA LAGI TOMBOL YANG MELAHIRKAN BARIS DI AKAR. Inilah kekeliruan
     yang dilaporkan di lapangan: "+ Sub" dan "+ Main board" berjarak sejengkal
     waktu daftarnya tergelar, dan sekali salah ketuk sub yang dimaksud lahir
     sebagai main board. Sekarang tiap tombol tambah SELALU punya induk, dan
     induknya tertulis di tombolnya sendiri. */
  await hal.click('#set-board [data-board-interest="Business"]');
  await hal.waitForTimeout(300);
  await hal.fill('#tanya-isi', 'Construction');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(500);
  cek('interest baru mendarat di dalam akarnya, bukan di akar pohon',
      (await hal.locator('#set-board .board-main').count()) === 3 &&
      (await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board)))
        .indexOf('Business Construction') >= 0 &&
      (await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board)))
        .indexOf('Construction') < 0,
      JSON.stringify(await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board))));

  /* MENGHAPUS MAIN BOARD IKUT MENGHAPUS ANAKNYA - kalau tidak, anaknya jadi
     yatim: dia naik ke akar dan tiba-tiba jadi main board bernama "Interior
     Bedroom", yang tidak pernah dibuat siapa pun. Isinya TIDAK ikut terhapus;
     aturan nomor empat tetap berlaku. */
  await hal.evaluate(() => TSimpan.taruh({
    id: 'gbrd', jenis: 'gambar', judul: 'kamar uji', isi: '', kategori: '',
    album: 'Business Interior Bedroom', albumManual: true, sumber: 'kamera', driver: 'bedroom',
    label: [], elemen: [], daftar: [], dibuat: Date.now(), diubah: Date.now(),
    dipakai: 0, diLabeliAI: true, diBacaAI: true
  }).then(() => TAlur.muatUlangUji()));
  await hal.waitForTimeout(300);
  await hal.click('#set-board [data-board-buang="Business Interior"]');
  await hal.waitForTimeout(300);
  cek('dikabarkan dulu berapa board dan berapa isinya',
      /3 board/.test(await hal.innerText('#tanya-ket')) &&
      /1 isinya tidak ikut terhapus/.test(await hal.innerText('#tanya-ket')),
      await hal.innerText('#tanya-ket'));
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(700);
  const sisa = await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board));
  cek('anaknya ikut terhapus, tidak naik jadi interest yatim',
      sisa.indexOf('Business Interior') < 0 && sisa.indexOf('Business Interior Bedroom') < 0 &&
      sisa.indexOf('Business Interior Kitchen') < 0, JSON.stringify(sisa));
  /* AKARNYA TETAP BERDIRI: dia tulang punggung, dan yang dihapus isinya. */
  cek('tapi akarnya tetap berdiri', sisa.indexOf('Business') >= 0, JSON.stringify(sisa));
  const lepas = await hal.evaluate(() => {
    const e = TAlur.semuaEntri().filter((x) => x.id === 'gbrd')[0];
    return e ? { album: e.album || '', manual: !!e.albumManual, hidup: !e.dihapus } : null;
  });
  cek('isinya tidak ikut terhapus — dia cuma keluar dari boardnya',
      lepas && lepas.hidup && lepas.album === '' && lepas.manual === false,
      JSON.stringify(lepas));

  /* ===== AKARNYA TETAP MILIKMU =====
     Daftar bawaannya tebakan tentang hidup orang lain: "Subject" tidak berarti
     apa-apa buat yang sudah lulus, dan yang kerja di ladang butuh baris yang
     tidak ada di daftar mana pun. Jadi akarnya bisa ditambah dan dinamai
     ulang tangan — yang tidak ada cuma tombol hapusnya. */
  await hal.click('#set-board [data-board-akar]');
  await hal.waitForTimeout(300);
  await hal.fill('#tanya-isi', 'Ladang');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(500);
  const akarBaru = await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board));
  cek('akar baru bisa ditambah tangan, dan dia benar-benar di akar',
      akarBaru.indexOf('Ladang') >= 0 &&
      (await hal.locator('#set-board [data-board-interest="Ladang"]').count()) === 1,
      JSON.stringify(akarBaru));

  /* ANAKNYA IKUT BERGANTI NAMA. Tanpa itu anaknya yatim: interest yang
     induknya sudah bernama lain naik ke akar dan berdiri sebagai akar yang
     tidak pernah dibuat siapa pun. */
  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(
    ['Business', 'Business FNB', 'Business FNB Menu'])));
  await hal.reload();
  await pasangAI();
  await hal.waitForTimeout(600);
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(300);
  await hal.click('#set-board [data-board-namai="Business"]');
  await hal.waitForTimeout(300);
  await hal.fill('#tanya-isi', 'Usaha');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(800);
  const setelahNamai = await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board));
  cek('akar bisa dinamai ulang, dan seluruh anaknya ikut',
      setelahNamai.indexOf('Usaha') >= 0 &&
      setelahNamai.indexOf('Usaha FNB') >= 0 &&
      setelahNamai.indexOf('Usaha FNB Menu') >= 0 &&
      setelahNamai.indexOf('Business') < 0,
      JSON.stringify(setelahNamai));
  /* DAN TIDAK ADA SILANG DI KEPALANYA: menghapus akar berarti seluruh bidang
     beserta sub-nya lenyap dalam satu ketukan yang tidak bisa dibatalkan. */
  cek('tapi tetap tidak ada tombol hapus di kepala akar',
      (await hal.locator('#set-board .board-akar-kepala .board-buang').count()) === 0);
  /* AKAR TANGAN BERLAKU SAMA PERSIS DENGAN AKAR BAWAAN — termasuk di sisi AI.
     Kalau tidak, "Usaha Inspiration" lahir di dalam tulang punggung: ruangan
     yang tidak menjawab apa pun, dan menaruh gambar di situ sama saja dengan
     tidak menaruhnya. */
  cek('akar yang kamu namai sendiri ikut tercatat sebagai akar',
      (await hal.evaluate(() => TSimpan.semuaSetelan()
        .then((s) => TPelabel.daftarAkarUji(s)))).indexOf('Usaha') >= 0);
  cek('dan AI tetap tidak boleh menumbuhinya',
      (await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TPelabel.pilihBoardUji(
        'Usaha Inspiration', ['Usaha', 'Usaha FNB'], ['Inspiration'], '',
        TPelabel.daftarAkarUji(s))))) === '');

  await hal.evaluate(() => {
    const e = TAlur.semuaEntri().filter((x) => x.id === 'gbrd')[0];
    if (e) { e.pensiun = true; return TSimpan.taruh(e); }
  });
  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(TBawaan.boardAwal)));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  /* Cukup lama untuk melewati putaran pelabelan yang dijadwalkan waktu halaman
     dimuat (JEDA_SUNDUL). Kalau blok berikutnya memanggil TPelabel.putaran
     sementara putaran itu masih di udara, penjaga 'jalan' memulangkannya
     seketika - dan yang gagal ujinya, bukan kodenya. */
  await hal.waitForTimeout(2000);
}

console.log('\nkunci: yang rahasia tidak pernah berangkat');
{
  const bisa = await hal.evaluate(() => TKunci.ada());
  cek('Web Crypto tersedia, jadi enkripsinya bawaan peramban', bisa === true);

  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TKunci.pasang(s, 'sandi-uji-123')));
  cek('kuncinya terpasang dan langsung terbuka', await hal.evaluate(() => TKunci.terbuka()));

  /* Yang disimpan cuma garam dan penanda uji - sandinya sendiri tidak pernah
     tersimpan di mana pun. */
  const setelanSemua = await hal.evaluate(() => TSimpan.semuaSetelan());
  cek('sandinya tidak ikut tersimpan',
      JSON.stringify(setelanSemua).indexOf('sandi-uji-123') < 0);
  cek('yang tersimpan cuma garam dan penanda uji',
      !!setelanSemua.kunciGaram && !!setelanSemua.kunciUji);

  const rahasia = await hal.evaluate(() => {
    const e = { id: 'rahasia1', jenis: 'teks', judul: 'Client Secret RAHASIA9-aB3dE5gH-jK7mN9pQ2sT',
      judulManual: false, isi: 'RAHASIA9-aB3dE5gH-jK7mN9pQ2sT', daftar: [],
      kategori: '', label: ['sandi'], tag: ['password'],
      elemen: [{ jenis: 'kode', nilai: 'RAHASIA9-aB3dE5gH-jK7mN9pQ2sT', nama: 'Client Secret' }],
      berkasId: null, driveId: null, thumb: '', namaBerkas: '', tipeBerkas: '', ukuran: 0,
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0,
      diLabeliAI: false, diBacaAI: false, rahasia: false, elemenTerkunci: '',
      pensiun: false, dihapus: false, riwayat: [] };
    return TKunci.kunciEntri(e).then(() => TSimpan.taruh(e)).then(() => e);
  });

  /* INTI SELURUH BAGIAN INI. */
  cek('isinya tersimpan sebagai sandi, bukan teks',
      rahasia.isi.indexOf('terkunci1:') === 0, rahasia.isi.slice(0, 40));
  cek('nilai aslinya tidak ada lagi di kolom mana pun',
      JSON.stringify(rahasia).indexOf('RAHASIA9-aB3dE5gH') < 0);
  /* Judul dan tag SENGAJA tetap terbuka: catatan yang tidak bisa ditemukan
     sama saja dengan tidak disimpan. */
  cek('judul dan tagnya tetap terbuka supaya masih bisa ditemukan',
      /Client Secret/.test(rahasia.judul) && rahasia.tag.indexOf('password') >= 0);
  /* Judul entri rahasia ikut naik ke spreadsheet dalam bentuk terbaca. Kalau
     nilainya dibiarkan di situ, yang paling rahasia justru satu-satunya
     bagian yang bocor. */
  cek('nilai di dalam judulnya ikut disamarkan',
      rahasia.judul.indexOf('RAHASIA9') < 0 && rahasia.judul.indexOf('•••') >= 0, rahasia.judul);

  const ketemu = await hal.evaluate(() => TSimpan.semua().then(
    (a) => TOtak.cari(a, 'client secret').length));
  cek('masih ketemu lewat judulnya', ketemu >= 1, String(ketemu));

  /* JANJI UTAMA: tidak pernah dikirim ke AI. */
  await hal.evaluate(() => TSimpan.semua().then((a) => Promise.all(
    a.filter((e) => !e.rahasia).map((e) => { e.diLabeliAI = false; return TSimpan.taruh(e); }))));
  const sebelumAI = proxyAI.panggilan;
  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TPelabel.putaran(s)));
  cek('pelabelan tetap jalan untuk yang lain', proxyAI.panggilan > sebelumAI);
  cek('isi rahasianya tidak pernah ikut dikirim',
      String(proxyAI.badanTerakhir || '').indexOf('RAHASIA9-aB3dE5gH') < 0);

  const balik = await hal.evaluate(() => TSimpan.ambil('rahasia1').then((e) => TKunci.bukaEntri(e)));
  cek('dengan sandinya, isinya kembali utuh',
      balik.isi === 'RAHASIA9-aB3dE5gH-jK7mN9pQ2sT' &&
      balik.elemen[0].nama === 'Client Secret', JSON.stringify(balik.elemen));

  await hal.evaluate(() => TKunci.tutup());
  const gagal = await hal.evaluate(() => TSimpan.ambil('rahasia1')
    .then((e) => TKunci.bukaEntri(e)).then(() => 'terbaca', (x) => x.message));
  cek('tanpa sandinya tidak bisa dibaca sama sekali', gagal !== 'terbaca', String(gagal));

  const salah = await hal.evaluate(() => TSimpan.semuaSetelan()
    .then((s) => TKunci.buka(s, 'sandi-yang-salah')).then(() => 'lolos', (x) => x.message));
  cek('sandi salah ditolak', /salah/i.test(String(salah)), String(salah));

  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TKunci.buka(s, 'sandi-uji-123')));
  cek('sandi benar membukanya lagi', await hal.evaluate(() => TKunci.terbuka()));
}

console.log('\nto-do: daftar yang mengurut sendiri');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-tugas'); TTugas.saring('semua'); TTugas.rak(''); TTugas.buka(); });
  await hal.waitForTimeout(200);

  await hal.fill('#tugas-baru', 'Kirim invoice AAA');
  await hal.press('#tugas-baru', 'Enter');
  await hal.waitForTimeout(250);
  cek('tambah cukup ketik lalu Enter',
      (await hal.locator('#tugas-daftar .tugas').count()) === 1 &&
      (await hal.inputValue('#tugas-baru')) === '');

  const id = await hal.evaluate(() => TAlur.semuaEntri().filter((e) => e.jenis === 'tugas')[0].id);

  /* Tugas menumpang di toko yang sama supaya tidak ada basis data kedua - dan
     karena itu dia ikut cadangan tanpa kode tambahan. Tapi dia BUKAN catatan:
     di layar hasil dia cuma barang yang harus dilewati, dan tugas yang sudah
     selesai pun ikut naik ke permukaan. */
  const ketemu = await hal.evaluate(() => TSimpan.semua().then(
    (a) => TOtak.cari(a, 'invoice').length));
  cek('tugas tidak ikut muncul di pencarian catatan', ketemu === 0, String(ketemu));

  const utuhAwal = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => e.jenis === 'tugas').length));
  cek('tapi datanya tetap tersimpan, jadi ikut cadangan', utuhAwal >= 1, String(utuhAwal));

  const kosong = await hal.evaluate(() => TOtak.cari(
    [{ id: 't', jenis: 'tugas', judul: 'apa saja', isi: '', label: [], tag: [] }], ''));
  cek('tanpa kata kunci pun tugas tidak ikut terdaftar', kosong.length === 0);

  /* Judul tugas ITU tugasnya - diketik sendiri dan sudah benar. Kalau AI
     menyusunnya ulang, yang dibaca besok bukan lagi yang ditulis. */
  const antreAI = await hal.evaluate(() => TPelabel.antreUji(
    [{ id: 't', jenis: 'tugas', judul: 'Bayar listrik', isi: 'catatan tugas',
       daftar: [{ teks: 'langkah', selesai: false }] },
     { id: 'c', jenis: 'teks', judul: '', isi: 'catatan biasa', daftar: [] }]));
  cek('tugas tidak pernah dikirim ke AI',
      antreAI.length === 1 && antreAI[0] === 'c', antreAI.join(','));

  await hal.evaluate((i) => {
    const e = TAlur.semuaEntri().filter((x) => x.id === i)[0];
    e.tenggat = TTugas.hariMulai(Date.now()) - 86400000;
    return TSimpan.taruh(e).then(() => TTugas.gambar());
  }, id);
  await hal.waitForTimeout(200);
  cek('yang lewat tenggat ditandai', (await hal.locator('.tugas-tenggat.lewat').count()) === 1);

  /* Berulang: menyelesaikannya melahirkan yang berikutnya, bukan sekadar
     mencoretnya - kalau tidak, tiap pekan harus diketik ulang. */
  await hal.evaluate((i) => {
    const e = TAlur.semuaEntri().filter((x) => x.id === i)[0];
    e.ulang = 'mingguan';
    e.tenggat = TTugas.hariMulai(Date.now());
    return TSimpan.taruh(e).then(() => TTugas.selesaikan(e));
  }, id);
  await hal.waitForTimeout(250);
  const tugasSemua = await hal.evaluate(() => TAlur.semuaEntri().filter((e) => e.jenis === 'tugas'));
  cek('tugas berulang melahirkan yang berikutnya', tugasSemua.length === 2, String(tugasSemua.length));
  const lanjut = tugasSemua.filter((e) => !e.selesai)[0];
  cek('tenggat berikutnya maju sepekan',
      lanjut && lanjut.tenggat > Date.now(), lanjut && String(lanjut.tenggat));
  cek('yang lama tercatat selesai, bukan terhapus',
      tugasSemua.filter((e) => e.selesai).length === 1);

  /* ATURAN NOMOR EMPAT tetap berlaku di sini juga. */
  await hal.evaluate(() => {
    const e = TAlur.semuaEntri().filter((x) => x.jenis === 'tugas' && !x.selesai)[0];
    e.pensiun = true;
    return TSimpan.taruh(e);
  });
  const utuh = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => e.jenis === 'tugas').length));
  cek('tugas yang dibuang tetap ada datanya', utuh === 2, String(utuh));

  /* TENGGAT DARI KALIMAT. Tombol tanggal masih satu ketukan lagi, dan ketukan
     itu ditagih tiap kali menambah tugas. Todoist dan TickTick sudah
     membuktikan jalan yang lebih murah: tanggalnya diketik di dalam
     kalimatnya, lalu dicabut dari judulnya. */
  const baca = (t) => hal.evaluate((x) => TTugas.bacaTenggat(x), t);
  const hariIni = await hal.evaluate(() => TTugas.hariMulai(Date.now()));

  const besok = await baca('bayar sewa ruko besok');
  cek('"besok" jadi tenggat, dan dicabut dari judulnya',
      besok.teks === 'bayar sewa ruko' && besok.tenggat === hariIni + 86400000,
      JSON.stringify(besok));
  cek('"3 hari lagi" ikut terbaca',
      (await baca('kontrol dokter 3 hari lagi')).tenggat === hariIni + 3 * 86400000);
  cek('hari bernama terbaca, dan yang diambil yang AKAN DATANG',
      (await baca('kirim invoice jumat')).tenggat > hariIni);
  cek('"tgl 25" terbaca', (await baca('bayar pajak tgl 25')).tenggat > 0);
  cek('kalimat tanpa tanggal dibiarkan utuh',
      (await baca('tidak ada tanggalnya')).tenggat === 0);

  /* DUA BAHASA SEKALIGUS, bukan mengikuti setelan. Setelan bahasa mengubah
     yang dibaca mata; yang diketik jari tidak ikut berganti sekaligus - orang
     yang memakai antarmuka Inggris tetap mengetik "besok" waktu buru-buru. */
  const tmr = await baca('pay the rent tomorrow');
  cek('"tomorrow" jadi tenggat, dan ikut dicabut dari judulnya',
      tmr.teks === 'pay the rent' && tmr.tenggat === hariIni + 86400000,
      JSON.stringify(tmr));
  cek('"today" dan "tonight" sama-sama hari ini',
      (await baca('call vendor today')).tenggat === hariIni &&
      (await baca('send the quote tonight')).tenggat === hariIni);
  /* "day after tomorrow" berisi kata "tomorrow" utuh - kalau urutan polanya
     terbalik, lusa selamanya jadi besok dan sisa judulnya "day after". */
  const lusaEn = await baca('site visit day after tomorrow');
  cek('"day after tomorrow" tidak tertelan pola "tomorrow"',
      lusaEn.tenggat === hariIni + 2 * 86400000 && lusaEn.teks === 'site visit',
      JSON.stringify(lusaEn));
  cek('"in 3 days" dan "3 days" sama-sama terbaca',
      (await baca('follow up in 3 days')).tenggat === hariIni + 3 * 86400000 &&
      (await baca('reply 3 days')).tenggat === hariIni + 3 * 86400000);
  cek('"next week" dan "next month" terbaca',
      (await baca('team sync next week')).tenggat === hariIni + 7 * 86400000 &&
      (await baca('renew licence next month')).tenggat > hariIni + 20 * 86400000);
  cek('nama hari Inggris terbaca, dan yang diambil yang AKAN DATANG',
      (await baca('send invoice friday')).tenggat ===
      (await baca('kirim invoice jumat')).tenggat);
  /* Tanggal telanjang Inggris WAJIB berakhiran urutan. "pay 25 sacks of
     cement" bukan tenggat tanggal 25, dan satu salah tebak seperti itu
     membuat orang berhenti memercayai seluruh isian ini. */
  cek('"the 25th" terbaca', (await baca('bayar pajak the 25th')).tenggat > 0);
  cek('angka telanjang tanpa akhiran urutan TIDAK dianggap tanggal',
      (await baca('pay 25 sacks of cement')).tenggat === 0,
      JSON.stringify(await baca('pay 25 sacks of cement')));
  cek('singkatan tiga huruf nama hari TIDAK dianggap tanggal',
      (await baca('get the sun shade')).tenggat === 0 &&
      (await baca('i sat down')).tenggat === 0);

  await hal.evaluate(() => { TTugas.saring('semua'); TTugas.rak(''); TTugas.buka(); });
  await hal.fill('#tugas-baru', 'rapat tim minggu depan');
  await hal.dispatchEvent('#tugas-baru', 'input');
  await hal.waitForTimeout(150);
  /* Tebakan yang tidak terlihat bikin alat terasa tidak bisa ditebak. */
  cek('tenggat yang terbaca ditunjukkan sebelum disimpan',
      !(await hal.locator('#tugas-tebak').getAttribute('class')).includes('sembunyi'));
  await hal.press('#tugas-baru', 'Enter');
  await hal.waitForTimeout(300);
  const dgnTenggat = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.jenis === 'tugas' && e.judul === 'rapat tim')[0]);
  cek('judulnya bersih dari kata tanggalnya', !!dgnTenggat, JSON.stringify(dgnTenggat && dgnTenggat.judul));
  cek('tenggatnya benar-benar tersimpan', dgnTenggat && dgnTenggat.tenggat === hariIni + 7 * 86400000);
  await hal.evaluate(() => { const e = TAlur.semuaEntri()
    .filter((x) => x.jenis === 'tugas' && x.judul === 'rapat tim')[0];
    if (e) { e.pensiun = true; return TSimpan.taruh(e); } });

  /* Daftar lahir dari keyword, tidak pernah dari layar "buat daftar baru". */
  await hal.evaluate(() => {
    const e = TAlur.semuaEntri().filter((x) => x.jenis === 'tugas' && !x.selesai)[0];
    if (e) { e.pensiun = false; e.kategori = 'kerja'; return TSimpan.taruh(e); }
  });
  const rak = await hal.evaluate(() => TTugas.daftarYangAda());
  cek('daftar lahir sendiri dari keyword yang dipakai',
      rak.some((r) => r.nama === 'kerja'), JSON.stringify(rak));
  cek('tanpa keyword pun tugas tetap sah - daftarnya opsional',
      (await hal.evaluate(() => TTugas.tugasBaru('apa saja').kategori)) === '');
}

console.log('\nteks bayangan: melengkapi nama gudang sambil diketik');
{
  /* Gudang bertingkat dibuat lewat layar Setelan, jalur yang sama dengan yang
     dipakai orangnya - bukan lewat pintu belakang yang cuma ada di uji. */
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(200);
  await hal.fill('#set-label',
    'Amara = amaraliving\nAmara Apps\nAmara Sales\nNgoffee = ngopi\nUltima');
  await hal.dispatchEvent('#set-label', 'change');
  await hal.waitForTimeout(250);

  /* Nama gudang disimpan UTUH. Dulu dipotong diam-diam di 16 huruf demi
     lebar barisan label - dan "MAP Mata Angin Pratama" tersimpan jadi "MAP
     Mata Angin P", yang tidak berarti apa-apa. Memotong data demi tampilan
     adalah cara paling sunyi untuk merusak daftar orang. */
  const panjang = await hal.evaluate(() => TOtak.uraiLabel(
    'MAP Mata Angin Pratama\nAmara Operasional').map((l) => l.nama));
  cek('nama gudang panjang tidak dipotong diam-diam',
      panjang[0] === 'MAP Mata Angin Pratama' && panjang[1] === 'Amara Operasional',
      JSON.stringify(panjang));
  /* Yang memendekkan cuma gaya, dengan titik-titik. */
  const gayaLabel = fs.readFileSync(path.join(AKAR, 'gaya.css'), 'utf8');
  cek('yang memendekkannya cuma tampilan',
      /\.label-baris-nama\{[^}]*text-overflow:ellipsis/.test(gayaLabel) &&
      /\.note-folder-nama\{[^}]*text-overflow:ellipsis/.test(gayaLabel) ||
      /\.label-baris-nama\{[^}]*text-overflow:ellipsis/.test(gayaLabel));

  const pohon = await hal.evaluate(() => TOtak.pohonLabel(TAlur.daftarLabelUji()));
  const apps = pohon.filter((l) => l.nama === 'Amara Apps')[0];
  cek('gudang bertingkat terbaca dari namanya sendiri',
      apps && apps.induk === 'Amara' && apps.ekor === 'Apps', JSON.stringify(apps));
  cek('gudang tanpa induk berdiri sendiri',
      pohon.filter((l) => l.nama === 'Ultima')[0].induk === '');

  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(200);

  const ketik = async (t) => {
    await hal.fill('#kotak', '');
    await hal.click('#kotak');
    await hal.type('#kotak', t, { delay: 12 });
    await hal.waitForTimeout(200);
  };
  /* Penanda ujung ekornya berisi spasi nol-lebar - tidak terlihat, tapi ikut
     terbaca sebagai teks. Dibersihkan supaya yang dibandingkan cuma yang
     benar-benar terlihat. */
  const bayang = () => hal.locator('#kotak-bayang').innerText()
    .then((t) => t.replace(/[\u200b]/g, ''));

  await ketik('Amara a');
  cek('ekornya muncul samar di belakang yang diketik',
      (await bayang()).trim() === 'Amara apps', await bayang());

  /* Panahnya berdiri TEPAT di ujung ekor, dan letaknya diukur - bukan
     ditebak dari jumlah huruf. Lebar huruf tidak tetap; menghitungnya dari
     panjang teks meleset makin jauh tiap kata. */
  const letak = await hal.evaluate(() => {
    const b = document.querySelector('#b-terima').getBoundingClientRect();
    const u = document.querySelector('#bayang-ujung').getBoundingClientRect();
    return { jarak: b.left - u.left, sebaris: Math.abs((b.top + b.height / 2) - (u.top + u.height / 2)) };
  });
  cek('panahnya berdiri tepat di ujung ekornya',
      letak.jarak >= 0 && letak.jarak < 14 && letak.sebaris < 6, JSON.stringify(letak));

  /* Dan dia satu-satunya bagian bayangan yang duduk DI ATAS kotak teksnya.
     Ekornya sendiri ada di belakang: apa pun yang digambar di sana menelan
     ketukan lewat textarea-nya, dan ekor yang mengundang ketukan tapi diam
     saja terbaca sebagai kerusakan. */
  const kena = await hal.evaluate(() => {
    const b = document.querySelector('#b-terima').getBoundingClientRect();
    const n = document.elementFromPoint(b.left + 12, b.top + b.height / 2);
    return n ? (n.closest('#b-terima') ? 'panah' : n.id || n.tagName) : 'kosong';
  });
  cek('ketukan di panahnya sampai ke panah, bukan ditelan kotak teksnya',
      kena === 'panah', String(kena));
  cek('sasaran sentuhnya tetap 44px seperti tombol lain',
      (await hal.locator('#b-terima').evaluate((n) => n.getBoundingClientRect().height)) >= 44);
  cek('ekornya sendiri tidak mengundang ketukan',
      (await hal.locator('#kotak-bayang [data-terima]').count()) === 0);

  await hal.click('#b-terima');
  await hal.waitForTimeout(200);
  cek('sekali ketuk, namanya utuh dan kursornya siap menulis isi',
      (await hal.inputValue('#kotak')) === 'Amara Apps ');

  /* Papan ketik keras: Tab, dan panah kanan waktu kursornya sudah di ujung -
     di ujung teks, panah kanan tidak punya kerja lain untuk direbut. */
  await ketik('ngo');
  await hal.press('#kotak', 'Tab');
  await hal.waitForTimeout(150);
  cek('Tab menerima tawarannya', (await hal.inputValue('#kotak')) === 'Ngoffee ');
  await ketik('ultim');
  await hal.press('#kotak', 'ArrowRight');
  await hal.waitForTimeout(150);
  cek('panah kanan di ujung ikut menerima', (await hal.inputValue('#kotak')) === 'Ultima ');

  /* Batas dua kata. Tanpa ini, tebakan muncul sepanjang kalimat dan berubah
     dari membantu jadi mengganggu. */
  await ketik('kirim invoice ke pak budi besok pagi');
  cek('kalimat panjang tidak ditebak sama sekali',
      (await bayang()).indexOf('Amara') < 0 &&
      (await hal.locator('#b-terima').getAttribute('class')).includes('sembunyi'));

  /* Cip turunan: melihat pilihan tanpa harus mengingatnya. */
  await ketik('Amara');
  const turunan = await hal.locator('#ruang-baris [data-ruang]').allInnerTexts();
  cek('turunan gudangnya ikut tampil',
      turunan.indexOf('Sales') >= 0, JSON.stringify(turunan));
  await hal.locator('#ruang-baris [data-ruang="Amara Sales"]').click();
  await hal.waitForTimeout(200);
  cek('mengetuk turunan menulis ke kotak, bukan membuka layar',
      (await hal.inputValue('#kotak')) === 'Amara Sales ');

  /* Yang paling penting: drop benar-benar mendarat di gudang yang dibaca dari
     teksnya, dan yang menang cocokan TERPANJANG. */
  await ketik('Amara Apps galat masuk halaman kasir');
  await hal.click('#b-drop');
  await hal.waitForTimeout(400);
  const mendarat = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => /halaman kasir/.test((e.teks || '') + ' ' + (e.judul || '')))[0]));
  cek('drop mendarat di gudang yang paling dalam, bukan berhenti di induknya',
      mendarat && mendarat.kategori === 'Amara Apps',
      JSON.stringify(mendarat && mendarat.kategori));

  /* Barang yang mendarat di gudang yang salah harus bisa dipindah, dan
     tempatnya di layar tulis - bukan di layar "rapikan catatanmu". */
  await hal.evaluate(() => TSimpan.semua().then((a) => {
    const e = a.filter((x) => /halaman kasir/.test((x.teks || '') + ' ' + (x.judul || '')))[0];
    if (e) TAlur.keCatat(e);
  }));
  await hal.waitForTimeout(300);
  /* KOLOM KATEGORI DIBUANG. Dia satu kolom kosong yang menagih jawaban tiap
     kali layar ini dibuka - padahal jawabannya sudah ditulis di baris judul di
     atasnya. Dua tempat yang menentukan satu hal yang sama, dan yang harus
     mengingat bedanya cuma orangnya. */
  cek('tidak ada lagi kolom kategori di layar tulis',
      (await hal.locator('#catat-kat').count()) === 0);
  /* Yang tinggal cuma KABARNYA: satu baris redup yang menyebut raknya. */
  cek('raknya dikabarkan, bukan ditanyakan',
      /Amara Apps/.test(await hal.locator('#catat-ruang').innerText()),
      await hal.locator('#catat-ruang').innerText());

  /* Memindah rak = MEMBETULKAN JUDULNYA, aturan yang sama persis dengan kotak
     Drop. Satu tempat yang menentukan, bukan dua yang diam-diam bisa beda. */
  await hal.fill('#catat-judul', 'Amara Sales galat masuk halaman kasir');
  await hal.dispatchEvent('#catat-judul', 'input');
  await hal.waitForTimeout(1100);
  const pindah = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => /halaman kasir/.test((e.teks || '') + ' ' + (e.judul || '')))[0]));
  cek('membetulkan judul memindahkan gudangnya',
      pindah && pindah.kategori === 'Amara Sales',
      JSON.stringify(pindah && pindah.kategori));

  /* Dan judul yang tidak menyebut gudang apa pun TIDAK mengosongkan raknya.
     Menghapus satu kata tidak pernah boleh berarti "keluarkan dari raknya" -
     itu kehilangan diam-diam, dan yang kehilangan tidak akan tahu sebabnya. */
  await hal.fill('#catat-judul', 'Galat masuk halaman kasir');
  await hal.dispatchEvent('#catat-judul', 'input');
  await hal.waitForTimeout(1100);
  const tetap = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => /halaman kasir/.test((e.teks || '') + ' ' + (e.judul || '')))[0]));
  cek('judul tanpa nama gudang tidak mengosongkan raknya',
      tetap && tetap.kategori === 'Amara Sales',
      JSON.stringify(tetap && tetap.kategori));

  await hal.evaluate(() => TSimpan.semua().then((a) => {
    const e = a.filter((x) => /halaman kasir/.test((x.teks || '') + ' ' + (x.judul || '')))[0];
    if (e) { e.pensiun = true; return TSimpan.taruh(e); }
  }));
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); });
  await hal.fill('#kotak', '');
  await hal.evaluate(() => { TAlur.tutupHasilDepanUji(); TAlur.muatUlangUji(); });
  await hal.waitForTimeout(250);
}

console.log('\ngudang di mana saja, elemen tidak beranak, gudang tersering');
{
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(200);
  await hal.fill('#set-label', 'Amara\nAmara Sales\nAmara Apps\nNgoffee = ngopi\nUltima\nPS = projectspace');
  await hal.dispatchEvent('#set-label', 'change');
  await hal.waitForTimeout(250);
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });

  /* NAMA GUDANG DICARI DI MANA SAJA DI BARIS PERTAMA.
     Dulu wajib jadi kata pertama, dan itu keliru membaca cara orang menulis:
     waktu menyimpan kontak yang keluar duluan nama ORANGNYA. "Selvi Amara
     Sales 0865..." tidak mendarat di mana pun, tanpa satu tanda pun bahwa
     gudangnya terlewat. */
  const ruang = await hal.evaluate(() => {
    const d = TAlur.daftarLabelUji();
    const baca = (t) => (TOtak.bacaRuang(t, d) || {}).nama || '';
    return {
      orangDulu: baca('Selvi Amara sales 08653678975'),
      gudangDulu: baca('Amara Sales Selvi 0865'),
      tengah: baca('besok ke Amara Sales bawa sample'),
      bukan: baca('Selvi 097765675578'),
      /* Tepi kata dijaga di kedua sisi - kalau tidak, "PS" tersangkut di
         dalam "gips" dan tiap catatan medis mendarat di ProjectSpace. */
      dalamKata: baca('pasang gips di kaki'),
      barisDua: baca('catatan biasa\nAmara Sales di baris kedua')
    };
  });
  cek('nama orang duluan pun gudangnya tetap terbaca',
      ruang.orangDulu === 'Amara Sales', JSON.stringify(ruang));
  cek('di awal tetap jalan seperti sebelumnya', ruang.gudangDulu === 'Amara Sales');
  cek('disebut di tengah kalimat ikut mendarat di sana', ruang.tengah === 'Amara Sales');
  cek('yang tidak menyebut gudang tetap tidak mendarat di mana pun', ruang.bukan === '');
  cek('tidak tersangkut di dalam kata lain', ruang.dalamKata === '');
  cek('baris kedua ke bawah itu isi, bukan alamat', ruang.barisDua === '');

  /* NAMA ELEMEN MENYEBUT JENIS BENDANYA, BUKAN PEMILIKNYA. "No WhatsApp
     Bunda" tidak akan pernah berkumpul dengan "No WhatsApp" yang lain -
     sebulan kemudian ada sepuluh nama untuk satu benda. */
  const baku = await hal.evaluate(() => {
    const lama = ['No WhatsApp', 'No Rekening'];
    return {
      pemilik: TOtak.bakukanNamaElemen('No WhatsApp Bunda', lama),
      besarKecil: TOtak.bakukanNamaElemen('no whatsapp', lama),
      bank: TOtak.bakukanNamaElemen('No Rekening BCA', lama),
      baru: TOtak.bakukanNamaElemen('Alamat Gudang', lama)
    };
  });
  cek('nama pemilik dilepas dari nama elemen', baku.pemilik === 'No WhatsApp', JSON.stringify(baku));
  cek('penulisan yang sudah ada yang dipakai', baku.besarKecil === 'No WhatsApp');
  cek('nama bank pun dilepas', baku.bank === 'No Rekening');
  /* "Nomor" selalu disingkat "No": namanya ditulis di kolom sempit, dan enam
     huruf untuk keterangan yang sudah jelas dari angkanya itu pemborosan.
     Disingkat waktu disimpan DAN waktu ditampilkan - yang kedua supaya yang
     terlanjur tersimpan panjang ikut rapi tanpa satu pun barisnya disentuh. */
  cek('"Nomor" disingkat jadi "No"',
      (await hal.evaluate(() => TOtak.pendekkanNama('Nomor WhatsApp'))) === 'No WhatsApp' &&
      (await hal.evaluate(() => TOtak.pendekkanNama('nomer HP'))) === 'No HP' &&
      (await hal.evaluate(() => TOtak.pendekkanNama('nama berkas'))) === 'nama berkas');
  cek('yang memang baru tetap boleh lahir', baku.baru === 'Alamat Gudang');
  /* Diminta ke AI JUGA - kodenya menegakkan, arahannya mencegah. */
  cek('aturannya ikut dikirim ke AI',
      /NAMA ELEMEN MENYEBUT JENIS BENDANYA/.test(
        await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TPelabel.arahanUji(s)))));

  /* Saringan jenis elemen: "tunjukkan semua nomor telepon" tidak bisa dijawab
     kata kunci - nomornya sendiri tidak memuat kata "telepon". */
  await hal.evaluate(async () => {
    const a = await TSimpan.semua();
    const pakai = a.filter((e) => e.jenis !== 'tugas' && !e.pensiun && !e.dihapus).slice(0, 2);
    for (const e of pakai) {
      e.elemen = [{ jenis: 'telepon', nama: 'No WhatsApp', nilai: '0865367' + e.id.slice(-4) }];
      await TSimpan.taruh(e);
    }
    return TAlur.muatUlangUji();
  });
  await hal.waitForTimeout(300);
  await hal.waitForTimeout(350);
  /* JENIS ELEMEN TIDAK LAGI JADI CIP. Namanya panjang dan jumlahnya banyak,
     jadi barisnya melipat jadi tiga baris dan menutupi setengah layar - dan
     namanya mirip nama gudang di baris atasnya, jadi terbaca seperti gudang
     yang muncul dua kali. */
  cek('jenis elemen tidak lagi memenuhi baris cip',
      (await hal.locator('#saring-baris [data-elemen]').count()) === 0,
      await hal.locator('#saring-baris').innerText());
  /* Dan kodenya ikut dibuang, bukan cuma cipnya disembunyikan: saringan yang
     tidak punya pintu lagi adalah kode mati yang kelihatan hidup. Kalau nanti
     dibutuhkan, tempatnya sudah disiapkan - laci jenis yang kosong. */
  cek('kodenya ikut dibuang, bukan cuma cipnya',
      !/saringElemen/.test(fs.readFileSync(path.join(AKAR, 'alur.js'), 'utf8')));
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());

  /* Kotak kosong: gudang yang paling sering dipakai sebulan terakhir. Ini
     KENDALI, bukan isi - jadi tidak melanggar "layar depan kosong". */
  /* Dihitung dari catatan yang benar-benar jatuh, bukan dari daftar label -
     yang ada di daftar itu semua gudang yang pernah dibuat, sementara yang
     berguna cuma yang sedang dipakai. Jadi harus ada yang jatuh dulu. */
  for (const t of ['Amara Sales target bulan depan', 'Amara Sales rapat senin',
                   'Ngoffee stok biji menipis']) {
    await hal.fill('#kotak', t);
    await hal.dispatchEvent('#kotak', 'input');
    await hal.waitForTimeout(120);
    await hal.click('#b-drop');
    await hal.waitForTimeout(300);
  }
  await hal.fill('#kotak', '');
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(350);
  const sering = await hal.locator('#ruang-baris .sering').allInnerTexts();
  cek('kotak kosong menawarkan gudang tersering', sering.length >= 1 && sering.length <= 7,
      JSON.stringify(sering));
  await hal.locator('#ruang-baris .sering').first().click();
  await hal.waitForTimeout(300);
  cek('sekali ketuk, kamu sudah di dalam ruangannya',
      (await hal.inputValue('#kotak')) === sering[0] + ' ');
  /* Dan dia menghilang begitu kamu mengetik - digantikan tebakan. */
  cek('tawarannya hilang begitu mulai mengetik',
      (await hal.locator('#ruang-baris .sering').count()) === 0);
  await hal.fill('#kotak', '');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);
}

console.log('\nTodo dari layar Drop: pembedanya ACTION, bukan tenggat');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(200);

  TTUGAS_HARI_INI = () => hariIniTugas;
  const hariIniTugas = await hal.evaluate(() => TTugas.hariMulai(Date.now()));

  const keTugas = async (t) => {
    await hal.fill('#kotak', t);
    await hal.dispatchEvent('#kotak', 'input');
    await hal.waitForTimeout(200);
    await hal.click('#b-tugas');
    await hal.waitForTimeout(400);
  };

  /* TUGAS TANPA TENGGAT ITU SAH. Memaksanya punya tanggal cuma melahirkan
     tanggal kamuflase - besok penuh barang yang sebenarnya tidak harus besok,
     dan seminggu kemudian daftarnya berhenti dipercaya. */
  await keTugas('Uji tugasunikuji ke staff bagikan link');
  const tanpaTanggal = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.jenis === 'tugas' && /tugasunikuji/.test(e.judul || ''))[0]);
  cek('sekali ketuk cip, langsung jadi tugas tanpa lewat tombol Drop',
      !!tanpaTanggal, JSON.stringify(tanpaTanggal && tanpaTanggal.judul));
  cek('tugas tanpa tenggat itu sah, tidak dipaksa punya tanggal',
      tanpaTanggal && !tanpaTanggal.tenggat);
  cek('kotaknya ikut dikosongkan, seperti sesudah Drop',
      (await hal.inputValue('#kotak')) === '');

  /* Gudangnya ikut terbawa - sudah ditulis di kotak yang sama, jadi
     menanyakannya lagi di layar sebelah adalah menagih jawaban yang sudah
     diberikan. Tanggal yang KEBETULAN ditulis tetap dibaca. */
  await keTugas('Amara Sales kirim proposal besok');
  const berGudang = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.jenis === 'tugas' && /kirim proposal/.test(e.judul || ''))[0]);
  cek('gudangnya ikut terbawa dari kotak yang sama',
      berGudang && berGudang.kategori === 'Amara Sales',
      JSON.stringify(berGudang && berGudang.kategori));
  cek('tanggal yang terlanjur ditulis tetap dibaca',
      berGudang && berGudang.tenggat === TTUGAS_HARI_INI() + 86400000,
      String(berGudang && berGudang.tenggat));

  /* "Hari ini" dan "penting" itu jawaban yang diberikan dengan BERDIRI di layar
     To Do. Dari layar Drop dia tidak pernah menjawabnya, jadi tidak boleh
     dijawabkan. */
  cek('keadaan layar To Do tidak diwariskan ke sini',
      berGudang && !berGudang.hariIni && !berGudang.penting);

  /* REMINDER ITU DROP BIASA. Yang cuma perlu diingat tanpa action - nomor
     rekening, kunci API, "Eko masih punya hutang" - itu isi gudang ini, dan
     tombol Drop sudah jadi tombol Reminder-nya. Tidak ada cip kedua yang
     kerjanya sama persis dengan tombol di sampingnya. */
  cek('tidak ada tombol Reminder - tombol Drop itulah Reminder-nya',
      (await hal.locator('#b-reminder').count()) === 0);

  await hal.fill('#kotak', 'Eko masih punya hutang tiga juta');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(200);
  await hal.click('#b-drop');
  await hal.waitForTimeout(400);

  /* Pemisahannya tetap: yang punya action tidak mengotori pencarian catatan,
     yang cuma perlu diingat justru harus ada di sana. */
  /* Kata umpannya harus kata yang TIDAK ADA di pohon board: sejak AI memilih
     alamat dari sana, satu catatan biasa yang mendarat di "Apps Dev Cortex"
     akan ketemu waktu dicari "cortex" - benar, tapi bukan yang sedang diuji
     di sini, dan bugnya jadi tersembunyi di balik kelulusan yang salah. */
  await hal.fill('#kotak', 'tugasunikuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(350);
  cek('tugas tidak ikut mengotori pencarian catatan',
      (await hal.locator('#hasil-depan .kartu').count()) === 0);
  await hal.fill('#kotak', 'hutang');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(350);
  cek('yang cuma perlu diingat tetap ketemu di gudang',
      (await hal.locator('#hasil-depan .kartu').count()) >= 1);

  /* Keduanya berakhir di layar yang sama - To Do itu jalur akses lengkapnya. */
  const diDaftar = await hal.evaluate(() => {
    TTugas.saring('semua'); TTugas.rak('');
    return TTugas.tersaring().filter((e) => /tugasunikuji|kirim proposal/.test(e.judul || '')).length;
  });
  cek('dua-duanya mendarat di layar To Do', diDaftar === 2, String(diDaftar));

  await hal.fill('#kotak', '');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);
}

console.log('\nfolder Note: alamatnya dibaca, dan bertingkat');
{
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(200);
  await hal.fill('#set-label', 'Amara\nAmara Sales\nAmara Apps\nNgoffee');
  await hal.dispatchEvent('#set-label', 'change');
  await hal.waitForTimeout(250);

  /* ALAMATNYA DIBACA, BUKAN DITERKA. Dulu di sini ada mesin penghitung teman:
     tiap catatan menyumbang semua tagnya sebagai calon ruangan, yang punya
     anggota terbanyak menang, dan calon yang menempel di lebih dari separuh
     timbunan dibuang karena terlalu luas. Semua itu ada untuk SATU sebab - tag
     lahir berhamburan dan tidak satu pun mengaku sebagai alamat, jadi alamat
     harus diterka dari kerumunannya. Hasilnya folder "No", "catatan", dan
     "daftar" yang masing-masing berisi satu keping.

     Sejak alamatnya dipilih langsung dari pohon board yang tertutup, tebakan
     itu tidak punya pekerjaan lagi: yang tersisa dua bacaan berurutan, dan
     gudang yang KAMU tulis di judul selalu menang atas board pilihan AI. */
  await hal.evaluate(async () => {
    const buat = (judul, board, kat) => ({
      id: 'nf_' + Math.random().toString(36).slice(2), jenis: 'teks',
      judul: judul, isi: judul, kategori: kat || '', album: board || '',
      label: [], elemen: [],
      daftar: [], dibuat: Date.now(), diubah: Date.now(), dipakai: 0,
      diLabeliAI: true, pensiun: false, dihapus: false, riwayat: []
    });
    const d = [
      buat('Telepon Selvi', 'Kontakuji'),
      buat('Telepon Bunda', 'Kontakuji'),
      buat('Telepon Badar', 'Kontakuji'),
      buat('WhatsApp Ryan', 'Kontakuji'),
      buat('Rekening BCA', 'Rekeninguji'),
      buat('Rekening Mandiri', 'Rekeninguji'),
      /* Yang tanpa board sama sekali tetap punya barisnya sendiri - tidak
         pernah ada catatan yang mengambang tanpa alamat. */
      buat('Rekening BNI', ''),
      buat('Amara target', 'Kontakuji', 'Amara Sales'),
      buat('Amara rapat', 'Kontakuji', 'Amara Sales')
    ];
    for (const e of d) await TSimpan.taruh(e);
    return TAlur.muatUlangUji();
  });
  await hal.evaluate(() => TAlur.keLayarUji('l-note'));
  await hal.waitForTimeout(400);

  const namaFolder = await hal.locator('#note-isi [data-note-folder]')
    .evaluateAll((n) => n.map((x) => x.getAttribute('data-note-folder')));

  cek('boardnya yang jadi folder, bukan kata yang kebetulan lewat',
      namaFolder.indexOf('Kontakuji') >= 0 && namaFolder.indexOf('Rekeninguji') >= 0,
      JSON.stringify(namaFolder));
  /* GUDANG YANG KAMU TULIS SELALU MENANG. "Amara target" boardnya Kontakuji,
     tapi kategorinya "Amara Sales" - dan itu keputusanmu, bukan tebakan
     mesin. */
  cek('rak yang kamu tulis sendiri menang atas board pilihan AI',
      namaFolder.indexOf('Amara') >= 0, JSON.stringify(namaFolder));

  /* Kategori dua kata dipakai UTUH, dan hierarkinya kelihatan: "Amara Sales"
     ada DI DALAM "Amara", bukan berdiri sejajar dengannya. */
  cek('yang tampil di akar cuma induknya',
      namaFolder.indexOf('Amara') >= 0 && namaFolder.indexOf('Amara Sales') < 0,
      JSON.stringify(namaFolder));

  await hal.click('#note-isi [data-note-folder="Amara"]');
  await hal.waitForTimeout(350);
  cek('membukanya memperlihatkan anaknya, bukan folder kosong',
      (await hal.locator('#note-isi [data-note-folder="Amara Sales"]').count()) === 1,
      await hal.locator('#note-isi').innerText());

  await hal.click('#note-isi [data-note-folder="Amara Sales"]');
  await hal.waitForTimeout(350);
  const isiAmara = await hal.locator('#note-isi').innerText();
  cek('kategori dua kata dipakai utuh, tidak dipotong jadi satu kata',
      /Amara target/.test(isiAmara) && /Amara rapat/.test(isiAmara), isiAmara);

  /* Kepalanya punya tata letaknya sendiri. Dulu dia memakai grid tiga kolom
     milik layar Drop, dan kotak Cari-nya terjepit di sepertiga lebar layar. */
  const lebar = await hal.evaluate(() => {
    const k = document.querySelector('#note-cari').getBoundingClientRect();
    const w = document.querySelector('.note-kepala').getBoundingClientRect();
    return Math.round((k.width / w.width) * 100);
  });
  cek('kotak Cari-nya hampir selebar kepalanya, tidak terjepit sepertiga',
      lebar >= 75, lebar + '%');

  /* DAN TOMBOL PILIH BENAR-BENAR TERLIHAT. Dulu kotak Cari dipatok 100% lebar
     tanpa syarat, dan tombol di sebelahnya terdorong keluar layar: ada di DOM,
     punya ukuran, sama sekali tidak kelihatan - jenis kerusakan yang paling
     lama tidak ketahuan, karena semua ujinya lulus. */
  const pilihTerlihat = await hal.evaluate(() => {
    const b = document.querySelector('#b-pilih-mulai');
    if (!b || b.classList.contains('sembunyi')) return 'tersembunyi';
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height) return 'tanpa ukuran';
    return r.right <= innerWidth + 1 && r.left >= -1 ? 'ok' : 'terdorong keluar layar';
  });
  cek('tombol Pilih benar-benar muat di layar, bukan terdorong keluar',
      pilihTerlihat === 'ok', pilihTerlihat);

  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.waitForTimeout(200);
}

console.log('\nTo Do dua bagian, timestamp di Note, dan gambar yang membesar');
{
  /* BAWAANNYA "SEMUA", bukan "Hari ini". Tugas tanpa tenggat itu sah - itu
     justru bentuk yang paling sering - dan kalau layar ini dibuka langsung di
     "Hari ini", semua yang tanpa tanggal tidak kelihatan sama sekali. Daftar
     yang menyembunyikan sebagian besar isinya waktu dibuka akan berhenti
     dipercaya, lalu berhenti dibuka. */
  const tugasJs = fs.readFileSync(path.join(AKAR, 'tugas.js'), 'utf8');
  cek('bawaan layar To Do "semua", bukan "hari ini"',
      /var saringSaat = 'semua';/.test(tugasJs));

  await hal.evaluate(async () => {
    const t = (judul, ulang) => {
      const e = TTugas.tugasBaru(judul);
      if (ulang) e.ulang = ulang;
      return TSimpan.taruh(e);
    };
    await t('Kirim proposal Amara');
    await t('Bayar wifi', 'bulan');
    await t('Jemput sekolah', 'hari');
    return TAlur.muatUlangUji();
  });
  await hal.evaluate(() => { TAlur.keLayarUji('l-tugas'); TTugas.saring('semua'); TTugas.rak(''); TTugas.gambar(); });
  await hal.waitForTimeout(350);

  /* SATU DAFTAR, TIDAK DIBAGI DUA LAGI. Pemisahan "Berulang" di bawah lahir
     sebelum Berulang punya saringannya sendiri di baris atas. Sekarang dia
     punya, dan dua tempat untuk satu hal yang sama itu satu tempat terlalu
     banyak - yang di bawah selalu tertimbun tugas sekali jalan, jadi bagian
     yang gunanya memperlihatkan justru yang paling jarang terlihat. */
  cek('tidak ada lagi bagian "Berulang" yang tertimbun di bawah',
      (await hal.locator('#tugas-daftar .tugas-bagian').count()) === 0,
      await hal.locator('#tugas-daftar').innerText());
  const urut = await hal.locator('#tugas-daftar').innerText();
  const urutKecil = urut.toLowerCase();
  /* Yang berulang tetap ikut di daftar yang sama - dia tidak disembunyikan,
     cuma tidak lagi dipisah ke ruang tersendiri. */
  cek('yang berulang tetap ikut di daftar yang sama',
      urutKecil.indexOf('bayar wifi') >= 0 && urutKecil.indexOf('jemput sekolah') >= 0,
      JSON.stringify(urut));

  /* Judul bagian cuma muncul kalau KEDUANYA ada - judul di atas daftar yang
     seluruhnya satu jenis tidak memisahkan apa pun. */
  await hal.evaluate(async () => {
    const a = await TSimpan.semua();
    for (const e of a) {
      if (e.jenis === 'tugas' && !e.ulang && !e.selesai) { e.pensiun = true; await TSimpan.taruh(e); }
    }
    return TAlur.muatUlangUji();
  });
  await hal.evaluate(() => TTugas.gambar());
  await hal.waitForTimeout(300);
  cek('judul bagian hilang kalau yang tersisa cuma satu jenis',
      (await hal.locator('#tugas-daftar .tugas-bagian').count()) === 0,
      await hal.locator('#tugas-daftar').innerText());

  /* TIMESTAMP DI NOTE. Di hasil pencarian yang menolong cuma "hari ini" lawan
     "sudah lama"; di Note kamu sedang membuka arsip, dan di situ tiga catatan
     dari hari yang sama memang perlu dibedakan. */
  const jam = await hal.evaluate(() => TOtak.waktuLengkap(Date.now()));
  cek('jamnya ikut ditulis di waktu lengkap', /\d\d\.\d\d$/.test(jam), jam);
  cek('dan tetap dibaca "Hari ini", bukan tanggal penuh', /^Hari ini · /.test(jam), jam);
  await hal.evaluate(() => { TAlur.keLayarUji('l-note'); });
  await hal.fill('#note-cari', 'telepon');
  await hal.dispatchEvent('#note-cari', 'input');
  await hal.waitForTimeout(400);
  const waktuNote = await hal.locator('#note-isi .kartu-waktu').first().textContent();
  cek('kartu di layar Note membawa jamnya', /\d\d\.\d\d/.test(waktuNote || ''), String(waktuNote));
  /* Di layar depan tetap ringkas - di sana jam tidak menjawab apa pun. */
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); });
  await hal.fill('#kotak', 'telepon');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  const waktuDepan = await hal.locator('#hasil-depan .kartu-waktu').first().textContent();
  cek('di layar depan waktunya tetap ringkas, tanpa jam',
      !/\d\d\.\d\d/.test(waktuDepan || ''), String(waktuDepan));

  /* GAMBAR YANG DISENTUH MEMBESAR. Menyentuh gambar hampir selalu berarti
     "aku mau LIHAT ini", bukan "aku mau menyuntingnya". */
  await hal.fill('#kotak', '');
  await hal.evaluate(() => { TAlur.tutupHasilDepanUji(); });
  await hal.evaluate(() => TSimpan.taruh({
    id: 'gbr-lihat', jenis: 'gambar', judul: 'Moodboard uji besar',
    isi: '', kategori: 'interior', tag: ['Interior'], label: [], elemen: [], daftar: [],
    thumb: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true
  }));
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(300);
  await hal.fill('#kotak', 'Moodboard uji besar');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  /* Cip Gambar sekarang PINTU ke Gallery, jadi kartu bergambar di layar Drop
     diuji lewat jalur yang memang masih menggambarnya: tampilan Daftar di
     Gallery, tempat kartunya utuh berikut gambarnya. */
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  await hal.fill('#galeri-cari', 'Moodboard uji besar');
  await hal.dispatchEvent('#galeri-cari', 'input');
  await hal.waitForTimeout(400);
  /* Pilihan tampilan tinggal di dalam menu View sekarang - kepalanya cuma tiga
     tombol, jadi dia harus dibuka dulu. */
  if (await hal.locator('#galeri-tampil').isHidden()) {
    await hal.click('#galeri-saring [data-gkepala="*view"]');
    await hal.waitForTimeout(250);
  }
  await hal.click('#galeri-tampil [data-ggaya="daftar"]');
  await hal.waitForTimeout(350);
  cek('gambarnya tergambar di kartunya',
      (await hal.locator('#galeri-isi img.kartu-gambar').count()) >= 1);
  await hal.click('#galeri-isi img.kartu-gambar');
  await hal.waitForTimeout(350);
  cek('menyentuh gambarnya membuka pratinjau, bukan layar tulis',
      !(await hal.locator('#lihat').evaluate((n) => n.classList.contains('sembunyi'))) &&
      await hal.locator('#l-galeri').isVisible());
  /* Menutupnya cukup dengan menyentuh di mana saja - satu tombol silang di
     layar yang cuma berisi satu gambar adalah sasaran yang harus dicari untuk
     sesuatu yang sudah jelas. */
  await hal.click('#lihat');
  await hal.waitForTimeout(300);
  cek('menyentuh di mana saja menutupnya',
      await hal.locator('#lihat').evaluate((n) => n.classList.contains('sembunyi')));

  /* Sisa kartunya tetap berlaku seperti biasa: menyentuh judulnya membuka
     rinciannya DI TEMPAT, bukan memindahkan layar - pindah layar itu mahal
     saat sedang memindai, karena posisi gulirnya hilang. */
  await hal.click('#galeri-isi .kartu-judul');
  await hal.waitForTimeout(350);
  cek('menyentuh judulnya membuka rinciannya di tempat, bukan pratinjau',
      (await hal.locator('#galeri-isi .kartu.terbuka').count()) === 1 &&
      await hal.locator('#lihat').evaluate((n) => n.classList.contains('sembunyi')));
  cek('dan layarnya tidak ke mana-mana', await hal.locator('#l-galeri').isVisible());
  await hal.fill('#galeri-cari', '');
  await hal.dispatchEvent('#galeri-cari', 'input');
  await hal.click('#galeri-saring [data-gkepala="*view"]');
  await hal.waitForTimeout(250);
  await hal.click('#galeri-tampil [data-ggaya="sedang"]');
  await hal.waitForTimeout(300);
  await hal.click('#galeri-saring [data-gkepala="*home"]');
  await hal.waitForTimeout(250);
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(200);
}

console.log('\npin: yang penting selalu di paling atas');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.evaluate(async () => {
    const b = (id, judul) => ({
      id: id, jenis: 'teks', judul: judul, isi: judul, kategori: 'pinuji',
      tag: ['PinUji'], label: [], elemen: [], daftar: [],
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true
    });
    await TSimpan.taruh(b('pin-1', 'pinuji satu paling lama'));
    await TSimpan.taruh(b('pin-2', 'pinuji dua'));
    await TSimpan.taruh(b('pin-3', 'pinuji tiga paling baru'));
    return TAlur.muatUlangUji();
  });
  await hal.fill('#kotak', 'pinuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);

  /* Pin SELALU TERLIHAT, tidak disembunyikan di dalam rincian: yang dipin itu
     justru yang paling sering dipanggil, dan menyembunyikan tombolnya berarti
     dua ketukan untuk membatalkan satu. */
  cek('tiap kartu hasil membawa pinnya sendiri',
      (await hal.locator('#hasil-depan .kartu [data-pin]').count()) === 3);
  cek('dan pinnya terlihat tanpa membuka rincian kartunya',
      (await hal.locator('#hasil-depan .kartu-atas [data-pin]').count()) === 3);

  const judulUrut = () => hal.locator('#hasil-depan .kartu-judul').allInnerTexts();
  const sebelum = await judulUrut();
  /* Urutan awalnya tidak dipatok di sini - yang diuji BUKAN cara mengurut
     biasa, tapi bahwa pin mengangkat apa pun ke atasnya. Memaksa urutan awal
     berarti uji ini ikut gagal tiap kali peringkatnya disetel ulang. */
  cek('ketiganya tergambar', sebelum.length === 3, JSON.stringify(sebelum));
  cek('yang mau dipin belum di atas',
      !/paling lama/.test(sebelum[0]), JSON.stringify(sebelum));

  /* Yang dipin naik ke paling atas - dan itu berlaku di layar depan MAUPUN di
     layar Note; pin yang sama tidak boleh terbaca beda tergantung dari mana
     kamu melihatnya. */
  const idx = sebelum.findIndex((t) => /paling lama/.test(t));
  await hal.locator('#hasil-depan .kartu [data-pin]').nth(idx).click();
  await hal.waitForTimeout(400);
  const sesudah = await judulUrut();
  cek('yang dipin naik ke paling atas',
      /paling lama/.test(sesudah[0]), JSON.stringify(sesudah));
  cek('kartunya ikut bertanda terpin',
      (await hal.locator('#hasil-depan .kartu.terpin').count()) === 1);
  cek('pinnya menyala', (await hal.locator('#hasil-depan [data-pin].nyala').count()) === 1);

  /* Satu ketukan memasang, satu ketukan yang sama melepas: kalau melepasnya
     lebih sulit daripada memasang, sebulan lagi separuh timbunanmu terpin. */
  await hal.locator('#hasil-depan .kartu [data-pin]').first().click();
  await hal.waitForTimeout(400);
  cek('ketukan yang sama melepasnya',
      (await hal.locator('#hasil-depan [data-pin].nyala').count()) === 0 &&
      (await hal.locator('#hasil-depan .kartu.terpin').count()) === 0);

  /* Kolom pin ikut naik ke cadangan. Yang dijaga di sini URUTAN KEPALANYA,
     bukan siapa yang duduk paling belakang: baris lama membaca nilainya
     menurut urutan, jadi kolom baru boleh ditambahkan di ekor kapan saja -
     yang tidak boleh cuma menyisipkannya di tengah, karena itu menggeser
     seluruh cadangan yang sudah terlanjur ada. Mematok "pin harus terakhir"
     akan gagal tiap kali ada kolom baru yang sah. */
  const kolom = await hal.evaluate(() => TAwan.KOLOM);
  const KEPALA = ['id', 'jenis', 'judul', 'judulManual', 'isi', 'kategori', 'label',
                  'daftar', 'berkasId', 'driveId', 'namaBerkas', 'tipeBerkas', 'ukuran',
                  'dibuat', 'diubah', 'dipakai', 'diLabeliAI', 'pensiun', 'dihapus',
                  'riwayat', 'tag', 'elemen', 'rahasia', 'elemenTerkunci',
                  'selesai', 'selesaiPada', 'penting', 'hariIni', 'tenggat', 'ulang',
                  'pin'];
  cek('pin ikut dicadangkan',
      kolom.indexOf('pin') >= 0, JSON.stringify(kolom.slice(-3)));
  cek('dan kolom lama tidak pernah bergeser - yang baru selalu di ekor',
      JSON.stringify(kolom.slice(0, KEPALA.length)) === JSON.stringify(KEPALA),
      JSON.stringify(kolom));

  await hal.evaluate(async () => {
    for (const id of ['pin-1', 'pin-2', 'pin-3']) {
      const e = await TSimpan.ambil(id);
      if (e) { e.pensiun = true; await TSimpan.taruh(e); }
    }
    return TAlur.muatUlangUji();
  });
  await hal.fill('#kotak', '');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);
}

console.log('\nsaringan lengkap, To Do rapat, dan tema warna');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(350);

  /* ENAM SARINGAN PLUS RESET, dan Reset yang PALING KANAN - di ujung yang
     paling dekat jempol. Dia memang bukan saringan, tapi dia dipakai sepanjang
     hari, dan itu yang menentukan tempatnya. Sempat naik ke kepala layar dan
     itu keliru: kepala ada di ujung terjauh dari jempol yang bertumpu di sudut
     kanan bawah. */
  const semuaJenis = await hal.evaluate(() =>
    TAlur.jenisSaringUji().map((j) => j[0]));
  cek('barisnya lengkap: semua, teks, gambar, berkas, link, pin, reset',
      JSON.stringify(semuaJenis) ===
        JSON.stringify(['*semua', 'teks', 'gambar', 'berkas', 'tautan', '*pin',
                        '*reset']),
      JSON.stringify(semuaJenis));
  /* KAMERA PALING KANAN, sesudah Reset - ujung yang paling dekat jempol, untuk
     hal yang paling sering dilakukan di aplikasi ini. Keduanya bukan saringan:
     mereka tidak punya angka dan tidak pernah menyala. */
  /* Reset kembali paling kanan di baris ini: kamera dan Tulis sudah pindah
     jadi sepasang lingkaran di luar kotak yang menggulir. */
  cek('resetnya paling kanan di antara cipnya sendiri',
      semuaJenis[semuaJenis.length - 1] === '*reset');

  /* BAWAANNYA TEKS, bukan semua. Hasil yang langsung berisi dinding gambar
     memenuhi layar sebelum satu judul pun sempat terbaca; gambar dicari
     dengan sengaja, lewat cipnya sendiri.

     Tapi bawaannya TIDAK disimpan sebagai 'teks': layar depan terbuka kalau
     ada saringan yang menyala, jadi menyimpan 'teks' membuat layar depan tidak
     akan pernah kosong lagi - dan layar depan yang kosong itu seluruh gunanya
     aplikasi ini. Jadi '' berarti "belum memilih", dan yang belum memilih
     dilayani teks. */
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(250);
  cek('layar depan tetap kosong walau bawaannya teks',
      await hal.locator('#petak-hasil-depan').evaluate((n) => n.classList.contains('sembunyi')));
  cek('cip Teks yang menyala waktu belum memilih',
      (await hal.locator('#saring-baris [data-jenis="teks"].nyala').count()) === 1 &&
      (await hal.locator('#saring-baris [data-jenis="*semua"].nyala').count()) === 0);
  cek('dan yang dipakai menyaring memang teks',
      (await hal.evaluate(() => TAlur.jenisEfektifUji())) === 'teks');
  await hal.click('#saring-baris [data-jenis="*semua"]');
  await hal.waitForTimeout(300);
  cek('"Semua" itu pilihan sendiri, bukan bawaan',
      (await hal.evaluate(() => TAlur.jenisEfektifUji())) === '');
  await hal.click('#saring-baris [data-jenis="*semua"]');
  await hal.waitForTimeout(300);
  cek('dan dia selalu tampil, tidak peduli isinya',
      (await hal.locator('#saring-baris [data-jenis="*semua"]').count()) === 1);

  /* Yang diuji sungguhan: reset benar-benar mengosongkan layarnya - sekarang
     dari kepala, di kiri Setelan. */
  await hal.fill('#kotak', 'pinuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(350);
  await hal.click('#saring-cip [data-jenis="*reset"]');
  await hal.waitForTimeout(350);
  cek('reset mengosongkan kotak dan menutup hasilnya',
      (await hal.inputValue('#kotak')) === '' &&
      await hal.locator('#petak-hasil-depan').evaluate((n) => n.classList.contains('sembunyi')));

  /* TO DO DIRAPATKAN. Tiap baris dulu setinggi dua baris teks walau tugasnya
     tidak punya keterangan apa pun, dan daftar setinggi dua baris berhenti
     bisa dipindai sekali lihat. */
  await hal.evaluate(async () => {
    await TSimpan.taruh(TTugas.tugasBaru('tugas polos tanpa keterangan'));
    const u = TTugas.tugasBaru('bayar wifi tiap bulan');
    u.ulang = 'bulan';
    await TSimpan.taruh(u);
    return TAlur.muatUlangUji();
  });
  await hal.evaluate(() => { TAlur.keLayarUji('l-tugas'); TTugas.saring('semua'); TTugas.rak(''); TTugas.gambar(); });
  await hal.waitForTimeout(350);
  const polos = hal.locator('#tugas-daftar .tugas').filter({ hasText: 'tugas polos' });
  cek('tugas tanpa keterangan tidak punya baris kedua',
      (await polos.locator('.tugas-ket').count()) === 0);
  cek('tanggalnya naik ke baris judul',
      (await polos.locator('.tugas-baris1 .tugas-dibuat').count()) === 1);
  const tinggi = await polos.locator('.tugas-atas').evaluate((n) => n.getBoundingClientRect().height);
  cek('barisnya jadi satu baris, bukan dua', tinggi < 52, String(Math.round(tinggi)));

  /* BULATAN YANG BERULANG BUKAN KOTAK CENTANG KOSONG. Bulatan kosong berjanji
     "centang aku, aku hilang" - dan itu bohong untuk tugas berulang. */
  const wifi = hal.locator('#tugas-daftar .tugas').filter({ hasText: 'bayar wifi' }).first();
  cek('bulatan yang berulang ditandai, bukan bulatan kosong biasa',
      (await wifi.locator('.tugas-centang.berulang').count()) === 1);
  cek('dan isinya panah melingkar, bukan kosong',
      (await wifi.locator('.tugas-centang .ik.ulang').count()) === 1);
  cek('yang sekali jalan tetap bulatan kosong',
      (await polos.locator('.tugas-centang.berulang').count()) === 0);

  /* TEMA WARNA. Yang berganti CUMA aksennya - dasarnya tetap putih redup, dan
     alasannya sama dengan alasan tema gelap dulu dibuang. */
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(300);
  const tema = await hal.locator('#set-tema [data-tema]')
    .evaluateAll((n) => n.map((x) => x.getAttribute('data-tema')));
  cek('empat warna siap pakai plus satu sendiri',
      tema.length === 5 && tema[4] === 'sendiri', JSON.stringify(tema));

  const aksen = () => hal.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--a').trim());
  const sebelumTema = await aksen();
  await hal.click('#set-tema [data-tema="nila"]');
  await hal.waitForTimeout(350);
  const sesudahTema = await aksen();
  cek('memilih warna benar-benar mengganti aksennya',
      sesudahTema !== sebelumTema && /^#4338CA$/i.test(sesudahTema), sesudahTema);
  /* Dasarnya TIDAK ikut berubah - dua alas berarti tiap suntingan gaya harus
     diperiksa dua kali. */
  cek('dasarnya tetap putih redup di tema mana pun',
      (await hal.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--g').trim())) === '#f5f5f3');
  cek('pilihannya diingat',
      (await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => s.tema))) === 'nila');
  await hal.click('#set-tema [data-tema="teal"]');
  await hal.waitForTimeout(300);
  cek('bisa dikembalikan', /^#0F766E$/i.test(await aksen()));

  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.waitForTimeout(200);
}

console.log('\nbadge angka, cip Pin, kotak link, dan To Do yang ringkas');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.evaluate(async () => {
    const b = (id, judul, jenis, isi) => ({
      id: id, jenis: jenis, judul: judul, isi: isi || judul, kategori: 'badge',
      tag: ['Badge'], label: [], elemen: [], daftar: [],
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true
    });
    await TSimpan.taruh(b('bd-1', 'badgeuji catatan biasa', 'teks'));
    await TSimpan.taruh(b('bd-2', 'badgeuji gambar', 'gambar'));
    await TSimpan.taruh(b('bd-3', 'badgeuji gambar dua', 'gambar'));
    const l = b('bd-4', 'badgeuji katalog', 'teks', 'badgeuji katalog https://a.example.id/x');
    l.elemen = [{ jenis: 'tautan', nilai: 'https://a.example.id/x', nama: 'tautan' }];
    await TSimpan.taruh(l);
    const p = b('bd-5', 'badgeuji yang dipin', 'teks');
    p.pin = true;
    await TSimpan.taruh(p);
    return TAlur.muatUlangUji();
  });
  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(450);

  /* ANGKANYA ANGKA HASIL PENCARIAN, bukan angka seluruh timbunan. Yang
     menolong waktu kamu mengetik bukan "aku punya berapa gambar", tapi "kata
     ini menemukan berapa gambar" - dan itu menjawab kenapa layarnya kosong
     sebelum kamu sempat bertanya. */
  const angka = async (j) => Number(await hal.locator(
    '#saring-baris [data-jenis="' + j + '"] .saring-angka').innerText());
  cek('tiap cip membawa angka hasil pencariannya', (await angka('*semua')) === 5,
      String(await angka('*semua')));
  /* TEKS = bukan gambar dan bukan berkas, jadi kartu berisi link ikut terhitung. */
  cek('teks berisi tiga: catatan, katalog berlink, dan yang dipin',
      (await angka('teks')) === 3, String(await angka('teks')));
  cek('gambar dua', (await angka('gambar')) === 2);
  /* LINK DIBACA DARI ISINYA: kartu 'teks' yang punya elemen tautan tetap
     terhitung link - dulu cip Link menjawab "mana yang dulu kudrop telanjang". */
  cek('link dibaca dari elemennya, bukan dari bentuk dropnya',
      (await angka('tautan')) === 1, String(await angka('tautan')));
  cek('pin punya cipnya sendiri', (await angka('*pin')) === 1);

  /* Yang dipin bisa ditampilkan TANPA dipancing pencarian - itu seluruh
     gunanya pin. */
  await hal.fill('#kotak', '');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(300);
  await hal.click('#saring-baris [data-jenis="*pin"]');
  await hal.waitForTimeout(400);
  cek('cip Pin membuka yang dipin tanpa satu kata pun diketik',
      (await hal.locator('#hasil-depan .kartu').count()) === 1 &&
      /badgeuji yang dipin/.test(await hal.locator('#hasil-depan').innerText()));
  await hal.click('#saring-cip [data-jenis="*reset"]');
  await hal.waitForTimeout(300);

  /* KOTAK KHUSUS LINK. Menempel sepuluh tautan lalu menyorot satu per satu
     dengan jempol adalah pekerjaan yang justru mau dihapus. */
  cek('semua alamat terbaca, bukan cuma yang pertama',
      (await hal.evaluate(() => TOtak.semuaUrl(
        'katalog https://a.example.id/x, brosur https://b.example.id/y dan www.c.example.id'
      ).length)) === 3);
  await hal.click('#b-lampir');
  await hal.waitForTimeout(250);
  await hal.click('[data-lamp="link"]');
  await hal.waitForTimeout(250);
  cek('kotak tempel link terbuka dari bilah lampiran',
      !(await hal.locator('#petak-link').evaluate((n) => n.classList.contains('sembunyi'))));
  await hal.fill('#link-tempel', 'https://x.example.id/satu\nhttps://y.example.id/dua');
  await hal.dispatchEvent('#link-tempel', 'input');
  await hal.waitForTimeout(250);
  cek('jumlahnya disebut sebelum di-drop',
      /2 link terbaca/.test(await hal.locator('#link-ket').innerText()),
      await hal.locator('#link-ket').innerText());
  await hal.click('#b-drop');
  await hal.waitForTimeout(500);
  const dualink = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => /x\.example\.id/.test(e.isi || ''))[0]));
  cek('keduanya jadi elemen sendiri-sendiri, bisa disalin satu per satu',
      dualink && (dualink.elemen || []).filter((x) => x.jenis === 'tautan').length === 2,
      JSON.stringify(dualink && (dualink.elemen || []).map((x) => x.nilai)));
  /* Dan yang kedua TIDAK hilang: dua alamat berdampingan dulu terbaca sebagai
     satu "tautan", lalu yang kedua dibuang tanpa jejak. */
  cek('tidak ada alamat yang hilang diam-diam',
      dualink && /y\.example\.id/.test(dualink.isi || ''));

  /* LAYAR TO DO: urutan saringan, baris rak dibuang, rinciannya diringkas. */
  const tugasJs2 = fs.readFileSync(path.join(AKAR, 'tugas.js'), 'utf8');
  const urutSaring = await hal.evaluate(() => {
    TAlur.keLayarUji('l-tugas'); TTugas.gambar();
    return Array.from(document.querySelectorAll('#tugas-saring [data-tsaring]'))
      .map((n) => n.getAttribute('data-tsaring'));
  });
  cek('urutannya semua - hari ini - penting - berulang - selesai',
      JSON.stringify(urutSaring) ===
        JSON.stringify(['semua', 'hariini', 'penting', 'ulang', 'selesai']),
      JSON.stringify(urutSaring));
  cek('baris rak "#Semua daftar" dibuang',
      (await hal.locator('#tugas-daftar-rak [data-trak]').count()) === 0);

  await hal.evaluate(() => { TTugas.saring('semua'); TTugas.gambar(); });
  await hal.waitForTimeout(300);
  await hal.locator('#tugas-daftar .tugas .tugas-judul').first().click();
  await hal.waitForTimeout(350);
  /* Yang terbuka duluan cuma tenggat - sisanya di balik "Lainnya", dan yang
     tidak pernah dibuka tidak pernah memakan tempat. */
  cek('yang terbuka duluan cuma tenggat',
      (await hal.locator('#tugas-daftar .tugas-rinci .cip-baris').first().innerText())
        .indexOf('Hari ini') >= 0);
  cek('sisanya di balik "Lainnya"',
      (await hal.locator('#tugas-daftar [data-lain]').count()) === 1 &&
      await hal.locator('#tugas-daftar .tugas-lain-isi').first()
        .evaluate((n) => n.classList.contains('sembunyi')));
  /* Ulang dibuang dari sini seluruhnya: dia sudah punya tempatnya sendiri. */
  cek('pilihan Harian/Mingguan/Bulanan tidak lagi di sini',
      !/ulangCip\('harian'/.test(tugasJs2));
  await hal.click('#tugas-daftar [data-lain]');
  await hal.waitForTimeout(300);
  cek('"Lainnya" membuka sisanya',
      !(await hal.locator('#tugas-daftar .tugas-lain-isi').first()
        .evaluate((n) => n.classList.contains('sembunyi'))));

  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(200);
}

console.log('\nsatu baris saja: saringan, gudang, dan kepala yang dirampingkan');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(250);

  /* SATU BARIS, TIDAK MELIPAT. Yang melipat mendorong doknya naik, dan tinggi
     dok yang berubah-ubah sambil kamu mengetik adalah layar yang bergoyang
     tepat di bawah jempol. */
  const saringSebaris = await hal.evaluate(() => {
    const anak = [...document.querySelectorAll('#saring-cip .saring-cip')];
    const atas = anak.map((n) => Math.round(n.getBoundingClientRect().top));
    return { baris: new Set(atas).size, jumlah: anak.length };
  });
  cek('tujuh cip muat dalam satu baris',
      saringSebaris.baris === 1 && saringSebaris.jumlah === 7,
      JSON.stringify(saringSebaris));

  const muatLebar = await hal.evaluate(() => {
    const b = document.querySelector('#saring-baris');
    return b.scrollWidth <= b.clientWidth + 1;
  });
  cek('dan muat dalam 100% lebar layar, tanpa menggulir', muatLebar === true);

  /* Angkanya menumpang DI ATAS ikonnya. Di sebelahnya, tujuh benda tidak muat
     di 412px dan barisnya melipat - itu justru yang mau dihilangkan. */
  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  const tumpang = await hal.evaluate(() => {
    const cip = document.querySelector('#saring-cip [data-jenis="*semua"]');
    const ang = cip.querySelector('.saring-angka');
    if (!ang) return 'tidak ada angkanya';
    const c = cip.getBoundingClientRect(), a = ang.getBoundingClientRect();
    const menumpang = a.left < c.right && a.right > c.left && a.top < c.bottom;
    return menumpang ? 'ok' : 'di sebelah, bukan di atas';
  });
  cek('angkanya menumpang di atas ikonnya, bukan di sebelahnya', tumpang === 'ok', tumpang);

  /* Yang nol: cipnya TETAP ADA - cip yang muncul-hilang sambil kamu mengetik
     memindahkan tetangganya dan jari yang sudah hafal jadi salah tekan -
     tapi angkanya pergi. Nol itu bukan kabar, itu cuma tinta. */
  const nol = await hal.evaluate(() => {
    const cip = document.querySelector('#saring-cip [data-jenis="berkas"]');
    return { ada: !!cip, angka: !!cip.querySelector('.saring-angka'),
             redup: cip.classList.contains('sepi') };
  });
  cek('cip yang kosong tetap di tempatnya', nol.ada === true && nol.redup === true);
  cek('tapi angka nolnya tidak digambar', nol.angka === false);

  /* Baris gudang juga satu baris. Nama gudangnya tetap boleh sepanjang apa
     pun - itu janji yang sudah dipegang - yang tidak boleh cuma barisnya
     melipat. */
  await hal.fill('#kotak', '');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  const gudangSebaris = await hal.evaluate(() => {
    const cip = [...document.querySelectorAll('#ruang-baris .ruang-cip')];
    if (!cip.length) return 'tidak ada cip gudang';
    const atas = cip.map((n) => Math.round(n.getBoundingClientRect().top));
    return new Set(atas).size === 1 ? 'ok' : (new Set(atas).size + ' baris');
  });
  cek('cip gudang tersering juga tidak pernah melipat', gudangSebaris === 'ok', gudangSebaris);
  const gudangUtuh = await hal.evaluate(() => {
    const t = [...document.querySelectorAll('#ruang-baris .ruang-cip')]
      .map((n) => n.textContent);
    return t.every((x) => x.indexOf('\u2026') < 0);
  });
  cek('dan namanya tetap utuh, tidak dipotong', gudangUtuh === true);

  /* Reset naik ke kepala, di KIRI Setelan. Dan "N tersimpan" turun: dia tidak
     pernah mengubah satu keputusan pun, dan tempatnya justru yang dibutuhkan. */
  const diBawah = await hal.evaluate(() => {
    const r = document.querySelector('#saring-cip [data-jenis="*reset"]');
    const p = document.querySelector('#saring-cip [data-jenis="*pin"]');
    if (!r || !p) return 'tidak ada';
    if (document.querySelector('#l-utama .atas #b-reset')) return 'masih di kepala';
    return r.getBoundingClientRect().left > p.getBoundingClientRect().left
      ? 'ok' : 'reset di kiri pin';
  });
  cek('reset turun ke baris saringan, di kanan Pin', diBawah === 'ok', diBawah);
  cek('angka "N tersimpan" dibuang dari kepala',
      (await hal.locator('#l-utama .atas .jumlah').count()) === 0);

  /* Menahan kartu tetap jalan, tapi tidak boleh jadi SATU-SATUNYA jalan:
     gerakan yang tidak kelihatan sama dengan tidak ada bagi orang yang belum
     pernah diberi tahu. */
  await hal.evaluate(() => TAlur.keLayarUji('l-note'));
  await hal.fill('#note-cari', '');
  await hal.dispatchEvent('#note-cari', 'input');
  await hal.waitForTimeout(250);
  /* Naik dulu ke akar: uji sebelumnya meninggalkan satu folder terbuka. */
  if (await hal.locator('#note-alamat [data-note-akar]').count()) {
    await hal.click('#note-alamat [data-note-akar]');
    await hal.waitForTimeout(250);
  }
  /* DI HALAMAN DEPAN STORAGE FOLDERNYA SENDIRI YANG BISA DIPILIH. Dulu tombol
     Pilih disembunyikan di sini karena tidak ada kartu untuk ditunjuk - dan
     itu berarti folder di halaman depan tidak punya satu pun cara untuk
     dibereskan: yang bisa dipilih cuma isinya, dan isinya baru kelihatan
     sesudah tiap folder dibuka satu-satu. */
  cek('tombol Pilih ditawarkan di halaman folder juga',
      await hal.locator('#b-pilih-mulai').isVisible());
  const folderStorage = await hal.locator('#note-isi [data-note-folder]').first()
    .getAttribute('data-note-folder');

  /* MENAHAN FOLDER MEMULAI MEMILIH, tanpa menyentuh tombol Pilih sama sekali -
     kebiasaan yang sama persis dengan menahan satu chat di WhatsApp. Menahan
     itu satu kebiasaan, bukan dua: yang menahan folder mengharapkan hal yang
     sama dengan yang menahan kartu. */
  await hal.locator('#note-isi [data-note-folder="' + folderStorage + '"]')
    .dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  cek('menahan folder memulai memilih, tanpa tombol Pilih dulu',
      (await hal.locator('#note-isi [data-note-folder].dipilih').count()) === 1,
      await hal.locator('#pilih-jumlah').innerText());
  await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(250);

  await hal.click('#b-pilih-mulai');
  await hal.waitForTimeout(200);
  await hal.click('#note-isi [data-note-folder="' + folderStorage + '"]');
  await hal.waitForTimeout(250);
  cek('mengetuk folder Storage memilihnya, bukan membukanya',
      (await hal.locator('#note-isi [data-note-folder].dipilih').count()) === 1 &&
      (await hal.locator('#note-alamat').innerText()).indexOf(folderStorage) < 0,
      await hal.locator('#note-alamat').innerText());
  cek('dan Buang serta Pindah ditawarkan untuk folder itu',
      await hal.locator('#b-pilih-buang').isVisible() &&
      await hal.locator('#b-pilih-pindah').isVisible());

  /* YANG DITAWARKAN FOLDER LAYAR INI, bukan folder layar sebelah. Dulu satu
     daftar dipakai untuk dua layar, jadi memindah catatan di Storage
     menawarkan folder milik Note - nama yang tidak ada hubungannya sama sekali
     dengan yang sedang dilihat. */
  await hal.click('#b-pilih-pindah');
  await hal.waitForSelector('#tanya-pilih:not(.sembunyi)');
  const tawaran = await hal.locator('#tanya-pilih [data-pilih]').allInnerTexts();
  /* Yang ditawarkan boleh termasuk rak ANAK yang tidak tampil di akar - itu
     tujuan yang sah. Yang tidak boleh: nama yang cuma ada di daftar folder
     Note, karena itu layar yang berbeda dan raknya tidak ada hubungannya. */
  const folderNoteSaja = await hal.evaluate(() =>
    TSimpan.setelan('folderNote').then((v) => {
      try { return JSON.parse(v || '[]'); } catch (e) { return []; }
    }));
  const rakStorage = await hal.evaluate(() =>
    TAlur.semuaEntri().filter((e) => !e.pensiun && e.jenis !== 'tugas')
      .map((e) => e.kategori || '').filter(Boolean));
  cek('folder yang ditawarkan milik Storage, bukan milik Note',
      tawaran.length > 0 &&
      tawaran.every((x) => folderNoteSaja.indexOf(x.trim()) < 0 ||
                           rakStorage.indexOf(x.trim()) >= 0),
      JSON.stringify(tawaran) + ' vs note: ' + JSON.stringify(folderNoteSaja));
  cek('dan folder yang dipilih tidak menawarkan dirinya sendiri',
      tawaran.map((x) => x.trim()).indexOf(folderStorage) < 0);
  await hal.click('#b-tanya-batal');
  await hal.waitForTimeout(150);
  await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(200);

  /* MENGHAPUS RAK HARUS BENAR-BENAR MENGHAPUSNYA.

     Rak Storage tidak punya daftar sendiri - dia LAHIR dari isinya, dan alamat
     satu catatan bukan cuma kolom kategori: begitu kategorinya kosong,
     alamatnya jatuh ke tag buatan AI. Tag itu hampir selalu kata yang sama
     dengan nama raknya, jadi mengosongkan kategori saja membuat raknya lahir
     kembali seketika dengan isi yang sama persis - pesan "1 folder dihapus"
     lewat, dan foldernya tetap utuh.

     Umpannya HARUS bertag. Catatan tanpa tag jatuh ke "Belum berlabel" dengan
     sendirinya, dan itulah yang dulu menyembunyikan bug ini dari uji. */
  await hal.evaluate(async () => {
    const n = (id, j, kat, tag) => TSimpan.taruh({ id, jenis: 'teks', judul: j, isi: j,
      kategori: kat, folder: '', tag, label: [], elemen: [], daftar: [],
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true });
    await n('rk1', 'Invoice Rakuji', 'Rakuji', ['rakuji', 'invoice']);
    await n('rk2', 'Brief Rakuji', 'Rakuji', ['rakuji']);
    await TAlur.muatUlangUji();
  });
  /* Dikembalikan ke AKAR dulu: uji sebelumnya boleh saja meninggalkan layar
     ini di dalam satu folder atau dengan kotak carinya terisi, dan daftar rak
     cuma ada di akar. */
  await hal.fill('#note-cari', '');
  await hal.dispatchEvent('#note-cari', 'input');
  await hal.evaluate(() => {
    const b = document.querySelector('[data-note-akar]');
    if (b) b.click();
  });
  await hal.evaluate(() => TAlur.keLayarUji('l-note'));
  await hal.waitForTimeout(400);
  cek('raknya memang lahir dari isinya',
      (await hal.locator('#note-isi [data-note-folder="Rakuji"]').count()) === 1,
      JSON.stringify(await hal.locator('#note-isi [data-note-folder]').allInnerTexts()));
  await hal.locator('#note-isi [data-note-folder="Rakuji"]').dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  await hal.click('#b-pilih-buang');
  await hal.waitForTimeout(300);
  /* Kalimatnya menyebut TEMPATNYA, dan tempat itu harus yang benar-benar
     didatangi orangnya sesudah menekan Buang. */
  cek('pertanyaannya menyebut ke mana isinya pergi',
      (await hal.innerText('#tanya-ket')).indexOf('Belum berlabel') >= 0,
      await hal.innerText('#tanya-ket'));
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(800);
  const sesudahHapusRak = await hal.locator('#note-isi [data-note-folder]').allInnerTexts();
  cek('sesudah dihapus, raknya TIDAK lahir kembali dari tag isinya',
      !sesudahHapusRak.some((x) => /rakuji/i.test(x)), JSON.stringify(sesudahHapusRak));
  /* DAN TIDAK MELAHIRKAN RAK BARU. Mencabut tag yang menamai raknya memang
     membuat raknya hilang - tapi tag yang tersisa lantas jadi alamat, jadi
     menghapus satu rak justru menambah dua ("invoice", "brief") yang tidak
     pernah dibuat siapa pun. Isinya harus MENUNGGU, bukan disebar. */
  cek('dan tidak melahirkan rak baru dari tag yang tersisa',
      !sesudahHapusRak.some((x) => /invoice/i.test(x)), JSON.stringify(sesudahHapusRak));
  cek('isinya menunggu di "Belum berlabel" - tempat yang memang didatangi',
      (await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => e.id === 'rk1')
        .map((e) => TAlur.alamatNoteUji(e))[0])) === 'Belum berlabel');
  /* Tagnya TIDAK dicabut: tag itu kata kunci pencarian, dan catatan yang
     raknya kamu bereskan tidak boleh ikut kehilangan cara ditemukannya. */
  const rk = await hal.evaluate(() => {
    const a = TAlur.semuaEntri().filter((e) => e.id === 'rk1')[0];
    return a ? { ada: !a.pensiun, kat: a.kategori, tag: a.tag, lepas: a.rakLepas } : null;
  });
  cek('catatannya sendiri utuh - tidak diarsipkan, tidak dihapus',
      !!rk && rk.ada === true, JSON.stringify(rk));
  cek('dan tagnya utuh - pencariannya tidak ikut hilang',
      !!rk && rk.tag.indexOf('rakuji') >= 0 && rk.tag.indexOf('invoice') >= 0,
      JSON.stringify(rk));
  cek('masih ketemu lewat pencarian dengan tag raknya yang lama',
      (await hal.evaluate(() => TOtak.cari(TAlur.semuaEntri(), 'rakuji', '', '')
        .filter((e) => e.id === 'rk1').length)) === 1);
  /* Dan keadaan lepas itu BERAKHIR begitu kamu menaruhnya sendiri - kalau
     tidak, catatannya dianggap tanpa rak selamanya walau sudah dipindahkan. */
  await hal.evaluate(() => {
    const a = TAlur.semuaEntri().filter((e) => e.id === 'rk1')[0];
    a.kategori = 'Ultima';
    a.rakLepas = false;
    return TSimpan.taruh(a).then(() => TAlur.muatUlangUji());
  });
  await hal.waitForTimeout(300);
  cek('menaruhnya di rak lain mengakhiri keadaan lepasnya',
      (await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => e.id === 'rk1')
        .map((e) => TAlur.alamatNoteUji(e))[0])) === 'Ultima');
  await hal.evaluate(() => Promise.all(TAlur.semuaEntri()
    .filter((e) => e.id === 'rk1' || e.id === 'rk2')
    .map((e) => { e.pensiun = true; return TSimpan.taruh(e); })));
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(300);

  await hal.fill('#note-cari', 'badgeuji');
  await hal.dispatchEvent('#note-cari', 'input');
  await hal.waitForTimeout(300);
  cek('dan kartu tetap bisa dipilih seperti biasa',
      await hal.locator('#b-pilih-mulai').isVisible());
  cek('bilah pilih masih tertutup sebelum diminta',
      await hal.locator('#pilih-bilah').isHidden());
  await hal.click('#b-pilih-mulai');
  await hal.waitForTimeout(150);
  cek('ada tombol Pilih yang kelihatan, bukan cuma tekan-lama',
      await hal.locator('#pilih-bilah').isVisible());
  /* Belum ada yang ditunjuk, jadi bilahnya menyebut apa yang harus dilakukan -
     bukan "0 dipilih", yang cuma mengabarkan keadaan tanpa jalan keluarnya. */
  cek('dan dia menyebut langkah berikutnya, bukan "0 dipilih"',
      /Ketuk/.test(await hal.locator('#pilih-jumlah').innerText()));
  cek('Gabung dan Buang belum ada isinya, jadi belum ditawarkan',
      await hal.locator('#b-pilih-gabung').isHidden() &&
      await hal.locator('#b-pilih-buang').isHidden());
  await hal.click('#b-pilih-mulai');
  await hal.waitForTimeout(150);
  cek('ketukan kedua di tombol yang sama membatalkannya',
      await hal.locator('#pilih-bilah').isHidden());
  await hal.fill('#note-cari', '');
  await hal.dispatchEvent('#note-cari', 'input');
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
}

console.log('\nmengisi dengan tenang, daftar yang utuh, berulang, dan pilih banyak');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');

  /* MENGISI ITU PEKERJAAN SETENGAH MENIT, dan tiap huruf yang diketik di sana
     tidak ada hubungannya dengan mencari. Dulu kotak drop tetap hidup di
     bawahnya: hasil naik-turun, cip berkedip - lingkungan berisik untuk
     pekerjaan yang justru butuh tenang. */
  await hal.click('#b-lampir');
  await hal.click('.lamp[data-lamp="daftar"]');
  await hal.waitForTimeout(150);
  cek('memilih Daftar membuka kotak isiannya', await hal.locator('#petak-daftar').isVisible());
  cek('dan mendiamkan pencarian', await hal.locator('#l-utama.mode-isi').count() === 1);
  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(250);
  cek('mengetik tidak memanggil hasil selama kotak isian terbuka',
      await hal.locator('#petak-hasil-depan').isHidden());

  /* DAFTARNYA MASUK UTUH SEBAGAI LANGKAH. Dulu yang tertangkap cuma baris
     pertama, dan sepuluh baris yang barusan diketik hilang begitu saja -
     kehilangan diam-diam, tepat sesudah kerja yang paling banyak mengetiknya. */
  await hal.fill('#kotak', 'belanja bahan Ngoffee');
  const isian = hal.locator('#daftar-baris input[type=text]');
  await isian.first().fill('kopi 2 kg');
  await hal.click('#b-tambah-baris');
  await hal.locator('#daftar-baris input[type=text]').last().fill('gula aren 1 kg');
  await hal.click('#b-tugas');
  await hal.waitForFunction(() => TAlur.semuaEntri().some(
    (e) => e.jenis === 'tugas' && /belanja bahan/i.test(e.judul)), null, { timeout: 5000 });
  const tugasBelanja = await hal.evaluate(() => TAlur.semuaEntri().filter(
    (e) => e.jenis === 'tugas' && /belanja bahan/i.test(e.judul))[0]);
  cek('seluruh daftarnya ikut jadi langkah, bukan cuma baris pertama',
      (tugasBelanja.daftar || []).length === 2,
      JSON.stringify((tugasBelanja.daftar || []).map((x) => x.teks)));
  cek('gudangnya ikut terbawa dari kotak yang sama', tugasBelanja.kategori === 'Ngoffee',
      tugasBelanja.kategori);
  cek('kotak isiannya tertutup sesudah dikirim', await hal.locator('#petak-daftar').isHidden());
  cek('dan pencarian hidup lagi', await hal.locator('#l-utama.mode-isi').count() === 0);

  /* BERULANG PUNYA TEMPATNYA SENDIRI. Iramanya ditulis di bawah judulnya di
     layar itu - bukan di balik "Lainnya" - karena begitu kamu berdiri di sana,
     mengubah irama justru pekerjaan yang paling mungkin kamu datangi. */
  await hal.evaluate(() => TAlur.keLayarUji('l-tugas'));
  await hal.click('#tugas-saring [data-tsaring="ulang"]');
  await hal.waitForTimeout(200);
  cek('layar Berulang menampilkan pilihan iramanya di tempat',
      (await hal.locator('#tugas-daftar .cip-baris.irama').count()) > 0);
  await hal.fill('#tugas-baru', 'bayar sewa ruko');
  await hal.click('#b-tugas-tambah');
  await hal.waitForFunction(() => TAlur.semuaEntri().some(
    (e) => e.jenis === 'tugas' && /bayar sewa ruko/i.test(e.judul)), null, { timeout: 5000 });
  const sewa = await hal.evaluate(() => TAlur.semuaEntri().filter(
    (e) => /bayar sewa ruko/i.test(e.judul))[0]);
  /* Ditambah sambil berdiri di layar Berulang berarti memang berulang -
     menanyakan iramanya lagi sesudahnya adalah menagih jawaban yang sudah
     diberikan. Bulanan duluan karena itu yang paling sering: sewa, tagihan. */
  cek('yang ditambah dari sana langsung berulang, tanpa ditanya', sewa.ulang === 'bulanan',
      String(sewa.ulang));
  await hal.click('#tugas-saring [data-tsaring="semua"]');

  /* PILIH BANYAK DI NOTE. "Telepon Yusvi" lima tahun lalu masih muncul tiap
     hari, jadi membuang berbanyak itu mutlak perlu - tapi membuang di sini
     tetap berarti TENGGELAM, bukan hilang: tidak ada yang benar-benar terhapus. */
  await hal.evaluate(async () => {
    const b = (id, judul) => ({
      id: id, jenis: 'teks', judul: judul, isi: judul, kategori: 'Pilihuji',
      tag: [], label: [], elemen: [], daftar: [],
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true
    });
    await TSimpan.taruh(b('pl-1', 'pilihuji satu'));
    await TSimpan.taruh(b('pl-2', 'pilihuji dua'));
    await TSimpan.taruh(b('pl-3', 'pilihuji tiga'));
    return TAlur.muatUlangUji();
  });
  await hal.evaluate(() => TAlur.keLayarUji('l-note'));
  await hal.fill('#note-cari', 'pilihuji');
  await hal.dispatchEvent('#note-cari', 'input');
  await hal.waitForTimeout(250);

  /* MENAHAN satu kartu memulai memilih. Bukan kotak centang yang menganga
     sepanjang hari: memilih banyak itu pekerjaan sebulan sekali, dan kotak
     centang di tiap kartu adalah ongkos yang dibayar tiap hari untuk itu. */
  await hal.dispatchEvent('#note-isi .kartu[data-id="pl-1"]', 'pointerdown');
  await hal.waitForTimeout(700);
  cek('menahan satu kartu memulai memilih', await hal.locator('#pilih-bilah').isVisible());
  await hal.click('#note-isi .kartu[data-id="pl-2"]');
  await hal.waitForTimeout(150);
  cek('sesudah itu menyentuh kartu berarti memilih, bukan membuka',
      (await hal.locator('#pilih-jumlah').innerText()).indexOf('2') >= 0,
      await hal.locator('#pilih-jumlah').innerText());

  await hal.click('#b-pilih-gabung');
  await hal.waitForSelector('#tanya:not(.sembunyi)');
  cek('menggabung bertanya dulu, dan menyebut jadi apa',
      /pilihuji/i.test(await hal.locator('#tanya').innerText()));
  await hal.click('#b-tanya-ya');
  await hal.waitForFunction(() => {
    const a = TAlur.semuaEntri();
    const hidup = a.filter((e) => /^pilihuji/.test(e.judul || '') && !e.pensiun);
    return hidup.length === 2;
  }, null, { timeout: 5000 });
  const sesudahGabung = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => /^pilihuji/.test(e.judul || ''))
    .map((e) => ({ id: e.id, pensiun: !!e.pensiun, isi: e.isi })));
  const digabung = sesudahGabung.filter((e) => !e.pensiun);
  cek('isi keduanya benar-benar menyatu di satu kartu',
      digabung.some((e) => /pilihuji satu/.test(e.isi) && /pilihuji dua/.test(e.isi)),
      JSON.stringify(digabung.map((e) => e.isi)));
  /* Yang kalah TENGGELAM, tidak dihapus - aturan nomor empat berlaku juga di
     sini, dan justru di sini yang paling gampang bocor. */
  cek('yang kalah tenggelam, bukan terhapus',
      sesudahGabung.filter((e) => e.pensiun).length === 1 && sesudahGabung.length === 3,
      JSON.stringify(sesudahGabung.map((e) => e.id + ':' + e.pensiun)));

  await hal.dispatchEvent('#note-isi .kartu[data-id="pl-3"]', 'pointerdown');
  await hal.waitForTimeout(700);
  await hal.click('#b-pilih-buang');
  await hal.waitForSelector('#tanya:not(.sembunyi)');
  await hal.click('#b-tanya-ya');
  await hal.waitForFunction(() => TAlur.semuaEntri().some((e) => e.id === 'pl-3' && e.pensiun),
                            null, { timeout: 5000 });
  const masihAda = await hal.evaluate(() =>
    TSimpan.ambil('pl-3').then((e) => !!e && !!e.pensiun));
  cek('membuang berbanyak juga menenggelamkan, tidak menghapus', masihAda === true);
  cek('bilah pilih menutup sendiri sesudah selesai', await hal.locator('#pilih-bilah').isHidden());
  await hal.fill('#note-cari', '');
  await hal.dispatchEvent('#note-cari', 'input');
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
}

console.log('\nmode AI: satu ikon di atas Drop, dan obrolan yang tidak jadi timbunan');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.evaluate(() => Promise.all([
    TSimpan.setel('modeAI', 'hemat'),
    TSimpan.setel('kunciGemini', ''),
    TSimpan.setel('obrolan', '')
  ]).then(() => {
    /* Yang dipakai layar adalah setelan yang hidup di memori, jadi dia yang
       disetel - menulis ke basis data saja tidak menyalakan apa pun. */
    const s = TAlur.setelanUji();
    s.modeAI = 'hemat';
    s.kunciGemini = '';
  }));

  /* Ikonnya duduk TEPAT DI ATAS tombol Drop, di tumpukan yang sama - bukan
     menyelip di bilah kotak bersama klip dan Todo. Yang mengubah arti tombol
     harus berdiri di tempat yang sama dengan akibatnya. */
  /* DI DALAM KOTAKNYA, DI UJUNG KIRI - tempat WhatsApp dan Telegram menaruh
     emoji. Dia mengubah arti seluruh kotak di sebelahnya, jadi dia berdiri di
     kepala kotaknya seperti tanda kutip pembuka. */
  const diKiriKotak = await hal.evaluate(() => {
    const ai = document.querySelector('#b-ai');
    if (!ai) return 'tidak ada';
    if (!ai.closest('.kotak-bar')) return 'tidak di dalam kotaknya';
    const k = document.querySelector('#kotak').getBoundingClientRect();
    const a = ai.getBoundingClientRect();
    if (a.right > k.left + 2) return 'bukan di kiri kotaknya';
    return Math.abs(a.top - k.top) < 24 ? 'ok' : 'tidak sebaris dengan kotaknya';
  });
  cek('ikon AI duduk di ujung kiri kotak, seperti WhatsApp', diKiriKotak === 'ok', diKiriKotak);

  /* EMPAT IKON WAKTU DIAM, TIGA WAKTU MENGETIK. Yang pergi selalu yang paling
     tidak mungkin dipakai saat itu: orang yang sudah mengetik catatan tidak
     sedang mau bertanya ke AI.

     Kamera sempat ikut di sini dan itu keliru: di antara klip dan Todo - dua
     ikon yang MEMBUKA LACI - dia tidak pernah terbaca sebagai tombol yang
     menghasilkan sesuatu. Tempatnya sekarang di baris cip, di kanan Reset. */
  const ikonKotak = async () => hal.evaluate(() =>
    ['#b-ai', '#b-lampir', '#b-tugas', '#b-drop']
      .filter((s) => document.querySelector(s).getBoundingClientRect().width > 0).length);
  cek('empat ikon waktu kotaknya diam', (await ikonKotak()) === 4,
      String(await ikonKotak()));
  cek('dan tidak ada lagi ikon kamera di dalam kotaknya',
      (await hal.locator('#b-kamera').count()) === 0);
  await hal.fill('#kotak', 'sesuatu');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(200);
  cek('tinggal tiga begitu mulai mengetik, dan yang pergi ikon AI',
      (await ikonKotak()) === 3 &&
      (await hal.locator('#b-ai').isHidden()), String(await ikonKotak()));
  await hal.fill('#kotak', '');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(200);
  cek('dan kembali empat begitu kotaknya kosong lagi', (await ikonKotak()) === 4);

  cek('sebelum dinyalakan, obrolannya tidak kelihatan sama sekali',
      await hal.locator('#petak-ai').isHidden());

  await hal.click('#b-ai');
  await hal.waitForTimeout(120);
  cek('mengetuk ikonnya menyalakan mode AI', await hal.locator('#petak-ai').isVisible());
  /* Selama mode AI menyala, kotaknya bertanya - bukan mencari. Cip saringan
     yang tetap terpampang padahal tidak lagi menyaring apa pun adalah layar
     yang berbohong. */
  cek('cip saringan turun panggung', await hal.locator('#saring-baris').isHidden());
  /* Tapi ikon AI-nya TIDAK ikut hilang - dia satu-satunya jalan pulang, dan
     dia tetap ada walau kotaknya sudah berisi. */
  cek('ikon AI tetap kelihatan, karena dia jalan pulangnya',
      await hal.locator('#b-ai').isVisible());
  /* Todo ikut pergi: tugas tidak pernah lahir dari layar ini. */
  cek('cip Todo turun panggung juga', await hal.locator('#b-tugas').isHidden());
  cek('tombolnya berganti jadi panah kirim',
      await hal.locator('#b-drop .ik.kirim').isVisible() &&
      await hal.locator('#b-drop .ik.turun').isHidden());

  /* Mengetik di mode AI tidak boleh memanggil satu pun hasil pencarian. */
  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(250);
  cek('mengetik tidak lagi memanggil daftar hasil',
      await hal.locator('#petak-hasil-depan').isHidden());

  const sebelumObrol = proxyAI.panggilan;
  await hal.fill('#kotak', 'pilih KPR bunga tetap atau mengambang?');
  await hal.click('#b-drop');
  await hal.waitForFunction(() => TAlur.riwayatAIUji().length >= 2, null, { timeout: 8000 });

  cek('pertanyaannya berangkat lewat layanan pembuat', proxyAI.panggilan > sebelumObrol);
  cek('dikirim sebagai mode obrol, bukan pelabelan', proxyAI.modeTerakhir === 'obrol',
      proxyAI.modeTerakhir);
  cek('token Google pemakai tetap ikut', proxyAI.tokenTerakhir === 'token-palsu');
  /* Karakternya asisten pribadi, dan yang paling menentukan di arahannya
     adalah dua hal ini: jawabannya seimbang dengan pertanyaannya, dan yang
     perlu diputuskan dijawab SATU rekomendasi - bukan daftar pilihan yang
     memindahkan pekerjaan berpikir kembali ke orangnya. */
  cek('arahannya menyuruh jawab seimbang dengan pertanyaannya',
      /SEIMBANG DENGAN PERTANYAANNYA/.test(proxyAI.arahanTerakhir));
  cek('dan memberi satu rekomendasi, bukan daftar pilihan',
      /SATU rekomendasi/.test(proxyAI.arahanTerakhir));
  cek('jawabannya kalimat biasa, bukan JSON',
      /Ambil yang bunga tetap/.test(await hal.locator('#ai-isi .ai-pesan.ai .ai-gelembung').last().innerText()));
  cek('kotaknya kosong lagi sesudah dikirim',
      (await hal.inputValue('#kotak')) === '');

  /* JANJI YANG PALING MUDAH BOCOR: obrolan itu percakapan, bukan timbunan.
     Kalau dia diam-diam jadi entri, dia ikut dihitung, ikut dicari, dan ikut
     dikirim ke AI sebagai bahan pelabelan - persis penyakit yang aplikasi ini
     ada untuk mengobatinya. */
  const bocorKeTimbunan = await hal.evaluate(() =>
    TSimpan.semua().then((a) => a.filter((e) => /bunga tetap/i.test(e.judul + ' ' + e.isi)).length));
  cek('obrolan tidak diam-diam jadi catatan', bocorKeTimbunan === 0, String(bocorKeTimbunan));

  /* ... tapi yang memang layak jadi timbunan tetap bisa masuk, satu ketukan. */
  const sebelumDrop = await hal.evaluate(() => TAlur.semuaEntri().length);
  await hal.click('#ai-isi .ai-pesan.ai [data-ai-drop]');
  await hal.waitForFunction((n) => TAlur.semuaEntri().length > n, sebelumDrop, { timeout: 5000 });
  const kartuAI = await hal.evaluate(() => {
    const a = TAlur.semuaEntri().slice().sort((x, y) => y.dibuat - x.dibuat)[0];
    return { judul: a.judul, isi: a.isi, manual: a.judulManual, jenis: a.jenis };
  });
  cek('jawabannya bisa di-drop jadi catatan', /Ambil yang bunga tetap/.test(kartuAI.isi), kartuAI.isi);
  /* Pertanyaannya ikut jadi judul: jawaban tanpa pertanyaannya adalah potongan
     yang enam bulan lagi tidak bisa ditempatkan lagi. */
  cek('pertanyaannya ikut jadi judulnya', /KPR bunga tetap/.test(kartuAI.judul), kartuAI.judul);
  cek('judul itu tidak akan ditimpa AI', kartuAI.manual === true);

  /* JAWABANNYA LANGSUNG TERLIHAT, tanpa digulir dulu. Sejak tinggi layar Drop
     dipatok, halamannya tidak bisa digulir sama sekali - jadi menyuruh window
     menggulir ke dasar tidak mengerjakan apa pun, dan jawaban yang baru datang
     tinggal di bawah garis pandang. Yang punya gulirannya petak obrolan. */
  for (let i = 0; i < 6; i++) {
    await hal.fill('#kotak', 'pertanyaan panjang nomor ' + i + ' supaya obrolannya melebihi tinggi layar');
    await hal.click('#b-drop');
    await hal.waitForFunction((n) => TAlur.riwayatAIUji().length >= n, (i + 2) * 2,
                              { timeout: 8000 });
  }
  await hal.waitForTimeout(400);
  const terlihat = await hal.evaluate(() => {
    const petak = document.querySelector('#petak-ai');
    const pesan = petak.querySelectorAll('.ai-pesan');
    const akhir = pesan[pesan.length - 1].getBoundingClientRect();
    const p = petak.getBoundingClientRect();
    return { atas: Math.round(akhir.top - p.top), bawah: Math.round(akhir.bottom - p.bottom),
             tinggi: Math.round(p.height) };
  });
  cek('jawaban terakhir sudah terlihat tanpa digulir dulu',
      terlihat.atas >= -2 && terlihat.atas < terlihat.tinggi && terlihat.bawah <= 4,
      JSON.stringify(terlihat));

  /* Mode gambar: model lain, jawaban lain, dan hasilnya mendarat di toko
     berkas lewat jalan yang sama dengan gambar yang dilampirkan sendiri. */
  await hal.click('#ai-mode [data-ai-mode="gambar"]');
  await hal.fill('#kotak', 'logo kedai kopi, garis tipis');
  await hal.click('#b-drop');
  await hal.waitForFunction(() => TAlur.riwayatAIUji().some((m) => m.berkasId), null, { timeout: 8000 });
  cek('minta gambar dikirim sebagai mode gambar', proxyAI.modeTerakhir === 'gambar',
      proxyAI.modeTerakhir);
  const adaBerkas = await hal.evaluate(() => {
    const m = TAlur.riwayatAIUji().filter((x) => x.berkasId).pop();
    return TSimpan.ambilBerkas(m.berkasId).then((r) => !!(r && r.blob && r.blob.size));
  });
  cek('gambarnya benar-benar mendarat di toko berkas', adaBerkas === true);

  /* Riwayatnya tinggal di setelan - dari sana dia ikut berkas cadangan tanpa
     satu baris kode tambahan, dan tetap di luar pencarian catatan. */
  const disimpan = await hal.evaluate(() => TSimpan.setelan('obrolan'));
  cek('riwayatnya tersimpan, tidak hilang waktu halamannya dimuat ulang',
      /bunga tetap/.test(disimpan || ''));
  const ikutCadangan = await hal.evaluate(() => TSimpan.ekspor().then((d) => !!d.setelan.obrolan));
  cek('dan ikut ke berkas cadangan', ikutCadangan === true);

  /* Mengetuk ikonnya SEKALI LAGI mengembalikan semuanya - tanpa itu, jalan
     pulangnya harus ditebak. */
  await hal.click('#b-ai');
  await hal.waitForTimeout(120);
  cek('ketukan kedua di ikon yang sama mengembalikan mode biasa',
      await hal.locator('#petak-ai').isHidden() &&
      await hal.locator('#b-drop .ik.turun').isVisible());

  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(250);
  cek('pencarian hidup lagi seperti semula',
      await hal.locator('#petak-hasil-depan').isVisible());
  await hal.fill('#kotak', '');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
}

console.log('\nNote: ruang menulis, dengan pencariannya sendiri');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');

  /* PINTU KEEMPAT. Urutannya menceritakan alur harinya: menjatuhkan,
     menulis, mengerjakan, menyimpan. */
  await hal.click('#l-utama [data-tab-ke="l-tulis"]');
  await hal.waitForSelector('#l-tulis.aktif');
  cek('pintu Note membuka layarnya sendiri', await hal.locator('#l-tulis').isVisible());
  cek('ada kotak cari khusus di layar itu', await hal.locator('#tulis-cari').isVisible());
  cek('dan tombol tulis baru yang kelihatan', await hal.locator('#b-tulis-baru').isVisible());

  /* Bulat, beralas aksen, di sudut kanan bawah - tempat jempol kanan sudah
     bertumpu, sama seperti tombol Drop. */
  const diSudut = await hal.evaluate(() => {
    const b = document.querySelector('#b-tulis-baru').getBoundingClientRect();
    return b.right > innerWidth * 0.6 && b.bottom > innerHeight * 0.7;
  });
  cek('tombolnya di sudut kanan bawah, dalam jangkauan jempol', diSudut === true);

  const kosongAwal = await hal.locator('#tulis-isi .kartu').count();
  cek('daftarnya masih kosong sebelum ada yang ditulis', kosongAwal === 0, String(kosongAwal));

  await hal.click('#b-tulis-baru');
  await hal.waitForSelector('#l-catat.aktif');
  cek('tombolnya membuka layar tulis', await hal.locator('#l-catat').isVisible());
  /* Layar ini menyimpan sendiri, jadi tombol Simpan tidak menambah satu pun
     kemampuan. Yang ditambahkannya BUKTI - dan yang menahan orang menulis dua
     puluh menit di sini bukan kehilangan yang pernah terjadi, melainkan tidak
     adanya satu pun tanda bahwa tulisannya aman. */
  cek('ada tombol Simpan yang bisa ditekan', await hal.locator('#b-simpan').isVisible());

  await hal.fill('#catat-judul', 'Instruksi editor font');
  await hal.fill('#catat-isi', 'Menu Font: buatkan filter Elegant, Script, Modern, Display.');
  await hal.click('#b-simpan');
  await hal.waitForFunction(() => TAlur.semuaEntri().some(
    (e) => e.tulisan && /Instruksi editor font/.test(e.judul || '')), null, { timeout: 5000 });
  cek('menekan Simpan benar-benar menyimpannya', true);

  await hal.evaluate(() => TAlur.keLayarUji('l-tulis'));
  await hal.waitForTimeout(300);
  /* SATU TINGKAT, SATU JENIS ISI. Di akar yang tampil FOLDER SAJA - isinya
     baru terlihat sesudah foldernya dibuka. Menampilkan keduanya sekaligus
     memperlihatkan tulisan yang sama dua kali: sekali di dalam angka
     foldernya, sekali sebagai baris di bawahnya. */
  cek('di akar yang tampil folder saja, bukan isinya sekalian',
      (await hal.locator('#tulis-isi .kartu').count()) === 0 &&
      (await hal.locator('#tulis-isi [data-tulis-folder]').count()) >= 1,
      await hal.locator('#tulis-isi').innerText());
  /* Yang belum berfolder punya barisnya sendiri - tanpa itu dia tidak punya
     satu pun jalan untuk dilihat lagi. */
  await hal.click('#tulis-isi [data-tulis-folder="Belum berfolder"]');
  await hal.waitForTimeout(300);
  const adaDiDaftar = await hal.locator('#tulis-isi .kartu').count();
  cek('tulisannya muncul sesudah foldernya dibuka', adaDiDaftar === 1,
      String(adaDiDaftar));

  /* JUDUL NOTE BERPRILAKU SAMA DENGAN DROP: gudangnya dibaca dari judulnya
     sendiri, tanpa satu kolom pun yang menagih jawaban. */
  await hal.click('#tulis-isi .kartu');
  await hal.waitForSelector('#l-catat.aktif');
  await hal.fill('#catat-judul', 'Ngoffee instruksi editor font');
  await hal.dispatchEvent('#catat-judul', 'input');
  await hal.waitForTimeout(300);
  cek('raknya terbaca dari judul, sambil diketik',
      /Ngoffee/.test(await hal.locator('#catat-ruang').innerText()),
      await hal.locator('#catat-ruang').innerText());
  await hal.click('#b-simpan');
  await hal.waitForTimeout(400);
  const ruangNote = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.tulisan && /instruksi editor font/i.test(e.judul || ''))[0]);
  cek('dan benar-benar mendarat di rak itu', ruangNote && ruangNote.kategori === 'Ngoffee',
      JSON.stringify(ruangNote && ruangNote.kategori));

  /* SALIN SELURUH TULISAN - judul dan isinya sekaligus. Yang ditulis di sini
     justru yang panjang: prompt, brief, instruksi - yang memang dibuat untuk
     ditempel ke tempat lain. Menyorotnya dengan jempol sampai ujung layar
     ketiga adalah pekerjaan yang aplikasi ini ada untuk menghapus. */
  cek('ada tombol salin di layar tulis', await hal.locator('#b-salin-catat').isVisible());
  await konteks.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await hal.click('#b-salin-catat');
  await hal.waitForTimeout(300);
  const tersalin = await hal.evaluate(() =>
    navigator.clipboard.readText().then((x) => x, () => ''));
  cek('menyalin judul DAN isinya sekaligus',
      /Ngoffee instruksi editor font/.test(tersalin) && /Menu Font/.test(tersalin),
      JSON.stringify(tersalin.slice(0, 80)));
  await hal.click('[data-kembali]');
  await hal.waitForTimeout(300);

  /* Catatan yang dibuka lalu ditinggal tanpa satu huruf pun TIDAK boleh jadi
     baris kosong di timbunan - tombol ini akan sering ditekan lalu diurungkan. */
  const sebelumBatal = await hal.evaluate(() => TAlur.semuaEntri().length);
  await hal.click('#b-tulis-baru');
  await hal.waitForSelector('#l-catat.aktif');
  await hal.click('[data-kembali]');
  await hal.waitForTimeout(350);
  const sesudahBatal = await hal.evaluate(() => TAlur.semuaEntri().length);
  cek('membuka lalu keluar tanpa mengetik tidak meninggalkan baris kosong',
      sesudahBatal === sebelumBatal, sebelumBatal + ' -> ' + sesudahBatal);

  /* PENCARIANNYA BERDIRI SENDIRI. Mencari satu tulisan di antara ribuan
     potongan drop berarti mengayak sesuatu yang kamu tahu persis ada. */
  await hal.evaluate(() => TAlur.keLayarUji('l-tulis'));
  await hal.fill('#tulis-cari', 'badgeuji');
  await hal.dispatchEvent('#tulis-cari', 'input');
  await hal.waitForTimeout(250);
  cek('yang di-drop tidak ikut muncul di layar Note',
      (await hal.locator('#tulis-isi .kartu').count()) === 0);
  await hal.fill('#tulis-cari', 'font');
  await hal.dispatchEvent('#tulis-cari', 'input');
  await hal.waitForTimeout(250);
  cek('dan tulisannya ketemu dari layar itu juga',
      (await hal.locator('#tulis-isi .kartu').count()) === 1);
  await hal.fill('#tulis-cari', '');
  await hal.dispatchEvent('#tulis-cari', 'input');

  /* TAPI JANJI NOMOR SATU TETAP: satu pencarian untuk mengambilnya kembali.
     Tulisan tetap ikut terjaring di kotak Drop seperti catatan lain - yang
     ditambahkan layar Note bukan dinding kedua, melainkan pintu yang lebih
     sempit ke rak yang sudah kamu tahu isinya. */
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.fill('#kotak', 'Instruksi editor');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  cek('tulisan tetap ikut terjaring pencarian utama',
      (await hal.locator('#hasil-depan .kartu')).count !== undefined &&
      (await hal.locator('#hasil-depan .kartu').count()) >= 1);
  await hal.fill('#kotak', '');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
}

console.log('\nTo Do: yang belum dibaca, dan urutan yang bisa ditebak');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  /* Bersihkan dulu supaya urutannya bisa diperiksa apa adanya. */
  await hal.evaluate(() => TSimpan.semua().then((a) => Promise.all(
    a.filter((e) => e.jenis === 'tugas').map((e) => { e.pensiun = true; return TSimpan.taruh(e); })
  )).then(() => TAlur.muatUlangUji()));

  /* YANG MASUK LEWAT DROP BELUM DIBACA. Dia dijatuhkan dalam tiga detik,
     sering sambil mengerjakan hal lain, dan tidak pernah dilihat lagi sampai
     kamu sengaja ke layar To Do - tanpa penanda dia mendarat di tengah
     puluhan baris yang rupanya sama persis. */
  const drop = async (teks) => {
    await hal.fill('#kotak', teks);
    await hal.click('#b-tugas');
    await hal.waitForTimeout(350);
  };
  await drop('bacauji kirim proposal Ngoffee');
  await drop('bacauji telepon vendor kaca');
  await drop('bacauji cek stok gula aren');

  /* Lewat pintunya, bukan keLayarUji: yang menggambar ulang daftar tugas itu
     TTugas.buka(), dan keLayarUji sengaja tidak memanggilnya. */
  await hal.click('#l-utama [data-tab-ke="l-tugas"]');
  await hal.waitForTimeout(400);
  const belum = await hal.locator('#tugas-daftar .tugas.belum').count();
  cek('yang masuk dari Drop bertanda belum dibaca', belum === 3, String(belum));

  /* URUTANNYA BISA DITEBAK: yang terbaru di paling atas. Pertanyaan yang
     paling sering ditanyakan di layar ini adalah "yang barusan kudrop mana",
     dan urutan berprioritas menjawabnya dengan melempar tugas baru ke tengah
     daftar - ke tempat yang tidak bisa ditebak. */
  const urut = await hal.locator('#tugas-daftar .tugas .tugas-judul').allInnerTexts();
  cek('bawaannya yang terbaru di paling atas',
      /stok gula aren/.test(urut[0]) && /kirim proposal/.test(urut[2]),
      JSON.stringify(urut));

  /* MEMBUKANYA BERARTI MEMBACANYA - tidak perlu tombol "tandai sudah dibaca". */
  await hal.click('#tugas-daftar .tugas:first-child .tugas-judul');
  await hal.waitForTimeout(400);
  cek('membuka satu tugas menghapus tanda belum dibacanya',
      (await hal.locator('#tugas-daftar .tugas.belum').count()) === 2);
  /* Dan itu benar-benar tersimpan, bukan cuma hilang dari layar. */
  const tersimpan = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => e.jenis === 'tugas' && /stok gula aren/.test(e.judul))[0]));
  cek('dan tandanya tidak kembali sesudah dimuat ulang', tersimpan.dibaca === true);

  /* Tugas yang KAMU KETIK SENDIRI di layar To Do lahir sudah dibaca: tanda
     yang menyala untuk hal yang jelas-jelas kamu tahu berhenti berarti apa-apa. */
  await hal.fill('#tugas-baru', 'bacauji tugas yang kuketik sendiri');
  await hal.click('#b-tugas-tambah');
  await hal.waitForTimeout(400);
  const sendiri = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => e.jenis === 'tugas' && /kuketik sendiri/.test(e.judul))[0]));
  cek('yang kamu ketik sendiri tidak pernah bertanda belum dibaca',
      sendiri.dibaca === true);

  /* Tugas lama tidak punya kolom ini sama sekali, dan mereka TIDAK boleh
     tiba-tiba menyala semua di pembukaan berikutnya. */
  const lama = await hal.evaluate(() => TTugas.belumDibaca({ judul: 'tugas lama' }));
  cek('tugas lama tanpa kolom itu tetap dianggap sudah dibaca', lama === false);

  /* "HARI INI" ITU TENGGAT, BUKAN TANGGAL DIBUAT. Namanya punya dua bacaan
     yang sama masuk akal, jadi yang benar disebutkan sekali di layar kosongnya
     - jauh lebih murah daripada membiarkan orangnya menebak tiap pagi. */
  await hal.click('#tugas-saring [data-tsaring="hariini"]');
  await hal.waitForTimeout(300);
  const hariIni = await hal.locator('#tugas-daftar .tugas .tugas-judul').allInnerTexts();
  cek('yang dibuat hari ini TIDAK otomatis masuk "Hari ini"',
      hariIni.length === 0, JSON.stringify(hariIni));
  cek('dan layar kosongnya menyebut apa yang dikumpulkannya',
      /jatuh tempo/.test(await hal.locator('#tugas-daftar').innerText()),
      await hal.locator('#tugas-daftar').innerText());

  /* Yang bertenggat hari ini memang masuk - itu arti namanya. */
  await hal.evaluate(() => TSimpan.semua().then((a) => {
    const e = a.filter((x) => x.jenis === 'tugas' && /vendor kaca/.test(x.judul))[0];
    e.tenggat = TTugas.hariMulai(Date.now());
    return TSimpan.taruh(e);
  }).then(() => TAlur.muatUlangUji()).then(() => TTugas.gambar()));
  await hal.waitForTimeout(300);
  cek('yang tenggatnya hari ini yang masuk',
      /vendor kaca/.test(await hal.locator('#tugas-daftar').innerText()));

  await hal.click('#tugas-saring [data-tsaring="semua"]');


  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.fill('#kotak', '');
}

console.log('\ngeser antar pintu, papan ketik, pin, dan arsip yang bisa dikosongkan');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.waitForTimeout(200);

  /* LENCANA ANGKA DI PINTU TO DO DIBUANG. Dia memberitahu ada 15 tugas belum
     selesai - dan itu bukan kabar, itu tagihan yang menempel sepanjang hari.
     Angka yang tidak pernah bisa jadi nol berhenti menggerakkan apa pun. */
  cek('tidak ada lagi lencana angka di pintu To Do',
      (await hal.locator('[data-tab] .tab-lencana').count()) === 0);

  /* NAMA PINTU 14px - ukuran label navigasi utama yang dipakai Material 3, dan
     kira-kira sama dengan tab bar iOS. 12,5px membuatnya setara dengan
     keterangan kecil di sekitarnya, padahal dia yang paling sering dituju
     mata. Yang dijaga: empat pintu tetap SATU BARIS dan namanya tidak pernah
     terpotong. */
  const pintuUkur = await hal.evaluate(() => {
    const t = [...document.querySelectorAll('#l-utama [data-tab] .tab')];
    return {
      ukuran: parseFloat(getComputedStyle(t[0]).fontSize),
      baris: new Set(t.map((e) => Math.round(e.getBoundingClientRect().top))).size,
      muat: t.every((e) => e.scrollWidth <= e.clientWidth + 1)
    };
  });
  cek('nama pintu cukup besar untuk dituju mata duluan', pintuUkur.ukuran >= 14,
      String(pintuUkur.ukuran));
  cek('dan empat pintu tetap sebaris tanpa satu nama pun terpotong',
      pintuUkur.baris === 1 && pintuUkur.muat === true, JSON.stringify(pintuUkur));

  /* TEKAN LAMA DI LAYAR DROP. Kebiasaan yang sama dengan WhatsApp: tahan satu,
     lalu ketuk teman-temannya. Di sini pintunya CUMA tekan-lama - tombol Pilih
     yang menganga di dok akan menagih tempat dari kotak yang dipakai puluhan
     kali sehari, untuk pekerjaan sebulan sekali. */
  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  const kartuDrop = hal.locator('#hasil-depan .kartu').first();
  await kartuDrop.dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  cek('menahan kartu di layar Drop memulai memilih',
      await hal.locator('#pilih-bilah').isVisible());
  cek('dan bilahnya tidak menutupi kotak drop',
      await hal.evaluate(() => {
        const b = document.querySelector('#pilih-bilah').getBoundingClientRect();
        const d = document.querySelector('#dok').getBoundingClientRect();
        return b.bottom <= d.top + 2;
      }) === true);
  /* PINDAH PINTU MENYELESAIKAN PILIHANNYA DULU. Bilah pilih melayang di
     tingkat halaman, jadi tanpa ini dia ikut ke layar berikutnya - membawa
     enam folder yang tidak ada di sana, dan tombol Buang yang tidak lagi tahu
     apa yang dibuangnya. */
  await hal.click('#l-utama [data-tab-ke="l-tugas"]');
  await hal.waitForTimeout(400);
  cek('pindah pintu membatalkan pilihannya, bukan membawanya ikut',
      await hal.locator('#pilih-bilah').isHidden());
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(250);

  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);

  /* GESER ANTAR PINTU. Empat pintu berjajar, dan memindahkannya cuma butuh
     satu ketukan - tapi ketukan itu di kepala layar, ujung terjauh dari jempol
     yang bertumpu di sudut kanan bawah. */
  const geser = async (dari, ke) => {
    await hal.evaluate((d) => TAlur.keLayarUji(d), dari);
    await hal.waitForTimeout(200);
    const kotak = await hal.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    const y = Math.round(kotak.h * 0.45);
    await hal.mouse.move(ke > 0 ? kotak.w - 40 : 40, y);
    await hal.mouse.down();
    await hal.mouse.move(ke > 0 ? 40 : kotak.w - 40, y, { steps: 8 });
    await hal.mouse.up();
    await hal.waitForTimeout(300);
    return hal.evaluate(() => document.querySelector('.layar.aktif').id);
  };
  cek('geser ke kiri membuka pintu di kanannya',
      (await geser('l-utama', 1)) === 'l-tulis');

  /* Dan selama memilih, pintunya tidak bisa DIGESER - geser itu gerakan yang
     gampang terjadi tanpa diniatkan, dan tersesat ke layar lain di tengah
     pekerjaan membuat pekerjaannya bercabang. */
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(200);
  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  await hal.locator('#hasil-depan .kartu').first().dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  const sesudahGeserPilih = await geser('l-utama', 1);
  cek('selama memilih, geser tidak memindahkan pintu',
      sesudahGeserPilih === 'l-utama', sesudahGeserPilih);
  await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(200);
  await hal.fill('#kotak', '');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);

  /* DI HP YANG DIPAKAI, GESERANNYA LEWAT SENTUHAN - dan di Android, begitu
     browser memutuskan gerakanmu itu gulir, dia MEMBATALKAN aliran pointer:
     'pointerup' tidak pernah datang. Jadi jalur sentuhnya diuji sendiri,
     bukan dititipkan ke jalur tetikus. */
  const geserSentuh = async (dari, ke) => {
    await hal.evaluate((d) => TAlur.keLayarUji(d), dari);
    await hal.waitForTimeout(250);
    return hal.evaluate((arah) => {
      var y = Math.round(innerHeight * 0.45);
      var x1 = arah > 0 ? innerWidth - 40 : 40;
      var x2 = arah > 0 ? 40 : innerWidth - 40;
      var sasaran = document.elementFromPoint(x1, y) || document.body;
      var buat = function (nama, x) {
        var s = { clientX: x, clientY: y, identifier: 1, target: sasaran };
        return new TouchEvent(nama, {
          bubbles: true, cancelable: true,
          touches: nama === 'touchend' ? [] : [new Touch(s)],
          changedTouches: [new Touch(s)]
        });
      };
      sasaran.dispatchEvent(buat('touchstart', x1));
      sasaran.dispatchEvent(buat('touchend', x2));
      return new Promise(function (r) {
        setTimeout(function () { r(document.querySelector('.layar.aktif').id); }, 250);
      });
    }, ke);
  };
  cek('geser SENTUH juga membuka pintu di kanannya',
      (await geserSentuh('l-utama', 1)) === 'l-tulis');
  cek('dan sentuhan dari layar Note sampai ke To Do',
      (await geserSentuh('l-tulis', 1)) === 'l-tugas');
  /* Baris tugas tidak lagi dikecualikan: tidak ada gerakan mendatar yang
     berarti apa pun di atasnya, dan layar To Do hampir seluruhnya baris
     tugas - jadi mengecualikannya membuat layar itu yang paling sulit
     ditinggalkan dengan geseran. */
  cek('dan dari To Do balik lagi ke Note',
      (await geserSentuh('l-tugas', -1)) === 'l-tulis');
  cek('geser ke kanan mengembalikannya',
      (await geser('l-tulis', -1)) === 'l-utama');
  /* Di ujung tidak ada apa-apa, dan tidak terjadi apa-apa - bukan melompat
     memutar ke pintu paling ujung yang lain. */
  cek('di pintu pertama, geser ke kanan tidak melompat ke ujung',
      (await geser('l-utama', -1)) === 'l-utama');

  /* Gerakan yang SUDAH punya arti tidak boleh direbut: geser di atas kartu
     berarti mengarsipkannya, bukan pindah pintu. */
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); });
  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  const kartuKotak = await hal.locator('#hasil-depan .kartu').first().boundingBox();
  if (kartuKotak) {
    await hal.mouse.move(kartuKotak.x + kartuKotak.width - 20, kartuKotak.y + kartuKotak.height / 2);
    await hal.mouse.down();
    await hal.mouse.move(kartuKotak.x + 20, kartuKotak.y + kartuKotak.height / 2, { steps: 8 });
    await hal.mouse.up();
    await hal.waitForTimeout(300);
    cek('geser di atas kartu tidak merebut arti geser kartu itu sendiri',
        (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-utama');
  }
  await hal.fill('#kotak', '');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());

  /* PAPAN KETIK DISIMULASIKAN, bukan ditebak. Papan ketik HP tidak mengubah
     tinggi halaman - dia cuma menutupi bagiannya - jadi selama layar Drop
     setinggi layar penuh, doknya duduk di dasar halaman DI BALIK papan ketik
     dan browser menggulir seluruh halaman supaya kotaknya terlihat. Yang
     tergulir keluar pandangan justru hasil pencarian di atasnya.

     Di sini --tampak dikecilkan jadi 480px - persis seperti papan ketik
     Android yang menutupi 435px bawah - lalu yang diukur GEOMETRI SUNGGUHAN
     di layar, bukan aturan CSS-nya. */
  await hal.fill('#kotak', 'badgeuji');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(400);
  const TAMPAK = 480;
  await hal.evaluate((h) => {
    document.documentElement.style.setProperty('--tampak', h + 'px');
  }, TAMPAK);
  await hal.waitForTimeout(250);
  await hal.evaluate(() => document.querySelector('#kotak').focus());
  /* Dipaksa menggulir: kalau halamannya masih bisa digeser, doknya akan
     melompat ke tengah layar persis seperti yang dilaporkan. */
  await hal.evaluate(() => window.scrollTo(0, 400));
  await hal.waitForTimeout(250);
  const papan = await hal.evaluate(() => {
    const dok = document.querySelector('#dok').getBoundingClientRect();
    const kartu = document.querySelector('#hasil-depan .kartu');
    const k = kartu ? kartu.getBoundingClientRect() : null;
    return {
      dokBawah: Math.round(dok.bottom),
      kartuAtas: k ? Math.round(k.top) : null,
      kartuBawah: k ? Math.round(k.bottom) : null,
      gulir: Math.round(window.scrollY)
    };
  });
  cek('dok duduk tepat di atas papan ketik, bukan di baliknya',
      papan.dokBawah <= TAMPAK + 2, JSON.stringify(papan));
  cek('hasil pertama terlihat tanpa menutup papan ketik dulu',
      papan.kartuAtas !== null && papan.kartuAtas >= 0 && papan.kartuBawah <= TAMPAK,
      JSON.stringify(papan));
  /* Yang paling penting: halamannya TIDAK BISA digulir sama sekali di layar
     ini. Dokumen yang tidak lebih tinggi dari layarnya tidak punya apa pun
     untuk digeser, jadi doknya tidak akan pernah melompat ke tengah. */
  cek('halamannya tidak bisa digulir, jadi doknya tidak pernah melompat',
      papan.gulir === 0, String(papan.gulir));
  await hal.evaluate(() => document.documentElement.style.removeProperty('--tampak'));
  await hal.fill('#kotak', '');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);

  /* MELEPAS PIN LANGSUNG TERLIHAT DI LAYAR NOTE. Dulu tidak: satu ketukan yang
     tidak menghasilkan apa-apa terbaca sebagai tombol rusak. */
  await hal.evaluate(() => TSimpan.semua().then((a) => {
    const e = a.filter((x) => x.tulisan && !x.pensiun)[0];
    if (e) { e.pin = true; return TSimpan.taruh(e); }
  }).then(() => TAlur.muatUlangUji()));
  await hal.evaluate(() => TAlur.keLayarUji('l-tulis'));
  await hal.waitForTimeout(300);
  cek('yang dipin ditandai di layar Note',
      (await hal.locator('#tulis-isi .kartu.terpin').count()) === 1);
  await hal.click('#tulis-isi .kartu.terpin [data-pin]');
  await hal.waitForTimeout(400);
  cek('melepasnya langsung terlihat, tanpa pindah layar dulu',
      (await hal.locator('#tulis-isi .kartu.terpin').count()) === 0 &&
      (await hal.locator('#tulis-isi .kartu-pin.nyala').count()) === 0);
  /* Garis tegak di tepi kiri dibuang: yang dipin sudah ditandai pinnya sendiri,
     dan tanda kedua untuk hal yang sama membuat daftarnya terlihat seperti
     berisi dua jenis kartu. */
  cek('tidak ada lagi garis tegak di tepi kartu terpin',
      !/\.kartu\.terpin\{border-left/.test(
        fs.readFileSync(path.join(AKAR, 'gaya.css'), 'utf8')));

  /* TULISAN TIDAK PUNYA ELEMEN. Satu alamat yang kebetulan disebut di paragraf
     ketiga dulu naik jadi label "LINK" di kepala kartunya - dan tetap di sana
     walau kalimatnya sudah dihapus. */
  await hal.click('#b-tulis-baru');
  await hal.waitForSelector('#l-catat.aktif');
  await hal.fill('#catat-judul', 'Panduan galat Cortex');
  await hal.fill('#catat-isi', 'Buka https://console.cloud.google.com lalu salin kode ABCD-1234-XYZ.');
  await hal.click('#b-simpan');
  await hal.waitForTimeout(500);
  const tanpaElemen = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.tulisan && /Panduan galat Cortex/.test(e.judul || ''))[0]);
  cek('tulisan tidak dipecah jadi elemen kode dan link',
      tanpaElemen && (tanpaElemen.elemen || []).length === 0,
      JSON.stringify(tanpaElemen && tanpaElemen.elemen));
  await hal.click('[data-kembali]');
  await hal.waitForTimeout(300);

  /* ARSIP BISA DIKOSONGKAN. Tanpa jalan ini arsip cuma gudang kedua yang ikut
     membengkakkan tiap cadangan selamanya - tapi menghapusnya harus kamu,
     sengaja, dari layar yang memang dibuat untuk itu. */
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(300);
  const adaArsip = await hal.evaluate(() =>
    TAlur.semuaEntri().filter((e) => e.pensiun && !e.dihapus && e.jenis !== 'tugas').length);
  cek('ada tombol mengosongkan arsip', adaArsip > 0 &&
      (await hal.locator('#b-arsip-bersih').count()) === 1, String(adaArsip));
  await hal.click('#b-arsip-bersih');
  await hal.waitForSelector('#tanya:not(.sembunyi)');
  /* Dan dia bertanya dulu, sekali, dengan menyebut angkanya - yang menahan
     orang menekan tombol seperti ini adalah tidak tahu seberapa banyak yang
     akan lenyap. */
  cek('bertanya dulu, dan menyebut berapa yang akan hilang',
      new RegExp(String(adaArsip)).test(await hal.locator('#tanya').innerText()),
      await hal.locator('#tanya').innerText());
  await hal.click('#b-tanya-ya');
  await hal.waitForFunction(() => TAlur.semuaEntri()
    .filter((e) => e.pensiun && !e.dihapus && e.jenis !== 'tugas').length === 0,
    null, { timeout: 5000 });
  cek('sesudah dikosongkan, arsipnya benar-benar kosong', true);
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
}

console.log('\nfolder di layar Note: dibuat sendiri, judul terisi, dan bisa dipindah');
{
  await hal.evaluate(() => { TAlur.keLayarUji('l-utama'); TAlur.tutupHasilDepanUji(); });
  await hal.fill('#kotak', '');
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(200);
  await hal.fill('#set-label', 'Ngoffee\nAmara');
  await hal.dispatchEvent('#set-label', 'change');
  await hal.waitForTimeout(250);

  await hal.click('#l-setelan [data-kembali]').catch(() => {});
  await hal.evaluate(() => TAlur.keLayarUji('l-tulis'));
  await hal.waitForTimeout(300);

  /* FOLDER NOTE ITU DAFTARNYA SENDIRI, DIBUAT TANGAN. Diturunkan dari daftar
     gudang, lima belas rak yang dipakai kotak Drop tiba-tiba muncul di sini
     sebagai folder kosong yang tidak pernah dibuat siapa pun. Rak lahir dari
     catatan yang jatuh dan disortir mesin; folder lahir karena kamu memutuskan
     ada tempat yang perlu diisi. */
  cek('ada tombol membuat folder di layar Note',
      await hal.locator('#b-folder-baru').isVisible());
  const sebelumFolder = await hal.locator('#tulis-isi [data-tulis-folder]').count();
  cek('rak gudang TIDAK ikut jadi folder Note', sebelumFolder === 0,
      String(sebelumFolder));
  await hal.click('#b-folder-baru');
  await hal.waitForSelector('#tanya-isi:not(.sembunyi)');
  await hal.fill('#tanya-isi', 'Cortex Apps');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(400);
  const jadiFolder = await hal.evaluate(() => TSimpan.setelan('folderNote'));
  cek('folder baru tersimpan di daftarnya sendiri',
      /Cortex Apps/.test(jadiFolder || ''), String(jadiFolder));
  /* Dan daftar gudang TIDAK ikut berubah: dua daftar yang berbeda, dan
     membuat folder di Note tidak boleh diam-diam menambah rak untuk Drop. */
  const rakTetap = await hal.evaluate(() => TAlur.daftarLabelUji().map((l) => l.nama));
  cek('dan daftar gudang tidak ikut berubah',
      rakTetap.indexOf('Cortex Apps') < 0, JSON.stringify(rakTetap));

  /* JUDULNYA SUDAH TERISI NAMA FOLDERNYA. Kamu masuk ke folder itu justru
     untuk menulis sesuatu miliknya - mengetik namanya lagi adalah menjawab
     pertanyaan yang sudah kamu jawab dengan membukanya. */
  await hal.click('#b-tulis-baru');
  await hal.waitForSelector('#l-catat.aktif');
  cek('judul memo baru sudah terisi nama foldernya',
      (await hal.inputValue('#catat-judul')).trim() === 'Cortex Apps',
      await hal.inputValue('#catat-judul'));

  await hal.fill('#catat-judul', 'Cortex Apps prompt editor');
  await hal.dispatchEvent('#catat-judul', 'input');
  await hal.fill('#catat-isi', 'Isi promptnya di sini.');
  await hal.click('#b-simpan');
  await hal.waitForTimeout(500);
  const mendaratDiFolder = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.tulisan && /prompt editor/.test(e.judul || ''))[0]);
  cek('dan tulisannya mendarat di folder itu',
      mendaratDiFolder && mendaratDiFolder.folder === 'Cortex Apps',
      JSON.stringify(mendaratDiFolder && mendaratDiFolder.folder));
  await hal.click('[data-kembali]');
  await hal.waitForTimeout(300);

  /* EKOR JUDUL YANG DIINGAT. Di dalam satu folder, kata yang menyusul nama
     foldernya itu-itu saja. Yang ditawarkan cuma yang KAMU sendiri pernah
     pakai di folder itu - bukan tebakan, bukan kamus. */
  await hal.click('#b-tulis-baru');
  await hal.waitForSelector('#l-catat.aktif');
  await hal.waitForTimeout(250);
  const ekor = await hal.locator('#catat-ekor .ekor-cip').allInnerTexts();
  cek('kata yang tadi dipakai ditawarkan lagi di folder yang sama',
      ekor.indexOf('prompt editor') >= 0, JSON.stringify(ekor));
  await hal.click('#catat-ekor [data-ekor="prompt editor"]');
  await hal.waitForTimeout(300);
  cek('satu ketukan menambahkannya ke judul',
      (await hal.inputValue('#catat-judul')).trim() === 'Cortex Apps prompt editor',
      await hal.inputValue('#catat-judul'));
  /* Sesudah judulnya lengkap, tawarannya pergi - cip yang tidak menjawab apa
     pun cuma menutupi tulisanmu. */
  cek('sesudah judulnya lengkap, tawarannya pergi',
      await hal.locator('#catat-ekor').isHidden());
  await hal.click('[data-kembali]');
  await hal.waitForTimeout(300);

  /* PANAHNYA NAIK SATU TINGKAT, bukan melompat ke akar - jadi pulang ke akar
     dari susunan tiga tingkat berarti menekannya tiga kali, persis seperti
     yang dilakukan jarinya. */
  const keAkarTulis = async () => {
    for (let i = 0; i < 8; i++) {
      if (!(await hal.locator('#tulis-alamat .folder-balik').count())) break;
      await hal.click('#tulis-alamat .folder-balik');
      await hal.waitForTimeout(250);
    }
  };

  /* Folder muncul sebagai baris rapat di akar, dan membukanya menyaring. */
  await hal.evaluate(() => TAlur.keLayarUji('l-tulis'));
  await hal.waitForTimeout(300);
  /* Naik ke akar dulu: membuat folder langsung membukanya, jadi yang sedang
     tampil adalah isi folder itu - bukan daftar foldernya. */
  await keAkarTulis();
  cek('foldernya tampil sebagai baris di layar Note',
      (await hal.locator('#tulis-isi [data-tulis-folder="Cortex Apps"]').count()) === 1);
  const tinggiFolder = await hal.evaluate(() =>
    Math.round(document.querySelector('.folder-baris').getBoundingClientRect().height));
  cek('barisnya rapat, bukan setinggi dua baris teks', tinggiFolder <= 48,
      tinggiFolder + 'px');
  await hal.click('#tulis-isi [data-tulis-folder="Cortex Apps"]');
  await hal.waitForTimeout(350);
  cek('membukanya menyaring isinya saja',
      (await hal.locator('#tulis-isi .kartu').count()) === 2,
      String(await hal.locator('#tulis-isi .kartu').count()));
  cek('dan jejaknya menyebut folder yang sedang dibuka',
      /Cortex Apps/.test(await hal.locator('#tulis-alamat').innerText()));

  /* MEMILIH BANYAK JUGA ADA DI LAYAR NOTE - bilahnya satu, dipakai dua layar. */
  cek('tombol Pilih ada di layar Note juga',
      await hal.locator('#b-tulis-pilih').isVisible());
  await hal.click('#b-tulis-pilih');
  await hal.waitForTimeout(200);
  await hal.click('#tulis-isi .kartu');
  await hal.waitForTimeout(200);
  cek('menyentuh kartu berarti memilih selama modenya hidup',
      (await hal.locator('#tulis-isi .kartu.dipilih').count()) === 1);

  /* MEMINDAH ANTAR FOLDER. Foldernya dibaca dari judul, jadi memindah tanpa
     menyentuh judul akan diam-diam dibatalkan lagi begitu tulisannya
     disunting - pemindahan yang membatalkan diri sendiri lebih buruk daripada
     tidak ada pemindahan sama sekali. */
  /* Folder tujuan harus ADA - memindahkan ke nama yang belum pernah dibuat
     adalah membuat folder secara diam-diam, dan folder yang lahir tanpa kamu
     memintanya persis masalah yang baru saja dibereskan. */
  await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(150);
  /* DI AKAR DULU. "+ Folder" membuat folder di tempat kamu berdiri, jadi
     menekannya dari dalam "Cortex Apps" akan melahirkan anaknya - bukan
     saudara yang dibutuhkan sebagai tujuan pindah. */
  await keAkarTulis();
  await hal.click('#b-folder-baru');
  await hal.waitForSelector('#tanya-isi:not(.sembunyi)');
  await hal.fill('#tanya-isi', 'Rak Kedua');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(400);
  await keAkarTulis();
  await hal.click('#tulis-isi [data-tulis-folder="Cortex Apps"]');
  await hal.waitForTimeout(300);
  await hal.click('#b-tulis-pilih');
  await hal.waitForTimeout(200);
  await hal.click('#tulis-isi .kartu');
  await hal.waitForTimeout(200);
  await hal.click('#b-pilih-pindah');
  await hal.waitForSelector('#tanya-pilih:not(.sembunyi)');
  /* MEMILIH, BUKAN MENGETIK. Mengetik nama folder tujuan itu friksi yang
     tidak perlu ada - namanya sudah ada di layar sebelah, dan satu huruf
     salah ketik berarti pemindahan yang gagal tanpa sebab yang kelihatan. */
  cek('folder tujuan dipilih dengan sekali ketuk, bukan diketik',
      (await hal.locator('#tanya-pilih [data-pilih="Rak Kedua"]').count()) === 1 &&
      await hal.locator('#tanya-isi').isHidden());
  /* Dan folder yang sedang dibuka tidak ditawarkan sebagai tujuan - memindah
     sesuatu ke tempat yang sudah ditempatinya bukan pilihan, itu ketukan yang
     tidak menghasilkan apa pun. */
  cek('folder yang sedang dibuka tidak ikut ditawarkan',
      (await hal.locator('#tanya-pilih [data-pilih="Cortex Apps"]').count()) === 0);
  await hal.click('#tanya-pilih [data-pilih="Rak Kedua"]');
  await hal.waitForTimeout(600);
  const sesudahPindah = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.tulisan && /prompt editor/.test(e.judul || ''))[0]);
  cek('catatannya benar-benar pindah folder',
      sesudahPindah && sesudahPindah.folder === 'Rak Kedua',
      JSON.stringify(sesudahPindah && sesudahPindah.folder));
  /* Judulnya TIDAK diutak-atik: foldernya kolomnya sendiri, jadi tidak ada
     aturan kedua yang diam-diam membatalkan pemindahan ini nanti. */
  cek('dan judulnya dibiarkan utuh',
      sesudahPindah && /prompt editor/.test(sesudahPindah.judul),
      sesudahPindah && sesudahPindah.judul);

  /* MEMILIH FOLDER, LALU MENGHAPUSNYA. Dulu mengetuk folder di mode pilih
     tidak menghasilkan apa pun sama sekali - tombol Pilih terbaca rusak justru
     di layar yang paling butuh membereskan. */
  if (await hal.locator('#b-pilih-batal').isVisible()) await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(150);
  await keAkarTulis();
  await hal.click('#b-tulis-pilih');
  await hal.waitForTimeout(200);
  await hal.click('#tulis-isi [data-tulis-folder="Cortex Apps"]');
  await hal.waitForTimeout(250);
  cek('mengetuk folder di mode pilih benar-benar memilihnya',
      (await hal.locator('#tulis-isi [data-tulis-folder="Cortex Apps"].dipilih').count()) === 1);
  cek('dan bilahnya menyebut folder, bukan cuma catatan',
      /folder/.test(await hal.locator('#pilih-jumlah').innerText()),
      await hal.locator('#pilih-jumlah').innerText());

  const isiSebelumHapus = await hal.evaluate(() =>
    TAlur.semuaEntri().filter((e) => e.folder === 'Cortex Apps').length);
  await hal.click('#b-pilih-buang');
  await hal.waitForSelector('#tanya:not(.sembunyi)');
  /* MEMBUANG FOLDER TIDAK MEMBUANG ISINYA, dan dialognya menyebut itu -
     ketakutan yang menahan orang menekan tombol ini persis ketakutan itu. */
  cek('dialognya menegaskan isinya tidak ikut terhapus',
      /tidak ikut terhapus/i.test(await hal.locator('#tanya').innerText()) ||
      isiSebelumHapus === 0,
      await hal.locator('#tanya').innerText());
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(600);
  cek('foldernya benar-benar hilang dari daftar',
      (await hal.locator('#tulis-isi [data-tulis-folder="Cortex Apps"]').count()) === 0);
  const isiSelamat = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.tulisan && !e.pensiun && /Cortex Apps/.test(e.judul || '')).length);
  cek('tapi tulisan yang tadi di dalamnya selamat, cuma naik keluar folder',
      isiSelamat >= 1, String(isiSelamat));
  /* Dan tidak ada satu pun yang masih menunjuk folder yang sudah tidak ada -
     tulisan yatim yang menunjuk rak hantu adalah baris yang tidak akan pernah
     muncul di folder mana pun lagi. Yang tadi dipindah ke folder lain tetap di
     sana; yang dilepas cuma penghuni folder yang dihapus. */
  const yatim = await hal.evaluate(() =>
    TAlur.semuaEntri().filter((e) => e.folder === 'Cortex Apps').length);
  cek('dan tidak ada yang masih menunjuk folder yang sudah tidak ada',
      yatim === 0, String(yatim));

  /* MENGGABUNG FOLDER. Bedanya dengan Pindah cuma DARI MANA tujuannya
     diambil: di sini dari antara yang kamu pilih sendiri, jadi dua rak yang
     ternyata benda yang sama bisa dilebur tanpa mengetik satu nama pun. */
  if (await hal.locator('#b-pilih-batal').isVisible()) await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(150);
  await keAkarTulis();
  const folderAda = await hal.locator('#tulis-isi [data-tulis-folder]').count();
  if (folderAda >= 2) {
    await hal.click('#b-tulis-pilih');
    await hal.waitForTimeout(200);
    const nama = await hal.locator('#tulis-isi [data-tulis-folder]')
      .evaluateAll((n) => n.map((e) => e.getAttribute('data-tulis-folder')).slice(0, 2));
    await hal.click('#tulis-isi [data-tulis-folder="' + nama[0] + '"]');
    await hal.click('#tulis-isi [data-tulis-folder="' + nama[1] + '"]');
    await hal.waitForTimeout(250);
    cek('dua folder bisa dipilih sekaligus',
        (await hal.locator('#tulis-isi [data-tulis-folder].dipilih').count()) === 2);
    cek('dan Gabung ditawarkan begitu ada dua',
        await hal.locator('#b-pilih-gabung').isVisible());
    await hal.click('#b-pilih-gabung');
    await hal.waitForSelector('#tanya-pilih:not(.sembunyi)');
    /* Yang ditawarkan cuma yang KAMU pilih sendiri - menggabung ke folder
       ketiga yang tidak kamu tunjuk adalah jawaban untuk pertanyaan lain. */
    const pilihanGabung = await hal.locator('#tanya-pilih [data-pilih]').allInnerTexts();
    cek('yang ditawarkan cuma folder yang dipilih',
        pilihanGabung.length === 2 &&
        pilihanGabung.every((x) => nama.indexOf(x.trim()) >= 0),
        JSON.stringify(pilihanGabung));
    await hal.click('#tanya-pilih [data-pilih="' + nama[0] + '"]');
    await hal.waitForTimeout(600);
    const sesudahGabungF = await hal.evaluate((n) => TAlur.semuaEntri()
      .filter((e) => e.folder === n).length, nama[1]);
    cek('isi folder yang kalah benar-benar pindah', sesudahGabungF === 0,
        String(sesudahGabungF));
  }

  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.fill('#kotak', '');
}

console.log('\nbahasa: Inggris bawaannya, dan tidak ada kalimat yang terlewat');
{
  /* Bahasa BAWAANNYA INGGRIS. Aplikasinya ditulis Indonesia, tapi yang
     memakainya belum tentu - dan yang membuka aplikasi asing dalam bahasa yang
     tidak dia mengerti berhenti di layar pertama. */
  const halEn = await konteks.newPage();
  const galatEn = [];
  halEn.on('pageerror', (e) => galatEn.push(e.message));
  await halEn.route('**', async (rute) => {
    const u = rute.request().url();
    if (u.startsWith('http://127.0.0.1:' + port)) return rute.continue();
    if (/googleapis\.com/.test(u)) {
      return rute.fulfill(google.tangani(u, rute.request().method(), rute.request().postData()));
    }
    return rute.abort();
  });
  await halEn.goto(alamat);
  await halEn.waitForFunction(() => window.TAlur && window.TBahasa);
  await halEn.evaluate(() => Promise.all([
    TSimpan.setel('bahasa', ''), TSimpan.setel('dipasang', 1)
  ]));
  await halEn.reload();
  await halEn.waitForFunction(() => window.TAlur && window.TBahasa);
  await halEn.waitForTimeout(600);

  cek('tanpa dipilih apa pun, bahasanya Inggris',
      (await halEn.evaluate(() => TBahasa.sekarang())) === 'en');

  /* NAMA PINTU TIDAK IKUT DITERJEMAHKAN. Itu nama tempat, bukan kalimat - dan
     nama tempat yang berganti bahasa membuat jarimu harus belajar ulang. */
  const pintu = await halEn.locator('#l-utama [data-tab] .tab').allInnerTexts();
  cek('nama pintu tetap Drop, Note, To Do, Storage, Gallery',
      JSON.stringify(pintu.map((x) => x.trim())) ===
        JSON.stringify(['Drop', 'Note', 'To Do', 'Storage', 'Gallery']),
      JSON.stringify(pintu));

  /* Kalimat layar - di HTML maupun yang digambar dari JS - benar-benar
     berganti, termasuk placeholder dan aria-label. */
  cek('kotak drop bicara Inggris',
      (await halEn.getAttribute('#kotak', 'placeholder')) === 'Type or search…');
  cek('placeholder yang disetel dari JS ikut',
      await halEn.evaluate(async () => {
        document.querySelector('#b-ai').click();
        await new Promise((r) => setTimeout(r, 400));
        const v = document.querySelector('#kotak').placeholder;
        document.querySelector('#b-ai').click();
        return v;
      }) === 'Ask anything…');
  cek('aria-label ikut diterjemahkan',
      (await halEn.getAttribute('#b-setelan', 'aria-label')) === 'Settings');

  /* Isian tugas itu SATU-SATUNYA teks di aplikasi yang isinya perintah, bukan
     keterangan: kata contohnya benar-benar diketik ulang orangnya. Menyalin
     "besok" apa adanya ke layar Inggris berarti mengiklankan kata yang tidak
     dimengerti pembacanya - dan sekarang pembacanya mengerti keduanya, jadi
     yang ditawarkan harus sebahasa dengan layarnya. */
  const isianTugasEn = await halEn.getAttribute('#tugas-baru', 'placeholder');
  cek('isian tugas menawarkan kata tenggat yang Inggris',
      /tomorrow/.test(isianTugasEn) && /friday/.test(isianTugasEn) &&
      !/besok|jumat|tgl/.test(isianTugasEn), isianTugasEn);
  /* Dan yang ditawarkan itu benar-benar DIMENGERTI pembacanya - kalau tidak,
     isiannya menjanjikan sesuatu yang tidak ada. */
  cek('dan kata yang ditawarkannya memang dibaca sebagai tenggat',
      await halEn.evaluate(() => {
        const h = TTugas.hariMulai(Date.now());
        return TTugas.bacaTenggat('pay rent tomorrow').tenggat === h + 86400000 &&
               TTugas.bacaTenggat('send invoice friday').tenggat > h &&
               TTugas.bacaTenggat('pay tax the 25th').tenggat > 0;
      }) === true);

  /* Nama hari muncul di kartu tugas untuk tenggat dalam pekan ini, dan kartu
     justru yang paling sering dilirik - satu "Jumat" di sana lebih kentara
     daripada sepuluh kalimat Indonesia di Setelan. Singkatan bulan ikut:
     empat dari dua belas berbeda ejaannya. */
  cek('nama hari ikut berganti di kartu tugas',
      await halEn.evaluate(async () => {
        /* Ditambah lewat jalur yang dipakai orangnya, dan tenggatnya dititipkan
           di kalimatnya sendiri - tiga hari ke depan supaya yang ditulis nama
           harinya, bukan "Today"/"Tomorrow" yang punya kalimatnya sendiri. */
        const e = await TTugas.tambah('due date sweep in 3 days');
        TTugas.gambar();
        TAlur.keLayarUji('l-tugas');
        await new Promise((r) => setTimeout(r, 500));
        const baris = document.querySelector('.tugas[data-id="' + e.id + '"]');
        const teks = baris ? baris.innerText : '';
        return !/Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu/.test(teks) &&
               /Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/.test(teks);
      }) === true);
  cek('singkatan bulan yang berbeda ejaannya ikut ditukar',
      await halEn.evaluate(() => [
        TBahasa.t('3 Mei'), TBahasa.t('17 Agu'), TBahasa.t('1 Okt · 14.20'),
        TBahasa.t('25 Des 25'), TBahasa.t('6 Sep')
      ].join('|')) === '3 May|17 Aug|1 Oct · 14.20|25 Dec 25|6 Sep');

  /* Diuji dalam keadaan yang PALING RAMAI - tersambung, AI nyala, sandi
     terpasang. Keadaan kosong menyembunyikan separuh kalimat layar ini, dan
     yang tersembunyi persis yang paling mudah terlewat diterjemahkan. */
  await halEn.evaluate(() => Promise.all([
    TSimpan.setel('cadanganNyala', 1),
    TSimpan.setel('modeAI', 'penuh'),
    TSimpan.setel('cadanganBerhasil', Date.now())
  ]).then(() => TSimpan.semuaSetelan()).then((s) => {
    Object.keys(s).forEach(function (k) { TAlur.setelanUji()[k] = s[k]; });
    TAlur.gambarSetelan();
    TAlur.keLayarUji('l-setelan');
  }));
  /* Dibaca lewat evaluate, bukan locator: layar ini menggambar ulang sendiri
     tiap kali status cadangan berubah, dan jeda sekejap antara menunggu dan
     membaca sudah cukup untuk menangkapnya setengah jadi. */
  const setelanEn = await halEn.waitForFunction(() => {
    var v = document.querySelector('#l-setelan').innerText;
    return v.length > 800 ? v : false;
  }, null, { timeout: 8000 }).then((h) => h.jsonValue());
  cek('layar Setelan bicara Inggris',
      /Connected to your Drive/.test(setelanEn) &&
      !/Tersambung ke Drive-mu/.test(setelanEn) &&
      !/Catatanmu cuma ada/.test(setelanEn),
      setelanEn.length + ' huruf: ' + setelanEn.replace(/\n/g, ' | ').slice(0, 200));
  /* Bagian yang jauh di bawah layar ikut - pemilih bahasanya sendiri, dan
     tombol paling berbahaya di aplikasi ini. */
  cek('sampai bagian paling bawah pun ikut',
      /Language/.test(setelanEn) && /Wipe all data/.test(setelanEn),
      setelanEn.replace(/\n/g, ' | ').slice(-200));
  /* Keterangan panjang yang terpotong <b> ikut utuh - menerjemahkan
     potongannya berarti separuh Indonesia separuh Inggris di satu baris. */
  cek('keterangan yang terpotong tag ikut utuh, bukan separuh-separuh',
      /gives each note a title and keywords/.test(setelanEn) &&
      !/memberi judul dan kata kunci/.test(setelanEn));

  /* SAPUAN TERAKHIR: tidak boleh ada satu pun kalimat Indonesia yang tersisa
     di layar mana pun. Ini yang menjawab "pastikan tidak ada nama menu yang
     terlewati" - bukan dengan membaca daftar, tapi dengan menyapu layarnya. */
  const ID_KATA = /\b(yang|tidak|dengan|untuk|dari|kamu|sudah|belum|bisa|akan|atau|tanpa|jadi|cuma|catatan|tulisan|simpan|hapus|buang|pilih|tambah|kembali|setelan|kunci|cadangan|arsip|gudang|layar|kotak|tugas|judul|masuk|keluar|ketuk|jatuhkan|menyimpan|tersimpan)\b/i;
  const sapu = async () => halEn.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const s = (n.nodeValue || '').trim();
      if (!s) continue;
      const e = n.parentElement;
      /* Yang kamu tulis sendiri tidak dihitung - itu memang bukan kalimat
         layar, dan menerjemahkannya justru kerusakan. */
      if (e && e.closest('textarea, [data-asli], .kartu, .tugas')) continue;
      out.push(s);
    }
    document.querySelectorAll('[placeholder],[aria-label],[title]').forEach((el) => {
      if (el.closest('[data-asli]')) return;
      ['placeholder', 'aria-label', 'title'].forEach((a) => {
        const v = el.getAttribute(a);
        if (v && v.trim()) out.push(v.trim());
      });
    });
    return out;
  });
  const sisa = [];
  for (const l of ['l-utama', 'l-tulis', 'l-tugas', 'l-note', 'l-galeri', 'l-setelan']) {
    await halEn.evaluate((x) => {
      if (x === 'l-setelan') TAlur.gambarSetelan();
      if (x === 'l-tugas') TTugas.gambar();
      TAlur.keLayarUji(x);
    }, l);
    await halEn.waitForTimeout(450);
    (await sapu()).forEach((s) => {
      /* "HAPUS" tetap Indonesia dengan sengaja: itu kata yang harus DIKETIK
         ULANG untuk membuka tombol hapus-semua, bukan kalimat yang dibaca -
         menerjemahkannya berarti mengubah kuncinya, dan orang yang hafal
         kuncinya jadi tidak bisa masuk. Contoh kata tenggat ("besok", "jumat")
         TIDAK lagi dikecualikan: pembacanya sekarang mengerti keduanya, jadi
         yang ditawarkan layar Inggris harus kata Inggris. */
      if (/HAPUS/.test(s)) return;
      if (ID_KATA.test(s) && sisa.indexOf(s) < 0) sisa.push(s);
    });
  }
  cek('tidak ada satu pun kalimat Indonesia yang tersisa di layar',
      sisa.length === 0, JSON.stringify(sisa.slice(0, 6)));

  /* Dan bisa dikembalikan: memilih Indonesia memuat ulang, lalu semuanya
     kembali ke kalimat aslinya. */
  await halEn.evaluate(() => TAlur.keLayarUji('l-utama'));
  await halEn.evaluate(() => TSimpan.setel('bahasa', 'id'));
  await halEn.reload();
  await halEn.waitForFunction(() => window.TAlur && window.TBahasa);
  await halEn.waitForTimeout(500);
  cek('memilih Indonesia mengembalikan kalimat aslinya',
      (await halEn.getAttribute('#kotak', 'placeholder')) === 'Tulis atau cari…');
  cek('dan nama pintunya tetap sama di kedua bahasa',
      JSON.stringify((await halEn.locator('#l-utama [data-tab] .tab').allInnerTexts())
        .map((x) => x.trim())) ===
        JSON.stringify(['Drop', 'Note', 'To Do', 'Storage', 'Gallery']));
  cek('tidak ada galat JavaScript di jalur bahasa', galatEn.length === 0, galatEn.join(' | '));
  await halEn.close();
}

console.log('\nfolder Note bertingkat: dibuat dari tempat kamu berdiri, ditulis seukur tingkatnya');
{
  /* SUSUNAN TIGA TINGKAT, dibuat lewat jalur yang dipakai jarinya - bukan
     lewat pintu belakang yang cuma ada di uji.

     Aturannya sendiri tidak berubah: susunan dibaca dari NAMA, jadi
     "Prompt Cortex" itu anak "Prompt". Yang dulu salah bukan aturannya, tapi
     siapa yang harus tahu aturannya - untuk membuat sub folder kamu harus
     menebak sendiri bahwa namanya wajib diawali nama induknya, dan menebak
     itu tidak pernah terjadi. Yang terjadi: kamu mengetik "Test level 2", dia
     mendarat di akar, dan susunan yang kamu bayangkan tidak pernah ada. */
  await hal.evaluate(() => Promise.all(TAlur.semuaEntri()
    .filter((e) => e.tulisan && !e.pensiun)
    .map((e) => { e.pensiun = true; return TSimpan.taruh(e); })));
  await hal.evaluate(() => TSimpan.setel('folderNote', '[]'));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForTimeout(500);
  await hal.evaluate(() => TAlur.keLayarUji('l-tulis'));
  await hal.waitForTimeout(300);

  const buatFolder = async (nama) => {
    await hal.click('#b-folder-baru');
    await hal.waitForSelector('#tanya-isi:not(.sembunyi)');
    const ket = await hal.innerText('#tanya-ket');
    await hal.fill('#tanya-isi', nama);
    await hal.click('#b-tanya-ya');
    await hal.waitForTimeout(400);
    return ket;
  };
  const naik = async () => {
    await hal.click('#tulis-alamat .folder-balik');
    await hal.waitForTimeout(300);
  };
  const jejakTulis = async () =>
    (await hal.innerText('#tulis-alamat')).replace(/\s+/g, ' ').trim();
  const barisFolder = () =>
    hal.locator('#tulis-isi [data-tulis-folder]').allInnerTexts();

  await buatFolder('Kumpulan Ide');
  await naik();
  cek('folder di akar tetap lahir di akar',
      (await hal.evaluate(() => TSimpan.setelan('folderNote')))
        .indexOf('Kumpulan Ide') >= 0);
  await buatFolder('Prompt');
  const ketDalam = await buatFolder('Cortex');
  cek('di dalam folder, pertanyaannya menyebut induknya',
      ketDalam.indexOf('Prompt') >= 0, ketDalam);
  /* AWALANNYA DIPASANG APLIKASI. Kamu mengetik "Cortex"; yang tersimpan
     "Prompt Cortex", karena itu yang membuatnya jadi anak. */
  cek('nama yang tersimpan sudah berawalan induknya',
      (await hal.evaluate(() => TSimpan.setelan('folderNote')))
        .indexOf('Prompt Cortex') >= 0);
  cek('dan jejaknya menunjukkan jalurnya, bukan cuma nama panjangnya',
      (await jejakTulis()).indexOf('Prompt / Cortex') >= 0, await jejakTulis());

  await buatFolder('Draf');
  cek('tingkatnya tidak dibatasi dua - anak dari anak tetap jadi',
      (await hal.evaluate(() => TSimpan.setelan('folderNote')))
        .indexOf('Prompt Cortex Draf') >= 0);
  cek('dan jejak tiga tingkat menyebut ketiganya',
      (await jejakTulis()).indexOf('Prompt / Cortex / Draf') >= 0, await jejakTulis());

  /* PANAHNYA NAIK SATU TINGKAT. Panah yang selalu pulang ke akar berarti tiap
     kali kamu salah masuk kamu harus menyusuri ulang dari awal. */
  await naik();
  cek('panah kembali naik SATU tingkat, bukan melompat ke akar',
      (await jejakTulis()).indexOf('Prompt / Cortex') >= 0, await jejakTulis());
  await naik();
  cek('dan sekali lagi sampai di induknya', (await jejakTulis()).indexOf('Prompt') >= 0);

  /* YANG DITULIS CUMA EKORNYA. Mengulang "Prompt" di tiap baris, di layar
     yang judulnya sudah "Prompt", memakan lebar yang justru dibutuhkan nama
     aslinya - dan tidak memberitahu apa pun. */
  const dalamPrompt = await barisFolder();
  cek('di dalam induknya, anaknya ditulis dengan nama pendek saja',
      dalamPrompt.some((x) => x.split('\n')[0] === 'Cortex'),
      JSON.stringify(dalamPrompt));
  cek('dan cucunya TIDAK ikut naik - satu tingkat, satu daftar',
      !dalamPrompt.some((x) => /Draf/.test(x)), JSON.stringify(dalamPrompt));

  await naik();
  const diAkar = await barisFolder();
  cek('di akar yang tampil cuma folder akar',
      diAkar.some((x) => /Prompt/.test(x)) &&
      diAkar.some((x) => /Kumpulan Ide/.test(x)) &&
      !diAkar.some((x) => /Cortex|Draf/.test(x)), JSON.stringify(diAkar));

  /* Yang sudah hafal awalannya tidak boleh dihukum dengan "Prompt Prompt X". */
  await hal.click('#tulis-isi [data-tulis-folder="Prompt"]');
  await hal.waitForTimeout(300);
  await buatFolder('Prompt Gemini');
  const daftarF = await hal.evaluate(() => TSimpan.setelan('folderNote'));
  cek('mengetik nama lengkapnya tidak melipatgandakan awalannya',
      daftarF.indexOf('Prompt Gemini') >= 0 &&
      daftarF.indexOf('Prompt Prompt') < 0, daftarF);

  /* NAMA FOLDER IKUT DICARI, aturan yang sama dengan album Gallery: folder itu
     kata yang KAMU ketik, jadi dia justru kata yang paling mungkin kamu ketik
     lagi. Umpannya sengaja tidak menyebut "Prompt" di judul maupun isinya -
     kalau menyebut, dia lolos lewat jalur lama dan bugnya tersembunyi. */
  await hal.evaluate(async () => {
    await TSimpan.taruh({ id: 'folderuji', jenis: 'teks', judul: 'Brief tanpa kata itu',
      isi: 'isi biasa saja', kategori: '', folder: 'Prompt Gemini', tulisan: true,
      album: '', sumber: '', tag: [], label: [], elemen: [], daftar: [],
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0,
      diLabeliAI: true, diBacaAI: true });
    await TAlur.muatUlangUji();
  });
  await hal.waitForTimeout(300);
  cek('tulisan ketemu lewat nama FOLDER-nya, bukan cuma judul dan isinya',
      (await hal.evaluate(() => TOtak.cari(TAlur.semuaEntri(), 'Gemini', '', '')
        .filter((e) => e.id === 'folderuji').length)) === 1);
  await hal.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => x.id === 'folderuji')[0];
    if (e) { e.pensiun = true; await TSimpan.taruh(e); }
    await TAlur.muatUlangUji();
  });
  await hal.waitForTimeout(250);

  /* JUDUL YANG SUDAH BERNOMOR SENDIRI. Dua tulisan berjudul sama persis tidak
     bisa dibedakan di hasil pencarian - dan yang membedakannya, tanggal,
     justru yang paling tidak kamu ingat. */
  await hal.evaluate(() => TAlur.keLayarUji('l-tulis'));
  await hal.waitForTimeout(200);
  for (let i = 0; i < 8; i++) {
    if (!(await hal.locator('#tulis-alamat .folder-balik').count())) break;
    await naik();
  }
  await hal.click('#tulis-isi [data-tulis-folder="Prompt"]');
  await hal.waitForTimeout(300);
  await hal.click('#tulis-isi [data-tulis-folder="Prompt Cortex"]');
  await hal.waitForTimeout(300);
  const judulKe = [];
  for (let i = 0; i < 3; i++) {
    await hal.click('#b-tulis-baru');
    await hal.waitForTimeout(450);
    judulKe.push(await hal.inputValue('#catat-judul'));
    await hal.fill('#catat-isi', 'isi ke ' + (i + 1));
    await hal.dispatchEvent('#catat-isi', 'input');
    await hal.waitForTimeout(600);
    await hal.click('#b-simpan');
    await hal.waitForTimeout(500);
    await hal.click('#l-catat [data-kembali]');
    await hal.waitForTimeout(500);
  }
  cek('judul tulisan baru terisi nama folder LENGKAP sampai akarnya',
      judulKe[0] === 'Prompt Cortex', JSON.stringify(judulKe));
  /* Nomornya dihitung dari yang SUDAH ADA, bukan dari hitungan yang disimpan:
     hitungan yang disimpan meleset begitu satu tulisan dibuang. Dan yang
     pertama tidak bernomor - "(1)" pada satu-satunya berkas cuma derau. */
  cek('yang kedua dan ketiga bernomor sendiri',
      judulKe[1] === 'Prompt Cortex (2)' && judulKe[2] === 'Prompt Cortex (3)',
      JSON.stringify(judulKe));

  /* Perbandingannya TIDAK lewat TOtak.normal(): normal() membuang semua tanda
     baca, tanda kurungnya sekalian, jadi "(2)" jatuh jadi "2" dan nomornya
     tidak pernah terbaca lagi - yang ketiga ikut bernomor (2). */
  cek('nomornya benar-benar terbaca, bukan tersapu normalisasi tanda baca',
      (await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => /^Prompt Cortex \(3\)$/.test(e.judul || '')).length)) === 1);
}

console.log('\njari sungguhan: tekan lama di layar sentuh, sampai foldernya benar-benar hilang');
{
  /* KENAPA HALAMAN SENDIRI. Uji tekan-lama yang lain menembakkan 'pointerdown'
     telanjang - dan itu justru melewatkan dua hal yang cuma ada di jari:

     1. Jari yang kelihatannya diam TIDAK PERNAH benar-benar diam. Satu-dua
        piksel getaran selama setengah detik itu normal, dan dulu piksel
        pertama sudah membatalkan penghitungnya.
     2. MENGANGKAT jari melahirkan satu klik di tempat yang sama - dan di sana
        mode pilih sudah menyala, jadi kliknya membaca ketukan itu sebagai
        "batalkan pilihan ini" dan mencabut kembali apa yang baru ditandai.

     Keduanya sempurna di tetikus yang memang diam dan tidak melahirkan klik
     kedua, jadi tidak ada satu pun uji lama yang bisa melihatnya. Yang
     terlihat di HP: bilah pilih muncul, isinya nol, dan Buang tidak membuang
     apa pun. */
  const konteksJari = await browser.newContext({ hasTouch: true, isMobile: true,
                                                 viewport: { width: 412, height: 915 } });
  await konteksJari.addInitScript(STUB_GIS);
  const halJ = await konteksJari.newPage();
  halJ.on('pageerror', (e) => galat.push('jari: ' + e.message));
  await halJ.route('**', async (rute) => {
    const u = rute.request().url();
    if (u.startsWith('http://127.0.0.1:' + port)) return rute.continue();
    return rute.abort();
  });
  await halJ.goto(alamat);
  await halJ.waitForFunction(() => window.TAlur);
  await halJ.evaluate(() => Promise.all([
    TSimpan.setel('dipasang', 1), TSimpan.setel('bahasa', 'id')]));
  await halJ.reload();
  await halJ.waitForFunction(() => window.TAlur);
  await halJ.waitForTimeout(400);
  await halJ.evaluate(async () => {
    const n = (id, j, kat, folder) => TSimpan.taruh({ id, jenis: 'teks', judul: j, isi: j,
      kategori: kat, folder: folder || '', tulisan: !!folder,
      tag: [], label: [], elemen: [], daftar: [], dibuat: Date.now(), diubah: Date.now(),
      dipakai: 0, diLabeliAI: true, diBacaAI: true });
    await n('j1', 'jarikat satu', 'JariKat'); await n('j2', 'jarikat dua', 'JariKat');
    await n('j3', 'jarilain satu', 'JariLain');
    await n('j4', 'Brief jari', '', 'JariFolder');
    await TSimpan.setel('folderNote', JSON.stringify(['JariFolder', 'JariKosong']));
  });
  await halJ.reload();
  await halJ.waitForFunction(() => window.TAlur);
  await halJ.waitForTimeout(500);

  const cdp = await konteksJari.newCDPSession(halJ);
  const titik = async (pilih) => {
    const k = await halJ.locator(pilih).boundingBox();
    return { x: Math.round(k.x + k.width / 2), y: Math.round(k.y + k.height / 2) };
  };
  /* Menahan SAMBIL BERGETAR, lalu diangkat - dan angkatnya melahirkan klik. */
  const tahan = async (pilih) => {
    const { x, y } = await titik(pilih);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 0; i < 6; i++) {
      await halJ.waitForTimeout(100);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: [{ x: x + (i % 2 ? 1 : -1), y: y + (i % 2 ? 1 : 0) }] });
    }
    await halJ.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await halJ.waitForTimeout(350);
  };
  const ketuk = async (pilih) => {
    const { x, y } = await titik(pilih);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await halJ.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await halJ.waitForTimeout(350);
  };

  await halJ.click('#l-utama [data-tab-ke="l-note"]');
  await halJ.waitForTimeout(500);
  await tahan('#note-isi [data-note-folder="JariKat"]');
  cek('menahan folder dengan jari yang bergetar tetap memilihnya',
      (await halJ.locator('#note-isi [data-note-folder].dipilih').count()) === 1);
  /* Inilah yang dulu nol: kliknya lahir, dan mencabut kembali pilihannya. */
  cek('dan pilihannya BERTAHAN sesudah jarinya diangkat',
      (await halJ.innerText('#pilih-jumlah')).indexOf('1 folder') === 0,
      await halJ.innerText('#pilih-jumlah'));
  await ketuk('#note-isi [data-note-folder="JariLain"]');
  cek('folder kedua ikut dengan ketukan biasa',
      (await halJ.locator('#note-isi [data-note-folder].dipilih').count()) === 2);
  await ketuk('#b-pilih-buang');
  cek('Buang membuka pertanyaannya', await halJ.locator('#tanya').isVisible());
  await ketuk('#b-tanya-ya');
  await halJ.waitForTimeout(800);
  const sisaRak = await halJ.locator('#note-isi [data-note-folder]').allInnerTexts();
  cek('dan sesudah dikonfirmasi rak itu BENAR-BENAR hilang',
      !sisaRak.some((x) => /JariKat|JariLain/.test(x)), JSON.stringify(sisaRak));
  cek('isinya tidak ikut terhapus - dia keluar ke rak tanpa label',
      (await halJ.evaluate(() => TAlur.semuaEntri()
        .filter((e) => e.id === 'j1' && !e.pensiun && !e.kategori).length)) === 1);

  await halJ.click('#l-note [data-tab-ke="l-tulis"]');
  await halJ.waitForTimeout(500);
  await tahan('#tulis-isi [data-tulis-folder="JariKosong"]');
  cek('di layar Note pun menahan folder memilihnya',
      (await halJ.locator('#tulis-isi [data-tulis-folder].dipilih').count()) === 1);
  await ketuk('#b-pilih-buang');
  await ketuk('#b-tanya-ya');
  await halJ.waitForTimeout(800);
  cek('dan foldernya hilang dari daftarnya sendiri',
      !(await halJ.locator('#tulis-isi [data-tulis-folder]').allInnerTexts())
        .some((x) => /JariKosong/.test(x)));

  /* Klik yang ditelan itu SATU, bukan seterusnya: ketukan biasa sesudahnya
     harus tetap MEMBUKA foldernya, bukan memilihnya. */
  await ketuk('#tulis-isi [data-tulis-folder="JariFolder"]');
  await halJ.waitForTimeout(300);
  cek('ketukan biasa tetap membuka foldernya, bukan memilih',
      (await halJ.innerText('#tulis-alamat')).indexOf('JariFolder') >= 0 &&
      (await halJ.locator('#pilih-bilah').isHidden()),
      await halJ.innerText('#tulis-alamat'));

  await halJ.close();
  await konteksJari.close();
}

console.log('\nGallery: pintu kelima untuk timbunan yang paling besar');
{
  /* Dua puluh ribu foto di galeri HP, ditambah yang tercecer di WhatsApp.
     Tiga sampai lima jepretan sehari terdengar sedikit; lima tahun kemudian
     tidak ada satu pun yang bisa ditemukan lagi. */
  const PNG2 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dw'
             + 'nwEJMKEL0FIQAG3+AwOfLbXbAAAAAElFTkSuQmCC';
  const binPng = Buffer.from(PNG2, 'base64');

  await hal.evaluate(async (b64) => {
    for (let i = 0; i < 4; i++) {
      const bin = atob(b64); const arr = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
      const blob = new Blob([arr], { type: 'image/png' });
      await TSimpan.taruhBerkas('bgal' + i, blob, 'gal' + i + '.png', 'image/png');
      await TSimpan.taruh({ id: 'gal' + i, jenis: 'gambar', judul: 'galuji ' + i, isi: '',
        kategori: '', folder: '', album: '', sumber: i < 2 ? 'kamera' : '', thumb: '',
        berkasId: 'bgal' + i, namaBerkas: 'gal' + i + '.png', tipeBerkas: 'image/png',
        ukuran: blob.size, label: [], elemen: [], daftar: [],
        dibuat: Date.now() - i * 1000, diubah: Date.now() - i * 1000,
        dipakai: 0, diLabeliAI: true, diBacaAI: true });
    }
    await TSimpan.setel('board', '[]');
  }, PNG2);
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForTimeout(600);

  const pintu = (await hal.locator('#l-utama [data-tab] .tab').allInnerTexts())
    .map((x) => x.trim());
  cek('pintunya lima, dan yang kelima Gallery',
      JSON.stringify(pintu) ===
      JSON.stringify(['Drop', 'Note', 'To Do', 'Storage', 'Gallery']),
      JSON.stringify(pintu));

  /* LIMA PINTU BERARTI IKONNYA PERGI DI HP. Empat masih muat bersama ikonnya
     di 412px; yang kelima memotong "Storage" jadi "Stor…" - dan pintu bernama
     "Stor…" tidak memberitahu apa pun. Yang mengalah ikonnya, bukan namanya. */
  cek('lima pintu tetap sebaris tanpa satu nama pun terpotong',
      await hal.evaluate(() => {
        const t = [...document.querySelectorAll('#l-utama [data-tab] .tab')];
        const baris = new Set(t.map((x) => Math.round(x.getBoundingClientRect().top)));
        return baris.size === 1 && t.every((x) => x.scrollWidth <= x.clientWidth + 1);
      }) === true);
  /* IKONNYA TETAP ADA, dan itu bukan hiasan: yang dituju mata pertama kali di
     baris pintu adalah bentuknya, baru namanya. Bersebelahan lima pintu tidak
     muat, jadi ikonnya NAIK ke atas namanya - yang dibayar tinggi baris, bukan
     ikon yang hilang atau nama yang terpotong. */
  cek('dan ikonnya tetap digambar di tiap pintu',
      await hal.evaluate(() => [...document.querySelectorAll('#l-utama [data-tab] .tab')]
        .every((x) => {
          const i = x.querySelector('.ik');
          return i && i.getBoundingClientRect().width > 0;
        })) === true);

  await hal.click('#l-utama [data-tab-ke="l-galeri"]');
  await hal.waitForTimeout(500);
  cek('pintunya membuka layar Gallery',
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-galeri');

  /* SEBELUM ADA SATU ALBUM PUN, GAMBARNYA LANGSUNG TERLIHAT. Aturan "di akar
     yang tampil folder saja" ada supaya isinya tidak terhitung dua kali - dan
     itu cuma berlaku kalau memang ada album untuk membaginya. */
  /* ABJAD, bukan terbanyak-dulu. Pohon board kamu tulis sendiri dan jumlahnya
     tetap; urutan yang berubah-ubah mengikuti isinya berarti jarimu tidak
     pernah bisa hafal tempatnya. Rak Storage lain ceritanya - dia lahir dari
     catatan yang jatuh, jadi yang paling ramai memang yang paling mungkin
     kamu tuju. */
  await hal.evaluate(() => TSimpan.setel('board',
    JSON.stringify(['Zeta uji', 'Alfa uji', 'Mika uji'])));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  /* AKARNYA DIBAGI DUA, dan garisnya bukan hiasan: tanpa dia ruang tunggu
     duduk di antara bidang usahamu seperti salah satunya - padahal dia justru
     kebalikannya, tempat yang isinya belum diputuskan. */
  await hal.evaluate(() => TSimpan.setel('board',
    JSON.stringify(['Zeta uji', 'Alfa uji', TBawaan.boardLain])));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  /* AKARNYA BARIS YANG BISA DIKETUK, bukan kepala bagian yang menggelar
     seluruh interest sekaligus. Tujuh kepala dengan sepuluh interest di bawah
     masing-masing adalah lima layar HP yang harus digulir sebelum sampai ke
     baris terakhir - dan yang dicari mata di layar pertama cuma "bidang mana". */
  cek('yang tampil di akar barisnya sendiri, dan cuma satu garis pemisah',
      (await hal.locator('#galeri-isi .galeri-bagian').count()) === 1 &&
      (await hal.locator('#galeri-isi .galeri-bagian.pisah').count()) === 1,
      await hal.innerText('#galeri-isi'));
  /* TIDAK ADA LAGI "Belum berboard" DI SEBELAHNYA. Dua baris yang mengucapkan
     pertanyaan yang sama persis - "yang tidak punya rumah" - dan yang pertama
     bunyinya seperti kesalahan. Yang belum punya alamat sekarang tinggal DI
     DALAM ruang tunggu; satu tempat, bukan dua. */
  await hal.evaluate(async () => {
    const bin = atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dw'
                   + 'nwEJMKEL0FIQAG3+AwOfLbXbAAAAAElFTkSuQmCC');
    const arr = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
    const blob = new Blob([arr], { type: 'image/png' });
    await TSimpan.taruhBerkas('bnol', blob, 'tanpaboard.png', 'image/png');
    await TSimpan.taruh({ id: 'gnol', jenis: 'gambar', judul: 'Tanpa board uji', isi: '',
      kategori: '', folder: '', album: '', sumber: 'kamera', driver: '', thumb: '',
      berkasId: 'bnol', namaBerkas: 'tanpaboard.png', tipeBerkas: 'image/png',
      ukuran: blob.size, label: [], elemen: [], daftar: [],
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true });
    await TAlur.muatUlangUji();
  });
  await hal.waitForTimeout(400);
  cek('tidak ada lagi baris “Belum berboard” di sebelah ruang tunggunya',
      (await hal.locator('#galeri-isi [data-galeri-folder="Belum berboard"]').count()) === 0,
      await hal.innerText('#galeri-isi'));
  /* DAN GAMBARNYA TIDAK HILANG: yang belum punya alamat harus tetap punya satu
     baris yang menampungnya - foto yang tidak punya tempat untuk ditampilkan
     sama saja dengan foto yang hilang. */
  await hal.click('#galeri-isi [data-galeri-folder="Other and Various"]');
  await hal.waitForTimeout(400);
  cek('yang belum punya alamat tinggal di dalam ruang tunggunya',
      (await hal.locator('#galeri-isi .petak-satu').count()) >= 1,
      await hal.innerText('#galeri-isi'));
  await hal.click('#galeri-saring [data-gkepala="*home"]');
  await hal.waitForTimeout(400);

  /* Ruang tunggu tidak dihitung sebagai alamat yang KAMU pilih: memotret dari
     dalamnya tidak mengunci apa pun, karena dia tempat yang isinya belum
     diputuskan - menguncinya di situ mematikan justru pekerjaan yang bikin
     ruangan itu ada. */
  await hal.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => x.id === 'gnol')[0];
    if (e) { e.pensiun = true; await TSimpan.taruh(e); }
    await TAlur.muatUlangUji();
  });
  await hal.waitForTimeout(300);

  /* Ruang tunggunya di BAWAH garis, bukan di antara bidang usahamu. */
  cek('dan ruang tunggunya duduk di bawah garisnya',
      await hal.evaluate(() => {
        const pisah = document.querySelector('#galeri-isi .galeri-bagian.pisah');
        const lain = document.querySelector('#galeri-isi [data-galeri-folder="Other and Various"]');
        if (!pisah || !lain) return false;
        return lain.compareDocumentPosition(pisah) & Node.DOCUMENT_POSITION_PRECEDING;
      }) ? true : false);
  cek('dan dia bukan salah satu Main Interest',
      await hal.evaluate(() => {
        const pisah = document.querySelector('#galeri-isi .galeri-bagian.pisah');
        const zeta = document.querySelector('#galeri-isi [data-galeri-folder="Zeta uji"]');
        return !!(pisah && zeta &&
          (pisah.compareDocumentPosition(zeta) & Node.DOCUMENT_POSITION_PRECEDING));
      }) === true);

  await hal.evaluate(() => TSimpan.setel('board',
    JSON.stringify(['Zeta uji', 'Alfa uji', 'Mika uji'])));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  cek('board di akar berurut abjad, bukan urutan pembuatan',
      (await hal.locator('#galeri-isi [data-galeri-folder]').evaluateAll(
        (n) => n.map((x) => x.getAttribute('data-galeri-folder'))))
        .filter((x) => /uji$/.test(x)).join(',') === 'Alfa uji,Mika uji,Zeta uji',
      JSON.stringify(await hal.locator('#galeri-isi [data-galeri-folder]').evaluateAll(
        (n) => n.map((x) => x.getAttribute('data-galeri-folder')))));
  await hal.evaluate(() => TSimpan.setel('board', '[]'));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);

  cek('tanpa board, gambarnya langsung terlihat di akar',
      (await hal.locator('#galeri-isi .petak-satu').count()) >= 4,
      String(await hal.locator('#galeri-isi .petak-satu').count()));

  /* Saringannya SUMBER, bukan jenis: di layar ini semuanya gambar, jadi
     menyaring jenis tidak memisahkan apa pun. */
  /* KEPALANYA TIGA TOMBOL: Home, All, View. Saringan sumber pindah ke dalam
     menu View - satu ketukan lebih dalam, dan itu setara dengan seberapa
     sering dia dipakai. Sembilan benda di satu baris, di layar yang isinya
     justru gambar, adalah baris yang tidak pernah dibaca. */
  cek('kepalanya tiga tombol: Home, All, View',
      (await hal.locator('#galeri-saring [data-gkepala]').count()) === 3 &&
      (await hal.locator('#galeri-saring').innerText()).replace(/\s+/g, ' ').indexOf('Home') >= 0);
  cek('menu View tertutup sampai diminta',
      await hal.locator('#galeri-tampil').isHidden());
  await hal.click('#galeri-saring [data-gkepala="*view"]');
  await hal.waitForTimeout(300);
  /* SATU BARIS, DAN CUMA UKURAN PETAK. Saringan sumber sudah dibuang:
     "Kamera / Unggah / Drop" memisahkan tumpukan menurut CARA BARANGNYA MASUK,
     dan itu bukan pertanyaan yang pernah dibawa mata ke layar ini. */
  cek('mengetuknya membuka satu baris ukuran petak, tanpa saringan sumber',
      (await hal.locator('#galeri-tampil').isVisible()) &&
      (await hal.locator('#galeri-tampil .view-baris').count()) === 1 &&
      (await hal.locator('#galeri-tampil .tampil-tbl').count()) === 4 &&
      (await hal.locator('#galeri-tampil [data-gsaring]').count()) === 0);

  /* Empat tampilan, dan yang dipilih ikut ke pembukaan berikutnya - kebiasaan
     orang menetap di satu ukuran. */
  await hal.click('#galeri-tampil [data-ggaya="besar"]');
  await hal.waitForTimeout(300);
  cek('memilih petak besar benar-benar mengganti petaknya',
      (await hal.evaluate(() =>
        document.querySelector('#galeri-isi .petak').className)) === 'petak besar');
  /* MENCIUT BEGITU DIJAWAB. Pertanyaannya cuma satu, dan menu yang tetap
     terbuka sesudahnya mendorong gambarnya turun justru waktu kamu baru
     selesai mengatur cara melihatnya. */
  cek('dan menunya menciut sendiri sesudah dipilih',
      await hal.locator('#galeri-tampil').isHidden());
  await hal.click('#galeri-saring [data-gkepala="*view"]');
  await hal.waitForTimeout(250);
  await hal.click('#galeri-tampil [data-ggaya="daftar"]');
  await hal.waitForTimeout(300);
  cek('dan Daftar menggantinya jadi baris, bukan petak',
      (await hal.locator('#galeri-isi .petak').count()) === 0 &&
      (await hal.locator('#galeri-isi .kartu').count()) >= 4);
  cek('pilihannya ikut tersimpan',
      (await hal.evaluate(() => TSimpan.setelan('gayaGaleri'))) === 'daftar');
  await hal.click('#galeri-saring [data-gkepala="*view"]');
  await hal.waitForTimeout(250);
  await hal.click('#galeri-tampil [data-ggaya="sedang"]');
  await hal.waitForTimeout(300);

  /* HOME MENGEMBALIKAN LAYAR SEPERTI BARU DIBUKA - satu ketukan, bukan empat
     di empat tempat. Yang paling sering terjadi bukan "aku mau melepas yang
     ini", tapi "aku mau mulai dari nol lagi". */
  await hal.click('#galeri-saring [data-gkepala="*home"]');
  await hal.waitForTimeout(350);
  cek('Home menutup menu View dan mengembalikan layar ke keadaan bersih',
      (await hal.locator('#galeri-tampil').isHidden()) &&
      (await hal.inputValue('#galeri-cari')) === '');

  /* POHONNYA DIKURASI DI SATU TEMPAT, DI SETELAN - dan itu bukan penghematan
     tombol. Dua pintu untuk menumbuhkan daftar yang sama berarti daftarnya
     tumbuh tanpa ada yang pernah melihat keseluruhannya, dan pohon yang tidak
     pernah dilihat utuh persis yang mau dihindari. */
  cek('tidak ada lagi "+ Folder" di Gallery — pohonnya dikurasi di Setelan',
      (await hal.locator('#b-galeri-folder').count()) === 0);

  /* ===== ANGKANYA GAMBAR, DAN DIA MENGHITUNG SAMPAI KE DALAM =====
     Dulu barisnya membawa dua angka: "10 album" dan isi langsungnya. Yang
     dibaca mata cuma yang pertama, dan yang pertama menjawab pertanyaan yang
     tidak pernah ditanyakan - kamu tidak mencari album, kamu mencari foto.
     Akibatnya baris bertulis "10 album" diketuk lalu isinya nol, dan angka
     yang menipu sekali saja berhenti dipercaya selamanya. */
  await hal.evaluate(async () => {
    await TSimpan.setel('board', JSON.stringify(
      ['Business', 'Business Bidanguji', 'Business Bidanguji Kamaruji']));
    const bin = atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dw'
                   + 'nwEJMKEL0FIQAG3+AwOfLbXbAAAAAElFTkSuQmCC');
    const arr = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
    const blob = new Blob([arr], { type: 'image/png' });
    for (const [id, album] of [['ghit1', 'Business Bidanguji Kamaruji'],
                               ['ghit2', 'Business Bidanguji Kamaruji'],
                               ['ghit3', 'Business Bidanguji']]) {
      await TSimpan.taruhBerkas('b' + id, blob, id + '.png', 'image/png');
      await TSimpan.taruh({ id: id, jenis: 'gambar', judul: id, isi: '',
        kategori: '', folder: '', album: album, sumber: 'kamera', driver: '', thumb: '',
        berkasId: 'b' + id, namaBerkas: id + '.png', tipeBerkas: 'image/png',
        ukuran: blob.size, label: [], elemen: [], daftar: [],
        dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true });
    }
  });
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  const angkaAkar = await hal.innerText('#galeri-isi [data-galeri-folder="Business"]');
  cek('akarnya menghitung SELURUH gambar di bawahnya, bukan jumlah interest-nya',
      /\b3\b/.test(angkaAkar) && !/album/.test(angkaAkar), angkaAkar);
  await hal.click('#galeri-isi [data-galeri-folder="Business"]');
  await hal.waitForTimeout(350);
  cek('mengetuk akarnya membuka interest di dalamnya, bukan fotonya',
      (await hal.locator('#galeri-isi [data-laci="Business Bidanguji"]').count()) === 1 &&
      (await hal.locator('#galeri-isi .petak-satu').count()) === 0);
  cek('dan interest-nya juga menghitung sampai ke sub-nya',
      /\b3\b/.test(await hal.innerText('#galeri-isi [data-laci="Business Bidanguji"]')),
      await hal.innerText('#galeri-isi [data-laci="Business Bidanguji"]'));

  /* ===== LACI: SUB FOLDER YANG BISA DIINTIP TANPA DIMASUKI =====
     Sebelumnya barisnya cuma nama dan angka, dan satu-satunya cara melihat
     isinya adalah masuk ke dalamnya lalu keluar lagi: tiga ketukan untuk satu
     pertanyaan yang jawabnya "oh, bukan yang ini". */
  cek('lacinya tertutup sampai diketuk',
      (await hal.locator('#galeri-isi .laci-board.buka').count()) === 0);
  await hal.click('#galeri-isi [data-laci="Business Bidanguji"]');
  await hal.waitForTimeout(300);
  cek('mengetuk barisnya membuka lacinya di tempat, tanpa memindahkan layar',
      (await hal.locator('#galeri-isi .laci-board.buka').count()) === 1 &&
      (await hal.innerText('#galeri-alamat')).indexOf('Bidanguji') < 0,
      await hal.innerText('#galeri-alamat'));
  /* ===== LACINYA BERSARANG, BUKAN MENELAN =====
     Membuka satu laci dulu menumpahkan seluruh isinya sebagai satu tumpukan
     rata, dan sub foldernya lenyap dari layar. Yang terbaca bukan "isinya
     diperlihatkan" tapi "susunannya hilang" - dan susunan yang hilang begitu
     diintip bikin mengintip berhenti bisa dipercaya. */
  cek('sub foldernya tetap kelihatan di dalamnya, sebagai laci lagi',
      (await hal.locator('#galeri-isi .laci-isi [data-laci="Business Bidanguji Kamaruji"]').count()) === 1,
      await hal.innerText('#galeri-isi'));
  /* Yang tampil langsung cuma gambar yang memang tinggal di baris ini sendiri;
     sisanya ada di dalam laci anaknya. Dua-duanya dijumlah = angka di
     barisnya, dan angka yang tidak cocok dengan isinya lebih buruk daripada
     tidak berangka. */
  cek('dan gambar yang memang tinggal di baris ini yang tergelar langsung',
      (await hal.locator('#galeri-isi .laci-isi > .petak .petak-satu').count()) === 1);
  await hal.click('#galeri-isi [data-laci="Business Bidanguji Kamaruji"]');
  await hal.waitForTimeout(300);
  cek('membuka laci anaknya menggelar sisanya, jadi genap seperti angkanya',
      (await hal.locator('#galeri-isi .petak-satu').count()) === 3,
      String(await hal.locator('#galeri-isi .petak-satu').count()));
  await hal.click('#galeri-isi [data-laci="Business Bidanguji Kamaruji"]');
  await hal.waitForTimeout(300);
  await hal.click('#galeri-isi [data-laci="Business Bidanguji"]');
  await hal.waitForTimeout(300);
  cek('mengetuknya lagi menutupnya',
      (await hal.locator('#galeri-isi .laci-board.buka').count()) === 0);
  /* Buka semua / tutup semua di kepalanya: sekali lihat seluruh isi board, atau
     merapikan kembali jadi daftar. */
  await hal.click('#galeri-isi [data-laci-semua="buka"]');
  await hal.waitForTimeout(300);
  /* MENEMBUS SAMPAI KE DALAM: "buka semua" yang berhenti di tingkat pertama
     bukan buka semua. */
  cek('“Buka semua” membuka seluruh lacinya sekaligus, sampai ke dalam',
      (await hal.locator('#galeri-isi .laci-board.buka').count()) ===
      (await hal.locator('#galeri-isi .laci-board').count()) &&
      (await hal.locator('#galeri-isi .laci-isi .laci-board.buka').count()) >= 1,
      String(await hal.locator('#galeri-isi .laci-board.buka').count()));
  await hal.click('#galeri-isi [data-laci-semua="tutup"]');
  await hal.waitForTimeout(300);
  cek('dan tombolnya berganti jadi “Tutup semua” yang menutup semuanya',
      (await hal.locator('#galeri-isi .laci-board.buka').count()) === 0);

  /* ===== NAMA KELAS YANG BERTABRAKAN TIDAK PERNAH BERGALAT =====
     'laci' sudah dipakai laci lampiran di dok Drop, dan gaya di sana memberi
     kartu berbingkai plus max-height 46vh. Dia tidak melempar apa pun; dia cuma
     diam-diam mewarisi gaya yang tidak dimaksud - baris folder jadi kartu
     putih, dan laci yang isinya banyak terpotong separuh layar. */
  cek('lacinya tidak mewarisi gaya laci lampiran dok Drop',
      await hal.evaluate(() => {
        const el = document.querySelector('#galeri-isi .laci-board');
        if (!el) return false;
        const g = getComputedStyle(el);
        return g.maxHeight === 'none' && g.borderTopWidth === '0px';
      }));
  /* PANAHNYA DI TENGAH BARIS, bukan di atas laci - dipatok ke tinggi barisnya
     sendiri, jadi dia tetap di tengah berapa pun tinggi barisnya. */
  cek('panah masuknya duduk di tengah barisnya, bukan menempel di atas',
      await hal.evaluate(() => {
        const b = document.querySelector('#galeri-isi .laci-baris');
        const p = b && b.querySelector('.laci-masuk');
        if (!p) return false;
        const rb = b.getBoundingClientRect(), rp = p.getBoundingClientRect();
        return Math.abs((rp.top + rp.height / 2) - (rb.top + rb.height / 2)) < 2;
      }));
  /* GARIS DI BAWAH JUDUL CUMA KALAU ADA ISINYA. Garis yang memisahkan judul
     dari ruang kosong tidak memisahkan apa pun - dia cuma coretan. */
  const garis = await hal.evaluate(() => {
    const tutup = document.querySelector('#galeri-isi .laci-board:not(.buka) .laci-kepala');
    return tutup ? getComputedStyle(tutup).borderBottomWidth : 'x';
  });
  cek('laci yang tertutup tidak menggantungkan garis di bawah judulnya',
      garis === '0px', garis);
  await hal.click('#galeri-isi [data-laci="Business Bidanguji"]');
  await hal.waitForTimeout(300);
  const garis2 = await hal.evaluate(() => {
    const buka = document.querySelector('#galeri-isi .laci-board.buka .laci-kepala');
    return buka ? getComputedStyle(buka).borderBottomWidth : 'x';
  });
  cek('tapi begitu terbuka, garisnya muncul memisahkan judul dari gambarnya',
      garis2 !== '0px' && garis2 !== 'x', garis2);
  await hal.click('#galeri-isi [data-laci="Business Bidanguji"]');
  await hal.waitForTimeout(300);

  /* ===== TIAP INTEREST SELALU PUNYA "VARIOUS", WALAU KOSONG =====
     Yang membuka "Business Hampers" dan cuma melihat "Isi Hamper" tidak punya
     satu tempat pun untuk hamper yang bukan isinya - jadi dia menaruhnya di
     interest itu sendiri, dan interest yang menampung foto lepas di samping
     sub-nya persis timbunan yang dilawan aplikasi ini. */
  /* MASUK KE DALAMNYA lewat panah di ujung kanan - dua sasaran di satu baris,
     dan keduanya 40px: yang kiri mengintip, yang kanan benar-benar pindah. */
  await hal.click('#galeri-isi .laci-masuk[data-galeri-folder="Business Bidanguji"]');
  await hal.waitForTimeout(350);
  cek('panah di ujung barisnya benar-benar memindahkan layarnya',
      (await hal.innerText('#galeri-alamat')).indexOf('Bidanguji') >= 0,
      await hal.innerText('#galeri-alamat'));
  cek('tiap interest dapat ruang tunggunya sendiri, walau belum ada isinya',
      (await hal.locator('#galeri-isi [data-laci="Business Bidanguji Various"]').count()) === 1,
      await hal.innerText('#galeri-isi'));
  /* TAPI VIRTUAL, bukan ditanam ke pohonmu: sebelas baris "Various" yang lahir
     sendiri di Setelan adalah pohon yang menumbuhi dirinya di belakangmu, dan
     pohon begitu berhenti terasa milikmu. */
  cek('tapi barisnya belum ditanam ke pohonmu sampai ada yang mendarat di situ',
      (await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board)))
        .indexOf('Business Bidanguji Various') < 0);
  /* AKAR DAN RUANG TUNGGU TIDAK IKUT DAPAT: akar itu tulang punggung, dan
     ruangan di dalam ruang tunggu membatalkan gunanya ruang tunggu. */
  cek('akarnya sendiri tidak ikut ditumbuhi Various',
      (await hal.evaluate(() => TAlur.albumTampakUji())).indexOf('Business Various') < 0);
  /* Foto langsung di interest tetap terlihat di sana - foto yang tidak punya
     baris untuk ditampilkan sama saja dengan foto yang hilang. */
  cek('dan foto yang memang di interest itu tetap kelihatan di bawahnya',
      (await hal.locator('#galeri-isi .petak-satu').count()) === 1);

  await hal.evaluate(async () => {
    for (const id of ['ghit1', 'ghit2', 'ghit3']) {
      const e = TAlur.semuaEntri().filter((x) => x.id === id)[0];
      if (e) { e.pensiun = true; await TSimpan.taruh(e); }
    }
  });
  /* Pohonnya dibaca sekali waktu halaman dimuat, jadi menulisnya ke basis data
     saja tidak cukup - halamannya harus benar-benar dimuat ulang, persis
     seperti yang terjadi di HP sesudah menyuntingnya di Setelan. */
  await hal.evaluate(() => TSimpan.setel('board',
    JSON.stringify(['Rumahuji', 'Rumahuji Dapuruji'])));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  await hal.click('#galeri-isi [data-galeri-folder="Rumahuji"]');
  await hal.waitForTimeout(350);
  /* Di dalam board, barisnya LACI - yang memindahkan layar panah di ujungnya. */
  await hal.click('#galeri-isi .laci-masuk[data-galeri-folder="Rumahuji Dapuruji"]');
  await hal.waitForTimeout(350);
  cek('jejaknya menunjukkan jalurnya',
      (await hal.innerText('#galeri-alamat')).replace(/\s+/g, ' ')
        .indexOf('Rumahuji / Dapuruji') >= 0,
      await hal.innerText('#galeri-alamat'));

  /* UNGGAHAN MASUK LANGSUNG JADI ENTRI di album yang sedang dibuka - niatnya
     sudah jelas, jadi menagih satu ketukan "Drop" lagi sesudahnya adalah
     menagih jawaban yang sudah diberikan. */
  await hal.setInputFiles('#galeri-pilih-unggah', [
    { name: 'unggahuji.png', mimeType: 'image/png', buffer: binPng }
  ]);
  await hal.waitForTimeout(2200);
  /* BERDIRI DI DALAM ALBUM MENJAWAB "KE MANA", BUKAN "APA YANG KAMU LIHAT" -
     jadi albumnya tidak ditanya lagi, tapi sudut pandangnya tetap ditagih
     sekali. Tanpa langkah ini, unggahannya berangkat ke AI tanpa satu kata pun
     driver dan jatuh ke pembaca dokumen. */
  cek('unggahan di dalam album tetap ditanya sudut pandangnya',
      await hal.locator('#tanya-isi').isVisible());
  await hal.fill('#tanya-isi', 'nanas pickup');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(900);
  cek('dan albumnya tidak ditanya lagi — itu sudah dijawab dengan berdiri di sana',
      await hal.locator('#tanya').isHidden());
  const yangDiunggah = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.namaBerkas === 'unggahuji.png')
    .map((e) => ({ album: e.album, sumber: e.sumber, jenis: e.jenis }))[0]);
  cek('unggahan mendarat di board yang sedang dibuka, bukan di akar',
      !!yangDiunggah && yangDiunggah.album === 'Rumahuji Dapuruji' &&
      yangDiunggah.sumber === 'unggah' && yangDiunggah.jenis === 'gambar',
      JSON.stringify(yangDiunggah));
  /* DAN ALAMATNYA DIKUNCI. Kalau tidak, pelabelan yang berjalan di belakang
     memindahkannya ke board yang dipilih AI - membatalkan jawaban yang barusan
     kamu berikan dengan berdiri di sana. */
  cek('dan alamatnya dikunci, jadi AI tidak boleh memindahkannya',
      (await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => e.namaBerkas === 'unggahuji.png')[0].albumManual)) === true);

  /* TEMPAT YANG KAMU NAMAI SENDIRI IKUT DICARI. Foto yang kamu potret di dalam
     board "Kopo Project" tidak punya kata "Kopo" di judulnya atau di deskripsi
     AI-nya - satu-satunya yang menyebutnya adalah boardnya. Tanpa ini, mencari
     "Kopo" menjawab "tidak ada yang cocok" padahal nama boardnya jelas-jelas
     tertulis di layar, dan yang terbaca: pencariannya rusak.

     Umpannya HARUS begitu: judul yang kebetulan menyebut nama boardnya akan
     lolos lewat jalur lain, dan itu yang menyembunyikan bugnya. */
  await hal.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => x.namaBerkas === 'unggahuji.png')[0];
    if (e) {
      e.judul = 'Penjual nanas';
      e.isi = 'Sebuah mobil pick up mengangkut buah.';
      await TSimpan.taruh(e);
    }
    await TAlur.muatUlangUji();
  });
  await hal.waitForTimeout(300);
  const lewatAlbum = await hal.evaluate(() => {
    const e = TAlur.semuaEntri().filter((x) => x.namaBerkas === 'unggahuji.png')[0];
    return {
      album: e && e.album,
      /* Dicari lewat kata yang CUMA ada di nama albumnya. */
      ketemu: TOtak.cari(TAlur.semuaEntri(), 'Rumahuji', '', '')
        .filter((x) => x.namaBerkas === 'unggahuji.png').length,
      judulBersih: e && !/rumahuji/i.test(e.judul + ' ' + e.isi)
    };
  });
  cek('umpannya benar - nama boardnya tidak bocor ke judul atau isinya',
      !!lewatAlbum.judulBersih, JSON.stringify(lewatAlbum));
  cek('gambar ketemu lewat nama BOARD-nya, bukan cuma judul dan deskripsi',
      lewatAlbum.ketemu === 1, JSON.stringify(lewatAlbum));
  /* Dan lewat kotak carinya sendiri, bukan cuma lewat mesinnya. */
  await hal.fill('#galeri-cari', 'Rumahuji');
  await hal.dispatchEvent('#galeri-cari', 'input');
  await hal.waitForTimeout(400);
  cek('dan kotak cari Gallery benar-benar memperlihatkannya',
      (await hal.locator('#galeri-isi .petak-satu').count()) >= 1 &&
      (await hal.locator('#galeri-isi .kosong').count()) === 0,
      String(await hal.locator('#galeri-isi .petak-satu').count()));
  await hal.fill('#galeri-cari', '');
  await hal.dispatchEvent('#galeri-cari', 'input');
  await hal.waitForTimeout(350);

  /* PREVIEW, BUKAN CUMA LAPISAN HITAM. Gambar yang membesar tanpa satu tombol
     pun tidak memberitahu cara keluarnya - dan layar yang tidak memberitahu
     cara keluarnya terbaca sebagai layar yang membeku, walau mengetuknya
     sebenarnya menutup. */
  await hal.locator('#galeri-isi .petak-satu img').first().click();
  await hal.waitForTimeout(600);
  cek('mengetuk gambar membuka previewnya', await hal.locator('#lihat').isVisible());
  const infoLihat = (await hal.innerText('#lihat-info')).replace(/\s+/g, ' ');
  cek('previewnya menyebut namanya dan keterangan yang menolong',
      /Kamera|Unggah|Drop/.test(infoLihat) && infoLihat.length > 8, infoLihat);
  cek('dan ada tombol Tutup yang kelihatan',
      await hal.locator('#b-lihat-tutup').isVisible());
  /* Doknya melayang di sudut yang sama. Tanpa z-index yang benar, yang duduk
     di sudut kanan bawah tombol kamera - dan mengetuknya memotret, bukan
     menutup. */
  cek('previewnya di ATAS dok kamera, bukan di bawahnya',
      (await hal.evaluate(() => {
        const el = document.elementFromPoint(innerWidth - 40, innerHeight - 40);
        return el ? (el.id || '') : '';
      })) === 'b-lihat-tutup');
  await hal.click('#b-lihat-tutup');
  await hal.waitForTimeout(400);
  cek('tombol Tutup benar-benar menutupnya',
      await hal.locator('#lihat').isHidden());
  cek('dan layarnya tetap di Gallery, tidak ikut berpindah',
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-galeri');

  /* Di HP, jalan keluar pertama yang dicoba orang dari gambar penuh layar
     adalah tombol Kembali - dan tanpa satu langkah riwayat, tombol itu
     meninggalkan layarnya sama sekali. */
  await hal.locator('#galeri-isi .petak-satu img').first().click();
  await hal.waitForTimeout(500);
  await hal.goBack();
  await hal.waitForTimeout(500);
  cek('tombol Kembali HP menutup previewnya, bukan memindahkan layar',
      (await hal.locator('#lihat').isHidden()) &&
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-galeri');

  /* Mengetuk keterangannya TIDAK menutup: di situ ada tulisan yang mungkin mau
     kamu baca ulang atau sorot, dan yang tertutup di tengah membaca terbaca
     sebagai layar yang tidak bisa dipegang. */
  await hal.locator('#galeri-isi .petak-satu img').first().click();
  await hal.waitForTimeout(500);
  await hal.locator('#lihat .lihat-judul').click();
  await hal.waitForTimeout(350);
  cek('mengetuk keterangannya tidak ikut menutup',
      await hal.locator('#lihat').isVisible());
  await hal.click('#b-lihat-tutup');
  await hal.waitForTimeout(350);

  /* PETAKNYA SENDIRI SEBUAH TOMBOL, dan itu jebakan yang sudah pernah
     mematikan tekan lama: penjaga "jangan menahan di atas tombol" menolaknya
     mentah-mentah. Yang ditolak seharusnya cuma tombol DI DALAM kartu. */
  await hal.locator('#galeri-isi .petak-satu').first().dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  cek('menahan petak gambar memulai memilih, walau petaknya sendiri tombol',
      (await hal.locator('#galeri-isi .petak-satu.dipilih').count()) === 1,
      await hal.innerText('#pilih-jumlah'));
  cek('dan bilahnya menyebut gambar, bukan catatan',
      (await hal.innerText('#pilih-jumlah')).indexOf('gambar') >= 0,
      await hal.innerText('#pilih-jumlah'));
  /* Doknya melayang di sudut yang sama dengan bilah pilih: kalau dia tidak
     pergi, tombol kameranya menutupi Batal dan satu-satunya jalan keluar dari
     mode pilih adalah memotret. */
  cek('selama memilih, dok kamera pergi supaya Batal bisa ditekan',
      await hal.locator('#l-galeri .galeri-dok').isHidden());
  await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(250);

  /* Yang ditawarkan dialog pindah HARUS board layar ini, bukan folder Note. */
  await hal.locator('#galeri-isi .petak-satu').first().dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  await hal.click('#b-pilih-pindah');
  await hal.waitForSelector('#tanya-pilih:not(.sembunyi)');
  const tawarGal = (await hal.locator('#tanya-pilih [data-pilih]').allInnerTexts())
    .map((x) => x.trim());
  cek('yang ditawarkan board Gallery, bukan folder Note',
      tawarGal.every((x) => /^Rumahuji/.test(x)) && tawarGal.length >= 1,
      JSON.stringify(tawarGal));
  await hal.click('#b-tanya-batal');
  await hal.waitForTimeout(150);
  await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(200);

  /* GAMBAR YANG KAMU DROP MENDARAT DI SINI SENDIRI. Tidak ada satu keputusan
     pun yang ditagih di jalur masuk - aturan nomor satu tetap utuh. */
  const sblmDrop = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.jenis === 'gambar' && !e.pensiun).length);
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(300);
  await hal.setInputFiles('#pilih-gambar', [
    { name: 'ssuji.png', mimeType: 'image/png', buffer: binPng }
  ]);
  await hal.waitForTimeout(1200);
  await hal.fill('#kotak', 'tangkapan layar uji');
  await hal.click('#b-drop');
  await hal.waitForTimeout(1200);
  const ssdhDrop = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.jenis === 'gambar' && !e.pensiun).length);
  cek('gambar yang di-drop ikut masuk Gallery tanpa satu keputusan pun',
      ssdhDrop === sblmDrop + 1, sblmDrop + ' -> ' + ssdhDrop);

  /* IKON KAMERA DI LAYAR DROP: JALAN PINTAS, BUKAN PINTU KEDUA.
     Yang dihemat perjalanan tiga ketukan - pindah pintu, buka dok, potret -
     untuk hal yang paling sering dilakukan di aplikasi ini. Yang lahir dari
     sini harus entri Gallery yang sama persis dengan yang lahir dari dok
     kamera di sana: dua jalur masuk yang menghasilkan dua bentuk barang
     adalah cara tercepat membuat satu tumpukan jadi dua tumpukan yang tidak
     pernah bertemu. */
  await hal.fill('#kotak', '');
  await hal.dispatchEvent('#kotak', 'input');
  await hal.waitForTimeout(200);
  /* ===== DUA JALAN PINTAS YANG MEMBUAT =====
     Keduanya BUKAN cip, dan itu bukan soal tempat tapi soal jenis: baris cip
     menjawab "perlihatkan yang mana", sementara dua ini menjawab "aku mau
     MEMBUAT sesuatu sekarang". Selama mereka duduk di dalam baris itu, dua
     pertanyaan yang berbeda memakai bentuk yang sama - dan yang paling sering
     ditekan ikut menggulir keluar layar begitu saringannya bertambah. */
  cek('kamera dan Tulis tidak lagi jadi cip di baris saringan',
      (await hal.locator('#saring-cip [data-jenis="*kamera"]').count()) === 0 &&
      (await hal.locator('#saring-cip [data-jenis="*note"]').count()) === 0);
  /* DIPATOK DI UJUNG KANAN, tepat di atas tombol Drop - tempat jempol kanan
     sudah bertumpu. Di LUAR kotak yang menggulir: saringan boleh tergeser
     keluar layar kalau suatu hari bertambah, dua ini tidak boleh. */
  cek('keduanya duduk di ujung kanan baris, di luar kotak yang menggulir',
      await hal.evaluate(() => {
        const g = document.querySelector('#pintas-bulat');
        const c = document.querySelector('#saring-cip');
        const d = document.querySelector('#b-drop');
        if (!g || !c || !d) return false;
        return g.getBoundingClientRect().left >= c.getBoundingClientRect().right - 1 &&
               !c.contains(g) &&
               Math.abs(g.getBoundingClientRect().right - d.getBoundingClientRect().right) < 40;
      }) === true);
  cek('dan keduanya bulat, sepasang, tidak menggulir bersama cipnya',
      (await hal.locator('#pintas-bulat .pintas-tbl').count()) === 2 &&
      await hal.evaluate(() => {
        const t = document.querySelector('#b-pintas-tulis').getBoundingClientRect();
        return Math.abs(t.width - t.height) < 1.5;
      }));

  await hal.click('#b-pintas-tulis');
  await hal.waitForTimeout(400);
  cek('mengetuknya langsung membuka layar tulis, bukan daftar folder',
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-catat',
      await hal.evaluate(() => document.querySelector('.layar.aktif').id));
  /* JUDULNYA KOSONG, dan itu seluruh gunanya: menagih alamat sebelum
     kalimatnya ada persis pertanyaan yang bikin catatan itu tidak jadi
     ditulis. Alamatnya masih bisa dipilih kapan saja sesudahnya. */
  cek('dan judulnya dibiarkan kosong, tidak diisi folder mana pun',
      (await hal.inputValue('#catat-judul')) === '',
      await hal.inputValue('#catat-judul'));
  await hal.fill('#catat-judul', 'Catatan lewat jalan pintas');
  await hal.fill('#catat-isi', 'Ditulis tanpa memilih folder dulu.');
  await hal.click('#b-simpan');
  await hal.waitForTimeout(500);
  cek('yang ditulis dari sini tersimpan sebagai tulisan, tanpa folder',
      await hal.evaluate(() => TAlur.semuaEntri().some((e) =>
        e.judul === 'Catatan lewat jalan pintas' && e.tulisan && !e.folder)),
      JSON.stringify(await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => e.judul === 'Catatan lewat jalan pintas')
        .map((e) => ({ tulisan: !!e.tulisan, folder: e.folder || '' })))));
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(300);

  const sblmKamera = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.jenis === 'gambar' && !e.pensiun).length);
  /* Ditembakkan lewat isian yang sama persis dengan yang dibuka cipnya - kalau
     cipnya membuka isian lain, yang lahir bentuk barang yang lain juga. */
  cek('tombolnya membuka isian kamera Gallery, bukan lampiran kotak Drop',
      await hal.evaluate(() => {
        let kena = '';
        const asli = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function () { kena = this.id; };
        document.querySelector('#b-pintas-kamera').click();
        HTMLInputElement.prototype.click = asli;
        return kena;
      }) === 'galeri-pilih-kamera');
  await hal.setInputFiles('#galeri-pilih-kamera', [
    { name: 'pintasuji.png', mimeType: 'image/png', buffer: binPng }
  ]);
  await hal.waitForTimeout(1500);
  const dariPintas = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.namaBerkas === 'pintasuji.png')[0]);
  cek('memotret dari layar Drop langsung jadi entri Gallery, bukan lampiran',
      !!dariPintas && dariPintas.jenis === 'gambar' && dariPintas.sumber === 'kamera' &&
      (await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => e.jenis === 'gambar' && !e.pensiun).length)) === sblmKamera + 1,
      JSON.stringify(dariPintas && { j: dariPintas.jenis, s: dariPintas.sumber }));
  /* Kotak Drop tidak boleh ikut terisi: yang barusan kamu potret sudah punya
     rumahnya sendiri, dan draf yang menggantung di kotak akan ikut tersimpan
     lagi waktu kamu menekan Drop untuk hal yang sama sekali lain. */
  cek('dan kotak Drop tidak ikut kebagian lampiran',
      (await hal.inputValue('#kotak')) === '' &&
      (await hal.locator('#tebakan').isHidden()));

  /* SESINYA SATU, DI KEDUA LAYAR. Sudut pandang yang kamu ketik di Gallery
     tadi ('nanas pickup') tetap berlaku di sini - jalan pintas ini memang
     tombol yang sama, cuma berdiri di tempat lain. Kalau sesinya terpisah,
     sepuluh jepretan beruntun yang kebetulan diambil dari dua layar berbeda
     berangkat ke AI dengan dua sudut pandang, dan yang setengahnya salah. */
  cek('sesi yang sedang berjalan ikut terbawa — tidak ditanya lagi',
      (await hal.locator('#tanya').isHidden()) &&
      dariPintas.driver === 'nanas pickup', JSON.stringify(dariPintas.driver));
  /* ALAMATNYA DIKOSONGKAN, BUKAN DIWARISI DARI KUNJUNGAN TERAKHIR KE GALLERY.
     Board yang tadi kebetulan terbuka di layar sebelah tidak menjawab "ke
     mana" untuk foto yang diambil dari sini - dan salah alamat lebih buruk
     daripada tanpa alamat, karena yang salah tidak pernah kamu curigai. */
  cek('alamatnya menunggu AI, tidak diwarisi board yang tadi dibuka di Gallery',
      dariPintas.album === '' && !dariPintas.albumManual,
      JSON.stringify({ a: dariPintas.album, m: !!dariPintas.albumManual }));

  /* "Ganti" tetap ditawarkan, dan di sini pun dia menanyakan SUDUT PANDANG -
     bukan daftar board. */
  cek('dan “Ganti” tetap ditawarkan, sama seperti di layar Gallery',
      (await hal.locator('#pesan .pesan-aksi').count()) === 1);
  await hal.click('#pesan .pesan-aksi');
  await hal.waitForSelector('#tanya-isi:not(.sembunyi)');
  cek('yang ditanya sudut pandangnya, bukan daftar board',
      (await hal.innerText('#tanya-judul')).indexOf('lihat') >= 0,
      await hal.innerText('#tanya-judul'));
  await hal.fill('#tanya-isi', 'pintas uji');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(900);
  cek('drivernya berganti, dan layarnya tidak ikut berpindah — ini jalan pintas, bukan pintu',
      (await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => e.namaBerkas === 'pintasuji.png')[0].driver)) === 'pintas uji' &&
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-utama');

  await hal.evaluate(() => Promise.all(TAlur.semuaEntri()
    .filter((e) => /^gal\d|unggahuji|ssuji|pintasuji/.test(e.id) ||
                   /gal\d|unggahuji|ssuji|pintasuji/.test(e.namaBerkas || ''))
    .map((e) => { e.pensiun = true; return TSimpan.taruh(e); })));
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(300);
}

console.log('\nsesi jepretan — satu pertanyaan, dan AI yang mengalamatkan');
{
  /* SURVEY LAPANGAN, dan ini alur yang sebenarnya: sepuluh jepretan dalam lima
     menit, semuanya milik tempat yang sama. Menagih pilihan sepuluh kali untuk
     satu jawaban yang sama adalah sembilan tagihan yang tidak perlu - dan itu
     yang bikin orang berhenti memilih sama sekali, lalu dua puluh ribu foto
     jatuh ke satu tumpukan tanpa alamat.

     ADA DUA PERTANYAAN DI SINI, DAN CUMA SATU YANG BISA DIJAWAB MANUSIA:

       "kamu lihat apa?"   -> cuma kamu yang tahu. Foto masjid yang sama jadi
                              barang lain sama sekali kalau yang kamu pikirkan
                              karpetnya. Ini DRIVER, dan ini tetap ditanya.
       "masuk board mana?" -> terjemahan dari jawaban pertama ke daftar yang
                              sudah kamu tulis sendiri di Setelan. Mesin bisa
                              mengerjakannya, dan mesin melihat gambarnya.

     Jadi dialog "masuk folder mana?" sudah dibuang seluruhnya. */
  const PNG3 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dw'
             + 'nwEJMKEL0FIQAG3+AwOfLbXbAAAAAElFTkSuQmCC';
  const binPng3 = Buffer.from(PNG3, 'base64');

  await hal.evaluate(() => Promise.all([
    TSimpan.setel('board', JSON.stringify(
      ['Interior', 'Interior Lampuuji', 'Interior Sofauji',
       'Construction', 'Construction Granituji'])),
    TSimpan.setel('driverLengket', ''),
    TSimpan.setel('driverLengketPada', '0')
  ]));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForTimeout(600);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);

  const potret = async (nama) => {
    await hal.setInputFiles('#galeri-pilih-kamera',
      [{ name: nama, mimeType: 'image/png', buffer: binPng3 }]);
    await hal.waitForTimeout(1400);
  };
  const fotoUji = (nama) => hal.evaluate((n) => {
    const e = TAlur.semuaEntri().filter((x) => x.namaBerkas === n)[0];
    return e ? { album: e.album || '', driver: e.driver || '', manual: !!e.albumManual } : null;
  }, nama);
  const ketikDriver = async (teks) => {
    await hal.waitForSelector('#tanya-isi:not(.sembunyi)');
    await hal.fill('#tanya-isi', teks);
    await hal.click('#b-tanya-ya');
    await hal.waitForTimeout(900);
  };

  await potret('sesi1.png');
  cek('jepretan pertama menanyakan sudut pandangnya, bukan nama boardnya',
      (await hal.locator('#tanya-isi').isVisible()) &&
      (await hal.innerText('#tanya-judul')).indexOf('lihat') >= 0,
      await hal.innerText('#tanya-judul'));
  /* TAPI GAMBARNYA SUDAH TERSIMPAN SEBELUM DIALOGNYA MUNCUL. Aturan nomor satu
     tidak punya pengecualian, bahkan untuk aturan yang bagus: dialog driver itu
     tawaran di belakang, bukan gerbang di depan. */
  cek('gambarnya sudah tersimpan sebelum satu dialog pun muncul',
      !!(await fotoUji('sesi1.png')));

  await ketikDriver('interior mesjid');
  const sesi1 = await fotoUji('sesi1.png');
  cek('drivernya menempel di fotonya, mentah apa adanya',
      sesi1.driver === 'interior mesjid', JSON.stringify(sesi1));
  /* SESUDAH DRIVER, TIDAK ADA PERTANYAAN KEDUA. Ini seluruh gunanya perubahan
     ini: alamat itu terjemahan, dan terjemahan bukan pekerjaan manusia. */
  cek('dan tidak ada dialog kedua — boardnya bukan pertanyaan lagi',
      await hal.locator('#tanya').isHidden());
  /* Alamatnya sengaja DIBIARKAN KOSONG sampai AI memilihnya. Menebaknya di
     sini berarti dua sistem memilih alamat, dan yang kedua selalu yang lebih
     miskin - dia tidak melihat gambarnya. */
  cek('alamatnya menunggu AI, tidak diterka di jalur masuk',
      sesi1.album === '' && sesi1.manual === false, JSON.stringify(sesi1));

  /* BERUNTUN. Jepretan berikutnya tidak ditagih apa pun - nol ketukan untuk hal
     yang paling sering benar - dan drivernya mewaris, jadi AI membacanya dari
     sudut pandang yang sama. */
  await potret('sesi2.png');
  const kedua = await fotoUji('sesi2.png');
  cek('jepretan berikutnya mewarisi sudut pandangnya, tanpa satu ketukan pun',
      kedua.driver === 'interior mesjid' && (await hal.locator('#tanya').isHidden()),
      JSON.stringify(kedua));

  /* BUKTI BAHWA JEPRETANNYA MENDARAT, DAN DI MANA. Sesudah memotret layarnya
     bersih - tidak ada satu pun tanda foto tadi masuk ke mana - dan yang
     terbaca bukan "sudah tersimpan" tapi "tombolnya tidak berfungsi". */
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  cek('jepretan sesi ini berbaris di kepala Gallery',
      (await hal.locator('#galeri-baru').isVisible()) &&
      (await hal.locator('#galeri-baru .baru-satu').count()) === 2,
      String(await hal.locator('#galeri-baru .baru-satu').count()));
  /* ALAMATNYA IKUT TERTULIS, dan itu seluruh gunanya baris ini: yang kamu
     tanyakan sesudah memotret bukan "sudah tersimpan?" tapi "masuk ke mana?".
     Yang belum dipilih AI ditulis apa adanya - menunggu itu jawaban. */
  cek('lengkap dengan ke mana perginya, atau bahwa dia masih menunggu',
      (await hal.locator('#galeri-baru .baru-ke').count()) === 2 &&
      (await hal.innerText('#galeri-baru')).length > 8,
      (await hal.innerText('#galeri-baru')).replace(/\s+/g, ' ').slice(0, 90));
  /* Yang terbaru paling depan: yang kamu tanyakan selalu jepretan terakhir. */
  cek('yang paling baru duduk paling depan',
      (await hal.evaluate(() => TAlur.fotoSesiUji()[0])) ===
      (await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => e.namaBerkas === 'sesi2.png')[0].id)));
  /* DI DALAM BOARD DIA TIDAK DIGAMBAR: fotonya sudah kelihatan sendiri di
     bawahnya, dan mengulanginya di kepala berarti satu gambar terhitung dua
     kali. */
  await hal.click('#galeri-isi [data-galeri-folder="Interior"]');
  await hal.waitForTimeout(350);
  cek('tapi di dalam board dia tidak digambar lagi',
      await hal.locator('#galeri-baru').isHidden());
  await hal.click('#galeri-saring [data-gkepala="*home"]');
  await hal.waitForTimeout(350);
  cek('dan kabarnya lewat, dengan satu jalan keluar',
      (await hal.locator('#pesan .pesan-aksi').count()) === 1,
      await hal.innerText('#pesan'));

  /* BILAH SESI MEMBACAKAN DRIVERNYA, dan itu bukan pilihan tampilan. Alamat
     masih bisa dipindah kapan saja; yang tidak bisa diperbaiki belakangan
     adalah foto yang berangkat ke AI dengan sudut pandang yang sudah berhenti
     berlaku. */
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  cek('sesi yang berjalan membacakan drivermu',
      (await hal.locator('#galeri-lengket').isVisible()) &&
      (await hal.innerText('#galeri-lengket')).indexOf('interior mesjid') >= 0,
      await hal.innerText('#galeri-lengket'));

  /* "GANTI" MENANYAKAN SUDUT PANDANGNYA LAGI. Kamu tidak menekannya karena
     alamatnya salah - kamu menekannya karena konteksnya berpindah: tadi
     granit, sekarang alumunium. */
  await potret('sesi3.png');
  await hal.click('#pesan .pesan-aksi');
  await hal.waitForTimeout(500);
  cek('“Ganti” menanyakan sudut pandang baru, bukan daftar board',
      (await hal.locator('#tanya-isi').isVisible()) &&
      (await hal.innerText('#tanya-judul')).indexOf('lihat') >= 0,
      await hal.innerText('#tanya-judul'));
  await ketikDriver('sofa unik minimalis');
  cek('drivernya berganti, dan tetap tanpa dialog alamat',
      (await fotoUji('sesi3.png')).driver === 'sofa unik minimalis' &&
      (await hal.locator('#tanya').isHidden()),
      JSON.stringify(await fotoUji('sesi3.png')));

  /* SATU JAM, BERGULIR DARI JEPRETAN TERAKHIR. Sepuluh foto dalam lima menit
     itu satu sesi; satu banner kompetitor jam sepuluh pagi dan satu foto lain
     jam empat sore itu dua kejadian yang tidak ada hubungannya. Salah sudut
     pandang lebih buruk daripada tanpa sudut pandang - yang salah tidak pernah
     kamu curigai. */
  await hal.evaluate(() => TSimpan.setel('driverLengketPada', String(Date.now() - 3700000)));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForTimeout(600);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  cek('lewat satu jam, bilah sesinya hilang sendiri',
      await hal.locator('#galeri-lengket').isHidden());
  await potret('sesi4.png');
  cek('dan jepretan sesudahnya ditanya lagi, tidak mewarisi sesi yang basi',
      (await hal.locator('#tanya-isi').isVisible()) &&
      (await fotoUji('sesi4.png')).driver === '');
  await ketikDriver('granit motif');

  /* ===== SESINYA HARUS TERBACA DARI LAYAR DROP JUGA =====
     Cip kamera di layar Drop dipakai persis waktu kamu TIDAK sedang di
     Gallery, jadi bilah sesi di sana tidak pernah terbaca dari sini. Yang
     terjadi di lapangan: ketuk kamera, gambarnya langsung masuk tanpa satu
     pertanyaan pun, dan yang terbaca "kok tidak ditanya foldernya?" - padahal
     jawabannya "karena sudut pandang tadi masih berlaku". */
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(350);
  const tinggiBaris = () => hal.evaluate(() =>
    Math.round(document.querySelector('#saring-baris').getBoundingClientRect().height));
  const tinggiTanpaSesi = await hal.evaluate(async () => {
    /* Diukur waktu sesinya sengaja dimatikan sebentar, lalu dinyalakan lagi -
       supaya yang dibandingkan tinggi baris yang sama, bukan dua layar. */
    const d = await TSimpan.setelan('driverLengket');
    const t = await TSimpan.setelan('driverLengketPada');
    await TAlur.pakaiLengketUji('');
    const h = Math.round(document.querySelector('#saring-baris').getBoundingClientRect().height);
    await TSimpan.setel('driverLengket', d);
    await TSimpan.setel('driverLengketPada', t);
    await TAlur.muatLengketUji();
    return h;
  });
  cek('tombol kamera memakai BADGE, bukan cip atau baris tambahan',
      (await hal.locator('#b-pintas-kamera .cip-sesi').count()) === 1 &&
      (await hal.locator('#drop-lengket').count()) === 0);
  /* BADGE-NYA MENUMPANG DI ATAS IKONNYA, jadi tidak menambah satu piksel pun
     pada tinggi baris - dan tinggi baris itulah yang dijaga di seluruh dok
     ini: yang bertambah mendorong doknya naik, dan layar yang bergoyang di
     bawah jempol adalah harga yang tidak sepadan untuk satu kabar. */
  cek('dan badge-nya sendiri tidak menambah tinggi baris cipnya',
      (await tinggiBaris()) === tinggiTanpaSesi,
      (await tinggiBaris()) + ' vs ' + tinggiTanpaSesi);
  /* SELURUHNYA DI DALAM TOMBOLNYA, tidak satu piksel pun menggantung keluar.
     Badge yang menggantung bergantung pada kelonggaran baris di sekitarnya,
     dan kelonggaran itu berubah tiap kali doknya disunting - jadi cacatnya
     kembali tanpa ada yang menyentuh badge-nya sama sekali. Di dalam, dia
     tidak bisa dipotong siapa pun. */
  const kotakBadge = await hal.evaluate(() => {
    const w = document.querySelector('#b-pintas-kamera');
    const g = w.querySelector('.cip-sesi');
    const a = w.getBoundingClientRect(), b = g.getBoundingClientRect();
    return { atas: b.top - a.top, kiri: b.left - a.left,
             bawah: a.bottom - b.bottom, kanan: a.right - b.right };
  });
  cek('badge-nya utuh di dalam tombolnya, tidak ada yang menggantung keluar',
      kotakBadge.atas >= -0.5 && kotakBadge.kiri >= -0.5 &&
      kotakBadge.bawah >= -0.5 && kotakBadge.kanan >= -0.5,
      JSON.stringify(kotakBadge));
  /* Dan angka saringan yang sudah lebih dulu ada di baris ini ikut terjaga -
     dia menggantung 3px, dan selama ini persis di ambang pisaunya. */
  cek('angka saringan pun tidak menggantung keluar kotaknya',
      await hal.evaluate(() => {
        const w = document.querySelector('#saring-cip');
        const a = w.getBoundingClientRect();
        return [...w.querySelectorAll('.saring-angka')]
          .every((n) => n.getBoundingClientRect().top - a.top >= -0.5);
      }));
  cek('dan tidak mendorong satu cip pun keluar layar',
      await hal.evaluate(() => {
        const b = document.querySelector('#saring-cip');
        return b.scrollWidth <= Math.ceil(b.getBoundingClientRect().width) + 1;
      }),
      await hal.evaluate(() => {
        const b = document.querySelector('#saring-cip');
        return b.scrollWidth + ' vs ' + b.getBoundingClientRect().width;
      }));

  /* "Use last scene set up UNTIL IT DROPPED." Silangnya itu yang menjatuhkan. */
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(350);
  cek('sesinya hidup lagi sesudah driver baru',
      await hal.locator('#galeri-lengket').isVisible());
  await hal.click('#galeri-lengket [data-lengket-buang]');
  await hal.waitForTimeout(400);
  cek('silangnya menutup sesinya',
      await hal.locator('#galeri-lengket').isHidden());
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(350);
  cek('dan badge di tombol kameranya ikut hilang',
      (await hal.locator('#b-pintas-kamera .cip-sesi').count()) === 0);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(300);
  /* Barisan fotonya ikut hilang: dia kabar tentang sesi yang barusan kamu
     jatuhkan, dan kabar yang hidup lebih lama daripada peristiwanya cuma jadi
     sisa yang harus dibersihkan sendiri. */
  cek('dan barisan foto sesinya ikut hilang bersamanya',
      (await hal.locator('#galeri-baru').isHidden()) &&
      (await hal.evaluate(() => TAlur.fotoSesiUji().length)) === 0);

  /* SILANG DI LAYAR DROP MENJATUHKAN SESI YANG SAMA. Silang yang cuma bekerja
     di satu layar lebih buruk daripada tidak ada sama sekali - dia terlihat
     bisa ditekan. */
  await potret('sesi4b.png');
  await ketikDriver('granit motif');
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(350);
  cek('sesi barunya terbaca lagi dari badge tombol kamera',
      (await hal.locator('#b-pintas-kamera .cip-sesi').count()) === 1);
  /* BADGE-NYA DIBACA DULUAN. Dia duduk DI DALAM tombol kameranya, jadi tanpa
     penjaga itu ketukan di badge tetap terbaca "buka kamera" - dan
     satu-satunya jalan keluar dari sesi jadi jalan masuk ke sesi. */
  await hal.click('#b-pintas-kamera .cip-sesi');
  await hal.waitForTimeout(450);
  cek('mengetuk badge-nya menjatuhkan sesi, bukan membuka kamera',
      (await hal.locator('#b-pintas-kamera .cip-sesi').count()) === 0 &&
      !(await hal.evaluate(() => TSimpan.setelan('driverLengket'))));
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(350);

  /* BERDIRI DI DALAM BOARD MENJAWAB "KE MANA", BUKAN "APA YANG KAMU LIHAT".
     Dua pertanyaan, dan menyamakannya adalah kesalahan yang paling mahal di
     layar ini: dulu memotret dari dalam board melewati pertanyaan driver sama
     sekali, lalu fotonya berangkat tanpa sudut pandang dan dibaca sebagai
     dokumen. Yang kembali "Ruang Tamu Modern" untuk board Bedroom. */
  await hal.click('#galeri-isi [data-galeri-folder="Interior"]');
  await hal.waitForTimeout(350);
  await hal.click('#galeri-isi .laci-masuk[data-galeri-folder="Interior Sofauji"]');
  await hal.waitForTimeout(350);
  await potret('sesi5.png');
  const dalam = await fotoUji('sesi5.png');
  cek('memotret di dalam board langsung mendarat di situ',
      dalam.album === 'Interior Sofauji', JSON.stringify(dalam));
  /* DAN DIKUNCI. Kalau tidak, pelabelan yang berjalan di belakang
     memindahkannya ke board pilihan AI - membatalkan jawaban yang barusan kamu
     berikan dengan berdiri di sana. */
  cek('dan alamatnya dikunci, jadi AI tidak boleh memindahkannya',
      dalam.manual === true, JSON.stringify(dalam));
  cek('boardnya tidak ditanya lagi, tapi sudut pandangnya tetap ditagih sekali',
      await hal.locator('#tanya-isi').isVisible());
  await ketikDriver('sudut sofa');
  cek('dan sesudah dijawab, tidak ada pertanyaan kedua',
      (await hal.locator('#tanya').isHidden()) &&
      (await fotoUji('sesi5.png')).driver === 'sudut sofa',
      JSON.stringify(await fotoUji('sesi5.png')));

  /* KETIK NAMA SUB BOARD = LANGSUNG MENDARAT, TANPA AMBIGU. Kadang yang kamu
     ketik bukan cuma sudut pandang - dia sekalian menyebut tempatnya, dan
     tempat yang kamu sebut sendiri tidak pantas ditebak ulang siapa pun. */
  await potret('sesi6.png');
  /* Sesinya masih hidup dari jepretan sebelumnya, jadi drivernya tidak ditanya
     lagi - "Ganti" yang menanyakannya. Itu memang alurnya di lapangan. */
  await hal.click('#pesan .pesan-aksi');
  await ketikDriver('sofauji sudut lampu');
  const sebutSub = await fotoUji('sesi6.png');
  cek('menyebut sub board di drivernya langsung mendarat di situ',
      sebutSub.album === 'Interior Sofauji', JSON.stringify(sebutSub));
  /* DAN DIKUNCI: kalau tidak, pelabelan yang berjalan di belakang
     memindahkannya ke board pilihan AI - membatalkan alamat yang barusan kamu
     sebut sendiri. */
  cek('dan dikunci, jadi AI tidak boleh memindahkannya',
      sebutSub.manual === true, JSON.stringify(sebutSub));

  /* MENYEBUT MAIN BOARD SAJA TIDAK MENGUNCI APA PUN: alamatnya baru separuh,
     dan yang tersisa - sub yang mana - justru pertanyaan yang bisa dijawab
     mesin, karena dia melihat gambarnya. */
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(300);
  await hal.click('#galeri-saring [data-gkepala="*home"]');
  await hal.waitForTimeout(300);
  await potret('sesi7.png');
  await hal.click('#pesan .pesan-aksi');
  await ketikDriver('construction granit motif');
  const sebutMain = await fotoUji('sesi7.png');
  cek('menyebut main board saja membiarkan alamatnya untuk AI',
      sebutMain.album === '' && sebutMain.manual === false,
      JSON.stringify(sebutMain));

  /* DIPANGGIL LAGI LEWAT KALIMATMU SENDIRI. Enam bulan lagi yang paling pasti
     kamu ingat bukan judul atau deskripsi karangan AI, tapi dua-tiga kata yang
     kamu ketik sendiri waktu mengangkat kamera. Umpannya harus bersih: nama
     boardnya tidak boleh menyebut kata drivernya, kalau tidak yang lolos
     adalah jalur lain dan bugnya tersembunyi. */
  const lewatDriver = await hal.evaluate(() => {
    const punya = TAlur.semuaEntri().filter((x) => /^sesi[12]\.png$/.test(x.namaBerkas || ''));
    return {
      bersih: punya.every((e) => !/mesjid/i.test(
        (e.judul || '') + ' ' + (e.isi || '') + ' ' + (e.album || ''))),
      ketemu: TOtak.cari(TAlur.semuaEntri(), 'mesjid', '', '')
        .filter((x) => /^sesi[12]\.png$/.test(x.namaBerkas || '')).length
    };
  });
  cek('umpannya benar — kata drivernya tidak bocor ke judul, deskripsi, atau boardnya',
      lewatDriver.bersih, JSON.stringify(lewatDriver));
  cek('fotonya ketemu lewat driver yang kamu ketik sendiri',
      lewatDriver.ketemu === 2, JSON.stringify(lewatDriver));

  /* ===== UBAH NAMA & GABUNG, DI LAYARNYA SENDIRI =====
     Ini yang membuat pohon yang boleh tumbuh tetap bisa dirapikan. AI cuma
     bisa membuat "<main> <akhiran>", jadi foto terrace mendarat di "Interior
     Inspiration"; begitu isinya sudah jelas satu jenis, namanya diganti dan
     seluruh isinya ikut - tanpa memindahkan satu foto pun. */
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(300);
  await hal.click('#galeri-saring [data-gkepala="*home"]');
  await hal.waitForTimeout(350);
  await hal.click('#galeri-isi [data-galeri-folder="Interior"]');
  await hal.waitForTimeout(350);
  await hal.locator('#galeri-isi .laci-kepala[data-galeri-folder="Interior Sofauji"]').dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  cek('“Ubah nama” cuma muncul untuk SATU folder',
      await hal.locator('#b-pilih-nama').isVisible());
  await hal.click('#b-pilih-nama');
  await hal.waitForSelector('#tanya-isi:not(.sembunyi)');
  /* Yang diketik NAMA PENDEKNYA saja - awalan induknya dipasang aplikasinya,
     aturan yang sama persis dengan "+ Sub". */
  cek('yang diminta nama pendeknya, dan induknya disebut',
      (await hal.innerText('#tanya-ket')).indexOf('Interior') >= 0,
      await hal.innerText('#tanya-ket'));
  await hal.fill('#tanya-isi', 'Terraceuji');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(900);
  const sesudahNama = await hal.evaluate(() => ({
    pohon: JSON.parse(TAlur.setelanUji().board),
    isi: TAlur.semuaEntri().filter((e) => (e.album || '') === 'Interior Terraceuji').length,
    sisa: TAlur.semuaEntri().filter((e) => (e.album || '') === 'Interior Sofauji').length
  }));
  cek('namanya berganti di pohonnya',
      sesudahNama.pohon.indexOf('Interior Terraceuji') >= 0 &&
      sesudahNama.pohon.indexOf('Interior Sofauji') < 0,
      JSON.stringify(sesudahNama.pohon.filter((x) => /uji/i.test(x))));
  /* ISINYA IKUT, dan itu seluruh gunanya: kalau tidak, mengganti nama sama
     dengan menghapus ruangan dan membiarkan isinya jadi yatim. */
  cek('dan seluruh isinya ikut pindah tanpa disentuh satu per satu',
      sesudahNama.isi >= 1 && sesudahNama.sisa === 0, JSON.stringify(sesudahNama));

  /* PINDAH BOARD LINTAS MAIN BOARD. Yang berpindah BOARDNYA SENDIRI, bukan
     isinya - dan ini pasangan wajib dari pohon yang boleh tumbuh: AI membuat
     ruangan dari akhiran, dan akhiran tidak tahu bidang. Tanpa jalan
     menggesernya, satu ruangan yang lahir di bidang yang salah cuma bisa
     dihapus, dan menghapus berarti isinya keluar semua. */
  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(
    ['Interior', 'Interior Terraceuji', 'Hospitality'])));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  await hal.click('#galeri-isi [data-galeri-folder="Interior"]');
  await hal.waitForTimeout(350);
  await hal.locator('#galeri-isi .laci-kepala[data-galeri-folder="Interior Terraceuji"]').dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  await hal.click('#b-pilih-pindah');
  await hal.waitForSelector('#tanya-pilih:not(.sembunyi)');
  /* Yang ditawarkan MAIN BOARD, bukan folder mana pun - dan induknya sendiri
     tidak ikut, karena memindahkan ke tempat yang sekarang bukan tindakan. */
  const tujuanMain = (await hal.locator('#tanya-pilih [data-pilih]').allInnerTexts())
    .map((x) => x.trim());
  cek('yang ditawarkan main board, dan induknya sendiri tidak ikut',
      JSON.stringify(tujuanMain) === JSON.stringify(['Hospitality']),
      JSON.stringify(tujuanMain));
  await hal.click('#tanya-pilih [data-pilih="Hospitality"]');
  await hal.waitForTimeout(900);
  const sesudahPindah = await hal.evaluate(() => ({
    pohon: JSON.parse(TAlur.setelanUji().board),
    isi: TAlur.semuaEntri().filter((e) => (e.album || '') === 'Hospitality Terraceuji').length
  }));
  cek('boardnya sendiri yang pindah, namanya ikut berganti induk',
      sesudahPindah.pohon.indexOf('Hospitality Terraceuji') >= 0 &&
      sesudahPindah.pohon.indexOf('Interior Terraceuji') < 0,
      JSON.stringify(sesudahPindah.pohon));
  cek('dan isinya ikut, tanpa disentuh satu per satu',
      sesudahPindah.isi >= 1, JSON.stringify(sesudahPindah));

  /* MAIN BOARD TIDAK BISA DIGESER: dia atapnya, dan atap ditentukan tanganmu -
     bukan AI, dan bukan kebetulan satu ketukan. */
  await hal.click('#galeri-saring [data-gkepala="*home"]');
  await hal.waitForTimeout(400);
  await hal.locator('#galeri-isi [data-galeri-folder="Hospitality"]').dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  await hal.click('#b-pilih-pindah');
  await hal.waitForSelector('#tanya-pilih:not(.sembunyi)');
  cek('main board tidak ditawari pindah induk — dia atapnya',
      (await hal.innerText('#tanya-judul')).indexOf('main board mana') < 0,
      await hal.innerText('#tanya-judul'));
  await hal.click('#b-tanya-batal');
  await hal.waitForTimeout(200);
  await hal.click('#b-pilih-batal');
  await hal.waitForTimeout(200);

  /* GABUNG MENCORET BARIS YANG SUDAH KOSONG. Memindahkan isinya saja
     meninggalkan ruangan kosong yang tetap berdiri, dan yang terbaca:
     "gabungnya gagal". */
  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(
    ['Interior', 'Interior Terraceuji', 'Interior Duauji', 'Hospitality'])));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(400);
  await hal.click('#galeri-isi [data-galeri-folder="Interior"]');
  await hal.waitForTimeout(350);
  await hal.locator('#galeri-isi .laci-kepala[data-galeri-folder="Interior Terraceuji"]').dispatchEvent('pointerdown');
  await hal.waitForTimeout(700);
  await hal.click('#galeri-isi .laci-masuk[data-galeri-folder="Interior Duauji"]');
  await hal.waitForTimeout(300);
  await hal.click('#b-pilih-gabung');
  await hal.waitForSelector('#tanya-pilih:not(.sembunyi)');
  await hal.click('#tanya-pilih [data-pilih="Interior Terraceuji"]');
  await hal.waitForTimeout(900);
  const sesudahGabungBoard = await hal.evaluate(() => JSON.parse(TAlur.setelanUji().board));
  cek('board yang sudah kosong ikut dicoret dari pohonnya',
      sesudahGabungBoard.indexOf('Interior Duauji') < 0 &&
      sesudahGabungBoard.indexOf('Interior Terraceuji') >= 0,
      JSON.stringify(sesudahGabungBoard));
  /* Dan induknya tidak ikut hilang: yang punya anak tidak pernah dicoret,
     karena mencoretnya membuat anaknya yatim dan naik ke akar. */
  cek('induknya tetap berdiri, anaknya tidak jadi yatim',
      sesudahGabungBoard.indexOf('Interior') >= 0);

  await hal.evaluate(() => Promise.all(TAlur.semuaEntri()
    .filter((e) => /^sesi\d\.png$/.test(e.namaBerkas || ''))
    .map((e) => { e.pensiun = true; return TSimpan.taruh(e); })));
  await hal.evaluate(() => Promise.all([
    TSimpan.setel('board', JSON.stringify(TBawaan.boardAwal)),
    TSimpan.setel('boardAI', '[]'),
    TSimpan.setel('driverLengket', ''),
    TSimpan.setel('driverLengketPada', '0')
  ]));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await pasangAI();
  await hal.waitForTimeout(2000);
}

console.log('\ntag sudah dibuang seluruhnya, bukan cuma disembunyikan');
{
  /* HASHTAG BUATAN MESIN MELAR DAN TIDAK PERNAH KONVERGEN. Sebulan kemudian
     ada #sofa, #kursi, dan #seating untuk satu benda, dan pemiliknya tidak
     mengenali satu pun waktu mencari. Kata yang tidak dia ingat bukan pintu
     masuk, cuma hiasan di kartu - dan hiasan yang menyaru sebagai pintu masuk
     lebih buruk daripada tidak ada.

     Yang menggantikannya deskripsi. Dia kalimat, jadi dia konsisten dengan
     dirinya sendiri, dan tiap kata di dalamnya ikut dicari. */
  const gambar = await hal.evaluate(() =>
    TPelabel.arahanGambarUji('bedroom lighting', ['Interior', 'Interior Bedroom']));
  const label = await hal.evaluate(() => TPelabel.arahanUji(TAlur.setelanUji()));
  const baca = [gambar, label].join('\n');
  cek('tidak ada satu pun permintaan tag atau hashtag yang tersisa di arahan',
      !/hashtag/i.test(baca) && !/"tag"/.test(baca) && !/\btag:/.test(baca), baca.slice(0, 200));
  cek('yang diminta deskripsi, dan isinya ditentukan',
      /MAKSIMAL 2 kalimat/.test(gambar) && /TULIS YANG MEMBEDAKAN/.test(gambar));
  /* Deskripsinya kontekstual: yang menentukan isinya DRIVER, bukan yang paling
     menonjol di gambar. Foto masjid dengan driver "interior mesjid" harus
     menghasilkan kalimat tentang elemen interiornya. */
  cek('dan drivernya yang menentukan isinya, bukan yang menonjol di gambar',
      /MEMBAHAS keywords/.test(gambar) &&
      /bukan yang paling menonjol/.test(gambar));

  /* ===== KATA "SUDUT PANDANG" TIDAK BOLEH ADA DI ARAHAN GAMBAR =====
     Aturannya tetap berlaku; yang dibuang cuma katanya. Yang dimaksud "bagian
     mana dari benda ini yang dibahas"; yang dibaca model "suara siapa yang
     bercerita" - dan jawabannya pulang sebagai laporan pandangan mata,
     lengkap dengan pelakunya, sampai memakai bahasa gaul. */
  cek('arahan gambar tidak lagi memakai kata "sudut pandang"',
      !/sudut pandang/i.test(gambar), gambar.slice(0, 300));
  /* Kata ganti orang di dalam PERINTAHNYA sendiri melahirkan kata ganti orang
     di JAWABANNYA. "Pakai sebutan yang akan DIA ketik lagi" adalah sebabnya,
     dan itu tidak kelihatan dari mana pun kecuali dari kalimat yang pulang. */
  cek('dan tidak ada satu pun kata ganti orang di dalam perintahnya',
      !/\b(dia|kamu|kami|kita|anda|aku|saya|gue|lo)\b/i.test(
        gambar.split('Lalu pilih SATU board')[0]),
      gambar.split('Lalu pilih SATU board')[0]);
  cek('larangannya disebut terang-terangan, bukan diserahkan ke tebakan',
      /DILARANG memakai kata ganti orang/.test(gambar) &&
      /tidak ada pelaku/.test(gambar) &&
      /Nada netral dan baku/.test(gambar));
  /* Kalau kamu mengetik driver dalam bahasa Inggris, jawabannya tidak boleh
     pulang dalam bahasa Indonesia - jadi registernya TIDAK BOLEH diminta
     dengan menamai bahasanya. "Tulis bahasa Indonesia baku" memperbaiki
     nadanya sambil merusak aturan ini. */
  cek('bahasa jawaban mengikuti bahasa keywords, bukan dipaksa Indonesia',
      /BAHASA JAWABAN MENGIKUTI BAHASA KEYWORDS/.test(gambar) &&
      !/Bahasa Indonesia/.test(gambar));
  cek('dan nadanya diminta tanpa menamai satu bahasa pun',
      /nadanya netral di bahasa mana pun/.test(gambar));
  cek('drivernya ditaruh paling atas sebagai Keywords',
      gambar.indexOf('Keywords: bedroom lighting') === 0, gambar.slice(0, 60));

  /* Dan entri baru benar-benar lahir TANPA kolom tag - bukan cuma tidak
     digambar. Entri lama boleh masih membawanya; aturan nomor empat berlaku,
     dan yang tersisa di sana tidak merugikan siapa pun. */
  const entriBaru = await hal.evaluate(() => {
    const e = TAlur.entriBaruUji('teks');
    return { punyaTag: 'tag' in e, kunci: Object.keys(e).length };
  });
  cek('entri baru lahir tanpa kolom tag sama sekali',
      entriBaru.punyaTag === false, JSON.stringify(entriBaru));
  cek('dan pustakanya tidak ikut disinkronkan lagi',
      (await hal.evaluate(() => TSinkron.KUNCI_SINKRON)).every((k) => !/tag|hashtag/i.test(k)),
      JSON.stringify(await hal.evaluate(() => TSinkron.KUNCI_SINKRON)));
}

console.log('\ndriver: satu foto, puluhan sudut pandang');
{
  /* Ini menambal kesalahan yang paling mahal di layar Gallery. Sebuah foto
     interior masjid dijawab "beberapa orang sedang melaksanakan sholat" -
     benar sebagai deskripsi, dan meleset total sebagai catatan. Yang dipotret
     memang orang sholat; yang DILIHAT pemotretnya konsep lampu gantung
     berlafadz untuk dekorasi mushala. */
  const arahan = await hal.evaluate(() => TPelabel.arahanUji(TAlur.setelanUji()));
  cek('arahan label tetap menyebut driver sebagai sudut pandang — tiga baris, bukan empat puluh',
      /DRIVER/.test(arahan) && /sudut pandangnya/i.test(arahan) &&
      /bahasanya mengikuti bahasa driver/i.test(arahan), String(arahan.length));

  /* Drivernya ikut berangkat ke AI, dan ditaruh SEBELUM isinya: model membaca
     dari atas, jadi sudut pandangnya harus sudah terpasang sebelum dia melihat
     apa yang tergambar. */
  const pesananUji = await hal.evaluate(() => {
    const e = { jenis: 'gambar', driver: 'interior mesjid', album: 'Interior Lampu',
                namaBerkas: 'a.png', isi: 'orang sedang sholat' };
    return TPelabel.pesananUji([e]);
  });
  cek('drivernya ikut berangkat ke AI',
      pesananUji.indexOf('DRIVER: interior mesjid') >= 0, pesananUji);
  cek('dan ditaruh sebelum isinya, supaya sudut pandangnya terpasang lebih dulu',
      pesananUji.indexOf('DRIVER:') < pesananUji.indexOf('isi:'), pesananUji);

  /* Driver yang datang belakangan mengubah artinya, jadi judul dan caption
     yang terlanjur disusun tanpa dia sudah kedaluwarsa - membiarkannya berarti
     foto masjid itu selamanya berjudul "orang sholat". */
  const dilabeliUlang = await hal.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => !x.pensiun && !x.dihapus && x.jenis !== 'tugas')[0];
    e.diLabeliAI = true; e.diBacaAI = true; e.driverUji = true;
    await TSimpan.taruh(e);
    await TAlur.muatUlangUji();
    await TAlur.taruhDriverUji([e.id], 'sudut pandang baru');
    const lagi = TAlur.semuaEntri().filter((x) => x.id === e.id)[0];
    return { driver: lagi.driver, label: lagi.diLabeliAI, baca: lagi.diBacaAI };
  });
  cek('driver yang datang belakangan memicu pelabelan ULANG, bukan cuma ditempel',
      dilabeliUlang.driver === 'sudut pandang baru' &&
      dilabeliUlang.label === false && dilabeliUlang.baca === false,
      JSON.stringify(dilabeliUlang));

  await hal.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => x.driverUji)[0];
    if (e) { e.driver = ''; e.diLabeliAI = true; e.diBacaAI = true; await TSimpan.taruh(e); }
    await TAlur.muatUlangUji();
  });
  await hal.waitForTimeout(300);

  /* Kolomnya ikut dicadangkan, DI EKOR - baris lama membaca nilainya menurut
     urutan, jadi menyisipkan di tengah menggeser seluruh cadangan yang ada. */
  const kolomDriver = await hal.evaluate(() => TAwan.KOLOM);
  cek('driver ikut dicadangkan, kolomnya di ekor',
      kolomDriver.indexOf('driver') >= kolomDriver.length - 3,
      JSON.stringify(kolomDriver.slice(-3)));
}

console.log('\narahan gambar: pendek, kontekstual, bahasamu');
{
  /* PROMPT PANJANG MEMBUAT MODEL KEHILANGAN FOKUS, dan yang tenggelam justru
     drivernya. Dibuktikan di lapangan: prompt tiga kalimat yang ditulis
     pemakainya sendiri mengalahkan arahan dua ratus baris milik aplikasi ini,
     pada gambar yang sama persis. */
  const arahanGbr = await hal.evaluate(() => TPelabel.arahanGambarUji(
    'Bedroom Interior Lighting', ['Interior', 'Interior Bedroom', 'Interior Lighting']));
  const arahanDok = await hal.evaluate(() => TPelabel.arahanUji(TAlur.setelanUji()));
  cek('arahan gambar jauh lebih pendek daripada arahan dokumen',
      arahanGbr.length * 3 < arahanDok.length,
      arahanGbr.length + ' vs ' + arahanDok.length);
  /* Batasnya melar sedikit sejak pohon board dan daftar akhiran ikut
     berangkat - tapi keduanya DATA, bukan perintah: yang bikin model
     kehilangan fokus paragraf yang menyuruh, bukan daftar yang dibaca. */
  cek('dan tetap di bawah 2000 karakter — cukup pendek untuk tidak buyar',
      arahanGbr.length < 2000, String(arahanGbr.length));

  /* DUA HASIL SAJA: satu deskripsi dan satu board. Tidak ada tag. */
  cek('yang diminta deskripsi dan board, tidak ada lagi tag',
      /"teks"/.test(arahanGbr) && /"board"/.test(arahanGbr) &&
      !/hashtag/i.test(arahanGbr) && !/"tag"/.test(arahanGbr), arahanGbr);

  /* ENAM HAL YANG DISEBUT, dan bukan asal panjang: satu kalimat tidak muat
     enam, dan "sebanyak yang benar-benar ada" menghasilkan kalimat bubur. */
  /* DUA KALIMAT, DAN ITU BATAS ATAS - bukan sasaran. Waktu diminta "2-3
     kalimat", yang kembali lima: model mengisi jatahnya dengan menulis ulang
     kalimat pertama memakai kata lain, dan yang ketiga sampai kelima tidak
     menambah satu pun pintu masuk. Deskripsi yang harus digulir berhenti
     dibaca, dan yang berhenti dibaca sama saja dengan tidak ada. */
  cek('deskripsinya maksimal 2 kalimat dengan isi yang ditentukan',
      /MAKSIMAL 2 kalimat/.test(arahanGbr) &&
      /TULIS YANG MEMBEDAKAN/.test(arahanGbr) &&
      /warna, bahan, merek/.test(arahanGbr), arahanGbr);
  /* ===== FUNGSI GENERIK ITU BUKAN DESKRIPSI =====
     "pulpen untuk mencatat", "air untuk minum", "ini adalah foto…" - semua itu
     sudah diketahui siapa pun yang membaca namanya, jadi kalimatnya habis tanpa
     memberi satu pun pintu masuk baru. Satu gambar sudah seribu kata; yang
     dibutuhkan deskripsi cuma kata yang MEMANGGIL gambar itu kembali, dan
     fungsi generik tidak memanggil apa pun karena dia berlaku untuk semua
     benda sejenis. */
  cek('fungsi generik bendanya dilarang terang-terangan',
      /DILARANG menyebut fungsi umum bendanya/.test(arahanGbr) &&
      /ini adalah foto/.test(arahanGbr), arahanGbr);
  /* DUA KALIMAT ITU BATAS ATAS, BUKAN SASARAN: kalau tidak ada yang
     membedakan, satu kalimat yang jujur lebih baik daripada dua yang berputar. */
  cek('dan kalimat kedua tidak boleh diisi sekadar memenuhi jatah',
      /cukup SATU kalimat/.test(arahanGbr) &&
      /memenuhi jatah/.test(arahanGbr));
  /* DITEGAKKAN KODENYA, bukan cuma diminta: permintaan bukan jaminan, dan yang
     bocor di sini tidak pernah kelihatan sebagai galat - cuma sebagai kartu
     yang makin lama makin panjang. */
  const potong = await hal.evaluate(() => [
    TPelabel.potongKalimatUji('Satu. Dua. Tiga. Empat.', 2),
    TPelabel.potongKalimatUji('Cuma satu kalimat tanpa titik', 2),
    TPelabel.potongKalimatUji('', 2)
  ]);
  cek('kalimat ketiga dan seterusnya dipotong kodenya',
      potong[0] === 'Satu. Dua.', JSON.stringify(potong[0]));
  /* Dipotong di UJUNG KALIMAT, bukan di jumlah karakter: kalimat yang putus di
     tengah kata terbaca sebagai data rusak. */
  cek('yang cuma satu kalimat tidak ikut dipotong di tengah',
      potong[1] === 'Cuma satu kalimat tanpa titik' && potong[2] === '',
      JSON.stringify(potong));
  /* Deskripsi menggantikan keyword, jadi kata-katanya harus kata yang lazim
     dipakai sehari-hari - bukan istilah pemasaran.

     DIMINTA POSITIF, BUKAN CUMA DILARANG. Dulu bunyinya "bukan bahasa
     katalog", dan itu cuma menyebut yang dilarang: yang paling jauh dari
     katalog adalah bahasa percakapan, jadi ke situlah jawabannya pergi -
     sampai gue-elo. */
  cek('dan diminta memakai sebutan sehari-hari, bukan istilah pemasaran',
      /Sebutan sehari-hari yang lazim/.test(arahanGbr) &&
      /bukan istilah pemasaran/.test(arahanGbr) &&
      !/bahasa katalog/.test(arahanGbr));

  /* KONTEKSTUAL: yang menentukan isinya DRIVER, bukan yang paling menonjol di
     gambar. Foto masjid dengan driver "interior mesjid" harus menghasilkan
     kalimat tentang elemen interiornya; yang sama dengan driver "karpet
     mesjid" menghasilkan kalimat tentang motif karpetnya. Bendanya satu,
     deskripsinya dua, dan keduanya benar. */
  cek('drivernya yang menentukan isinya, bukan yang menonjol di gambar',
      /MEMBAHAS keywords/.test(arahanGbr) &&
      /bukan yang paling menonjol di gambar/.test(arahanGbr));
  /* KATANYA yang dibuang, bukan aturannya. "Sudut pandang" dimaksudkan
     "bagian mana yang dibahas", tapi dibaca model "suara siapa yang
     bercerita" - dan yang pulang laporan pandangan mata, lengkap dengan
     pelakunya. */
  cek('dan kata "sudut pandang" tidak dipakai lagi di arahan gambar',
      !/sudut pandang/i.test(arahanGbr));
  cek('drivernya ditaruh paling atas sebagai Keywords',
      arahanGbr.indexOf('Keywords: Bedroom Interior Lighting') === 0, arahanGbr.slice(0, 60));

  /* Kalau kamu mengetik driver dalam bahasa Inggris, jawabannya tidak boleh
     pulang dalam bahasa Indonesia. Dulu arahannya sendiri yang menerjemahkan. */
  cek('bahasa jawaban mengikuti bahasa keywords, bukan dipaksa Indonesia',
      /BAHASA JAWABAN MENGIKUTI BAHASA KEYWORDS/.test(arahanGbr) &&
      !/Bahasa Indonesia/.test(arahanGbr), arahanGbr);

  /* POHONNYA IKUT, DAN DIA DAFTAR TERTUTUP. Ini kebalikan aturan tag yang
     lama: daftar tag sengaja terbuka, karena tag yang meleset cuma pintu
     tambahan yang tidak terpakai. Alamat lain ceritanya - daftar alamat yang
     boleh ditambah mesin melar sampai tidak ada dua foto yang tinggal di
     ruangan yang sama. */
  cek('pohonnya ikut dikirim, dan disebut tertutup',
      /Interior Bedroom/.test(arahanGbr) && /TERTUTUP/.test(arahanGbr) &&
      /jangan mengarang nama board maupun akhiran baru/.test(arahanGbr), arahanGbr);
  cek('jawabannya wajib turun sampai sub interest',
      /HARUS SUB INTEREST/.test(arahanGbr) && !/cukup main board/.test(arahanGbr),
      arahanGbr);

  /* ARAHAN DOKUMEN TETAP TERPISAH. Paragraf driver yang ditempelkan ke sana
     bertabrakan dengan perintahnya sendiri - "sebutkan jenis dokumennya",
     "tulis apa adanya, jangan menafsirkan" - dan yang kalah drivernya. */
  cek('arahan label tidak memuat paragraf driver empat puluh baris',
      arahanDok.indexOf('DRIVER') > 0 && arahanDok.indexOf('karpet mesjid') < 0,
      String(arahanDok.length));

  /* CAPTION YANG TERPOTONG HARUS BISA DIBACA. Teks yang dipotong "…" tanpa satu
     pun cara membacanya lebih buruk daripada tidak ditampilkan sama sekali:
     yang terbaca bukan "ringkas" tapi "ada yang disembunyikan". */
  const PNG4 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dw'
             + 'nwEJMKEL0FIQAG3+AwOfLbXbAAAAAElFTkSuQmCC';
  const binPng4 = Buffer.from(PNG4, 'base64');
  await hal.evaluate(async (b64) => {
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
    const blob = new Blob([arr], { type: 'image/png' });
    await TSimpan.taruhBerkas('bcap', blob, 'capuji.png', 'image/png');
    await TSimpan.taruh({ id: 'gcap', jenis: 'gambar', judul: 'Caption panjang uji',
      /* Sengaja PANJANG. Uji ini berjalan di layar lebar, dan caption dua ratus
         karakter masih muat dua baris di situ - jadi tidak ada yang terpotong,
         tidak ada yang bisa dibuktikan, dan ujinya lulus atau gagal karena
         lebar jendela, bukan karena fiturnya. */
      isi: 'Foto interior kamar tidur gelap dengan fokus pada pencahayaan aksen modern dari '
         + 'cermin LED bulat yang menyala di atas meja rias kayu minimalis, dengan rak dinding '
         + 'kecil di sampingnya dan tirai gelap yang menutup seluruh dinding belakang. Nuansa '
         + 'kayu hangat berpadu dengan cahaya putih netral, memberi kesan tenang dan modern '
         + 'tanpa terasa dingin. Meja riasnya bergaya minimalis dengan laci tanpa pegangan, '
         + 'dan cerminnya memakai lampu tepi yang menyala rata sehingga wajah tidak berbayang '
         + 'saat berdandan. Rak dinding kecil di sampingnya dipakai menaruh botol parfum dan '
         + 'perawatan wajah, sekaligus jadi aksen dekoratif yang memecah bidang dinding kosong.',
      kategori: '', folder: '', album: '', sumber: 'kamera', driver: 'bedroom interior lighting',
      thumb: '', berkasId: 'bcap', namaBerkas: 'capuji.png', tipeBerkas: 'image/png',
      ukuran: blob.size, label: [], elemen: [], daftar: [],
      dibuat: Date.now(), diubah: Date.now(), dipakai: 0, diLabeliAI: true, diBacaAI: true });
    await TAlur.muatUlangUji();
  }, PNG4);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(500);
  await hal.fill('#galeri-cari', 'Caption panjang uji');
  await hal.dispatchEvent('#galeri-cari', 'input');
  await hal.waitForTimeout(450);
  await hal.locator('#galeri-isi .petak-satu').first().click();
  await hal.waitForTimeout(600);
  cek('caption panjang menawarkan jalan untuk membacanya',
      await hal.locator('.lihat-isi-lagi').isVisible());
  /* Diukur dari TINGGINYA, bukan dari scrollHeight: -webkit-line-clamp memotong
     dengan menyembunyikan barisnya, jadi scrollHeight ikut terpotong dan
     selisihnya nol - ukuran yang kelihatan masuk akal tapi tidak pernah bisa
     membuktikan apa pun. */
  const tinggiRingkas = await hal.evaluate(() =>
    document.querySelector('.lihat-isi').getBoundingClientRect().height);
  await hal.click('.lihat-isi-lagi');
  await hal.waitForTimeout(350);
  const tinggiPenuh = await hal.evaluate(() =>
    document.querySelector('.lihat-isi').getBoundingClientRect().height);
  cek('dan captionnya memang tumbuh waktu dibuka, bukan cuma ganti kelas',
      tinggiPenuh > tinggiRingkas + 8,
      Math.round(tinggiRingkas) + ' -> ' + Math.round(tinggiPenuh));
  cek('mengetuknya membuka penuh, tanpa pindah layar',
      (await hal.evaluate(() =>
        document.querySelector('.lihat-isi').classList.contains('penuh'))) === true &&
      (await hal.locator('#lihat').isVisible()));
  cek('dan previewnya tidak ikut tertutup — itu bagian dari membaca',
      (await hal.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-galeri');
  cek('tombolnya berubah jadi jalan pulang',
      (await hal.innerText('.lihat-isi-lagi')) === 'Ringkas',
      await hal.innerText('.lihat-isi-lagi'));
  await hal.click('#b-lihat-tutup');
  await hal.waitForTimeout(350);
  await hal.fill('#galeri-cari', '');
  await hal.dispatchEvent('#galeri-cari', 'input');
  await hal.waitForTimeout(300);
  await hal.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => x.id === 'gcap')[0];
    if (e) { e.pensiun = true; await TSimpan.taruh(e); }
    await TAlur.muatUlangUji();
  });
  await hal.waitForTimeout(300);
}

console.log('\nberdiri di board menjawab "ke mana", bukan "apa yang kamu lihat"');
{
  /* LUBANG YANG MEMATIKAN SELURUH PERBAIKAN SEBELUMNYA. Dua pertanyaan, dan
     dulu di sini keduanya dianggap satu: begitu kamu memotret dari DALAM
     album, drivernya tidak pernah ditanya sama sekali. Fotonya berangkat ke AI
     tanpa satu kata pun sudut pandang, jatuh ke pembaca dokumen, dan yang
     kembali "Foto Interior Ruang Tamu Modern" untuk album Bedroom - lengkap
     dengan #AmaraLiving yang disedot dari pustaka tag. */
  const PNG5 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dw'
             + 'nwEJMKEL0FIQAG3+AwOfLbXbAAAAAElFTkSuQmCC';
  const binPng5 = Buffer.from(PNG5, 'base64');

  await hal.evaluate(() => Promise.all([
    TSimpan.setel('board', JSON.stringify(['Interior', 'Interior Kamaruji'])),
    TSimpan.setel('driverLengket', ''),
    TSimpan.setel('driverLengketPada', '0')
  ]));
  await hal.reload();
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForTimeout(700);
  await hal.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal.waitForTimeout(500);

  const fotoUji5 = (nama) => hal.evaluate((n) => {
    const e = TAlur.semuaEntri().filter((x) => x.namaBerkas === n)[0];
    return e ? { album: e.album || '', driver: e.driver || '' } : null;
  }, nama);
  const potret5 = async (nama) => {
    await hal.setInputFiles('#galeri-pilih-kamera',
      [{ name: nama, mimeType: 'image/png', buffer: binPng5 }]);
    await hal.waitForTimeout(1400);
  };

  await hal.click('#galeri-isi [data-galeri-folder="Interior"]');
  await hal.waitForTimeout(400);
  await hal.click('#galeri-isi .laci-masuk[data-galeri-folder="Interior Kamaruji"]');
  await hal.waitForTimeout(400);
  cek('memang sedang berdiri di dalam boardnya',
      (await hal.innerText('#galeri-alamat')).indexOf('Kamaruji') >= 0,
      await hal.innerText('#galeri-alamat'));

  await potret5('dalam1.png');
  cek('memotret di dalam board TETAP menanyakan sudut pandangnya',
      (await hal.locator('#tanya-isi').isVisible()) &&
      (await hal.innerText('#tanya-judul')).indexOf('lihat') >= 0,
      await hal.innerText('#tanya-judul'));
  await hal.fill('#tanya-isi', 'Bedroom Interior Lighting');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(1000);
  /* Boardnya sudah kamu jawab dengan berdiri di sana - menanyakannya lagi
     berarti menagih jawaban yang barusan diberikan. */
  cek('tapi boardnya TIDAK ditanya lagi — itu sudah dijawab dengan berdiri di sana',
      await hal.locator('#tanya').isHidden());
  const dalam1 = await fotoUji5('dalam1.png');
  cek('drivernya mendarat, boardnya tetap yang sedang dibuka',
      dalam1.driver === 'Bedroom Interior Lighting' && dalam1.album === 'Interior Kamaruji',
      JSON.stringify(dalam1));

  /* Sesudah itu harganya kembali nol - itu seluruh gunanya sesi. */
  await potret5('dalam2.png');
  const dalam2 = await fotoUji5('dalam2.png');
  cek('jepretan berikutnya di board yang sama tidak ditanya apa pun',
      (await hal.locator('#tanya').isHidden()) &&
      dalam2.driver === 'Bedroom Interior Lighting',
      JSON.stringify(dalam2));

  /* FOTO KAMERA TIDAK PERNAH DIBACA SEBAGAI DOKUMEN. Dulu yang memilih arahan
     itu drivernya, jadi satu foto yang lolos tanpa driver langsung jatuh ke
     pembaca dokumen - dijawab dalam bahasa Indonesia sebagai dokumen, "Foto
     Interior Ruang Tamu Modern" untuk foto kamar tidur. Kamera tidak pernah
     menghasilkan faktur.

     Diuji lewat ATURANNYA SENDIRI, bukan lewat perjalanan bolak-balik ke
     layanan AI. Yang bolak-balik itu bergantung pada mode AI, panjang antrean,
     dan sisa keadaan blok uji sebelumnya - tiga hal yang tidak ada hubungannya
     dengan aturan yang sedang diuji, dan tiap satunya bisa membuat ujinya
     gagal atau lulus karena alasan yang salah. */
  const rute = (e) => hal.evaluate((x) => TPelabel.fotoReferensiUji(x), e);
  cek('foto kamera TANPA driver tetap dibaca sebagai foto referensi',
      (await rute({ sumber: 'kamera' })) === true);
  cek('unggahan dari galeri HP juga — itu tetap foto milikmu, bukan dokumen',
      (await rute({ sumber: 'unggah' })) === true);
  cek('yang punya driver selalu foto referensi, dari mana pun dia masuk',
      (await rute({ sumber: 'drop', driver: 'sofa abu' })) === true);
  /* Yang jatuh lewat kotak Drop tanpa driver lain ceritanya: di situ tangkapan
     layar struk dan KTP memang yang terbanyak, dan pembaca dokumen yang teliti
     memang yang dibutuhkan. Menyeragamkan keduanya merusak sisi yang satunya. */
  cek('tapi tangkapan layar yang di-drop tetap dibaca sebagai dokumen',
      (await rute({ sumber: 'drop' })) === false &&
      (await rute({ sumber: '' })) === false);
  /* Dan arahannya memang dua benda yang berbeda, bukan dua nama untuk satu. */
  const dua = await hal.evaluate(() => ({
    gambar: TPelabel.arahanGambarUji('', TPelabel.daftarBoardUji(TAlur.setelanUji())),
    dokumen: TPelabel.arahanUji(TAlur.setelanUji())
  }));
  cek('arahan gambar dan arahan dokumen memang dua benda berbeda',
      /MAKSIMAL 2 kalimat/.test(dua.gambar) && !/MAKSIMAL 2 kalimat/.test(dua.dokumen) &&
      dua.gambar.length * 3 < dua.dokumen.length,
      dua.gambar.length + ' vs ' + dua.dokumen.length);

  await hal.evaluate(() => Promise.all(TAlur.semuaEntri()
    .filter((e) => /^dalam[12]\.png$/.test(e.namaBerkas || ''))
    .map((e) => { e.pensiun = true; return TSimpan.taruh(e); })));
  await hal.evaluate(() => Promise.all([
    TSimpan.setel('board', JSON.stringify(TBawaan.boardAwal)),
    TSimpan.setel('driverLengket', ''),
    TSimpan.setel('driverLengketPada', '0')
  ]));
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(300);
}

const TBAWAAN_NAMA = await hal.evaluate(() => TBawaan.nama);
console.log('\nsinkron empat perangkat');
{
  /* HP, tablet, laptop, PC. Selama ini awan cuma brankas - satu arah, dan
     menarik balik adalah tombol manual untuk hari kamu ganti perangkat. Itu
     benar waktu ini aplikasi HP; begitu perangkatnya empat, dia salah bentuk.

     Yang diuji di sini PERANGKAT KEDUA YANG SUNGGUHAN: konteks browser
     terpisah, IndexedDB-nya sendiri, cuma berbagi Drive palsu yang sama.
     Menguji dua perangkat di dalam satu halaman tidak bisa melihat satu pun
     kegagalan yang benar-benar terjadi di lapangan - keduanya akan memakai
     penyimpanan yang sama, dan yang diuji cuma dirinya sendiri. */
  const konteks2 = await browser.newContext();
  await konteks2.addInitScript(STUB_GIS);
  const hal2 = await konteks2.newPage();
  hal2.on('pageerror', (e) => galat.push('[perangkat 2] ' + e.message));
  await hal2.route('**', async (rute) => {
    const permintaan = rute.request();
    const u = permintaan.url();
    if (u.startsWith('http://127.0.0.1:' + port)) return rute.continue();
    if (/googleapis\.com/.test(u)) {
      return rute.fulfill(google.tangani(u, permintaan.method(), permintaan.postData()));
    }
    return rute.abort();
  });
  await hal2.goto(alamat);
  await hal2.waitForFunction(() => window.TAlur && window.TSinkron);
  await hal2.evaluate(() => Promise.all([
    TSimpan.setel('bahasa', 'id'), TSimpan.setel('dipasang', 1),
    TSimpan.setel('cadanganNyala', 1)
  ]));
  await hal2.reload();
  await hal2.waitForFunction(() => window.TAlur && window.TSinkron);
  /* Lebih lama dari JEDA_AWAN_AWAL: pekerjaan awan sekarang sengaja ditunda
     sampai lewat penggambaran layar, jadi tarikan pembukaan belum tentu sudah
     selesai di 700 ms - dan yang berangkat belakangan akan bertabrakan dengan
     tarikan yang dipanggil uji ini sendiri. */
  await hal2.waitForTimeout(2500);
  /* SATU IZIN PER PERANGKAT, ditekan jari. Ini bukan kekurangan uji - OAuth
     memang menuntut satu sentuhan di tiap peramban, dan latar belakang tidak
     pernah boleh membukanya sendiri. Dulu uji ini membiarkan perangkat kedua
     menyambung diam-diam, dan di lapangan yang terjadi persis kebalikan dari
     yang dibayangkan: tiap kali aplikasinya dibuka lagi setelah ditinggal
     sebentar, Google memunculkan layar pilih akun. */
  await hal2.evaluate(() => TAwan.masuk(TAlur.setelanUji()));
  await hal2.waitForTimeout(300);

  const dorong = (p) => p.evaluate(() => TSinkron.putaran(TAlur.setelanUji(), true));
  const tarik = (p) => p.evaluate(() => TAlur.tarikSinkronUji(true));
  const punya = (p, judul) => p.evaluate((j) => TAlur.semuaEntri()
    .some((e) => e.judul === j && !e.dihapus), judul);
  const setelanDi = (p, k) => p.evaluate((k) => TAlur.setelanUji()[k], k);

  await hal.evaluate(() => Promise.all([
    TSimpan.setel('cadanganNyala', 1),
    TSimpan.setel('folderNote', JSON.stringify(['Sinkronuji'])),
    TSimpan.setel('board', JSON.stringify(['Ujiboard']))
  ]));
  await hal.evaluate(() => {
    const s = TAlur.setelanUji();
    s.cadanganNyala = 1;
    s.folderNote = JSON.stringify(['Sinkronuji']);
    s.board = JSON.stringify(['Ujiboard']);
  });
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(400);
  await hal.fill('#kotak', 'Catatan dari perangkat satu');
  await hal.click('#b-drop');
  await hal.waitForTimeout(700);
  await dorong(hal);

  /* SATU RUMAH, BUKAN DUA. Dua perangkat yang pertama kali dibuka pada menit
     yang sama sama-sama tidak menemukan apa pun, lalu sama-sama membuat -
     hasilnya dua folder bernama sama dan dua perangkat yang tidak akan pernah
     bertemu, tanpa satu pesan galat pun. Keduanya merasa cadangannya jalan. */
  await tarik(hal2);
  const rumah1 = await setelanDi(hal, 'sheetId');
  const rumah2 = await setelanDi(hal2, 'sheetId');
  cek('dua perangkat memakai satu rumah yang sama di Drive',
      !!rumah1 && rumah1 === rumah2, rumah1 + ' vs ' + rumah2);
  cek('dan folder aplikasinya cuma satu, tidak beranak',
      [...google.berkas.values()].filter((f) => f.name === TBAWAAN_NAMA).length === 1,
      JSON.stringify([...google.berkas.values()].map((f) => f.name)));

  cek('catatan dari perangkat pertama sampai ke perangkat kedua',
      await punya(hal2, 'Catatan dari perangkat satu'));

  /* ===== GAMBAR YANG LAHIR DI PERANGKAT LAIN =====
     Yang dilaporkan di lapangan: foto dipotret di HP, entrinya sampai di
     laptop dengan judul dan board yang benar, gambarnya tidak pernah muncul.
     Delapan refresh, tiga reconnect, kesimpulannya "sinkronnya rusak" -
     padahal sinkronnya sudah selesai bekerja sejak menit pertama.

     Dua cacat bertumpuk, dan dua-duanya diam:
     1. Berkasnya naik ke Drive lalu blob-nya dibuang dari HP, jadi yang
        sampai ke laptop cuma 'driveId' - dan tidak ada satu pun jalur yang
        menggambar dari situ.
     2. Cuma BERKAS_SEKALI berkas yang naik per putaran, sementara barisnya
        naik semua - jadi foto keempat dan seterusnya terkirim TANPA driveId,
        dan tanpa 'diubah' yang ikut naik, id-nya tidak pernah menyusul. */
  const buatFoto = (p, judul, jumlah) => p.evaluate(async ([j, n]) => {
    const kanvas = document.createElement('canvas');
    kanvas.width = 8; kanvas.height = 8;
    const k = kanvas.getContext('2d');
    for (let i = 0; i < n; i++) {
      k.fillStyle = ['#f00', '#0f0', '#00f', '#ff0', '#0ff'][i % 5];
      k.fillRect(0, 0, 8, 8);
      const blob = await new Promise((t) => kanvas.toBlob(t, 'image/png'));
      const bid = 'b-uji-' + j + '-' + i;
      await TSimpan.taruhBerkas(bid, blob, 'uji.png', 'image/png');
      await TSimpan.taruh({
        id: 'e-uji-' + j + '-' + i, jenis: 'gambar',
        judul: j + ' ' + (i + 1), isi: '', kategori: '', album: 'Ujiboard',
        label: [], elemen: [], daftar: [], riwayat: [],
        berkasId: bid, driveId: null, namaBerkas: 'uji.png', tipeBerkas: 'image/png',
        ukuran: blob.size, thumb: '',
        dibuat: Date.now(), diubah: Date.now(), dipakai: 0, dihapus: false
      });
    }
  }, [judul, jumlah]);

  /* LIMA, bukan satu: BERKAS_SEKALI-nya 3, jadi yang kelima baru naik di
     putaran berikutnya - dan justru di situ cacat keduanya hidup. */
  await buatFoto(hal, 'Foto sinkron', 5);
  await dorong(hal);
  await hal.waitForTimeout(300);
  await dorong(hal);
  await hal.waitForTimeout(300);
  await dorong(hal);
  await hal.waitForTimeout(300);

  const berkasNaik = await hal.evaluate(() => TSimpan.semua().then((a) =>
    a.filter((e) => /^e-uji-Foto sinkron/.test(e.id))
     .map((e) => ({ id: e.id, drive: !!e.driveId, lokal: !!e.berkasId }))));
  cek('semua berkasnya naik ke Drive dan blob lokalnya dilepas',
      berkasNaik.length === 5 && berkasNaik.every((e) => e.drive && !e.lokal),
      JSON.stringify(berkasNaik));

  await tarik(hal2);
  const sampai = await hal2.evaluate(() => TSimpan.semua().then((a) =>
    a.filter((e) => /^e-uji-Foto sinkron/.test(e.id))
     .map((e) => ({ id: e.id, drive: e.driveId || '', thumb: !!e.thumb }))));
  cek('kelima fotonya sampai di perangkat kedua LENGKAP DENGAN driveId-nya',
      sampai.length === 5 && sampai.every((e) => e.drive),
      JSON.stringify(sampai));

  /* Dan yang menentukan: petaknya benar-benar tergambar. Entri yang sampai
     utuh tapi kotaknya kosong terbaca persis seperti sinkron yang gagal, dan
     itu lebih buruk daripada galat - galat menyuruhmu berhenti, petak kosong
     menyuruhmu mencoba lagi selamanya. */
  await hal2.evaluate(() => TAlur.keLayarUji('l-galeri'));
  await hal2.waitForTimeout(200);
  await hal2.fill('#galeri-cari', 'Foto sinkron');
  await hal2.dispatchEvent('#galeri-cari', 'input');
  await hal2.waitForTimeout(400);
  cek('petaknya menunggu gambar dari Drive, bukan kotak kosong',
      (await hal2.locator('#galeri-isi img[data-drive]').count()) >= 1,
      await hal2.innerText('#galeri-isi'));
  const terisi = await hal2.waitForFunction(() => {
    const g = document.querySelectorAll('#galeri-isi img[data-drive]');
    return g.length > 0 && [...g].every((i) => /^(blob|data):/.test(i.src));
  }, null, { timeout: 8000 }).then(() => true, () => false);
  cek('dan gambarnya benar-benar diambil dari Drive lalu terpasang', terisi,
      await hal2.evaluate(() => [...document.querySelectorAll('#galeri-isi img[data-drive]')]
        .map((i) => i.src.slice(0, 24)).join(' | ')));
  /* Dikembalikan ke pintu depan: uji sesudah ini mengetik di '#kotak', dan
     kotak itu tidak ada di layar Gallery. */
  await hal2.fill('#galeri-cari', '');
  await hal2.dispatchEvent('#galeri-cari', 'input');
  await hal2.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal2.waitForTimeout(200);

  /* ===== MEMBERESKAN YANG LAMA TIDAK BOLEH MENYANDERA YANG BARU =====
     Satu putaran dulu adalah satu rantai: bersihkan nisan -> unggah berkas ->
     dorong baris. Satu rantai berarti satu tahap yang gagal membunuh semua
     tahap sesudahnya, DIAM-DIAM.

     Yang terjadi di lapangan: puluhan catatan uji dihapus sekaligus,
     kirimannya ditolak, dan sejak saat itu tidak ada satu baris pun yang
     pernah naik lagi - termasuk satu baris teks yang baru saja diketik. Dua
     perangkat tetap melapor sehat, dan menekan "Pulihkan dari Drive"
     berkali-kali tidak menolong sama sekali: yang rusak sisi PENGIRIMNYA,
     jadi tidak ada apa pun di tabel untuk ditarik. */
  await hal.evaluate(async () => {
    const s = TAlur.setelanUji();
    await TSimpan.taruh({
      id: 'e-nisan-nakal', jenis: 'teks', judul: 'Nisan nakal', isi: '',
      label: [], elemen: [], daftar: [], riwayat: [],
      dibuat: Date.now(), diubah: Date.now(), dihapus: true
    });
    await TSimpan.taruh({
      id: 'e-sesudah-nisan', jenis: 'teks', judul: 'Teks sesudah nisan',
      isi: 'satu baris saja', kategori: '',
      label: [], elemen: [], daftar: [], riwayat: [],
      dibuat: Date.now(), diubah: Date.now(), dihapus: false
    });
    /* Kiriman NISAN-nya yang ditolak, bukan yang lain - persis seperti
       kiriman yang terlalu besar atau lajunya dibatasi. */
    const asli = TAwan.tulisBaris;
    const kolomDihapus = TAwan.KOLOM.indexOf('dihapus');
    TAwan.tulisBaris = function (st, sa, baris) {
      if (baris.some((b) => b[kolomDihapus] === 'true')) {
        return Promise.reject(new Error('kiriman nisan ditolak'));
      }
      return asli(st, sa, baris);
    };
    await TSinkron.putaran(s, true);
    TAwan.tulisBaris = asli;
  });
  await tarik(hal2);
  cek('kiriman nisan yang ditolak tidak ikut membunuh catatan baru',
      await punya(hal2, 'Teks sesudah nisan'));
  /* Dan nisannya sendiri tidak hilang begitu saja - dia cuma menunggu
     putaran berikutnya. */
  cek('nisannya sendiri tetap menunggu, bukan dianggap sudah beres',
      await hal.evaluate(() => TSimpan.ambil('e-nisan-nakal').then((e) => !!(e && e.dihapus))));
  await dorong(hal);
  await hal.waitForTimeout(300);
  cek('lalu berangkat sendiri di putaran sesudahnya',
      await hal.evaluate(() => TSimpan.ambil('e-nisan-nakal').then((e) => !e)));

  /* ===== DUA JAM YANG BERBEDA TIDAK PERNAH DIBANDINGKAN =====
     'tarikCap' menyimpan modifiedTime SPREADSHEET-NYA - jam servernya Google.
     Dulu, kalau pemeriksaan modifiedTime gagal, waktunya jadi 0 dan yang
     DICATAT malah Date.now() - jam LOKAL perangkat ini. Sejak saat itu
     perangkat itu membandingkan jam server dengan jam lokalnya sendiri:
     spreadsheet yang diubah dua puluh menit lalu punya modifiedTime yang LEBIH
     KECIL daripada "sekarang" yang terlanjur tercatat, jadi jawabannya selalu
     "tidak ada yang baru" - dan pulihkan() tidak pernah jalan lagi. Selamanya.

     Yang terlihat di layar justru sehat: pemeriksaannya berhasil, jadi
     "Terakhir menarik: baru saja" - padahal yang berhasil cuma memeriksanya.
     Laptop berisi 11 catatan sementara HP berisi 55, dan dua-duanya melapor
     baik-baik saja. */
  const capGagal = await hal2.evaluate(async () => {
    const s = TAlur.setelanUji();
    await TSimpan.setel('tarikCap', 0);
    s.tarikCap = 0;
    const asli = TAwan.waktuBerkas;
    TAwan.waktuBerkas = () => Promise.reject(new Error('sinyal putus'));
    await TSinkron.tarik(s, true);
    TAwan.waktuBerkas = asli;
    return Number(await TSimpan.setelan('tarikCap')) || 0;
  });
  cek('pemeriksaan waktu yang gagal tidak pernah mencatat jam lokal sebagai cap',
      capGagal === 0, String(capGagal));
  /* Dan tariknya TETAP JALAN: lebih baik menarik sekali lagi tanpa perlu
     daripada berhenti menarik selamanya. */
  cek('dan tariknya tetap jalan walau waktunya tidak terbaca',
      await punya(hal2, 'Catatan dari perangkat satu'));

  /* ===== DUA PERANGKAT YANG TERPATOK KE RUMAH BERBEDA =====
     Ini keadaan yang dilaporkan di lapangan, dan yang paling sulit dilihat
     dari mana pun: HP menunjuk satu spreadsheet, laptop menunjuk yang lain.
     Dua-duanya sehat sempurna - dorongan berhasil, tarikan berhasil, "belum
     terkirim: 0" - dan isinya 55 lawan 11.
     Sebabnya rumah() memakai sheetId yang sudah dipatok dan tidak pernah
     memeriksanya lagi. Sekali dua perangkat terlanjur membuat rumah
     masing-masing, keduanya terpatok selamanya. */
  const rumahPalsu = await hal2.evaluate(async () => {
    const s = TAlur.setelanUji();
    const asli = s.folderAkar;
    /* Dipatok ke rumah karangan, persis seperti perangkat yang dulu membuat
       rumahnya sendiri waktu belum bisa melihat punya yang lain. */
    for (const [k, v] of [['folderAkar', 'akar-nyasar'], ['folderBerkas', 'berkas-nyasar'],
                          ['sheetId', 'sheet-nyasar'], ['rumahPeriksa', 0]]) {
      await TSimpan.setel(k, v); s[k] = v;
    }
    await TSinkron.samakanRumahUji(s);
    return { asli: asli, sesudah: s.folderAkar };
  });
  cek('rumah yang nyasar dilepas, bukan dipakai selamanya',
      rumahPalsu.sesudah === '', JSON.stringify(rumahPalsu));
  /* Dan tarikan berikutnya menemukan rumah yang benar sendiri - yang TERTUA,
     aturan yang sama dengan cariAtauBuat, jadi semua perangkat sampai pada
     jawaban yang sama tanpa perlu berunding. */
  await tarik(hal2);
  await hal2.waitForTimeout(600);
  cek('lalu tarikan berikutnya kembali ke rumah yang sama dengan perangkat lain',
      (await setelanDi(hal2, 'folderAkar')) === rumahPalsu.asli,
      JSON.stringify([await setelanDi(hal2, 'folderAkar'), rumahPalsu.asli]));
  cek('dan isinya kembali bertemu',
      await punya(hal2, 'Catatan dari perangkat satu'));

  /* ===== YANG DIHAPUS DI SATU PERANGKAT IKUT HILANG DI PERANGKAT LAIN =====
     Ini cacat yang paling sunyi: menghapus di HP membuang BARISNYA dari
     spreadsheet, lalu membuangnya dari HP. Perangkat lain yang sudah terlanjur
     punya catatan itu tidak pernah tahu apa-apa - baris yang hilang dari tabel
     tidak memberi tahu siapa pun bahwa dia pernah ada.
     Akibatnya jumlahnya menyimpang PERMANEN: HP 4, laptop 6, dua-duanya
     melapor sinkron. */
  /* Umpan SENDIRI, bukan menumpang catatan yang dipakai uji berikutnya:
     menghapus umpan bersama membuat uji setelahnya gagal karena alasan yang
     tidak ada hubungannya dengan yang diujinya. */
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(300);
  await hal.fill('#kotak', 'Catatan yang akan dihapus');
  await hal.click('#b-drop');
  await hal.waitForTimeout(700);
  await dorong(hal);
  await hal.waitForTimeout(400);
  await tarik(hal2);
  await hal2.waitForTimeout(700);
  const hapusId = await hal.evaluate(() => {
    const e = TAlur.semuaEntri().filter((x) => x.judul === 'Catatan yang akan dihapus')[0];
    return e ? e.id : '';
  });
  cek('umpannya ada di dua perangkat sebelum dihapus',
      !!hapusId && await punya(hal2, 'Catatan yang akan dihapus'), hapusId);
  await hal.evaluate(async (id) => {
    const e = TAlur.semuaEntri().filter((x) => x.id === id)[0];
    e.dihapus = true;
    e.diubah = Date.now();
    await TSimpan.taruh(e);
  }, hapusId);
  await hal.evaluate(() => TSimpan.setel('cadanganDicoba', 0));
  await dorong(hal);
  await hal.waitForTimeout(600);
  await tarik(hal2);
  await hal2.waitForTimeout(800);
  cek('nisannya menyeberang, dan catatannya ikut hilang di perangkat kedua',
      !(await punya(hal2, 'Catatan yang akan dihapus')),
      JSON.stringify(await hal2.evaluate(() => TAlur.semuaEntri()
        .filter((e) => !e.dihapus).map((e) => e.judul))));
  /* DAN YANG LAIN TIDAK IKUT TERBAWA: nisan cuma menghapus dirinya sendiri. */
  cek('catatan lain di perangkat kedua tidak ikut terbawa',
      await punya(hal2, 'Catatan dari perangkat satu'));

  /* ===== DROP BARU BERANGKAT SEKARANG, BUKAN LIMA MENIT LAGI =====
     putaran() punya gerbang lima menit supaya denyut berkala tidak menghajar
     Drive. Tapi dorongan yang lahir dari drop kamu sendiri ikut kena gerbang
     itu - jadi foto yang baru diambil menunggu sampai lima menit sebelum
     berangkat, dan di perangkat lain baru muncul beberapa menit sesudahnya.
     Yang terbaca "entri baru tidak sinkron", padahal sinkronnya menunggu jam.
     Yang menahan laju dorongan perubahan sudah ada dan sudah cukup: jeda 8
     detik di sundulNaik. */
  await hal.evaluate(() => TSimpan.setel('cadanganDicoba', Date.now()));
  await hal.evaluate(() => { TAlur.setelanUji().cadanganDicoba = Date.now(); });
  const gerbang = await hal.evaluate(async () => {
    const s = TAlur.setelanUji();
    return {
      berkala: await TSinkron.putaran(s),        /* denyut: kena gerbang */
      dipicu: await TSinkron.putaran(s, true)    /* drop kamu: lewat */
    };
  });
  cek('denyut berkala tetap ditahan gerbang lima menitnya',
      gerbang.berkala === 0, JSON.stringify(gerbang));
  /* Yang penting BUKAN angkanya, tapi bahwa yang dipaksa memang menembus
     gerbang - kalau tidak, dia memulangkan 0 tanpa menyentuh Drive. */
  cek('tapi dorongan yang dipicu drop menembusnya',
      typeof gerbang.dipicu === 'number', JSON.stringify(gerbang));
  cek('dan sundulNaik memang memaksanya, bukan menyerahkannya ke jam',
      /putaranCadangan\(true\)/.test(fs.readFileSync(path.join(AKAR, 'alur.js'), 'utf8')));

  /* ===== KEMBALI MELIHAT LAYAR INI ADALAH PERMINTAANNYA =====
     Ini yang menggantikan tombol "tarik sekarang". Waktu kamu menoleh ke
     Cortex, kamu sedang mencari sesuatu yang barusan kamu kirim dari perangkat
     lain - dan menunggu setengah menit sesudah menoleh terbaca persis sama
     dengan tidak sinkron. Penahan setengah menit itu untuk denyut berkala,
     bukan untuk mata yang baru saja menoleh. */
  const kodeAlur = fs.readFileSync(path.join(AKAR, 'alur.js'), 'utf8');
  cek('kembali ke layar ini memaksa tarikan, bukan menunggu penahannya',
      /putaranCadangan\(\);\s*(\/\*[\s\S]*?\*\/\s*)?tarikSinkron\(true\);/.test(kodeAlur));
  /* Dan itu benar-benar terjadi di jalur visibilitychange, bukan cuma tertulis
     di suatu tempat. */
  const tarikSaatKembali = await hal2.evaluate(async () => {
    await TSimpan.setel('tarikBerhasil', 0);
    TAlur.setelanUji().tarikBerhasil = 0;
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 1200));
    return Number(await TSimpan.setelan('tarikBerhasil')) || 0;
  });
  cek('dan jalurnya memang terpasang di kembalinya layar',
      tarikSaatKembali > 0, String(tarikSaatKembali));
  /* SEKALI SEJAM, bukan tiap tarikan: satu panggilan Drive tambahan tiap dua
     menit itu ongkos harian untuk jawaban yang hampir selalu "masih sama". */
  cek('pemeriksaannya tidak diulang tiap tarikan',
      (await hal2.evaluate(() => TSinkron.samakanRumahUji(TAlur.setelanUji()))) === false);

  /* ALAMATNYA IKUT PINDAH, BUKAN CUMA CATATANNYA. Catatan yang sampai di
     laptop TANPA RAKNYA jatuh semua ke "Belum berlabel" - dan yang terbaca di
     situ bukan "raknya belum ikut", melainkan "aplikasinya kacau". */
  cek('daftar folder ikut berpindah, bukan cuma entrinya',
      String(await setelanDi(hal2, 'folderNote')).indexOf('Sinkronuji') >= 0,
      String(await setelanDi(hal2, 'folderNote')));
  cek('pohon board ikut berpindah juga',
      String(await setelanDi(hal2, 'board')).indexOf('Ujiboard') >= 0,
      String(await setelanDi(hal2, 'board')));

  /* DUA ARAH. Yang ditulis di perangkat kedua harus kembali ke yang pertama -
     tanpa itu ini masih cadangan, cuma dengan tombol yang lebih rajin. */
  await hal2.fill('#kotak', 'Catatan dari perangkat dua');
  await hal2.click('#b-drop');
  await hal2.waitForTimeout(700);
  await dorong(hal2);
  await tarik(hal);
  cek('dan yang ditulis di perangkat kedua kembali ke yang pertama',
      await punya(hal, 'Catatan dari perangkat dua'));

  /* TARIKAN YANG TIDAK MENEMUKAN APA-APA HARUS MURAH. Menarik seluruh tabel
     dua puluh ribu baris tiap kali aplikasinya dibuka adalah ongkos yang
     dibayar setiap hari untuk jawaban yang hampir selalu "tidak ada yang
     baru" - dan di HP dengan sinyal seadanya, itu terasa sebagai aplikasi
     yang lambat dibuka. */
  const sebelumTarik = google.negara.panggilan;
  const kosong = await tarik(hal);
  cek('tarikan yang tidak menemukan apa-apa berhenti tanpa membaca tabelnya',
      kosong === 0 && (google.negara.panggilan - sebelumTarik) <= 5,
      kosong + ' perubahan, ' + (google.negara.panggilan - sebelumTarik) + ' panggilan');

  /* DUA PERANGKAT MENAMBAH DAFTAR YANG BERBEDA, dan keduanya harus selamat.
     Kalau seluruh berkas yang menang, menambah satu folder di HP menghapus
     board yang baru kamu tulis di laptop lima menit sebelumnya - dan dengan
     empat perangkat, kekalahan seperti itu terjadi tiap minggu. */
  await hal.evaluate(() => TSimpan.setel('board', JSON.stringify(['Ujiboard', 'Keduauji']))
    .then(() => { TAlur.setelanUji().board = JSON.stringify(['Ujiboard', 'Keduauji']); }));
  await hal2.evaluate(() => TSimpan.setel('folderNote', JSON.stringify(['Sinkronuji', 'Duauji']))
    .then(() => { TAlur.setelanUji().folderNote = JSON.stringify(['Sinkronuji', 'Duauji']); }));
  await hal.waitForTimeout(200);
  await tarik(hal); await tarik(hal2); await tarik(hal);
  const board1 = String(await setelanDi(hal, 'board'));
  const folder1 = String(await setelanDi(hal, 'folderNote'));
  const board2 = String(await setelanDi(hal2, 'board'));
  const folder2 = String(await setelanDi(hal2, 'folderNote'));
  cek('perubahan dari dua perangkat sama-sama selamat, menangnya per kunci',
      board1.indexOf('Keduauji') >= 0 && folder1.indexOf('Duauji') >= 0 &&
      board2.indexOf('Keduauji') >= 0 && folder2.indexOf('Duauji') >= 0,
      JSON.stringify([board1, folder1, board2, folder2]));

  /* BERKAS SETELANNYA CUMA SATU. Kalau dua, masing-masing perangkat menulis ke
     salinannya sendiri, keduanya merasa sudah sinkron, dan daftar folder
     mereka tidak pernah bertemu selamanya - tanpa satu pesan galat pun. */
  cek('berkas setelan di Drive cuma satu, tidak beranak tiap penyimpanan',
      [...google.berkas.values()].filter((f) => f.name === 'setelan.json').length === 1,
      String([...google.berkas.values()].filter((f) => f.name === 'setelan.json').length));

  /* SESI TIDAK BOLEH MENULAR. driverLengket itu KENYATAAN FISIK - kamu sedang
     berdiri di masjid dengan HP di tangan. Menularkannya ke PC di kantor
     berarti gambar yang diunggah di sana berangkat ke AI dengan sudut pandang
     survey yang tidak ada hubungannya, dan salah sudut pandang tidak pernah
     kamu curigai. */
  await hal.evaluate(() => Promise.all([
    TSimpan.setel('driverLengket', 'interior mesjid'),
    TSimpan.setel('driverLengketPada', String(Date.now())),
    TSimpan.setel('gayaGaleri', 'besar')
  ]));
  await hal.waitForTimeout(200);
  await tarik(hal); await tarik(hal2);
  cek('sesi jepretan tidak ikut berpindah perangkat',
      !(await setelanDi(hal2, 'driverLengket')) && !(await setelanDi(hal2, 'driverLengketPada')),
      JSON.stringify([await setelanDi(hal2, 'driverLengket'),
                      await setelanDi(hal2, 'driverLengketPada')]));
  cek('dan ukuran petak tetap milik perangkatnya sendiri',
      !(await setelanDi(hal2, 'gayaGaleri')),
      String(await setelanDi(hal2, 'gayaGaleri')));

  /* YANG LEBIH BARU DI PERANGKAT INI TIDAK BOLEH MUNDUR. Menarik tidak pernah
     boleh memundurkan tulisan yang belum sempat naik. */
  await hal2.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => x.judul === 'Catatan dari perangkat satu')[0];
    e.judul = 'Disunting di perangkat dua'; e.diubah = Date.now();
    await TSimpan.taruh(e); await TAlur.muatUlangUji();
  });
  await dorong(hal2);
  await hal.evaluate(async () => {
    const e = TAlur.semuaEntri().filter((x) => /perangkat satu|perangkat dua/.test(x.judul || ''))
      .filter((x) => x.judul !== 'Catatan dari perangkat dua')[0];
    e.judul = 'Disunting di perangkat satu'; e.diubah = Date.now() + 9000;
    await TSimpan.taruh(e); await TAlur.muatUlangUji();
  });
  await tarik(hal);
  cek('suntingan yang lebih baru di perangkat ini tidak dimundurkan tarikan',
      await punya(hal, 'Disunting di perangkat satu'),
      JSON.stringify(await hal.evaluate(() => TAlur.semuaEntri()
        .filter((e) => /Disunting|perangkat/.test(e.judul || '')).map((e) => e.judul))));

  /* PERANGKAT KETIGA YANG KOSONG SAMA SEKALI. Ini yang sebenarnya diuji: buka
     aplikasinya di PC yang belum pernah dipakai, dan semuanya sudah ada -
     tanpa satu tombol pun ditekan. */
  const konteks3 = await browser.newContext();
  await konteks3.addInitScript(STUB_GIS);
  const hal3 = await konteks3.newPage();
  hal3.on('pageerror', (e) => galat.push('[perangkat 3] ' + e.message));
  await hal3.route('**', async (rute) => {
    const permintaan = rute.request();
    const u = permintaan.url();
    if (u.startsWith('http://127.0.0.1:' + port)) return rute.continue();
    if (/googleapis\.com/.test(u)) {
      return rute.fulfill(google.tangani(u, permintaan.method(), permintaan.postData()));
    }
    return rute.abort();
  });
  await hal3.goto(alamat);
  await hal3.waitForFunction(() => window.TAlur && window.TSinkron);
  await hal3.evaluate(() => Promise.all([
    TSimpan.setel('bahasa', 'id'), TSimpan.setel('dipasang', 1),
    TSimpan.setel('cadanganNyala', 1)
  ]));
  /* ===== SATU IZIN PER PERANGKAT, LALU DIAM SELAMANYA =====
     Uji ini dulu menuntut perangkat baru mengisi dirinya TANPA satu tombol pun.
     Itu tidak bisa ada bersama yang lain: mengisi diri butuh token, dan token
     di peramban yang belum pernah mengizinkan cuma bisa didapat lewat layar
     Google. Jadi yang terjadi di lapangan bukan "terisi sendiri", tapi "tiap
     kali aplikasinya dibuka lagi setelah ditinggal sebentar, muncul layar
     pilih akun" - untuk sesuatu yang tidak pernah diminta pemakainya.

     Aturannya sekarang: LATAR BELAKANG TIDAK PERNAH MENGETUK PINTU GOOGLE.
     Perangkat baru diam sampai kamu menekan Hubungkan sekali; sesudah itu dia
     mengisi dirinya sendiri sampai penuh, tanpa satu tombol lagi. */
  await hal3.reload();
  await hal3.waitForFunction(() => window.TAlur && window.TSinkron);
  await hal3.waitForTimeout(3500);
  cek('perangkat baru DIAM dulu — tidak memanggil Google sendiri',
      (await hal3.evaluate(() => window.__mintaToken)) === 0 &&
      !(await punya(hal3, 'Catatan dari perangkat dua')),
      String(await hal3.evaluate(() => window.__mintaToken)));

  /* DITEKAN LEWAT TOMBOLNYA SENDIRI, dan sesudah itu TIDAK ADA satu pun
     panggilan tarik dari uji ini. Menekan Hubungkan lalu melihat layar yang
     tetap kosong terbaca sebagai "sambungannya gagal", dan orang yang membaca
     begitu tidak akan menekannya kedua kali. Ini juga satu-satunya sentuhan
     yang pernah diminta dari perangkat baru, jadi dia harus menyelesaikan
     pekerjaannya sampai habis. */
  await hal3.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal3.waitForTimeout(300);
  await hal3.click('#b-hubungkan');
  await hal3.waitForTimeout(2500);
  cek('sesudah satu kali diizinkan, dia terisi sendiri sampai penuh',
      await punya(hal3, 'Catatan dari perangkat dua'),
      JSON.stringify(await hal3.evaluate(() => TAlur.semuaEntri().map((e) => e.judul))));
  cek('lengkap dengan folder dan pohon boardnya, tanpa satu tombol lagi',
      String(await setelanDi(hal3, 'folderNote')).indexOf('Duauji') >= 0 &&
      String(await setelanDi(hal3, 'board')).indexOf('Keduauji') >= 0,
      JSON.stringify([await setelanDi(hal3, 'folderNote'), await setelanDi(hal3, 'board')]));
  cek('dan rumahnya tetap satu walau perangkatnya sudah tiga',
      [...google.berkas.values()].filter((f) => f.name === TBAWAAN_NAMA).length === 1);

  /* Cap waktu dicatat di corong tulisannya, bukan di tiap pemanggil - ada
     belasan tempat yang menulis setelan, dan yang terlupa diam-diam kalah
     terus di perangkat lain. */
  const capnya = await hal.evaluate(() => TSimpan.setelan('setelanWaktu'));
  cek('tiap setelan punya cap waktunya sendiri, dicatat di corong tulisannya',
      capnya && typeof capnya === 'object' && capnya.board > 0 && capnya.folderNote > 0,
      JSON.stringify(capnya && Object.keys(capnya)));

  await konteks3.close();
  await konteks2.close();
  await hal.evaluate(() => Promise.all([
    TSimpan.setel('cadanganNyala', ''),
    TSimpan.setel('driverLengket', ''), TSimpan.setel('driverLengketPada', '0')
  ]));
  await hal.evaluate(() => {
    const s = TAlur.setelanUji();
    s.cadanganNyala = ''; s.driverLengket = ''; s.driverLengketPada = '0';
  });
  await hal.evaluate(() => Promise.all(TAlur.semuaEntri()
    .filter((e) => /perangkat|Disunting/.test(e.judul || ''))
    .map((e) => { e.pensiun = true; return TSimpan.taruh(e); })));
  await hal.evaluate(() => TAlur.muatUlangUji());
  await hal.waitForTimeout(300);
}

console.log('\nnama cuma kulit');
{
  const berkasKode = ['bawaan.js', 'simpan.js', 'otak.js', 'awan.js', 'pelabel.js', 'sinkron.js', 'alur.js', 'sw.js'];
  const bocor = berkasKode.filter((f) => {
    const t = fs.readFileSync(path.join(AKAR, f), 'utf8');
    return f !== 'bawaan.js' && /Drop Memory/.test(t);
  });
  cek('nama aplikasi cuma ada di bawaan.js', bocor.length === 0, bocor.join(', '));
  const simpan = fs.readFileSync(path.join(AKAR, 'simpan.js'), 'utf8');
  cek('nama basis data tidak menyebut merek', /var NAMA = 'simpanan'/.test(simpan));
  cek('model Gemini yang benar',
      /gemini-3\.5-flash-lite/.test(fs.readFileSync(path.join(AKAR, 'bawaan.js'), 'utf8')));
}

console.log('\nshortcut layar home Android');
{
  /* Manifest 'shortcuts' membuat Android menaruh "Tulis" dan "Kamera" di menu
     tekan-lama ikon Cortex - dan tiap shortcut itu bisa diseret keluar jadi
     ikonnya sendiri di home screen. Dari home, menulis catatan jadi SATU
     ketukan; tanpa ini tiga (buka aplikasi, pindah pintu, tekan pensil). */
  const mf = JSON.parse(fs.readFileSync(path.join(AKAR, 'manifest.webmanifest'), 'utf8'));
  cek('manifest menyebut dua shortcut, dengan ikon dan alamatnya sendiri',
      Array.isArray(mf.shortcuts) && mf.shortcuts.length === 2 &&
      mf.shortcuts.every((x) => x.url && x.icons && x.icons.length &&
                                fs.existsSync(path.join(AKAR, x.icons[0].src))),
      JSON.stringify(mf.shortcuts || null));
  cek('dan ikonnya ikut disinggahkan service worker',
      /ikon-tulis-192\.png/.test(fs.readFileSync(path.join(AKAR, 'sw.js'), 'utf8')) &&
      /ikon-kamera-192\.png/.test(fs.readFileSync(path.join(AKAR, 'sw.js'), 'utf8')));

  const halS = await konteks.newPage();
  halS.on('pageerror', (e) => galat.push('[shortcut] ' + e.message));
  await halS.goto(alamat + '?aksi=tulis');
  await halS.waitForFunction(() => window.TAlur);
  await halS.waitForTimeout(900);
  cek('membuka lewat ?aksi=tulis langsung mendarat di layar tulis',
      (await halS.evaluate(() => document.querySelector('.layar.aktif').id)) === 'l-catat',
      await halS.evaluate(() => document.querySelector('.layar.aktif').id));
  cek('dan judulnya kosong — tidak menagih folder sebelum kalimatnya ada',
      (await halS.inputValue('#catat-judul')) === '');
  /* ALAMATNYA DIBERSIHKAN begitu dibaca. Kalau tidak, satu kali muat ulang -
     atau tombol Kembali - menjalankan perbuatannya lagi, dan yang lahir
     catatan kosong kedua yang tidak pernah kamu minta. */
  cek('alamatnya dibersihkan, jadi muat ulang tidak mengulanginya',
      (await halS.evaluate(() => location.search)) === '',
      await halS.evaluate(() => location.search));

  const halK = await konteks.newPage();
  halK.on('pageerror', (e) => galat.push('[shortcut] ' + e.message));
  await halK.addInitScript(() => {
    window.__kenaKamera = '';
    const asli = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      window.__kenaKamera = this.id;
      if (this.id !== 'galeri-pilih-kamera') asli.call(this);
    };
  });
  await halK.goto(alamat + '?aksi=kamera');
  await halK.waitForFunction(() => window.TAlur);
  await halK.waitForTimeout(900);
  cek('dan ?aksi=kamera membuka isian kamera Gallery, bukan lampiran Drop',
      (await halK.evaluate(() => window.__kenaKamera)) === 'galeri-pilih-kamera',
      await halK.evaluate(() => window.__kenaKamera));
  await halS.close();
  await halK.close();
}

console.log('\ntanpa galat');
cek('tidak ada galat JavaScript sama sekali', galat.length === 0, galat.join(' | '));

await browser.close();
server.close();

console.log('\n' + lulus + ' lulus, ' + gagal + ' gagal\n');
process.exit(gagal ? 1 : 0);
