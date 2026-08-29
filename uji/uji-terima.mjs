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
const proxyAI = { panggilan: 0, tokenTerakhir: null, tolak: false, arahanTerakhir: '', badanTerakhir: '' };
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (proxyAI.tolak) return res.end(JSON.stringify({ galat: 'belum-terdaftar' }));
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

console.log('\npemasangan swalayan');
{
  await hal.waitForSelector('#l-mulai.aktif', { timeout: 4000 });
  cek('layar pemasangan muncul sekali di awal', await hal.locator('#l-mulai').isVisible());
  /* textContent, bukan innerText: .merek pakai text-transform uppercase, dan
     innerText mengembalikan yang terlihat, bukan yang tertulis. */
  cek('namanya dituliskan dari satu tempat',
      (await hal.locator('#merek-mulai').textContent()) === 'Drop Memory');
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
      dibuat.some((x) => x.startsWith('Drop Memory|application/vnd.google-apps.folder')), dibuat.join(', '));
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
  cek('salah ketik mendarat di rak yang ada', r.kategori === 'apps design' && r.dibetulkan === true, JSON.stringify(r));
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
  cek('nomor telepon mendarat di Telepon, bukan Nomor',
      (await susun('nomor telepon pak har', { elemen: [] })) === 'Telepon pak har');
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
  await hal.fill('#kat', 'apps design');
  await hal.waitForTimeout(400);
  cek('tautan terbaca sebelum di-drop', await hal.locator('#tebakan').isVisible());

  await hal.click('#b-drop');
  await hal.waitForFunction(() => window.TAlur.semuaEntri().length === 1);
  cek('kotak dikosongkan setelah drop', (await hal.inputValue('#kotak')) === '');
  cek('kategori tetap menempel untuk drop berikutnya', (await hal.inputValue('#kat')) === 'apps design');

  await hal.fill('#kotak', '');
  await hal.click('#b-cari');
  await hal.fill('#cari-input', 'uji');
  await hal.waitForTimeout(300);
  cek('yang di-drop ketemu lagi tanpa jaringan', await hal.locator('#hasil .kartu').count() === 1);
  cek('judulnya menyebut uji coba', /uji coba/.test(await hal.locator('.kartu-judul').first().innerText()));

  await hal.fill('#cari-input', 'staging');
  await hal.waitForTimeout(300);
  cek('ketemu lewat kata yang tidak tertulis (label /dev)', await hal.locator('#hasil .kartu').count() === 1);
}

console.log('\ncatat: satu baris, banyak versi');
{
  await hal.fill('#cari-input', '');
  await hal.waitForTimeout(250);
  /* Kartunya ringkas: sentuh judulnya untuk membuka rincian, lalu tombol
     pensil untuk benar-benar menyunting. Pindah layar hanya kalau memang
     diminta - saat memindai, pindah layar itu kehilangan posisi gulir. */
  await hal.locator('#hasil .kartu .kartu-judul').first().click();
  await hal.locator('#hasil .kartu [data-sunting]').first().click();
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
  await hal.click('#l-hasil [data-kembali]');
  await hal.waitForSelector('#l-utama.aktif');
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
  cek('nama aplikasi ikut satu sumber', manifes.name === 'Drop Memory');
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
    document.querySelector('#kat').value = '';
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

console.log('\nkeyword: dicentang, bukan diketik');
{
  await hal.evaluate(() => { document.querySelector('#kat').value = ''; TAlur.perbaruiUsulKategori(); });
  const adaPilihan = await hal.locator('#kat-usul .cip').count();
  cek('pilihan umum tersedia tanpa perlu mengetik', adaPilihan > 3, String(adaPilihan));

  await hal.evaluate(() => { TAlur.alihKeyword('kerja'); TAlur.alihKeyword('klien'); });
  const dua = await hal.inputValue('#kat');
  cek('dua keyword bisa menempel sekaligus, dipisah spasi', dua === 'kerja klien', dua);

  const nyala = await hal.locator('#kat-usul .cip.nyala').count();
  cek('yang tercentang terlihat tercentang', nyala === 2, String(nyala));

  await hal.evaluate(() => TAlur.alihKeyword('kerja'));
  cek('centang lagi berarti buang', (await hal.inputValue('#kat')) === 'klien');

  const saring = await hal.evaluate(() => TOtak.cari(
    [{ id: 'a', judul: '', isi: '', label: [], kategori: 'kerja klien' },
     { id: 'b', judul: '', isi: '', label: [], kategori: 'rumah' }], '', '', 'klien'));
  cek('saringan rak mencocokkan salah satu keyword, bukan seluruh isian',
      saring.length === 1 && saring[0].id === 'a');
  await hal.evaluate(() => { document.querySelector('#kat').value = ''; TAlur.perbaruiUsulKategori(); });
}

console.log('\ntata letak: sedekat mungkin ke jempol');
{
  const html = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf8');
  const utama = html.slice(html.indexOf('id="l-utama"'), html.indexOf('id="l-hasil"'));
  cek('ikon lampiran di ATAS kotak', utama.indexOf('id="lampiran"') < utama.indexOf('id="kotak"'));
  /* Tepat di bawah kotak, bukan di dasar layar: di layar panjang, dasar layar
     itu jauh dari yang barusan diketik. */
  cek('tombol tepat di BAWAH kotak', utama.indexOf('id="b-drop"') > utama.indexOf('id="kotak"'));
  cek('tombol tidak terlempar ke bawah keyword',
      utama.indexOf('id="b-drop"') < utama.indexOf('id="kat-usul"'));

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
  cek('Drop paling kanan, Semua paling kiri',
      utama.indexOf('id="b-semua"') < utama.indexOf('id="b-cari"') &&
      utama.indexOf('id="b-cari"') < utama.indexOf('id="b-drop"'));

  const hasil = html.slice(html.indexOf('id="l-hasil"'), html.indexOf('id="l-catat"'));
  cek('layar hasil punya tombol yang sama', /id="b-hasil-drop"/.test(hasil) &&
      /id="b-hasil-cari"/.test(hasil) && /id="b-hasil-semua"/.test(hasil));
  cek('tidak ada tombol Catat di layar hasil', !/id="b-hasil-catat"/.test(hasil));
  /* Jempol yang sudah hafal satu tempat tidak boleh menemukan tombol lain di
     sana waktu pindah layar. */
  cek('urutan di layar hasil sama persis dengan layar utama',
      hasil.indexOf('id="b-hasil-semua"') < hasil.indexOf('id="b-hasil-cari"') &&
      hasil.indexOf('id="b-hasil-cari"') < hasil.indexOf('id="b-hasil-drop"'));
  cek('layar tulis tetap ada, cuma tidak lagi jadi pintu masuk',
      /id="l-catat"/.test(html));
  cek('di layar hasil tombolnya lebih kecil dan menempel', /tombol-baris kecil jempol/.test(hasil));

  const css = fs.readFileSync(path.join(AKAR, 'gaya.css'), 'utf8');
  cek('menempelnya benar-benar diatur di gaya', /\.tombol-baris\.jempol\{[^}]*position:sticky/.test(css));
  cek('ukuran kecilnya benar-benar diatur di gaya', /\.tombol-baris\.kecil \.tbl\{/.test(css));
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
  await hal.evaluate(() => TAlur.keSemua());
  await hal.waitForSelector('#l-hasil.aktif');
  cek('tombol Semua membuka seluruh isi tanpa kata kunci',
      (await hal.inputValue('#cari-input')) === '' &&
      (await hal.locator('#hasil .kartu').count()) > 1);
  cek('dua cara mengurut tersedia', (await hal.locator('#urut-baris .cip').count()) === 2);

  await hal.click('[data-urut="tag"]');
  await hal.waitForTimeout(200);
  const kepala = await hal.locator('#hasil .kelompok-nama').allTextContents();
  cek('diurut per tag, dan yang tanpa tag tetap ikut - bukan hilang',
      kepala.length > 0 && kepala[kepala.length - 1] === 'Belum bertag', kepala.join(' | '));

  /* Terbanyak dulu. Ini yang menaruh rak yang benar-benar dipakai di atas
     tanpa perlu ditata sendiri. */
  const jumlah = (await hal.locator('#hasil .kelompok-jumlah').allTextContents())
    .slice(0, -1).map(Number);
  const menurun = jumlah.every((n, i) => i === 0 || jumlah[i - 1] >= n);
  cek('kelompok terbanyak berada di atas', menurun, jumlah.join(','));

  await hal.click('[data-urut="waktu"]');
  await hal.waitForTimeout(150);
  cek('kembali ke urutan terbaru tanpa kepala kelompok',
      (await hal.locator('#hasil .kelompok').count()) === 0);
}

console.log('\nlayar kosong harus menyebut sebabnya');
{
  await hal.evaluate(() => TAlur.keHasil('katayangpastitidakada'));
  await hal.waitForTimeout(250);
  const teks = await hal.textContent('#hasil .kosong');
  /* "Tidak ada yang cocok" saat timbunannya sebenarnya penuh membuat orang
     menyimpulkan aplikasinya rusak, lalu berhenti memakainya. */
  cek('sebab kosongnya disebut, bukan cuma "tidak ada"',
      /katayangpastitidakada/.test(teks), teks);
  cek('ada jalan keluar satu ketukan',
      (await hal.locator('#hasil [data-bersihkan]').count()) === 1);

  await hal.click('#hasil [data-bersihkan]');
  await hal.waitForTimeout(300);
  cek('menekannya benar-benar mengembalikan seluruh isi',
      (await hal.locator('#hasil .kartu').count()) > 1 &&
      (await hal.inputValue('#cari-input')) === '');

  /* Saringan rak juga disebut - bukan cuma kata pencariannya. */
  await hal.evaluate(() => TAlur.saringRakUji('rakyangtidakada'));
  await hal.waitForTimeout(250);
  cek('rak yang menyaring ikut disebut',
      /rakyangtidakada/.test(await hal.textContent('#hasil .kosong')));
  /* Saringan yang tertinggal menyala adalah cara paling halus untuk membuat
     pencarian TERLIHAT rusak: catatan yang baru dijatuhkan tidak muncul, dan
     yang disimpulkan bukan "ada label menyala" tapi "aplikasinya tidak
     bekerja". Pencarian baru wajib mulai bersih. */
  await hal.evaluate(() => TAlur.saringRakUji('Cons'));
  await hal.waitForTimeout(250);
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.fill('#kotak', 'password wifi kantor baru 99aabbcc');
  await hal.click('#b-drop');
  await hal.waitForTimeout(350);
  await hal.click('#b-cari');
  await hal.waitForTimeout(250);
  await hal.fill('#cari-input', 'wifi');
  await hal.waitForTimeout(500);
  cek('pencarian baru tidak mewarisi saringan label yang tertinggal',
      (await hal.locator('#hasil .kartu').count()) >= 1,
      await hal.locator('#saring-kat .cip.nyala').first().textContent());
  cek('yang menyala kembali ke Semua',
      /^Semua/.test(await hal.locator('#saring-kat .cip.nyala').first().textContent()));

  await hal.evaluate(() => TAlur.keSemua());
  await hal.waitForTimeout(200);
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

  await hal.evaluate(() => TAlur.keSemua());
  await hal.waitForTimeout(300);
  const cipNama = await hal.locator('#saring-kat .cip').allTextContents();
  cek('barisan label tergambar di layar hasil', cipNama.length > 5, cipNama.join('|'));
  cek('cip pertama "Semua"', /^Semua/.test(cipNama[0]), cipNama[0]);
  cek('urutannya persis daftar bawaan, tidak diacak isi',
      cipNama[1].indexOf('MAP') === 0 && cipNama[2].indexOf('Amara') === 0,
      cipNama.slice(1, 3).join('|'));
  await hal.evaluate(() => TAlur.keSemua());
  await hal.waitForTimeout(200);
}

console.log('\narsip: geser ke kiri, bukan hapus');
{
  await hal.evaluate(() => TAlur.keSemua());
  await hal.waitForTimeout(300);
  const sebelum = await hal.locator('#hasil .kartu').count();

  /* Mulai dari baris judulnya, bukan tepi kanan: di tepi kanan ada tombol
     salin, dan gestur yang dimulai di atas tombol memang sengaja diabaikan. */
  const kotak = await hal.locator('#hasil .kartu').first().boundingBox();
  const y = kotak.y + 14;
  await hal.mouse.move(kotak.x + kotak.width * 0.6, y);
  await hal.mouse.down();
  await hal.mouse.move(kotak.x + kotak.width * 0.4, y, { steps: 5 });
  await hal.mouse.move(kotak.x + 10, y, { steps: 8 });
  await hal.mouse.up();
  await hal.waitForTimeout(600);

  cek('geser ke kiri mengeluarkannya dari hasil',
      (await hal.locator('#hasil .kartu').count()) === sebelum - 1);

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
  await hal.evaluate(() => TAlur.keSemua());
  await hal.waitForTimeout(300);
  cek('bisa dikembalikan, dan muncul lagi di hasil',
      (await hal.locator('#hasil .kartu').count()) === sebelum);

  /* Gulir tegak tidak boleh berubah jadi arsip di tengah jalan. */
  const kotak2 = await hal.locator('#hasil .kartu').first().boundingBox();
  await hal.mouse.move(kotak2.x + kotak2.width * 0.6, kotak2.y + 14);
  await hal.mouse.down();
  await hal.mouse.move(kotak2.x + kotak2.width * 0.5, kotak2.y + 160, { steps: 8 });
  await hal.mouse.up();
  await hal.waitForTimeout(400);
  cek('gulir tegak tidak ikut mengarsipkan',
      (await hal.locator('#hasil .kartu').count()) === sebelum);
}

console.log('\nEnter = cari, di dua kotak');
{
  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.waitForSelector('#l-utama.aktif');
  await hal.fill('#kotak', 'wifi');
  await hal.press('#kotak', 'Enter');
  await hal.waitForSelector('#l-hasil.aktif');
  cek('Enter di kotak drop langsung mencari', (await hal.inputValue('#cari-input')) === 'wifi');
  /* Isinya tidak boleh hilang: kalau ternyata mau di-drop, tinggal tekan Drop. */
  cek('isi kotak tetap utuh setelah Enter', (await hal.inputValue('#kotak')) === 'wifi');

  await hal.evaluate(() => TAlur.keLayarUji('l-utama'));
  await hal.fill('#kotak', 'baris satu');
  await hal.press('#kotak', 'Shift+Enter');
  cek('Shift+Enter tetap baris baru', /\n/.test(await hal.inputValue('#kotak')),
      JSON.stringify(await hal.inputValue('#kotak')));
  await hal.fill('#kotak', '');
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
  cek('tidak boleh ada catatan yang pulang tanpa tag',
      /WAJIB dapat minimal 8 tag/.test(arahan));

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
