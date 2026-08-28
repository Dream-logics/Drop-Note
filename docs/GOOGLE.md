# Menyambungkan ke Google

Aplikasinya **swalayan**: folder, spreadsheet, dan folder berkas dibuat sendiri
oleh aplikasi di Drive milik pemakainya. Pemakai tidak membuat apa pun, tidak
menempel kode ke mana pun, tidak men-deploy apa pun.

Tapi ada satu langkah yang tidak bisa dihilangkan siapa pun, dan itu langkah
**pembuat aplikasi**, bukan pemakainya: OAuth tidak ada tanpa Client ID.

Dikerjakan **sekali seumur proyek**, ditanam di `public/bawaan.js`, lalu
**tidak ada satu pun pemakai yang pernah melihatnya**.

## Apa yang dilihat pemakai

Satu tombol **Hubungkan Google**, lalu layar izin Google yang biasa — "Aplikasi
ini ingin melihat, mengedit, membuat, dan menghapus berkas Drive miliknya
sendiri". Tekan Izinkan, selesai. Sama persis seperti aplikasi lain yang pernah
dia pasang.

Isian Client ID di layar pemasangan hanya muncul kalau `clientId` di
`bawaan.js` masih kosong — artinya hanya di mesin pengembangnya. Begitu diisi,
isian itu hilang untuk semua orang.

---

## Sekali, oleh pembuatnya (±10 menit)

1. Buka <https://console.cloud.google.com> → **New Project**. Namanya bebas.

2. **APIs & Services → Library**, nyalakan dua ini:
   - **Google Drive API**
   - **Google Sheets API**

3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - Isi nama aplikasi, email dukungan, email pengembang.
   - Bagian *Scopes* boleh dilewati — cakupannya diminta saat berjalan.
   - **Publishing status → PUBLISH APP.**

   > Ini penting dan sering salah. Selama statusnya masih *Testing*, tiap
   > pemakai harus didaftarkan satu per satu dan izinnya kedaluwarsa tiap
   > 7 hari. Karena aplikasi ini **hanya meminta `drive.file`** — cakupan yang
   > tidak dianggap sensitif oleh Google — menerbitkannya **tidak memerlukan
   > peninjauan**. Terbitkan saja.

4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins** — isi asal aplikasimu, tanpa jalur:
     ```
     https://dream-logics.github.io
     http://localhost:8080
     ```
     Cukup skema + host. Sub-jalur seperti `/Drop-Note/` tidak ditulis dan
     tidak perlu — karena itu mengganti nama repo tidak pernah menyentuh
     Client ID: yang berubah cuma jalurnya, bukan asalnya.
   - Salin **Client ID**-nya.

5. Tempel Client ID itu ke layar pemasangan aplikasi — atau, kalau mau semua
   pemakai langsung terisi, ke `clientId` di `public/bawaan.js`.

---

## Client ID itu bukan rahasia

Dia memang terbaca di semua aplikasi browser, tanpa kecuali. Yang menjaganya
adalah daftar **Authorized JavaScript origins** di atas: token hanya diberikan
kepada halaman yang berjalan di asal itu. Jadi menaruhnya di repo publik pun
tidak apa-apa.

Yang **tidak boleh** masuk repo: kunci Gemini. Itu milik tiap pemakai, tinggal
di HP-nya sendiri.

---

## Kenapa cuma `drive.file`

Cakupan ini memberi akses **hanya ke berkas yang dibuat aplikasi ini sendiri**.
Isi Drive pemakai yang lain tidak terlihat sama sekali — bukan "tidak dibaca",
tapi memang tidak bisa.

Akibatnya tiga-tiganya baik: pemakainya tidak perlu menyerahkan seluruh
Drive-nya, layar izinnya tidak menakutkan, dan Google tidak menuntut peninjauan.

---

## Yang dibuat aplikasi di Drive-mu

```
Drive/
  └─ Drop Memory/            <- dibuat aplikasi
       ├─ cadangan           <- spreadsheet: satu baris per catatan
       └─ berkas/            <- gambar, dokumen, rekaman
```

Spreadsheet-nya bisa kamu buka dan baca sendiri kapan saja — tombolnya ada di
Setelan. Kolomnya mengikuti `TAwan.KOLOM` di `public/awan.js`; kalau urutannya
diubah, ubah juga `pipihkan()` dan `mekarkan()` di `public/sinkron.js`.
Keduanya harus sepakat, kalau tidak isi kolom bergeser.

---

## Kunci Gemini

Terpisah, dan opsional. Aplikasinya jalan penuh tanpa AI.

1. <https://aistudio.google.com/apikey> → **Create API key**.
2. Tempel di layar pemasangan, atau Setelan → Bantuan AI.

Model bawaan: **`gemini-3.5-flash-lite`**. Dua tingkat:

| Mode | Yang dikerjakan |
|---|---|
| **Hemat** | judul + kata kunci untuk catatan teks |
| **Penuh** | juga membaca isi foto dan PDF (KTP, kontrak, struk) supaya bisa dicari lewat isinya |

Kuncinya tinggal di HP dan **tidak bisa benar-benar disembunyikan** — itu
konsekuensi aplikasi yang seluruhnya berjalan di browser, dan dikatakan apa
adanya di layar Setelan. Karena kuncinya milik pemakainya sendiri, risikonya
juga miliknya: cabut dari AI Studio kalau HP-nya hilang.
