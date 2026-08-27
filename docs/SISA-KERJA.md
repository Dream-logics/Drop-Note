# Sisa kerja

Urut dari yang paling menentukan. Nomor 1 sendirian sudah membuat aplikasinya
hidup; sisanya penyempurnaan.

---

## 1. `public/tnote.js` — alur UI *(belum ada; ini penghalang utama)*

`index.html` sudah memanggilnya dan semua id-nya sudah terpasang. Yang belum
ada cuma penghubungnya.

### Bentuk satu entri

```js
{
  id:          'e_1724750000000_a7f3',   // 'e_' + waktu + acak
  jenis:       'teks'|'tautan'|'gambar'|'berkas'|'daftar'|'suara'|'catatan',
  judul:       '',
  judulManual: false,   // true kalau diketik sendiri -> AI TIDAK BOLEH menimpa
  isi:         '',      // teks, atau URL untuk jenis 'tautan'
  daftar:      [{teks:'', selesai:false}],   // hanya untuk jenis 'daftar'
  kategori:    '',
  label:       [],      // kata kunci tersembunyi; tidak pernah ditampilkan
  berkasId:    null,    // kunci ke toko 'berkas'
  namaBerkas:  '', tipeBerkas:'', ukuran:0,
  dibuat:      0, diubah: 0,
  dipakai:     0,       // naik tiap dibuka -> ini saluran keluarnya
  diLabeliAI:  false,   // antrean pelabelan
  pensiun:     false,   // disembunyikan dari hasil, TIDAK dihapus
  riwayat:     [{isi:'', ts:0}]   // versi sebelumnya, maksimal ~20
}
```

`riwayat` itu inti dari kenapa aplikasi ini ada. Di Keep, merevisi berarti
menimpa, jadi pemiliknya membuat catatan baru tiap revisi — dan itulah asal
semua duplikatnya. Di sini merevisi **memperbarui baris yang sama** dan versi
lama tetap tersimpan. Jangan hilangkan.

### Layar utama (`#l-utama`)

- `#kotak` — satu kotak untuk drop sekaligus cari.
- Saat isinya berubah (beri jeda ±250 ms): panggil `TOtak.bacaJenis()`. Kalau
  tautan, tampilkan `#tebakan` berisi `TOtak.judulTautan()`. Kalau kosong,
  sembunyikan.
- **Kategori.** Saat `#kat` kehilangan fokus atau saat menekan Drop, jalankan
  `TOtak.benahiKategori(nilai, daftarKategoriYangSudahAda)`. Kalau
  `dibetulkan`, tampilkan di `#kat-koreksi` dengan bentuk
  `<s>apps desig</s> → <b>apps design</b>` supaya koreksinya **terlihat** —
  tebakan diam-diam itu yang bikin terasa tidak predictable.
  `#kat-usul` diisi 3 kategori tersering plus hasil `TOtak.usulKategori()`.
- **`#b-drop`** — susun entri, `TOtak.judulOtomatis()`, `TOtak.labelOtomatis()`,
  `TSimpan.taruh()`, kosongkan kotak, tampilkan `#pesan` "Tersimpan".
  **Tidak ada jaringan di jalur ini.**
- **`#b-cari`** — pindah ke `#l-hasil` membawa isi kotak sebagai kueri.
- **`#b-catat`** — buka `#l-catat` dengan entri baru berjenis `catatan`, isi
  kotak dipindah ke badannya.
- **`#lampiran`** — tombol `data-lamp`: `gambar` dan `berkas` memicu
  `#pilih-gambar` / `#pilih-berkas`; `suara` merekam lewat `MediaRecorder`
  (tombol berubah jadi tanda berhenti + penghitung detik); `daftar` menyalakan
  `#petak-daftar` dan mengubah jenis jadi `daftar`.
  Berkas masuk ke `TSimpan.taruhBerkas()`, entrinya hanya memegang `berkasId`.
  Kecilkan gambar dulu lewat `<canvas>` (sisi terpanjang ~1600px, JPEG 0.82) —
  foto HP 6 MB akan memenuhi kuota penyimpanan dalam hitungan minggu.

### Layar hasil (`#l-hasil`)

- Cari sambil mengetik (jeda ±120 ms) lewat `TOtak.cari(semua, kueri, jenis, kat)`.
- `#saring-jenis` — cip: semua · tautan · gambar · berkas · daftar · suara ·
  catatan (ini padanan baris "Types" milik Google Keep).
- `#saring-kat` — 8 kategori tersering.
- Kartu menampilkan **judul + potongan isi 2 baris** (`.kartu-cuplik`), lalu
  tautan bersih yang tinggal diklik (`.kartu-tautan`), lalu ikon salin.
  Untuk gambar, tampilkan pratinjaunya.
- Menyalin: `navigator.clipboard.writeText()`, mundur ke `<textarea>` +
  `document.execCommand('copy')` kalau ditolak (Android lama, konteks non-HTTPS).
- Membuka kartu: `dipakai++`, simpan, lalu masuk `#l-catat`.
- Yang `dipakai >= 5` diberi kelas `.sering` dan cap "sering dipakai".

### Layar catat (`#l-catat`) — memo pad

- Simpan otomatis, jeda ±700 ms setelah berhenti mengetik. `#simpan-tanda`
  menampilkan "tersimpan" / "menyimpan…". Tidak ada tombol simpan.
- Mengubah `#catat-judul` menyalakan `judulManual = true`.
- Sebelum menimpa `isi`, dorong versi lama ke `riwayat` — **tapi hanya kalau
  suntingan terakhir lebih dari 10 menit lalu**, supaya riwayatnya tidak
  membengkak oleh tiap ketikan.
- `#b-riwayat` membuka `#riwayat`; tiap baris punya tombol "pulihkan".
- `#b-buang` **memensiunkan** (`pensiun = true`), tidak menghapus. Beri jalan
  urung lewat `#pesan`.

### Layar setelan (`#l-setelan`)

Isi `#setelan-isi` dari JS. Bagian-bagiannya:

- **Pelabelan otomatis** — pilihan `mati` / `proxy` / `langsung`
  (`setelan.modeAI`), `#set-kunci` (`kunciGemini`), `alamatProxy`, `model`
  (bawaan `TPelabel.MODEL_BAWAAN`), dan tombol "Uji" yang memanggil
  `TPelabel.coba()`.
- **Cadangan** — Ekspor (`TSimpan.ekspor()` → unduh JSON) dan Impor.
- **Bahaya** — kosongkan semua data, dengan konfirmasi ketik.

Jalankan `TPelabel.putaran(setelan)` saat aplikasi dibuka dan tiap ±3 menit
selama ada antrean.

---

## 2. Menyembunyikan kunci Gemini

Pertanyaan pemiliknya, dan jawab jujur di layar Setelan-nya sendiri:

**Di aplikasi yang seluruhnya berjalan di browser, kunci API tidak bisa
benar-benar disembunyikan.** Siapa pun yang memegang HP-nya bisa membacanya.
Jangan bikin UI yang seolah-olah aman.

Yang benar-benar menyembunyikan cuma **proxy**: kunci tinggal di Apps Script
sebagai Script Property, aplikasi hanya tahu alamat proxy-nya. Sarankan ini
sebagai bawaan; mode "langsung" tetap ada untuk mencoba-coba.

```js
// Apps Script — Proyek baru, tempel, Deploy > Web app,
// "Execute as: Me", "Who has access: Anyone".
// Simpan kunci di Project Settings > Script Properties: KUNCI_GEMINI
const MODEL = 'gemini-flash-lite-latest';

function doPost(e) {
  const minta = JSON.parse(e.postData.contents);
  const kunci = PropertiesService.getScriptProperties().getProperty('KUNCI_GEMINI');
  const r = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent',
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': kunci },
      payload: JSON.stringify({
        systemInstruction: { parts: [{ text: minta.arahan }] },
        contents: [{ role: 'user', parts: [{ text: minta.entri }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    });
  const j = JSON.parse(r.getContentText());
  const teks = j.candidates && j.candidates[0].content.parts[0].text || '';
  return ContentService.createTextOutput(JSON.stringify({ teks: teks }))
                       .setMimeType(ContentService.MimeType.JSON);
}
```

`pelabel.js` sudah mengirim `Content-Type: text/plain` dengan sengaja — supaya
CORS menganggapnya permintaan sederhana dan tidak mengirim preflight `OPTIONS`,
yang tidak dijawab Apps Script. Jangan diubah jadi `application/json`.

Sarankan juga membatasi kuncinya di Google Cloud Console (pembatasan situs
perujuk) sebagai lapis kedua.

---

## 3. PWA — `manifest.webmanifest` + `sw.js`

Ini yang membuatnya terasa seperti aplikasi, bukan halaman web.

- Manifest: `display: standalone`, `start_url: "./"`, warna ikut CSS
  (`#0f1115`), ikon 192 + 512.
- **`share_target`** — inilah yang menggantikan kebiasaan share-ke-WhatsApp:

  ```json
  "share_target": {
    "action": "./bagikan", "method": "POST", "enctype": "multipart/form-data",
    "params": { "title": "judul", "text": "teks", "url": "tautan",
                "files": [{ "name": "berkas", "accept": ["image/*", "*/*"] }] }
  }
  ```

  `sw.js` menangkap `POST ./bagikan`, menyimpan bawaannya ke IndexedDB, lalu
  `Response.redirect('./?bagikan=1')`. Wajib POST kalau mau bisa menerima
  berkas; GET hanya cukup untuk teks.
- Service worker juga menyinggahkan kerangka aplikasinya supaya bisa dibuka
  tanpa sinyal.

## 4. Ikon

`ikon.svg` lalu render jadi `ikon-192.png` dan `ikon-512.png`. Tidak ada
ImageMagick maupun PIL di lingkungan ini — pakai Playwright + Chromium
(`/opt/pw-browsers/chromium`) untuk memotret SVG-nya jadi PNG.

## 5. Uji terima

`uji/uji-tnote.mjs`, pola sama seperti repo editor. Yang paling perlu dijaga:

- `TOtak.benahiKategori('apps desig', ['apps design'])` → `apps design`,
  `dibetulkan: true`
- `TOtak.judulTautan('https://script.google.com/macros/s/AAA/dev')`
  memuat `uji coba` — dan yang `/exec` memuat `terbit`
- drop → cari → ketemu, **dengan jaringan dimatikan** (`page.route` blokir
  semua). Ini uji yang paling penting di seluruh berkas: kalau ini gagal,
  aturan nomor 1 sudah bocor.
- layar depan tidak menampilkan satu pun kartu

## 6. Nanti, kalau yang di atas sudah terpakai sehari-hari

- Sinkron ke Google Sheets lewat Apps Script (lapis simpanan). **Selalu di
  belakang layar, tidak pernah ditunggu.**
- `embedding` saat menyimpan → pencocokan makna tanpa memanggil AI saat mencari.
- Naik otomatis ke jalur cepat: kalau satu entri diambil tiga kali, tawarkan
  jadi pintasan keyboard (`;rek`).
- Kalau pencarian biasa nol hasil, baru lempar ke Gemini. Jarang, jadi murah.

---

## Yang belum diputuskan

- **Prompt draf: cukup versi terakhir, atau perlu membandingkan antar versi?**
  Belum terjawab. Menentukan seberapa serius `riwayat` perlu digarap
  (daftar sederhana vs pembandingan berdampingan). Tanyakan sebelum
  membangun tampilan riwayat yang rumit.
- Peran mana yang diisi lebih dulu. Rancangannya menampung semuanya sejak
  awal, tapi pengisiannya sebaiknya mulai dari satu.
