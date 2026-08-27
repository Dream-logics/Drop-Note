# Sisa kerja

Nomor 1 sampai 5 di daftar lama sudah dikerjakan; yang tersisa ada di bawah.
Riwayat lengkap alasannya tetap di `docs/RANCANGAN.md`.

---

## Sudah jadi

- **`public/dropnote.js`** — alur UI penuh: drop, cari, catat, setelan,
  lampiran (gambar dikecilkan ke 1600px/JPEG 0.82, berkas, rekaman suara,
  daftar centang), riwayat versi, pensiun + urung.
- **PWA** — `manifest.webmanifest`, `sw.js`, `ikon.svg` + PNG 192/512.
  `share_target` POST sudah menerima teks **dan** berkas dari tombol Bagikan
  aplikasi lain; kerangka disinggahkan supaya terbuka tanpa sinyal.
- **Uji terima** — `node uji/uji-dropnote.mjs`, 31 lulus. Termasuk yang paling
  menentukan: drop → cari → ketemu dengan **semua permintaan keluar diblokir**.
- **Jawaban soal kunci Gemini** — dijawab jujur di layar Setelan sendiri, dan
  tidak disamarkan jadi UI yang seolah-olah aman. Ringkasnya: di aplikasi yang
  seluruhnya jalan di browser, kunci API **tidak bisa** benar-benar
  disembunyikan. Yang benar-benar menyembunyikan cuma proxy.

---

## Yang masih perlu dipasang pemiliknya

Bukan pekerjaan kode — pekerjaan sekali pasang.

### Proxy Apps Script (mode "Proxy" di Setelan)

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

Batasi juga kuncinya di Google Cloud Console (pembatasan situs perujuk)
sebagai lapis kedua.

---

## Berikutnya, kalau yang di atas sudah terpakai sehari-hari

Urutannya sengaja begitu: jangan bangun apa pun di bawah ini sebelum
aplikasinya benar-benar dipakai sebulan. Risiko terbesar proyek ini bukan
teknis — melainkan sistemnya tidak bertahan sebulan seperti pendahulunya.

- Sinkron ke Google Sheets lewat Apps Script (lapis simpanan). **Selalu di
  belakang layar, tidak pernah ditunggu.**
- `embedding` saat menyimpan → pencocokan makna tanpa memanggil AI saat mencari.
- Naik otomatis ke jalur cepat: kalau satu entri diambil tiga kali, tawarkan
  jadi pintasan keyboard (`;rek`).
- Kalau pencarian biasa nol hasil, baru lempar ke Gemini. Jarang, jadi murah.
- Memanggil lewat konteks, bukan kata kunci: buka "apps A" → keluar isi raknya.
  Sekarang baru separuh jalan lewat cip kategori di layar hasil.

---

## Sudah diputuskan

**Prompt draf: cukup versi terakhir saja.** Dijawab pemiliknya, 27 Agustus 2026.
Riwayat cuma perlu menjawab "mana yang terakhir" — **jangan** bangun
pembandingan antar versi berdampingan. Bentuk yang sekarang (daftar sederhana
+ tombol "pulihkan") sudah cukup dan sudah selesai. Menambah pembandingan
berarti menambah keputusan yang harus diambil tiap kali membuka riwayat, dan
itu persis ongkos yang aplikasi ini dibangun untuk menghapusnya.

---

## Yang belum diputuskan

- Peran mana yang diisi lebih dulu. Rancangannya menampung semuanya sejak
  awal, tapi pengisiannya sebaiknya mulai dari satu.
