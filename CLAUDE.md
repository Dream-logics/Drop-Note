# Catatan untuk Claude berikutnya

Baca berkas ini sampai habis sebelum menyentuh kode. Berkas ini menjelaskan
**kenapa** aplikasi ini berbentuk seperti sekarang. Tanpa itu, hampir setiap
"perbaikan" yang kelihatan masuk akal justru merusak satu-satunya hal yang
menentukan aplikasi ini hidup atau mati.

## Ini aplikasi apa

Satu kotak untuk menimbun catatan, satu pencarian untuk mengambilnya kembali.
PWA, dipakai di HP, tanpa server.

Dipakai satu orang yang menjalankan banyak peran sekaligus. Catatannya selama
ini tersebar di Google Keep, puluhan grup chat ke diri sendiri, dan aplikasi
Notes bawaan — menumpuk sampai tidak bisa dicari lagi.

Aplikasi ini menggantikan semua itu dengan satu pintu masuk dan satu pencarian.

**Namanya sekarang "Drop Memory", dan nama itu kulit.** Dia cuma ditulis di
`public/bawaan.js`, judul `index.html`, dan manifest. Nama basis data, nama
berkas, nama global, dan nama kolom sengaja tidak menyebut merek sama sekali —
menggantinya besok tidak boleh menyentuh satu baris pun data pemakainya.

## Yang harus kamu pahami dulu, sebelum kode

Ini bukan latar belakang basa-basi. Empat temuan ini yang membentuk hampir
setiap keputusan teknis di sini.

**1. Ongkos sebenarnya adalah KEPUTUSAN, bukan waktu.**
Menghapus satu catatan cuma butuh dua detik. Yang mahal adalah memutuskan
masih perlu atau tidak. Tenaga memutuskan itu sudah habis dipakai di pekerjaan
utama. Jadi setiap kali kamu tergoda menambahkan pilihan, dialog konfirmasi,
atau "pengguna tinggal memilih…", ingat: **setiap keputusan yang kamu bebankan
adalah tagihan pada dompet yang sudah kosong.** Itu yang membunuh semua sistem
sebelumnya.

**2. Semua sistem sebelumnya gagal karena tidak punya SALURAN KELUAR.**
Semua yang masuk statusnya "ada" selamanya. Bug yang sudah diperbaiki sebulan
lalu tetap memakan tempat. Bahkan wadah yang sengaja dinamai "MEMO Satu Kali
Pakai" pun tidak pernah kosong. Di sini saluran keluarnya adalah **peringkat**, bukan
tombol hapus: yang sering dipakai naik (`dipakai`), yang tidak pernah disentuh
tenggelam sendiri. Tidak ada yang dibuang, tapi yang basi berhenti muncul.
Jangan pernah menggantinya dengan alur "rapikan catatanmu".

**3. Catatan lahir dalam 3 detik, jadi konteksnya tidak pernah ikut tertulis.**
Kartu berjudul "Link dev photo studio" akan dicari enam bulan kemudian dengan
kata "apps A" — dan tidak ada satu pun kata yang cocok. Itu bukan salah mesin
pencarinya; catatannya memang lahir setengah. Menambal selisih inilah
satu-satunya tugas AI di sini (lihat `public/pelabel.js`).

**4. Sesak datang dari TAMPILAN, bukan dari jumlah.**
Google Keep memaksa melihat dinding kartu tiap kali dibuka. Karena itu layar
depan aplikasi ini **kosong** — cuma kotak dan tombol. Timbunan yang tidak terlihat
tidak menyesakkan, mau sepuluh ribu sekalipun. **Jangan pernah menambahkan
daftar catatan terbaru di layar depan.** Itu perbaikan yang paling sering
terpikir, dan itu membatalkan seluruh gunanya.

## Aturan yang tidak boleh dilanggar

1. **Memasukkan harus instan, offline, tanpa keputusan.** Drop menulis ke
   IndexedDB dan selesai. Tidak ada jaringan di jalur masuk. Tidak pernah.
   Begitu nge-drop terasa berat, kebiasaannya mati dan aplikasinya ikut mati.
2. **Pelabelan AI menyusul di belakang**, borongan, dan boleh gagal diam-diam.
   Aplikasi harus jalan penuh tanpa AI sama sekali. **Kuncinya milik pembuat,
   di proxy** — pemakai tidak pernah memegang, membeli, atau menempel kunci.
   Yang memutuskan seseorang berhak itu proxy, bukan aplikasi; kalau keputusan
   itu pindah ke sisi klien, siapa pun bisa mengubahnya.
3. **Pencarian tanpa jaringan.** Berjalan di atas salinan lokal. Ini tindakan
   yang paling sering dilakukan, jadi harus yang paling murah.
4. **Tidak ada yang benar-benar terhapus.** Yang basi tenggelam.
5. **Layar depan kosong.**
6. **Judul yang diketik sendiri tidak pernah ditimpa AI** (`judulManual`).
7. **Swalayan.** Folder Drive dan spreadsheet dibuat aplikasi, bukan pemakainya.
   Satu-satunya yang diminta darinya: kunci Gemini, dan itu pun boleh dilewati.
   **Client ID Google tidak pernah ditanyakan ke pemakai** — itu ditanam sekali
   di `bawaan.js` oleh pembuatnya, dan isiannya cuma muncul kalau masih kosong.
   Kalau pemasangan sampai meminta sesuatu yang berbau konfigurasi teknis,
   pemasangannya sudah gagal sebelum dimulai.
8. **Nama aplikasi cuma di `bawaan.js`.** Jangan pernah menuliskannya di berkas
   lain, dan jangan pernah menurunkan nama basis data atau kunci setelan dari
   nama itu — data pemakainya ikut hilang kalau namanya berganti.

## Peta berkas

```
public/index.html   kerangka semua layar (mulai, utama, hasil, catat, setelan)
public/bawaan.js    SATU-SATUNYA tempat nama aplikasi & model AI ditulis
public/gaya.css     gaya; gelap dulu, terang lewat prefers-color-scheme
public/simpan.js    IndexedDB — entri, berkas (blob), setelan, cadangan
public/otak.js      SEMUA yang menebak, tanpa AI: baca jenis, susun judul dari
                    alamat, bakukan istilah judul (Inggris dulu kalau bentrok:
                    Link bukan Tautan), betulkan kategori salah ketik, tarik
                    kata kunci, pisahkan elemen berpola, nilai hasil pencarian
public/awan.js      Google Drive & Sheets langsung — folder dan spreadsheet
                    dibuat SENDIRI oleh aplikasi; cakupan cuma drive.file
public/pelabel.js   satu-satunya bagian ber-AI: judul + elemen + tag + OCR.
                    Lewat proxy milik PEMBUAT; kunci tidak pernah ada di
                    perangkat pemakai. Daftar tag lama ikut dikirim supaya
                    tag tidak beranak sendiri
public/tugas.js     to-do berdiri sendiri: centang, penting, Hari Ini, tenggat,
                    ulang, langkah, catatan. Daftar ganda lewat keyword yang
                    sudah ada - opsional, tidak pernah wajib
public/kunci.js     enkripsi SELEKTIF: cuma yang kamu tandai. Isi & elemen
                    dikunci, judul & tag tetap terbuka supaya masih bisa
                    ditemukan. Yang terkunci tidak pernah dikirim ke AI
public/sinkron.js   cadangan satu arah ke Drive; tidak pernah di jalur drop
public/alur.js      alur UI — semua layar, drop, cari, catat, setelan
public/sw.js        service worker — singgahan kerangka + penerima "Bagikan"
public/manifest.webmanifest   supaya bisa dipasang di HP
uji/uji-terima.mjs            uji terima (Playwright)
uji/palsu-google.mjs          tiruan Drive+Sheets di memori untuk uji
docs/RANCANGAN.md   alasan di balik rancangannya
docs/PROPOSAL-V2.md rencana bertahap yang sedang dikerjakan
docs/GOOGLE.md      satu langkah pembuat: OAuth Client ID
docs/PROXY-AI.md    layanan AI + daftar pengguna terdaftar; kodenya lengkap
docs/SISA-KERJA.md  yang belum dikerjakan, cukup rinci untuk langsung jalan
docs/mockup/        sumber mockup UI (3 arah; yang dipilih: B)
```

## Keadaan sekarang

**Aplikasinya sudah jalan**, dan sudah benar-benar dijalankan di Chromium —
bukan cuma lolos `node --check`. Empat layarnya hidup, bisa dipasang di HP,
menerima tombol Bagikan dari aplikasi lain, dan terbuka penuh tanpa sinyal.

Sebelum menyentuh kode, jalankan dulu `node uji/uji-terima.mjs` (165 lulus).
Kalau ada satu saja yang gagal setelah suntinganmu, kemungkinan besar yang
bocor adalah salah satu aturan di atas — bukan sekadar uji yang rewel.

Yang belum: catatan sekali pakai, pencarian pakai bahasa manusia, habit sebagai
keadaan. Urutannya di
`docs/PROPOSAL-V2.md`, rinciannya di `docs/SISA-KERJA.md`.

## Konvensi

Diikuti dari repo `text-image-editor` yang satu penulis, supaya satu keluarga
dan supaya tidak perlu belajar gaya baru:

- **Vanilla JS.** Tanpa framework, tanpa build step, tanpa npm untuk aplikasinya.
  Buka berkasnya, jalan. Tiap berkas satu IIFE `(function(global){ 'use strict';
  … })(window)` yang menggantung satu objek global (`TSimpan`, `TOtak`,
  `TPelabel`).
- **Bahasa Indonesia** untuk komentar, nama variabel, dan seluruh teks di layar.
- **Komentar menjelaskan KENAPA, bukan APA.** Kalau satu keputusan bisa
  disalahpahami sebagai kekeliruan, tulis alasannya di situ. Contoh gayanya ada
  di kepala tiap berkas.
- Kepala berkas pakai blok `/* ===== … ===== */`.
- CSS: variabel pendek (`--g` dasar, `--p` permukaan, `--i` tinta, `--m` redup,
  `--l` garis, `--a` aksen). Gelap bawaan, terang lewat
  `@media (prefers-color-scheme: light)`.
- Sasaran sentuh minimal 44px. Ini dipakai satu tangan sambil mengerjakan hal lain.
- Uji terima pakai Playwright (`node uji/…`), Chromium di
  `/opt/pw-browsers/chromium`.

## Cara membalas

Pesan yang masuk ke sini pendek — biasanya dari HP, di sela pekerjaan lain.
Balas seimbang dengan itu. Jawaban 600 kata untuk pertanyaan 15 kata bukan
membantu — itu menambah beban di tempat yang sama. Kalau ada yang perlu
diputuskan, tawarkan satu rekomendasi, bukan daftar pilihan.

Dan kalau kamu diberi tahu rancanganmu keliru, kemungkinan besar memang keliru.
Selama percakapan yang melahirkan aplikasi ini, hampir setiap koreksi yang
masuk terbukti benar.
