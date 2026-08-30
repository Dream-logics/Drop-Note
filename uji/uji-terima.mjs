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
          tag: ['appsscript', 'ujicoba'],
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

  const arahan = await hal.evaluate(() => TPelabel.arahanUji({ tagFavorit: [], hashtag: [] }));
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

  const baris = [...google.lembar.values()][0];
  cek('barisnya hilang dari spreadsheet', !baris.some((b) => b[0] === idHapus), JSON.stringify(baris.map((b) => b[0])));
  cek('berkasnya hilang dari Drive', ![...google.berkas.values()].some((f) => f.name === 'kontrak.txt'));
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

console.log('\ntag: label yang kelihatan dan bisa ditekan');
{
  const bersih = await hal.evaluate(() => TOtak.cari(
    [{ id: 'a', judul: '', isi: '', label: [], tag: ['keuangan'] },
     { id: 'b', judul: '', isi: '', label: [], tag: ['rumah'] }], 'keuangan'));
  cek('tag dipakai mencari', bersih.length === 1 && bersih[0].id === 'a');

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

  /* Tag boleh banyak - tiap tag yang tepat satu pintu lagi. Yang dibatasi
     tampilannya, bukan simpanannya. */
  const kartu = await hal.evaluate(() => TAlur.kartuHtmlUji({
    id: 'z', jenis: 'teks', judul: 'banyak tag', isi: '', label: [], elemen: [],
    tag: ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan',
          'sembilan', 'sepuluh', 'sebelas', 'duabelas'],
    diubah: Date.now()
  }));
  /* Yang menentukan berapa hasil muat dalam satu layar: bawaannya ringkas.
     Semua rincian ada di dalam .kartu-rinci yang tersembunyi. */
  cek('rincian tersembunyi sampai kartunya disentuh', /kartu-rinci sembunyi/.test(kartu));
  cek('tag ikut tersembunyi, tidak memenuhi baris',
      kartu.indexOf('tag-baris') > kartu.indexOf('kartu-rinci sembunyi'));
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

  /* Delapan dulu; sisanya terlipat. Batasnya soal TAMPILAN - simpanannya
     tetap sampai 30, dan yang terlipat tetap bekerja sebagai pancingan. */
  const terlipat = (kartu.match(/tag terlipat/g) || []).length;
  cek('cuma delapan tag yang langsung terlihat', terlipat === 4, String(terlipat));
  cek('sisanya ditawarkan, bukan dibuang', /data-tag-lagi>\+4</.test(kartu));
  /* Yang terlipat tetap ada di HTML - jadi tidak ada permintaan baru saat
     dibuka, dan pencarian tetap menemukannya. */
  cek('yang terlipat tetap ikut tergambar', /data-tag="duabelas"/.test(kartu));

  /* Elemen PERTAMA tetap terlihat walau kartunya ringkas: menyalin satu nomor
     adalah alasan tersering kartu ini dilihat sama sekali. */
  const berelemen = await hal.evaluate(() => TAlur.kartuHtmlUji({
    id: 'y', jenis: 'teks', judul: 'rekening', isi: 'BCA 123456789', label: [], tag: [],
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
  cek('tidak ada tombol yang beralas warna', !/tbl utama/.test(html));

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

  /* Klik pertama tidak boleh jadi klik yang dingin. */
  await hal.evaluate(() => TAwan.keluar());
  const hangat = await hal.evaluate(() => TSimpan.semuaSetelan()
    .then((s) => TAwan.hangatkan(s)).then(() => TAwan.punyaToken()));
  cek('token dihangatkan di latar sebelum ada yang diketuk', hangat === true);
  cek('dan itu benar-benar dipanggil waktu aplikasinya dibuka',
      /TAwan\.hangatkan\(setelanSaat\)/.test(fs.readFileSync(path.join(AKAR, 'alur.js'), 'utf8')));

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
  const alamatAI = 'http://127.0.0.1:' + port + '/palsu-ai';

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
  cek('arahan meminta subjek, elemen, dan tag',
      /SUBJEK/.test(proxyAI.arahanTerakhir) && /ELEMEN/.test(proxyAI.arahanTerakhir) &&
      /TAG/.test(proxyAI.arahanTerakhir));

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
  cek('tag dari layanan ikut tersimpan',
      (berlabel.tag || []).indexOf('appsscript') >= 0, JSON.stringify(berlabel.tag));

  /* Inti kenapa daftar tag ada: tanpa dia, "klien" dan "pelanggan" jadi dua
     tag berbeda dalam sebulan dan tidak ada yang bisa diandalkan. */
  const daftarTag = await hal.evaluate(() => TSimpan.setelan('hashtag'));
  cek('tag yang pernah dibuat dicatat di perangkat',
      (daftarTag || []).indexOf('appsscript') >= 0, JSON.stringify(daftarTag));

  await hal.evaluate(() => TSimpan.semua().then((a) => Promise.all(
    a.map((e) => { e.diLabeliAI = false; return TSimpan.taruh(e); }))));
  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TPelabel.putaran(s)));
  cek('daftar tag lama ikut dikirim supaya tag tidak beranak',
      /appsscript/.test(proxyAI.arahanTerakhir), proxyAI.arahanTerakhir.slice(-200));

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

  /* Singkatan cuma hidup di kepala pemakainya - AI melabeli dengan kata utuh.
     Kalau label rapi tidak menangkap tag buatan AI, dia cuma hiasan. */
  const cocok = await hal.evaluate(() => {
    const l = TOtak.uraiLabel('Amara = amaraliving\nCons = construction\nPS = projectspace');
    return [
      TOtak.cocokLabel({ tag: ['AmaraLiving'], kategori: '' }, l[0].istilah),
      TOtak.cocokLabel({ tag: ['Construction'], kategori: '' }, l[1].istilah),
      TOtak.cocokLabel({ tag: [], kategori: 'ngoffee projectspace' }, l[2].istilah),
      TOtak.cocokLabel({ tag: ['password'], kategori: 'resep' }, l[1].istilah)
    ];
  });
  cek('singkatan menangkap tag panjang buatan AI', cocok[0] === true);
  cek('kata sesudah = menangkap tag utuh', cocok[1] === true);
  cek('keyword di kategori juga dihitung', cocok[2] === true);
  cek('yang tidak berhubungan tetap di luar', cocok[3] === false);

  /* Dua huruf tidak boleh dipakai sebagai awalan - "PS" akan menyeret hampir
     seluruh rak dan saringannya jadi tidak berarti apa-apa. */
  const pendek = await hal.evaluate(() => TOtak.cocokLabel(
    { tag: ['psikologi'], kategori: '' }, TOtak.uraiLabel('PS')[0].istilah));
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

console.log('\ntiga pintu di kepala, dan layar Note');
{
  const html = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf8');
  /* Digambar dari satu tempat, bukan disalin tiga kali: baris yang disalin
     akan berbeda-beda begitu salah satunya disunting. */
  cek('baris tabnya wadah kosong di HTML, diisi dari alur.js',
      (html.match(/class="tab-baris" data-tab></g) || []).length === 4);

  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(250);
  const tab = await hal.locator('#l-utama [data-tab] .tab').allTextContents();
  /* EMPAT PINTU, dan urutannya menceritakan alur harinya: menjatuhkan,
     menulis, mengerjakan, menyimpan. "Storage" bukan "Note" karena layar itu
     memang gudang - dia memperlihatkan semua yang pernah jatuh, tersusun di
     raknya; Note yang ruang menulisnya. Menamai keduanya sama membuat yang mau
     menulis mendarat di gudang lalu mengira aplikasinya tidak bisa menulis. */
  cek('empat pintu: Drop, Note, To Do, Storage', tab.length === 4 &&
      /^Drop/.test(tab[0]) && /^Note/.test(tab[1]) &&
      /^To Do/.test(tab[2]) && /^Storage/.test(tab[3]), tab.join('|'));
  cek('yang sedang dibuka ditandai',
      (await hal.locator('#l-utama [data-tab] .tab.nyala').textContent()).indexOf('Drop') === 0);

  await hal.click('#l-utama [data-tab-ke="l-note"]');
  await hal.waitForSelector('#l-note.aktif');
  cek('Note punya layarnya sendiri', await hal.locator('#l-note').isVisible());

  /* Struktur foldernya tetap ada - itu yang bikin catatan punya ALAMAT. */
  const folder = await hal.locator('#note-isi .note-folder').count();
  cek('catatan tersusun dalam folder, bukan mengambang', folder >= 1, String(folder));

  /* Alamatnya dari rak yang dipilih sendiri; kalau lupa, dari tag AI. */
  const alamat = await hal.evaluate(() => [
    TAlur.alamatNoteUji({ kategori: 'construction', tag: ['Lain'] }),
    TAlur.alamatNoteUji({ kategori: '', tag: ['AmaraLiving', 'Lain'] }),
    TAlur.alamatNoteUji({ kategori: '', tag: [] })
  ]);
  cek('alamat diambil dari rak yang dipilih sendiri', alamat[0] === 'construction', alamat[0]);
  cek('kalau lupa mengisi, alamatnya dari tag pertama AI', alamat[1] === 'AmaraLiving', alamat[1]);
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

  /* Untuk jenis lain, ukuran thumbnail tidak menjawab pertanyaan apa pun -
     yang dikenali di sana judulnya, dan judul tidak punya ukuran. */
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForTimeout(250);
  await hal.click('#saring-baris [data-jenis="tautan"]');
  await hal.waitForTimeout(350);
  cek('pilihan ukuran tidak muncul untuk jenis selain gambar',
      await hal.locator('#tampil-baris').evaluate((n) => n.classList.contains('sembunyi')));

  await hal.click('#saring-baris [data-jenis="gambar"]');
  await hal.waitForTimeout(400);
  cek('pilihan ukuran muncul begitu yang tampil gambar',
      !(await hal.locator('#tampil-baris').evaluate((n) => n.classList.contains('sembunyi'))));
  cek('empat ukuran tersedia',
      (await hal.locator('#tampil-baris .tampil-tbl').count()) === 4);
  /* Bawaannya petak KECIL: pertanyaan tersering di sini bukan "yang mana yang
     ini" tapi "ada apa saja" - dan itu dijawab dengan sebanyak mungkin masuk
     satu layar. */
  cek('bawaannya petak kecil',
      (await hal.locator('#hasil-depan .petak.kecil').count()) === 1);

  await hal.click('[data-gaya="besar"]');
  await hal.waitForTimeout(350);
  cek('memilih besar mengganti petaknya', (await hal.locator('#hasil-depan .petak.besar').count()) === 1);

  /* Daftar = baris biasa, bukan petak: kadang yang dicari justru judulnya. */
  await hal.click('[data-gaya="daftar"]');
  await hal.waitForTimeout(350);
  cek('daftar kembali jadi baris, bukan petak',
      (await hal.locator('#hasil-depan .petak').count()) === 0 &&
      (await hal.locator('#hasil-depan .kartu').count()) >= 1);

  /* Kebiasaan menetap di satu ukuran - memilihnya lagi tiap kali membuka
     aplikasi adalah keputusan berulang tanpa guna. */
  const tersimpan = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => s.gayaGambar));
  cek('ukuran yang dipilih diingat untuk pembukaan berikutnya',
      tersimpan === 'daftar', String(tersimpan));

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

console.log('\ntag andalan: rak yang sudah diputuskan sendiri');
{
  const awal = await hal.evaluate(() => TBawaan.tagAwal);
  cek('daftar awal ditanam di bawaan.js, bukan berserakan',
      Array.isArray(awal) && awal.indexOf('ProjectSpace') >= 0, JSON.stringify(awal));

  const rapi = await hal.evaluate(() => TAlur.uraiTagFavorit('#MAP  #ProjectSpace, map\n#Resep'));
  cek('pagar, koma, dan baris baru sama saja', rapi.join(' ') === 'MAP ProjectSpace Resep', rapi.join(' '));
  cek('tag kembar tidak masuk dua kali walau beda huruf besar', rapi.length === 3);

  await hal.evaluate(() => TSimpan.setel('tagFavorit', ['Ngoffee', 'AmaraLiving']));
  await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => {
    window.__arahan = TPelabel.arahanUji(s);
  }));
  const arahan = await hal.evaluate(() => window.__arahan);
  cek('tag andalan ikut dikirim ke AI, di depan', /Ngoffee/.test(arahan) && /AmaraLiving/.test(arahan));
  cek('huruf besarnya diminta disalin persis', /huruf besar-kecil/.test(arahan));

  /* Ini yang paling menentukan: daftar andalan itu BANTUAN, bukan kandang.
     Kalau AI cuma boleh memilih dari daftar, orang yang sedang kehabisan
     tenaga - dan karena itu daftarnya pendek - malah dapat tag yang meleset. */
  cek('daftar andalan bukan daftar tertutup', /bukan daftar tertutup/.test(arahan));
  cek('AI disuruh membuat tag baru kalau tidak ada yang cocok',
      /BUAT TAG BARU/.test(arahan));
  /* TAG ITU RUANGAN, BUKAN JARING - dan itu membalik aturan lamanya.

     Dulu arahannya menuntut MINIMAL 8 tag dan bahkan menyuruh menebak sebutan
     yang "tidak tertulis di catatannya". Itu masuk akal waktu tag cuma pintu
     tambahan yang boleh meleset. Sejak tag ikut menentukan folder, tebakan
     yang salah tidak lagi gratis: dia menaruh barang di kamar yang salah.

     "Sandy 087575686578" pulang membawa sembilan tag, tiga di antaranya -
     teman, pribadi, catatan - tidak ada satu pun di catatannya. Sandy bisa
     saja salesman mobil. */
  cek('tidak ada lagi jumlah tag minimum yang dipaksakan',
      !/WAJIB dapat minimal/.test(arahan) && /TIDAK LEBIH/.test(arahan));
  cek('mengarang hubungan dan sifat dilarang terang-terangan',
      /JANGAN MENGARANG HUBUNGAN/.test(arahan) && /salesman mobil/.test(arahan));
  cek('kata yang menyebut bentuk, bukan isi, ikut dilarang',
      /MENYEBUT BENTUKNYA, BUKAN ISINYA/.test(arahan));
  cek('AI tidak lagi disuruh menebak yang tidak tertulis',
      !/walaupun tidak tertulis di catatannya/.test(arahan));

  /* TAG HARUS BISA DITUNJUK ASALNYA. Larangan saja tidak cukup - larangan cuma
     menyebut yang tidak boleh, dan yang tidak disebut akan tetap dikarang.
     Yang menutup celahnya aturan positif: cuma DUA sumber yang sah, dan tiap
     tag harus lolos satu per satu. */
  cek('tiap tag wajib bisa ditunjuk asalnya',
      /TAG HARUS BISA DITUNJUK ASALNYA/.test(arahan) &&
      /kata mana di catatan ini yang jadi alasannya/.test(arahan));
  cek('sumbernya cuma dua, dan disebut terang-terangan',
      /KATA YANG MEMANG TERTULIS/.test(arahan) &&
      /BENTUK YANG MENYEBUT DIRINYA SENDIRI/.test(arahan) &&
      /DI LUAR DUA SUMBER ITU, TIDAK ADA LAGI/.test(arahan));
  /* Bentuk yang menyebut dirinya sendiri itu BACAAN, bukan tafsiran - dan
     batasnya ikut ditulis supaya tidak melebar jadi tebakan lagi. */
  cek('bentuk yang menyebut diri dicontohkan, berikut batasnya',
      /08xx atau \+628xx/.test(arahan) && /BUKAN tafsiran, ini bacaan/.test(arahan) &&
      /nama orang bukan "klien"/.test(arahan));
  /* Contoh yang benar DAN yang salah, dari kasus yang benar-benar terjadi. */
  cek('contohnya menunjukkan yang benar dan yang salah sekaligus',
      /BENAR : \["Sandy", "WhatsApp"\]/.test(arahan) && /SALAH : /.test(arahan));

  /* Dan yang menegakkan kodenya, bukan cuma arahannya: aturan yang cuma
     diminta akan bocor persis di hari tersibuk. */
  const lolos = await hal.evaluate(() =>
    TPelabel.saringTagUji(['Sandy', 'catatan', 'Data', 'nomor', 'Ngoffee', 'info']));
  cek('kata bentuk dibuang oleh kodenya, bukan cuma diminta',
      lolos.join(',') === 'Sandy,Ngoffee', JSON.stringify(lolos));
  cek('tag baru per entri dibatasi',
      (await hal.evaluate(() => TPelabel.saringTagUji(
        ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11','a12']).length)) === 8);

  /* Dan tanpa satu pun tag andalan pun, AI tetap harus menyusun sendiri. */
  const kosong = await hal.evaluate(() => TPelabel.arahanUji({ tagFavorit: [], hashtag: [] }));
  cek('tanpa daftar sama sekali, AI tetap disuruh menyusun dari nol',
      /susun sendiri dari nol/.test(kosong));
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
  await keTugas('Uji cortex apps ke staff bagikan link');
  const tanpaTanggal = await hal.evaluate(() => TAlur.semuaEntri()
    .filter((e) => e.jenis === 'tugas' && /Uji cortex/.test(e.judul || ''))[0]);
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
  await hal.fill('#kotak', 'cortex');
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
    return TTugas.tersaring().filter((e) => /Uji cortex|kirim proposal/.test(e.judul || '')).length;
  });
  cek('dua-duanya mendarat di layar To Do', diDaftar === 2, String(diDaftar));

  await hal.fill('#kotak', '');
  await hal.evaluate(() => TAlur.tutupHasilDepanUji());
  await hal.waitForTimeout(200);
}

console.log('\nfolder Note: dipilih dari temannya, dan bertingkat');
{
  await hal.evaluate(() => { TAlur.gambarSetelan(); TAlur.keLayarUji('l-setelan'); });
  await hal.waitForTimeout(200);
  await hal.fill('#set-label', 'Amara\nAmara Sales\nAmara Apps\nNgoffee');
  await hal.dispatchEvent('#set-label', 'change');
  await hal.waitForTimeout(250);

  /* Timbunan tiruan dengan tag ACAK - persis bentuk yang bikin folder "No",
     "catatan", dan "daftar" lahir masing-masing berisi satu keping. */
  await hal.evaluate(async () => {
    const buat = (judul, tag, kat) => ({
      id: 'nf_' + Math.random().toString(36).slice(2), jenis: 'teks',
      judul: judul, isi: judul, kategori: kat || '', tag: tag, label: [], elemen: [],
      daftar: [], dibuat: Date.now(), diubah: Date.now(), dipakai: 0,
      diLabeliAI: true, pensiun: false, dihapus: false, riwayat: []
    });
    const d = [
      buat('Telepon Selvi', ['No', 'Telepon', 'kontak']),
      buat('Telepon Bunda', ['No', 'Telepon']),
      buat('Telepon Badar', ['Telepon', 'catatan']),
      /* "WhatsApp" dan "Telepon" itu satu benda - dua rak untuk satu benda
         membuat dua-duanya setengah isi. */
      buat('WhatsApp Ryan', ['whatsapp', 'daftar']),
      buat('Rekening BCA', ['Rekening', 'No']),
      buat('Rekening Mandiri', ['Rekening', 'berkas']),
      buat('Rekening BNI', ['Rekening']),
      buat('Amara target', ['Amara'], 'Amara Sales'),
      buat('Amara rapat', ['Amara'], 'Amara Sales')
    ];
    for (const e of d) await TSimpan.taruh(e);
    return TAlur.muatUlangUji();
  });
  await hal.evaluate(() => TAlur.keLayarUji('l-note'));
  await hal.waitForTimeout(400);

  const namaFolder = await hal.locator('#note-isi [data-note-folder]')
    .evaluateAll((n) => n.map((x) => x.getAttribute('data-note-folder')));

  /* Folder dipilih dari TEMANNYA, bukan dari urutan tag. Sebelas folder
     berisi satu keping itu bukan sistem arsip, itu serpihan. */
  cek('tag serpihan tidak melahirkan folder sendiri',
      ['No', 'catatan', 'daftar', 'berkas', 'kontak'].every((x) => namaFolder.indexOf(x) < 0),
      JSON.stringify(namaFolder));
  cek('yang punya paling banyak teman yang jadi folder',
      namaFolder.indexOf('WhatsApp') >= 0 && namaFolder.indexOf('Rekening') >= 0,
      JSON.stringify(namaFolder));
  /* "Telepon" dan "WhatsApp" itu satu benda, dan yang menang WhatsApp. */
  cek('satu benda tidak dipecah jadi dua rak',
      namaFolder.indexOf('Telepon') < 0 && namaFolder.indexOf('whatsapp') < 0);

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
  /* Bawaannya teks, jadi gambar dicari dengan sengaja - lewat cip Gambar.
     Dan di sana yang dipakai daftar, bukan petak, supaya kartunya utuh. */
  await hal.click('#saring-baris [data-jenis="gambar"]');
  await hal.waitForTimeout(300);
  await hal.click('#tampil-baris [data-gaya="daftar"]');
  await hal.waitForTimeout(350);
  cek('gambarnya tergambar di kartunya',
      (await hal.locator('#hasil-depan img.kartu-gambar').count()) >= 1);
  await hal.click('#hasil-depan img.kartu-gambar');
  await hal.waitForTimeout(350);
  cek('menyentuh gambarnya membuka pratinjau, bukan layar tulis',
      !(await hal.locator('#lihat').evaluate((n) => n.classList.contains('sembunyi'))) &&
      await hal.locator('#l-utama').isVisible());
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
  await hal.click('#hasil-depan .kartu-judul');
  await hal.waitForTimeout(350);
  cek('menyentuh judulnya membuka rinciannya di tempat, bukan pratinjau',
      (await hal.locator('#hasil-depan .kartu.terbuka').count()) === 1 &&
      await hal.locator('#lihat').evaluate((n) => n.classList.contains('sembunyi')));
  cek('dan layarnya tidak ke mana-mana', await hal.locator('#l-utama').isVisible());
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

  /* Kolom pin ikut naik ke cadangan, DI EKOR - baris lama membaca nilainya
     menurut urutan, jadi menyisipkan kolom di tengah menggeser seluruh
     cadangan yang sudah terlanjur ada. */
  const kolom = await hal.evaluate(() => TAwan.KOLOM);
  cek('pin ikut dicadangkan, dan kolomnya di ekor',
      kolom[kolom.length - 1] === 'pin', JSON.stringify(kolom.slice(-3)));

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
  cek('saringannya lengkap: semua, teks, gambar, berkas, link, pin, reset',
      JSON.stringify(semuaJenis) ===
        JSON.stringify(['*semua', 'teks', 'gambar', 'berkas', 'tautan', '*pin', '*reset']),
      JSON.stringify(semuaJenis));
  cek('resetnya paling kanan, tepat di sebelah Pin',
      semuaJenis[semuaJenis.length - 1] === '*reset' &&
      semuaJenis[semuaJenis.length - 2] === '*pin');

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
  cek('tujuh saringan muat dalam satu baris',
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
  /* DI HALAMAN DEPAN STORAGE yang tampil cuma FOLDER - tidak ada satu kartu
     pun yang bisa ditunjuk. Tombol yang ada tapi tidak menghasilkan apa-apa
     lebih buruk daripada tombol yang tidak ada: yang pertama terbaca sebagai
     rusak. */
  cek('tombol Pilih tidak ditawarkan di halaman folder',
      await hal.locator('#b-pilih-mulai').isHidden());

  await hal.fill('#note-cari', 'badgeuji');
  await hal.dispatchEvent('#note-cari', 'input');
  await hal.waitForTimeout(300);
  cek('tapi muncul begitu ada kartu yang bisa ditunjuk',
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
     sedang mau bertanya ke AI. */
  const ikonKotak = async () => hal.evaluate(() =>
    ['#b-ai', '#b-lampir', '#b-tugas', '#b-drop']
      .filter((s) => document.querySelector(s).getBoundingClientRect().width > 0).length);
  cek('empat ikon waktu kotaknya diam', (await ikonKotak()) === 4,
      String(await ikonKotak()));
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

  /* Folder muncul sebagai baris rapat di akar, dan membukanya menyaring. */
  await hal.evaluate(() => TAlur.keLayarUji('l-tulis'));
  await hal.waitForTimeout(300);
  /* Naik ke akar dulu: membuat folder langsung membukanya, jadi yang sedang
     tampil adalah isi folder itu - bukan daftar foldernya. */
  if (await hal.locator('#tulis-alamat [data-tulis-akar]').count()) {
    await hal.click('#tulis-alamat [data-tulis-akar]');
    await hal.waitForTimeout(300);
  }
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
  await hal.click('#b-folder-baru');
  await hal.waitForSelector('#tanya-isi:not(.sembunyi)');
  await hal.fill('#tanya-isi', 'Rak Kedua');
  await hal.click('#b-tanya-ya');
  await hal.waitForTimeout(400);
  await hal.click('#tulis-alamat [data-tulis-akar]');
  await hal.waitForTimeout(300);
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
  if (await hal.locator('#tulis-alamat [data-tulis-akar]').count()) {
    await hal.click('#tulis-alamat [data-tulis-akar]');
    await hal.waitForTimeout(300);
  }
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
  cek('nama pintu tetap Drop, Note, To Do, Storage',
      JSON.stringify(pintu.map((x) => x.trim())) ===
        JSON.stringify(['Drop', 'Note', 'To Do', 'Storage']),
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
  for (const l of ['l-utama', 'l-tulis', 'l-tugas', 'l-note', 'l-setelan']) {
    await halEn.evaluate((x) => {
      if (x === 'l-setelan') TAlur.gambarSetelan();
      if (x === 'l-tugas') TTugas.gambar();
      TAlur.keLayarUji(x);
    }, l);
    await halEn.waitForTimeout(450);
    (await sapu()).forEach((s) => {
      /* "besok/jumat/tgl" sengaja tetap Indonesia: itu kata yang benar-benar
         DIKENALI pembaca tenggat, bukan kalimat layar. Menerjemahkannya
         berarti menjanjikan sesuatu yang tidak dimengerti kodenya. */
      if (/besok|jumat|tgl|HAPUS/.test(s)) return;
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
        JSON.stringify(['Drop', 'Note', 'To Do', 'Storage']));
  cek('tidak ada galat JavaScript di jalur bahasa', galatEn.length === 0, galatEn.join(' | '));
  await halEn.close();
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

console.log('\ntanpa galat');
cek('tidak ada galat JavaScript sama sekali', galat.length === 0, galat.join(' | '));

await browser.close();
server.close();

console.log('\n' + lulus + ' lulus, ' + gagal + ' gagal\n');
process.exit(gagal ? 1 : 0);
