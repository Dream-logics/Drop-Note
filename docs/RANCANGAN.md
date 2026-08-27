# Rancangan Note Management

Hasil percakapan 27 Agustus 2026. Dokumen hidup — akan berubah.

## Masalah

Catatan tersebar di Google Keep, WhatsApp (±50 grup diri sendiri),
Notes, dan keyboard shortcut. Semuanya menumpuk, makin lama makin
susah dicari. Menghapus terasa berbahaya, tidak menghapus terasa sesak.

Cakupan sebenarnya: satu sistem untuk seluruh peran — bisnis,
programmer, penulis konten, pengembang produk, eksplorasi ide,
customer service, dan ±20 peran lain. Plus ranah keluarga:
kenangan tiap anak, dan urusan bersama pasangan.

## Temuan

**1. Tidak ada satu pun alat yang punya versi.**
Merevisi prompt di Keep berarti menimpa yang lama. Karena tidak berani
menimpa, tiap revisi jadi catatan baru. Duplikat beranak.

Akibatnya: dari enam versi yang mirip, tidak mungkin tahu mana yang
terakhir dan mana yang paling berhasil. Takut menghapus itu penilaian
yang benar atas informasi yang ada — bukan hambatan mental.
Ini masalah teknis, bukan masalah disiplin.

**2. Tidak ada saluran keluar.**
Semua yang masuk statusnya "ada" selamanya. Bug yang sudah diperbaiki
sebulan lalu tetap memakan tempat. Bahkan wadah bernama "MEMO Satu
Kali Pakai" pun tidak pernah kosong — karena tidak ada mekanisme
apa pun yang bisa menandai sesuatu selesai.

**3. Ongkos sebenarnya adalah keputusan, bukan waktu.**
Menghapus butuh dua detik. Yang mahal itu memutuskan masih perlu atau
tidak. Tenaga memutuskan sudah habis dipakai di pekerjaan utama.
Sistem apa pun yang menuntut keputusan saat memasukkan akan mati.

**4. Sesak datang dari tampilan, bukan dari jumlah.**
Keep memaksa melihat dinding kartu tiap kali dibuka. Timbunan yang
tidak terlihat tidak menyesakkan.

## Dua jenis isi (lifecycle-nya berlawanan)

**Alat** — prompt, link dev, template, pretext CS.
Berubah terus, punya versi, dipakai lalu pensiun.
Butuh: riwayat, status, dan cara untuk berhenti muncul.

**Kenangan** — memori anak, catatan hidup.
Tidak pernah direvisi, tidak pernah pensiun, ditambah terus.
Nilainya justru naik seiring waktu.
Butuh: permanen, ditelusuri lewat waktu, bukan lewat pencarian.

Satu aplikasi, satu pintu masuk, satu pencarian — tapi dua jenis
catatan dengan perlakuan berbeda. Jangan dipaksa jadi satu bentuk.

## Bentuk satu baris (untuk Alat)

- nilai sekarang — yang dipakai hari ini
- riwayat — versi sebelumnya, tetap ada, tidak perlu dilihat
- status — draft / dipakai / pensiun
- milik proyek atau peran mana

Kuncinya: **revisi meng-update baris yang sama, bukan menambah baris
baru.** Katalog tidak membengkak seperti timbunan — bukan karena
rajin, tapi karena bentuknya memang tidak bisa membengkak.

## Cara memanggil

Bukan pencarian. Dalam kerja nyata selalu sedang mengerjakan sesuatu.
Buka "apps A" -> keluar isi raknya: link dev, prompt, catatan bug.
Lima barang, bukan lima ratus. Konteks yang menyaring, bukan kata kunci.

Layar depan kosong. Tidak ada dinding kartu.

## Prinsip yang tidak boleh dilanggar

1. **Memasukkan harus instan, offline, tanpa keputusan.** Nol detik,
   tidak pernah gagal walau tidak ada sinyal. Begitu nge-drop terasa
   berat, sistemnya mati — seperti semua sistem sebelumnya.
2. **Pelabelan menyusul di belakang**, borongan, terjadwal.
   Tidak pernah di jalur masuk.
3. **Naik ke jalur cepat otomatis** berdasarkan frekuensi pakai,
   bukan lewat keputusan pengguna.
4. **Tidak ada yang benar-benar terhapus.** Yang basi tenggelam,
   bukan dibuang.

## Soal AI

Mayoritas nol AI: deteksi link, buang duplikat, hitung frekuensi,
pencarian kata, versi, promosi otomatis.

Judul link bisa diambil dari `<title>` halamannya — gratis, tanpa AI.
Itu sudah menutup sebagian besar masalah "susah dicari".

AI cuma untuk satu hal: memberi label berisi kata-kata yang nanti
dipakai untuk mencari (kartu "photo studio" yang dicari sebagai
"apps A"). Model terkecil sudah cukup. Sekali per catatan.
Alasannya bukan kecanggihan — melainkan karena pekerjaan memberi
judul itu menuntut keputusan, dan itu ongkos yang tidak boleh
dibebankan ke pengguna.

Bisa dipasang belakangan. Aplikasi harus jalan penuh tanpanya.

## Yang belum diputuskan

- Draft prompt: cukup versi terakhir yang berhasil, atau perlu
  membandingkan antar versi?
- Peran mana yang dipakai untuk versi pertama.
- Tempat penyimpanan (kandidat: Apps Script + Google Sheets,
  karena sudah dikuasai dan tanpa server).

## Catatan strategi

Cakupannya besar (±50 grup, ±20 peran). Risiko terbesarnya bukan
teknis — melainkan sistem ini tidak bertahan sebulan, seperti
pendahulunya.

Jadi: **rancangannya menampung semua peran sejak hari pertama,
tapi pengisiannya mulai dari satu peran.** Yang dibatasi isinya,
bukan bentuknya.
