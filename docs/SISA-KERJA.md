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
- **Cadangan harian ke Google Sheets** (`public/sinkron.js`) — satu arah,
  DB → Sheet, berjalan saat aplikasi dibuka dan **tidak pernah** di jalur drop.
  Menarik balik adalah tombol manual, dan yang di HP selalu menang kalau lebih
  baru. Isi berkas tidak ikut; yang dijamin teksnya.
- **Penyimpanan permanen** — `navigator.storage.persist()` diminta saat aplikasi
  dibuka, supaya browser tidak membuang timbunan sendiri saat HP sesak.
  Statusnya kelihatan di Setelan.
- **Uji terima** — `node uji/uji-dropnote.mjs`, 42 lulus. Termasuk dua yang
  paling menentukan: drop → cari → ketemu dengan **semua permintaan keluar
  diblokir**, dan **drop tidak memanggil jaringan sama sekali** meski cadangan
  sedang nyala dan penahan jedanya dilepas.
- **Jawaban soal kunci Gemini** — dijawab jujur di layar Setelan sendiri, dan
  tidak disamarkan jadi UI yang seolah-olah aman. Ringkasnya: di aplikasi yang
  seluruhnya jalan di browser, kunci API **tidak bisa** benar-benar
  disembunyikan. Yang benar-benar menyembunyikan cuma proxy.

---

## Yang masih perlu dipasang sekali di sisi pemakai

Bukan pekerjaan kode — pekerjaan sekali pasang, ±10 menit.

**Buat satu Google Sheets kosong, tempel satu Apps Script, deploy, tempel
alamat + sandinya di Setelan.** Satu deployment melayani cadangan harian
sekaligus pelabelan AI. Langkah dan kodenya lengkap di
[`docs/APPS-SCRIPT.md`](APPS-SCRIPT.md).

Batasi juga kunci Gemini-nya di Google Cloud Console (pembatasan situs
perujuk) sebagai lapis kedua.

**Jangan pernah menaruh alamat `/exec` atau sandinya ke dalam repo.** Repo ini
publik, dan riwayat Git menyimpan segalanya — menghapusnya dari commit
berikutnya tidak menghapus apa pun.

---

## Berikutnya, kalau yang di atas sudah terpakai sehari-hari

Urutannya sengaja begitu: jangan bangun apa pun di bawah ini sebelum
aplikasinya benar-benar dipakai sebulan. Risiko terbesar proyek ini bukan
teknis — melainkan sistemnya tidak bertahan sebulan seperti pendahulunya.

- `embedding` saat menyimpan → pencocokan makna tanpa memanggil AI saat mencari.
- Naik otomatis ke jalur cepat: kalau satu entri diambil tiga kali, tawarkan
  jadi pintasan keyboard (`;rek`).
- Kalau pencarian biasa nol hasil, baru lempar ke Gemini. Jarang, jadi murah.
- Memanggil lewat konteks, bukan kata kunci: buka "apps A" → keluar isi raknya.
  Sekarang baru separuh jalan lewat cip kategori di layar hasil.

---

## Sudah diputuskan

**Prompt draf: cukup versi terakhir saja.** Diputuskan 27 Agustus 2026.
Riwayat cuma perlu menjawab "mana yang terakhir" — **jangan** bangun
pembandingan antar versi berdampingan. Bentuk yang sekarang (daftar sederhana
+ tombol "pulihkan") sudah cukup dan sudah selesai. Menambah pembandingan
berarti menambah keputusan yang harus diambil tiap kali membuka riwayat, dan
itu persis ongkos yang aplikasi ini dibangun untuk menghapusnya.

---

## Yang belum diputuskan

- Peran mana yang diisi lebih dulu. Rancangannya menampung semuanya sejak
  awal, tapi pengisiannya sebaiknya mulai dari satu.
