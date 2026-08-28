/* ============================================================================
   Drop Note — uji terima
   ============================================================================
   Yang dijaga di sini bukan kerapian kode, melainkan empat janji yang kalau
   satu saja bocor, aplikasinya kehilangan alasan untuk ada:

     1. drop -> cari -> ketemu, DENGAN JARINGAN DIMATIKAN TOTAL.
     2. layar depan tidak pernah menampilkan satu pun kartu.
     3. kategori salah ketik mendarat di rak yang sudah ada.
     4. merevisi memperbarui baris yang sama, versi lama tetap ada.

   Jalankan:  node uji/uji-dropnote.mjs
   ============================================================================ */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/* Tiruan Apps Script + Sheets, seluruhnya di memori. Dipakai untuk menguji
   cadangan tanpa menyentuh jaringan sungguhan - sekaligus supaya bisa dihitung
   BERAPA KALI dia dipanggil, yang justru pengujian terpentingnya. */
const lembar = new Map();
let panggilanScript = 0;

function tiruScript(req, res) {
  let badan = '';
  req.on('data', (p) => { badan += p; });
  req.on('end', () => {
    panggilanScript++;
    let j = {};
    try { j = JSON.parse(badan); } catch (e) { /* biarkan kosong */ }
    let balas;
    if (j.sandi !== 'rahasia') balas = { galat: 'Sandi salah' };
    else if (j.tugas === 'halo') balas = { baris: lembar.size };
    else if (j.tugas === 'sinkron') {
      (j.entri || []).forEach((e) => lembar.set(String(e.id), e));   /* upsert per id */
      balas = { disimpan: (j.entri || []).length, baris: lembar.size };
    } else if (j.tugas === 'pulihkan') balas = { entri: Array.from(lembar.values()) };
    else balas = { galat: 'Tugas tidak dikenali' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(balas));
  });
}

/* IndexedDB tidak jalan di file:// - jadi uji ini butuh server kecil. */
function layani() {
  return new Promise((terima) => {
    const s = http.createServer((req, res) => {
      const nama = decodeURIComponent(req.url.split('?')[0]);
      if (nama === '/palsu-script') return tiruScript(req, res);
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

let lulus = 0, gagal = 0;
function cek(nama, syarat, catatan) {
  if (syarat) { lulus++; console.log('  ok   ' + nama); }
  else { gagal++; console.log('  GAGAL ' + nama + (catatan ? '  -> ' + catatan : '')); }
}

const { server, port } = await layani();
const alamat = 'http://127.0.0.1:' + port + '/index.html';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const konteks = await browser.newContext();
const hal = await konteks.newPage();

const galat = [];
hal.on('pageerror', (e) => galat.push(e.message));

/* JANJI NOMOR SATU: tidak ada satu pun permintaan keluar yang boleh
   dibutuhkan. Semua diblokir sejak sebelum halaman dibuka. */
await hal.route('**', (rute) => {
  const u = rute.request().url();
  if (u.startsWith('http://127.0.0.1:' + port)) return rute.continue();
  return rute.abort();
});

await hal.goto(alamat);
await hal.waitForFunction(() => window.TAlur && window.TSimpan && window.TOtak);

console.log('\notak (tanpa browser pun harus benar)');
{
  const r = await hal.evaluate(() => TOtak.benahiKategori('apps desig', ['apps design']));
  cek('salah ketik mendarat di rak yang ada', r.kategori === 'apps design' && r.dibetulkan === true, JSON.stringify(r));

  const dev = await hal.evaluate(() => TOtak.judulTautan('https://script.google.com/macros/s/AAA/dev'));
  const exec = await hal.evaluate(() => TOtak.judulTautan('https://script.google.com/macros/s/AAA/exec'));
  cek('/dev disebut uji coba', /uji coba/.test(dev), dev);
  cek('/exec disebut terbit', /terbit/.test(exec), exec);
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

  /* Ini uji yang paling menentukan di seluruh berkas: kalau gagal, aturan
     nomor satu sudah bocor dan aplikasinya kehilangan alasan untuk ada. */
  await hal.fill('#kotak', '');
  await hal.click('#b-cari');
  await hal.fill('#cari-input', 'uji');
  await hal.waitForTimeout(300);
  cek('yang di-drop ketemu lagi tanpa jaringan', await hal.locator('#hasil .kartu').count() === 1);
  cek('judulnya menyebut uji coba', /uji coba/.test(await hal.locator('.kartu-judul').first().innerText()));

  await hal.fill('#cari-input', 'apps design');
  await hal.waitForTimeout(300);
  cek('ketemu lewat nama raknya', await hal.locator('#hasil .kartu').count() === 1);

  await hal.fill('#cari-input', 'staging');
  await hal.waitForTimeout(300);
  cek('ketemu lewat kata yang tidak tertulis (label /dev)', await hal.locator('#hasil .kartu').count() === 1);
}

console.log('\ncatat: satu baris, banyak versi');
{
  await hal.fill('#cari-input', '');
  await hal.waitForTimeout(250);
  await hal.locator('#hasil .kartu').first().click();
  await hal.waitForSelector('#l-catat.aktif');
  cek('dipakai naik saat kartunya dibuka', (await hal.evaluate(() => TAlur.semuaEntri()[0].dipakai)) === 1);

  await hal.fill('#catat-judul', 'Link dev photo studio');
  await hal.fill('#catat-isi', 'versi pertama');
  await hal.waitForTimeout(900);
  cek('judul manual ditandai supaya AI tidak menimpanya',
      (await hal.evaluate(() => TAlur.semuaEntri()[0].judulManual)) === true);
  cek('tersimpan tanpa tombol simpan', (await hal.innerText('#simpan-tanda')).indexOf('tersimpan') >= 0);

  /* Suntingan berjarak >10 menit: versi lama harus masuk riwayat, dan
     barisnya tetap satu - inilah kenapa aplikasi ini ada. */
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

  await hal.click('#b-riwayat');
  cek('riwayat bisa dilihat', await hal.locator('.riwayat-pulih').count() === 1);
}

console.log('\nmembuang = memensiunkan');
{
  await hal.click('#b-buang');
  await hal.waitForTimeout(300);
  const p = await hal.evaluate(() => TAlur.semuaEntri()[0].pensiun);
  cek('dipensiunkan, bukan dihapus', p === true);
  cek('entrinya masih ada di penyimpanan',
      (await hal.evaluate(() => TSimpan.semua().then(a => a.length))) === 1);
  cek('urung ditawarkan lewat pesan', await hal.locator('.pesan-aksi').count() === 1);

  await hal.click('.pesan-aksi');
  await hal.waitForTimeout(300);
  cek('urung mengembalikannya', (await hal.evaluate(() => TAlur.semuaEntri()[0].pensiun)) === false);
}

console.log('\nsetelan');
{
  await hal.click('#l-hasil [data-kembali]');
  await hal.waitForSelector('#l-utama.aktif');
  await hal.click('#b-setelan');
  await hal.waitForSelector('#l-setelan.aktif');
  cek('setelan terisi dari JS', (await hal.locator('#setelan-isi .set-kotak').count()) >= 3);
  await hal.click('#set-mode [data-mode="langsung"]');
  await hal.waitForTimeout(200);
  cek('mode langsung menjawab jujur soal kunci',
      /tidak bisa benar-benar disembunyikan/.test(await hal.innerText('#setelan-isi')));
  await hal.click('#set-mode [data-mode="mati"]');
  await hal.waitForTimeout(200);
}

console.log('\ncadangan ke Sheet');
{
  const alamatScript = 'http://127.0.0.1:' + port + '/palsu-script';
  await hal.evaluate(([a]) => Promise.all([
    TSimpan.setel('alamatScript', a),
    TSimpan.setel('sandiScript', 'rahasia'),
    TSimpan.setel('cadanganNyala', true)
  ]), [alamatScript]);

  /* Membuka aplikasi = cadangan menyusul di belakang layar. */
  await hal.goto(alamat);
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForFunction(() => TAlur.semuaEntri().length > 0);
  await hal.waitForTimeout(800);
  cek('catatan naik ke Sheet saat aplikasi dibuka', lembar.size === 1, 'baris: ' + lembar.size);

  const baris = Array.from(lembar.values())[0];
  cek('isinya utuh sampai di Sheet', /Link dev photo studio/.test(baris.judul || ''), JSON.stringify(baris.judul));
  cek('riwayat versi ikut naik', JSON.parse(baris.riwayat || '[]').length === 1);
  cek('berkas tidak ikut naik, cuma teksnya', baris.blob === undefined);

  /* INI UJI TERPENTING DI BAGIAN INI. Cadangan boleh berjalan kapan saja
     KECUALI di jalur drop. Penahan jedanya dinolkan dulu supaya kalau dia
     memang menembak saat drop, dia benar-benar tertangkap. */
  await hal.evaluate(() => TSimpan.setel('cadanganDicoba', 0));
  const sebelum = panggilanScript;
  await hal.fill('#kotak', 'catatan baru saat jaringan tidak boleh disentuh');
  await hal.click('#b-drop');
  await hal.waitForFunction(() => TAlur.semuaEntri().length === 2);
  await hal.waitForTimeout(700);
  cek('drop tidak memanggil jaringan sama sekali', panggilanScript === sebelum,
      'bertambah ' + (panggilanScript - sebelum) + ' panggilan');

  const naik = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TSinkron.putaran(s, true)));
  cek('yang baru menyusul di putaran berikutnya', naik === 1 && lembar.size === 2, 'naik: ' + naik);

  const lagi = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TSinkron.putaran(s, true)));
  cek('yang sudah naik tidak dikirim ulang', lagi === 0);

  const salah = await hal.evaluate(() => TSinkron.coba({ alamatScript: document.location.origin + '/palsu-script', sandiScript: 'ngawur' }).then(() => 'lolos', (e) => e.message));
  cek('sandi salah ditolak', salah === 'Sandi salah', String(salah));

  /* Ganti HP: DB kosong, lalu ditarik balik dari Sheet. */
  await hal.evaluate(() => TSimpan.kosongkan());
  const pulih = await hal.evaluate(() => TSimpan.semuaSetelan().then((s) => TSinkron.pulihkan(s)));
  cek('semua ditarik balik dari Sheet', pulih === 2, 'pulih: ' + pulih);
  const setelahPulih = await hal.evaluate(() => TSimpan.semua().then((a) => a.map((e) => e.judul).sort()));
  cek('judulnya utuh setelah dipulihkan', /Link dev photo studio/.test(setelahPulih.join(' ')), setelahPulih.join(' | '));
  const riwayatPulih = await hal.evaluate(() => TSimpan.semua().then(
    (a) => a.filter((e) => (e.riwayat || []).length).length));
  cek('riwayat versi selamat menyeberang', riwayatPulih === 1);
}

console.log('\npwa: bisa dipasang & menerima Bagikan');
{
  const manifes = JSON.parse(fs.readFileSync(path.join(AKAR, 'manifest.webmanifest'), 'utf8'));
  cek('manifest berdiri sendiri', manifes.display === 'standalone' && manifes.start_url === './');
  /* GET cuma cukup untuk teks; berkas hanya ikut kalau POST. */
  cek('share_target lewat POST + berkas',
      manifes.share_target && manifes.share_target.method === 'POST' &&
      manifes.share_target.enctype === 'multipart/form-data' &&
      Array.isArray(manifes.share_target.params.files));
  cek('ikon 192 dan 512 benar-benar ada',
      fs.existsSync(path.join(AKAR, 'ikon-192.png')) && fs.existsSync(path.join(AKAR, 'ikon-512.png')));

  /* Titipan dari sw.js: aplikasinya harus memungutnya ke kotak, bukan
     langsung menyimpannya - raknya masih perlu ditempel sekali ketuk. */
  await hal.evaluate(() => TSimpan.setel('bagikanTertunda', {
    judul: 'Studio', teks: 'lihat ini', tautan: 'https://contoh.id/abc', waktu: Date.now()
  }));
  await hal.goto(alamat + '?bagikan=1');
  await hal.waitForFunction(() => window.TAlur);
  await hal.waitForTimeout(400);
  const isiKotak = await hal.inputValue('#kotak');
  cek('titipan Bagikan dipungut ke kotak',
      /Studio/.test(isiKotak) && /contoh\.id\/abc/.test(isiKotak), isiKotak);
  cek('titipan dibuang setelah dipungut',
      (await hal.evaluate(() => TSimpan.setelan('bagikanTertunda'))) === null);
}

console.log('\ntanpa galat');
cek('tidak ada galat JavaScript sama sekali', galat.length === 0, galat.join(' | '));

await browser.close();
server.close();

console.log('\n' + lulus + ' lulus, ' + gagal + ' gagal\n');
process.exit(gagal ? 1 : 0);
