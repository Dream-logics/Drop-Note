# Layanan AI — kunci milik pembuat, bukan pemakai

Ada **dua versi** aplikasi ini, dan bedanya bukan fitur, melainkan siapa yang
membayar berpikirnya:

| | Tanpa AI | Dengan AI |
|---|---|---|
| Siapa | siapa saja | **pengguna terdaftar** |
| Kunci Gemini | tidak ada | milik **pembuat**, di server |
| Yang diminta ke pemakai | tidak ada | tidak ada |
| Drop, cari, cadangan | jalan penuh | jalan penuh |

Pemakai **tidak pernah memegang kunci API**. Dia tidak membelinya, tidak
menempelnya, tidak tahu ada kunci. Dia sudah menyambungkan akun Google-nya
untuk cadangan — dan dari situlah layanan mengenalinya.

Kalau akunnya terdaftar, AI bekerja diam-diam. Kalau tidak, semua yang lain
tetap jalan seperti biasa dan Setelan menyebutkan sebabnya sekali, tanpa
mengganggu.

---

## Cara kerjanya

```
Aplikasi                      Proxy (punyamu)              Gemini
   │                                │                        │
   │ token Google pemakai ─────────►│                        │
   │                                │ tanya Google:          │
   │                                │ "token ini siapa?"     │
   │                                │◄── email + aud         │
   │                                │                        │
   │                                │ cek daftar terdaftar   │
   │                                │                        │
   │                                │ kunci PEMBUAT ────────►│
   │◄──────── jawaban ──────────────│◄───────────────────────│
```

Yang memutuskan seseorang berhak atau tidak adalah **proxy**, bukan aplikasi.
Kalau keputusan itu diambil di sisi aplikasi, siapa pun bisa mengubahnya dengan
membuka devtools.

Pemeriksaan `aud` itu bukan hiasan: tanpa itu, token dari aplikasi Google mana
pun bisa dipakai untuk menumpang layananmu.

---

## Pasang (sekali, ±10 menit)

1. Buat **Google Sheets** baru — ini daftar penggunamu. Beri satu tab bernama
   `pengguna`, dengan kolom:

   | A · email | B · sampai (opsional) |
   |---|---|
   | `staf1@gmail.com` | `2027-01-31` |
   | `staf2@gmail.com` | *(kosong = selamanya)* |

2. Di Sheet itu: **Extensions → Apps Script**. Tempel kode di bawah.

3. **Project Settings → Script Properties:**

   | Nama | Isi |
   |---|---|
   | `KUNCI_GEMINI` | kunci Gemini-mu dari [AI Studio](https://aistudio.google.com/apikey) |
   | `CLIENT_ID` | OAuth Client ID yang sama dengan di `bawaan.js` |

4. **Deploy → New deployment → Web app** — *Execute as: Me*,
   *Who has access: Anyone*. Salin alamat `/exec`.

5. Tempel alamat itu ke `alamatAI` di `public/bawaan.js`. Selesai — semua
   pemakai langsung terlayani, tanpa mengisi apa pun.

Menambah pelanggan nanti = menambah satu baris di Sheet. Bisa dari HP.

---

## Kodenya

```js
/* Proxy AI. Kunci Gemini tidak pernah meninggalkan berkas ini. */

const P = PropertiesService.getScriptProperties();
const MODEL = 'gemini-3.5-flash-lite';
const TAB = 'pengguna';

function doPost(e) {
  try {
    const minta = JSON.parse(e.postData.contents);
    const email = emailDari(minta.token);
    if (!email) return jawab({ galat: 'token-tidak-dikenali' });
    if (!terdaftar(email)) return jawab({ galat: 'belum-terdaftar' });

    catatPakai(email);
    return jawab(keGemini(minta));
  } catch (err) {
    return jawab({ galat: String((err && err.message) || err) });
  }
}

function jawab(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/* Google sendiri yang bilang token ini milik siapa. Aplikasi tidak pernah
   ditanya - apa pun yang dia kirim soal identitas tidak dipercaya. */
function emailDari(token) {
  if (!token) return '';
  const r = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return '';
  const j = JSON.parse(r.getContentText());

  /* Tanpa pemeriksaan aud, token dari aplikasi Google mana pun bisa dipakai
     untuk menumpang kuota Gemini-mu. */
  if (j.aud !== P.getProperty('CLIENT_ID')) return '';
  if (j.email_verified === 'false') return '';
  return String(j.email || '').toLowerCase();
}

function terdaftar(email) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB);
  if (!sh || sh.getLastRow() < 2) return false;
  const baris = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const hariIni = new Date();
  for (const [alamat, sampai] of baris) {
    if (String(alamat).trim().toLowerCase() !== email) continue;
    if (!sampai) return true;                       /* kosong = selamanya */
    return new Date(sampai) >= hariIni;
  }
  return false;
}

/* Catatan pemakaian, supaya kelak ada dasar untuk menagih - dan supaya
   penyalahgunaan kelihatan sebelum tagihannya datang. */
function catatPakai(email) {
  const buku = SpreadsheetApp.getActive();
  const sh = buku.getSheetByName('pakai') || buku.insertSheet('pakai');
  if (sh.getLastRow() === 0) sh.appendRow(['waktu', 'email']);
  sh.appendRow([new Date(), email]);
}

function keGemini(minta) {
  const kunci = P.getProperty('KUNCI_GEMINI');
  if (!kunci) return { galat: 'KUNCI_GEMINI belum diisi' };

  const r = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent',
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': kunci },
      payload: JSON.stringify({
        systemInstruction: { parts: [{ text: minta.arahan }] },
        contents: [{ role: 'user', parts: minta.bagian }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    });

  const j = JSON.parse(r.getContentText());
  if (j.error) return { galat: j.error.message };
  return j;   /* diteruskan apa adanya; aplikasi yang menguraikannya */
}
```

---

## Yang perlu diketahui

**`Content-Type: text/plain` itu disengaja.** Aplikasi mengirim begitu supaya
CORS menganggapnya permintaan sederhana dan tidak mengirim preflight `OPTIONS` —
yang tidak pernah dijawab Apps Script. Jangan diubah jadi `application/json`.

**Batas Apps Script:** 20.000 panggilan UrlFetch per hari untuk akun biasa, dan
6 menit per eksekusi. Untuk kamu dan staf, itu berlebihan. Kalau kelak
penggunanya ratusan, pindahkan berkas ini ke Cloudflare Workers — bentuk
permintaannya sama persis, jadi aplikasinya tidak perlu diubah sama sekali.

**Membaca berkas (mode Penuh)** mengirim gambar sebagai base64 lewat proxy.
Aplikasi sudah membatasi 5 MB per berkas; base64 menambah sekitar sepertiga,
masih jauh di bawah batas Apps Script.

**Mode pengembang.** Selama `alamatAI` di `bawaan.js` masih kosong, Setelan
menampilkan isian kunci Gemini supaya kamu bisa mencoba tanpa proxy. Begitu
alamatnya diisi, isian itu hilang untuk semua orang.
