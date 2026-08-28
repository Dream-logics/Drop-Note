# Sisa kerja

Urutan besarnya ada di [`PROPOSAL-V2.md`](PROPOSAL-V2.md). Berkas ini yang
rinci, cukup untuk langsung jalan.

---

## Sudah jadi

- **Inti** — drop instan tanpa jaringan, pencarian offline, memo pad dengan
  riwayat versi di baris yang sama, pensiun + urung, layar depan kosong.
- **PWA** — bisa dipasang di HP, menerima tombol Bagikan (teks dan berkas),
  terbuka penuh tanpa sinyal.
- **Swalayan ke Google** (`awan.js`) — folder, folder berkas, dan spreadsheet
  dibuat sendiri oleh aplikasi. Cakupan cuma `drive.file`. Pemakai menekan satu
  tombol; tidak ada kode yang perlu ditempel, tidak ada yang perlu di-deploy.
- **Cadangan** (`sinkron.js`) — satu arah, berjalan saat aplikasi dibuka, tidak
  pernah di jalur drop. Berkas naik ke Drive; blob lokal dibuang, thumbnail
  tinggal supaya daftar tetap seketika tanpa sinyal.
- **Hapus permanen** — nisan (`dihapus`) naik ke awan, barisnya di Sheet dan
  berkasnya di Drive dihapus, baru entrinya dibuang dari HP. Tekan lama pada
  tombol buang; ketuk biasa tetap memensiunkan.
- **AI langsung ke Gemini** (`pelabel.js`), model `gemini-3.5-flash-lite`.
  Hemat = judul + kata kunci. Penuh = juga membaca isi foto dan PDF (OCR),
  hasilnya masuk ke `isi` supaya pencarian yang sudah ada langsung menemukannya.
- **Layar pemasangan** — muncul sekali, dua langkah, keduanya boleh dilewati.
- **Penyimpanan permanen** — `navigator.storage.persist()`.
- **Nama sebagai kulit** — hanya di `bawaan.js`, judul `index.html`, dan
  manifest. Dijaga uji.
- **Uji terima** — `node uji/uji-terima.mjs`, 51 lulus.

---

## Berikutnya

### 1. Sekali pakai *(kecil, dan menutup masalah tertua)*

`sekaliPakai: true` pada entri. Setelah dibuka atau disalin sekali, jalankan
rantai hapus permanen yang sudah ada. Ini jawaban langsung untuk wadah "MEMO
Satu Kali Pakai" yang tidak pernah kosong — di sini dia kosong sendiri, tanpa
satu pun keputusan.

- Tanda di layar catat, dan cip saring di hasil.
- Purge otomatis untuk yang pensiun lebih dari 90 hari **dan** `sekaliPakai`.

### 2. Kunci layar + enkripsi selektif

- PIN atau WebAuthn untuk membuka aplikasi. Ini pagar, bukan brankas — dan
  dikatakan begitu di layarnya.
- `rahasia: true` per entri → `isi` dienkripsi AES-GCM, kunci dari kata sandi
  lewat PBKDF2. Yang naik ke Sheet ikut tersandi.
- **Jangan** mengenkripsi semuanya: satu kata sandi yang harus diingat seumur
  hidup adalah risiko yang lebih besar daripada yang sedang dihindari.
- Entri rahasia tidak dikirim ke AI kecuali diizinkan per-entri.

### 3. Pencarian pakai bahasa manusia

Kalau kueri lebih dari tiga kata **atau** pencarian biasa nol hasil, baru
lempar ke Gemini untuk diubah jadi kata kunci + saringan. Jarang, jadi murah.
Tanpa AI atau tanpa sinyal: pencarian kata biasa, tetap jalan.

### 4. To-do & habit sebagai keadaan, bukan modul

`selesai` dan `tally[]` pada objek yang sama. Tidak ada layar baru, tidak ada
tombol jenis saat drop. Mencentang yang membuatnya jadi tugas — bukan memilih.

**Tunggu bukti dulu.** Dua fitur ini paling gampang dibayangkan dan paling
sering tidak dipakai.

### 5. Daftar hasil digulung (virtualized)

Di atas 200 kartu. Batasnya sudah ditulis di proposal; jadikan uji yang gagal
kalau dilanggar.

### 6. Huruf dibenamkan

Plus Jakarta Sans + IBM Plex Mono sebagai `@font-face` data URI, supaya tanpa
sinyal hurufnya tidak berubah dan tidak ada layar berkedip menunggu font.

### 7. Play Store

Domain sendiri + TWA lewat PWABuilder + akun developer $25 sekali. Paling
akhir, saat sudah jelas aplikasinya bertahan.

---

## Yang disarankan JANGAN dikerjakan

- Iklan.
- Daftar catatan terbaru di layar depan.
- Sinkron dua arah otomatis.
- Folder, tag bertingkat, papan kanban.
- Backend sendiri, selama penggunanya masih segelintir.

---

## Yang perlu dipasang sekali oleh pembuatnya

OAuth Client ID Google — langkahnya di [`GOOGLE.md`](GOOGLE.md). Itu satu-satunya
langkah teknis yang tersisa, dan itu pun cuma sekali seumur proyek.
