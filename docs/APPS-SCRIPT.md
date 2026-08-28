# Apps Script — satu skrip, dua tugas

Satu deployment melayani **cadangan harian ke Sheets** dan **pelabelan AI**.
Satu alamat, satu sandi, sekali pasang.

Kuncinya: kunci Gemini dan sandi tinggal di Apps Script sebagai Script
Property. Aplikasi di HP cuma tahu alamat dan sandinya. Itu satu-satunya cara
kunci benar-benar tersembunyi di aplikasi yang jalan di browser.

---

## Pasang (sekali, ±10 menit)

1. Buat **Google Sheets kosong** baru. Namanya bebas — misalnya `Drop Note`.
2. Di Sheet itu: **Extensions → Apps Script**. Skripnya jadi menempel ke Sheet,
   jadi tidak perlu menyalin ID apa pun.
3. Hapus isi editornya, tempel seluruh kode di bawah, simpan.
4. **Project Settings → Script Properties → Add script property:**
   | Nama | Isi |
   |---|---|
   | `SANDI` | karangan bebas, panjang, acak. Ini yang menjaga pintunya. |
   | `KUNCI_GEMINI` | kunci Gemini-mu. Kosongkan saja kalau belum mau AI. |
5. **Deploy → New deployment → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Salin alamat `/exec`-nya.
6. Di HP: **Setelan → Apps Script** → tempel alamat dan sandi → **Uji sambungan**.
   Lalu **Cadangan harian → Nyala**.

> *"Anyone" terdengar menakutkan, dan memang itu sebabnya `SANDI` wajib diisi.*
> *Tanpa sandi, siapa pun yang tahu alamatnya bisa membaca seluruh catatanmu.*
> *Jangan pernah menaruh alamat atau sandi ini ke dalam repo.*

---

## Kodenya

```js
/* Drop Note — proxy Apps Script.
   Melayani: cadangan (sinkron/pulihkan) dan pelabelan AI (label). */

const P = PropertiesService.getScriptProperties();
const NAMA_LEMBAR = 'entri';
const MODEL_BAWAAN = 'gemini-flash-lite-latest';

/* Urutan kolom ini harus sama persis dengan yang dikirim sinkron.js.
   Kalau diubah, ubah juga di sana - kalau tidak, isi kolom bergeser. */
const KOLOM = ['id', 'jenis', 'judul', 'judulManual', 'isi', 'kategori', 'label',
               'daftar', 'berkasId', 'namaBerkas', 'tipeBerkas', 'ukuran',
               'dibuat', 'diubah', 'dipakai', 'diLabeliAI', 'pensiun', 'riwayat'];

function doPost(e) {
  try {
    const minta = JSON.parse(e.postData.contents);
    const sandi = P.getProperty('SANDI');
    if (sandi && minta.sandi !== sandi) return jawab({ galat: 'Sandi salah' });

    if (minta.tugas === 'halo')     return jawab({ baris: Math.max(0, lembar().getLastRow() - 1) });
    if (minta.tugas === 'sinkron')  return jawab(simpan(minta.entri || []));
    if (minta.tugas === 'pulihkan') return jawab({ entri: bacaSemua() });
    if (minta.tugas === 'label')    return jawab(label(minta));
    return jawab({ galat: 'Tugas tidak dikenali: ' + minta.tugas });
  } catch (err) {
    return jawab({ galat: String((err && err.message) || err) });
  }
}

function jawab(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

function lembar() {
  const buku = SpreadsheetApp.getActive();
  let sh = buku.getSheetByName(NAMA_LEMBAR);
  if (!sh) {
    sh = buku.insertSheet(NAMA_LEMBAR);
    /* Seluruh lembar dipaksa berformat teks. Tanpa ini, catatan yang diawali
       "=" atau "+" ditelan Sheets sebagai rumus - dan tulisannya rusak diam-diam. */
    sh.getRange(1, 1, sh.getMaxRows(), KOLOM.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, KOLOM.length).setValues([KOLOM]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function simpan(entri) {
  const sh = lembar();
  const akhir = sh.getLastRow();

  const barisDariId = {};
  if (akhir > 1) {
    const id = sh.getRange(2, 1, akhir - 1, 1).getValues();
    for (let i = 0; i < id.length; i++) barisDariId[String(id[i][0])] = i + 2;
  }

  const tambahan = [];
  entri.forEach(function (e) {
    const baris = KOLOM.map(function (k) { return e[k] == null ? '' : String(e[k]); });
    const ada = barisDariId[String(e.id)];
    /* Merevisi memperbarui BARIS YANG SAMA. Inilah kenapa aplikasi ini ada:
       di Keep tiap revisi melahirkan catatan baru, dan duplikatnya beranak. */
    if (ada) sh.getRange(ada, 1, 1, KOLOM.length).setValues([baris]);
    else tambahan.push(baris);
  });

  if (tambahan.length) {
    sh.getRange(sh.getLastRow() + 1, 1, tambahan.length, KOLOM.length).setValues(tambahan);
  }
  return { disimpan: entri.length, baris: Math.max(0, sh.getLastRow() - 1) };
}

function bacaSemua() {
  const sh = lembar();
  const akhir = sh.getLastRow();
  if (akhir < 2) return [];
  return sh.getRange(2, 1, akhir - 1, KOLOM.length).getValues().map(function (r) {
    const o = {};
    KOLOM.forEach(function (k, i) { o[k] = r[i]; });
    return o;
  }).filter(function (o) { return o.id; });
}

function label(minta) {
  const kunci = P.getProperty('KUNCI_GEMINI');
  if (!kunci) return { galat: 'KUNCI_GEMINI belum diisi di Script Properties' };

  const r = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL_BAWAAN + ':generateContent',
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': kunci },
      payload: JSON.stringify({
        systemInstruction: { parts: [{ text: minta.arahan }] },
        contents: [{ role: 'user', parts: [{ text: minta.entri }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    });
  const j = JSON.parse(r.getContentText());
  const teks = (j.candidates && j.candidates[0].content.parts[0].text) || '';
  return { teks: teks };
}
```

---

## Yang perlu diketahui

**`Content-Type: text/plain` itu disengaja.** Aplikasinya mengirim begitu supaya
CORS menganggapnya permintaan sederhana dan tidak mengirim preflight `OPTIONS` —
yang tidak pernah dijawab Apps Script. Jangan diubah jadi `application/json`.

**Isi berkas tidak ikut naik.** Gambar dan rekaman tetap hanya di HP; yang masuk
Sheet cuma nama dan ukurannya. Sheet tidak dirancang memuat blob, dan cadangan
berisi foto akan gagal di tengah jalan.

**Satu arah.** Aplikasi mengirim, tidak pernah menarik otomatis. Menarik balik
adalah tombol manual di Setelan, dan yang di HP selalu menang kalau lebih baru —
memulihkan tidak boleh memundurkan tulisan yang belum sempat naik.

**Batas Sheets:** 10 juta sel per spreadsheet. Dengan 18 kolom, itu sekitar
550.000 catatan. Tidak akan jadi masalah.

**Kalau `KOLOM` diubah**, ubah juga `pipihkan()` dan `mekarkan()` di
`public/sinkron.js`. Keduanya harus sepakat, kalau tidak isi kolom bergeser.
