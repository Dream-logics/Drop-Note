# Drop Note — catatan untuk Claude berikutnya

Baca berkas ini sampai habis sebelum menyentuh kode. Berkas ini menjelaskan
**kenapa** aplikasi ini berbentuk seperti sekarang. Tanpa itu, hampir setiap
"perbaikan" yang kelihatan masuk akal justru merusak satu-satunya hal yang
menentukan aplikasi ini hidup atau mati.

## Ini aplikasi apa

Satu kotak untuk menimbun catatan, satu pencarian untuk mengambilnya kembali.
PWA, dipakai di HP, tanpa server.

Pemiliknya menjalankan banyak peran sekaligus — bisnis, programmer, penulis
konten, customer service, dan lainnya — dan catatannya selama ini tersebar di
Google Keep, sekitar 50 grup WhatsApp berisi dirinya sendiri, dan aplikasi
Notes. Semuanya menumpuk sampai tidak bisa dicari lagi.

Drop Note menggantikan semua itu dengan satu pintu masuk dan satu pencarian.

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
lalu tetap memakan tempat. Bahkan grup WhatsApp bernama "MEMO Satu Kali Pakai"
pun tidak pernah kosong. Di sini saluran keluarnya adalah **peringkat**, bukan
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
depan Drop Note **kosong** — cuma kotak dan tombol. Timbunan yang tidak terlihat
tidak menyesakkan, mau sepuluh ribu sekalipun. **Jangan pernah menambahkan
daftar catatan terbaru di layar depan.** Itu perbaikan yang paling sering
terpikir, dan itu membatalkan seluruh gunanya.

## Aturan yang tidak boleh dilanggar

1. **Memasukkan harus instan, offline, tanpa keputusan.** Drop menulis ke
   IndexedDB dan selesai. Tidak ada jaringan di jalur masuk. Tidak pernah.
   Begitu nge-drop terasa berat, kebiasaannya mati dan aplikasinya ikut mati.
2. **Pelabelan AI menyusul di belakang**, borongan, dan boleh gagal diam-diam.
   Aplikasi harus jalan penuh tanpa AI sama sekali.
3. **Pencarian tanpa jaringan.** Berjalan di atas salinan lokal. Ini tindakan
   yang paling sering dilakukan, jadi harus yang paling murah.
4. **Tidak ada yang benar-benar terhapus.** Yang basi tenggelam.
5. **Layar depan kosong.**
6. **Judul yang diketik sendiri tidak pernah ditimpa AI** (`judulManual`).

## Peta berkas

```
public/index.html   kerangka semua layar (utama, hasil, catat, setelan)
public/dropnote.css    gaya; gelap dulu, terang lewat prefers-color-scheme
public/simpan.js    IndexedDB — entri, berkas (blob), setelan, cadangan
public/otak.js      SEMUA yang menebak, tanpa AI: baca jenis, susun judul dari
                    alamat, betulkan kategori salah ketik, tarik kata kunci,
                    nilai hasil pencarian
public/pelabel.js   satu-satunya bagian ber-AI (Gemini / proxy Apps Script)
public/dropnote.js     BELUM ADA — alur UI. Ini yang berikutnya dikerjakan.
docs/RANCANGAN.md   alasan di balik rancangannya
docs/SISA-KERJA.md  yang belum dikerjakan, cukup rinci untuk langsung jalan
docs/mockup/        sumber mockup UI (3 arah; yang dipilih pemiliknya: B)
```

## Keadaan sekarang

**Aplikasinya belum bisa dijalankan.** `public/index.html` memanggil
`dropnote.js` yang belum ada, jadi membuka `public/index.html` sekarang hanya
menampilkan layar diam tanpa satu pun tombol yang bekerja.

Yang sudah jadi: kerangka HTML, gaya lengkap, lapis penyimpanan, dan seluruh
otak (deteksi, judul, koreksi kategori, label, pencarian) — semuanya sudah
lolos `node --check` tapi **belum pernah dijalankan sama sekali di browser**.
Anggap belum teruji sampai kamu benar-benar menjalankannya.

Selebihnya ada di `docs/SISA-KERJA.md`.

## Konvensi

Diikuti dari repo `text-image-editor` milik pemilik yang sama, supaya satu
keluarga dan supaya dia tidak perlu belajar gaya baru:

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

## Cara bicara dengan pemiliknya

Dia menulis pendek — sering dari HP, sering di sela pekerjaan lain, kadang
dengan baterai hampir habis. Pesannya padat dan koreksinya tajam.

Balas seimbang dengan itu. Jawaban 600 kata untuk pertanyaan 15 kata bukan
membantu — itu menambah beban di tempat yang sama. Kalau ada yang perlu
diputuskan, tawarkan satu rekomendasi, bukan daftar pilihan.

Dan kalau dia bilang rancanganmu keliru, kemungkinan besar memang keliru.
Selama percakapan yang melahirkan aplikasi ini, hampir setiap koreksinya benar.
