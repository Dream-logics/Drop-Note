# Proposal revisi — Drop Note v2

Ditulis 28 Agustus 2026, menjawab tujuh syarat baru dari pemakainya.
Belum dikerjakan. Ini bahan keputusan, bukan catatan pekerjaan.

---

## Ringkas

**Jangan bangun ulang. Perluas.** Inti yang sekarang — penyimpanan, otak,
pelabelan, cadangan — sudah menjawab pondasi dari kesembilan syarat itu, dan
sudah dijaga 42 uji. Yang perlu berubah cuma dua: **bentuk satu entri**
(tambah keadaan baru) dan **permukaan UI**-nya. Membangun ulang berarti
membuang inti yang sudah teruji untuk mendapatkan hal yang sama.

**Dan satu peringatan yang harus disampaikan di depan:** to-do, habit tracker,
dan manajemen berkas adalah tiga arah yang, kalau digarap bersamaan, akan
membunuh aplikasi ini persis seperti pendahulunya. Bukan karena sulit —
karena tiap arah menambah keputusan di layar yang seluruh gunanya justru
meniadakan keputusan.

Jalan keluarnya ada di bagian **Satu objek, banyak keadaan** di bawah.

---

## 1. Nama

**Riset Play Store menunjukkan "Drop Note" sudah ramai:**

| Nama | Keadaan |
|---|---|
| **Drop — Instant Capture & Notes** | Hidup, dan **premisnya nyaris identik**: tangkap cepat, tanpa layar muat, dari panel notifikasi |
| **Note Drop** | Hidup, tapi itu game |
| **Dropnotes** | Ditarik dari Play Store, 2021 |
| **Titip** | Di Indonesia melekat kuat ke jastip/belanja — tabrakan makna |

Artinya nama sekarang bukan cuma mirip — dia bertabrakan dengan pesaing
langsung yang sudah lebih dulu ada. Bertarung SEO dari hari pertama.

### Usulan: **Laci**

Tidak ditemukan aplikasi catatan bernama ini di Play Store.

Alasannya bukan cuma kosong:

- **Persis model mentalnya.** Laci itu tempat kamu melempar barang tanpa
  menyusun, lalu ditarik saat butuh. Itu seluruh aplikasi ini dalam satu kata.
- **Empat huruf, satu kata, gampang diucap dan diketik.**
- **Muat tumbuh.** "Drop Note" mengunci ke catatan. Ke dalam laci bisa masuk
  catatan, tugas, dokumen, KTP — semuanya wajar.
- **Bahasa Indonesia jadi pembeda, bukan kelemahan.** Seluruh antarmukanya
  memang Bahasa. Nama Inggris generik justru menenggelamkannya di antara
  ratusan "Notes".

Judul di Play Store nanti: **Laci — simpan dulu, cari nanti.**

Kalau kelak perlu pasar global, nama toko bisa ditambah tanpa mengganti
identitas: *Laci · Drawer for everything*.

> Menggantinya sekarang gratis. Nanti, setelah ada pengguna dan tautan, mahal.

---

## 2. Yang tidak boleh berubah

Enam aturan lama tetap berlaku, dan **semua fitur baru harus tunduk padanya**,
bukan sebaliknya:

1. Memasukkan instan, offline, tanpa keputusan. Tidak ada jaringan di jalur masuk.
2. AI menyusul di belakang, borongan, boleh gagal diam-diam.
3. Pencarian tanpa jaringan.
4. Yang basi tenggelam.
5. Layar depan kosong.
6. Judul manual tidak pernah ditimpa AI.

Satu aturan diperjelas karena syarat baru nomor 6:

> **4b. Tenggelam itu bawaan. Menghapus permanen itu tindakan sadar, dua
> langkah, dan menghapus jejaknya sampai ke Sheet dan Drive.**

---

## 3. Satu objek, banyak keadaan

Ini keputusan arsitektur terpenting di dokumen ini.

Catatan, tugas, habit, dan berkas **bukan empat modul**. Mereka satu objek
yang sama dengan lifecycle berbeda — dan aplikasi ini sudah punya mesin yang
membedakannya: `dipakai`, `pensiun`, `diubah`.

| Yang kamu bayangkan | Sebenarnya | Saluran keluarnya |
|---|---|---|
| Catatan | entri | tenggelam kalau tidak disentuh |
| **To-do** | entri + `selesai` | selesai → tenggelam |
| **Habit** | entri + `tally[]` | tidak pernah tenggelam; justru naik |
| **Berkas** | entri + `driveId` + `thumb` | tenggelam kalau tidak dibuka |
| **Sekali pakai** | entri + `sekaliPakai` | **hilang sendiri setelah dipakai** |

Akibatnya, dan ini yang penting:

- **Tidak ada tombol "jenis" yang harus dipilih saat drop.** Tetap satu kotak.
  Mengetik `beli galon` lalu mencentangnya nanti membuatnya jadi tugas —
  bukan karena kamu memilih, tapi karena kamu mencentang.
- **Tidak ada empat layar baru.** Layar depan tetap kosong. Yang bertambah
  cuma cip saring di layar hasil: `belum selesai`, `berkas`, `habit`.
- **Tidak ada dinding kartu di mana pun.**

`sekaliPakai` layak disebut sendiri: itu jawaban langsung untuk wadah
"MEMO Satu Kali Pakai" yang tidak pernah kosong. Di sini dia benar-benar
kosong sendiri — dipakai sekali, lalu lenyap tanpa kamu memutuskan apa pun.

---

## 4. Berkas, Drive, dan masalah ratusan dokumenmu

Ini bagian yang paling menjawab rasa sakitmu sekarang, jadi digarap duluan.

### Alurnya

```
Drop berkas
   │
   ├─► IndexedDB  ── instan, offline, tidak pernah gagal      ← jalur masuk
   │
   └─► (belakang layar, saat aplikasi dibuka)
         ├─► unggah ke folder Drive lewat Apps Script
         ├─► AI baca isinya (OCR) → jadi teks yang bisa dicari
         └─► blob lokal dibuang, sisakan thumbnail 200px
```

**Kenapa blob lokalnya dibuang.** Ratusan dokumen akan memenuhi kuota
IndexedDB dalam hitungan bulan, dan kuota penuh artinya drop mulai gagal —
pelanggaran aturan nomor satu. Setelah aman di Drive, yang perlu tinggal di
HP cuma thumbnail-nya: daftar tetap seketika dan tetap jalan tanpa sinyal.

**Yang muncul di layar:** thumbnail atau pratinjau, lalu ikon unduh. Ketuk
unduh → ambil dari Drive (atau dari blob lokal kalau belum sempat terunggah).

### Kenapa ini menyelesaikan masalah "ada di laptop tapi tidak ketemu juga"

Masalahmu bukan tempat menyimpan — kamu sudah punya Drive. Masalahnya
**dokumen tidak punya kata.** `IMG_20240312_094512.jpg` tidak cocok dengan
apa pun yang kamu ingat.

AI membaca isinya sekali saat masuk, lalu menuliskan kata-kata yang nanti
kamu pakai mencari: *ktp, nik, kartu identitas, 2024, surat perjanjian, sewa
ruko, pak budi, notaris*. Setelah itu pencarian biasa — offline, nol biaya —
sudah cukup menemukannya.

Ini satu-satunya bagian di mana AI benar-benar tak tergantikan, dan alasannya
sama seperti sejak awal: **AI menulis sekali, logic membaca selamanya.**

### Batas jujurnya

- Apps Script menerima unggahan ±50 MB per permintaan. Foto dan dokumen aman;
  video panjang tidak. Berkas terlalu besar tetap tersimpan lokal dan ditandai
  "tidak dicadangkan" — tidak pernah gagal diam-diam.
- OCR bergantung AI. Tanpa AI, berkas tetap masuk dan tetap bisa dicari lewat
  nama berkas dan kategori — cuma tidak lewat isinya.

---

## 5. AI: lebih hadir, tapi satu garis tidak boleh bergeser

Kamu minta AI lebih terasa. Boleh, dan ada empat tempat yang benar-benar
menambah nilai — semuanya **di belakang atau di jalur cari, tidak satu pun
di jalur masuk**:

| Di mana | Gunanya | Kalau AI mati |
|---|---|---|
| **Setelah masuk** *(sudah ada)* | judul + kata kunci untuk dicari nanti | judul dari alamat/baris pertama |
| **OCR dokumen** *(baru)* | isi KTP, kontrak, struk jadi bisa dicari | cari lewat nama berkas saja |
| **Pencarian bahasa manusia** *(baru)* | "surat sewa ruko tahun lalu" → kata kunci + saring | pencarian kata biasa, tetap jalan |
| **Nol hasil** *(baru)* | baru lempar ke AI. Jarang, jadi murah | tampilkan "tidak ada yang cocok" |

Satu setelan, tiga tingkat: **mati · hemat · penuh**. Bawaannya hemat.

> **Garis yang tidak boleh bergeser:** menekan Drop tidak boleh menunggu AI
> satu milidetik pun. Kalau garis itu jebol, aplikasinya mati — bukan
> perlahan, tapi dalam dua minggu. Ini satu-satunya hal yang membunuh setiap
> pendahulunya.

Mode **langsung** (kunci Gemini di HP) tetap ada untuk bereksperimen cepat.
Untuk pemakaian sehari-hari, **proxy** yang disarankan — kuncinya tinggal di
Apps Script, bukan di HP.

---

## 6. Menghapus sampai bersih

Satu arah tetap satu arah, tapi penghapusan butuh jejak — kalau tidak, baris
yang dihapus di HP akan hidup lagi saat dipulihkan dari Sheet.

```
Buang        → pensiun = true       → tenggelam, masih ada, bisa diurungkan
Hapus permanen → dihapus = true     → nisan; ikut naik ke Sheet
                                      Apps Script menghapus barisnya
                                      + berkasnya di Drive
                                      → baru dibuang dari HP
```

Untuk `sekaliPakai`, seluruh rantai itu berjalan sendiri: dipakai sekali,
lalu lenyap. Tanpa satu pun pertanyaan ke kamu.

---

## 7. Kunci — dan jawaban jujurnya

Ada dua tingkat, dan bedanya besar. Jangan tertukar.

**Tingkat 1 — Kunci layar (PIN atau sidik jari).** Menahan orang yang
memegang HP-mu. Murah, cepat, tanpa risiko. **Tapi datanya tetap terbaca**
oleh siapa pun yang tahu cara membuka penyimpanan browser. Ini pagar, bukan
brankas.

**Tingkat 2 — Enkripsi sungguhan (AES-GCM, kunci dari kata sandimu).** Isinya
jadi tidak terbaca siapa pun, termasuk di Sheet. Ongkosnya nyata:

- **Lupa kata sandi = hilang selamanya.** Tidak ada pemulihan. Tidak ada
  "lupa password". Ini bukan gertakan.
- Tidak bisa dilabeli AI tanpa kamu izinkan per-entri.
- Sheet-nya tidak bisa lagi dibaca mata sebagai cadangan darurat.

**Usulan saya: pakai keduanya, tapi tidak rata.**

> Kunci layar untuk seluruh aplikasi. Enkripsi **hanya untuk entri yang kamu
> tandai rahasia** — KTP, akta, kontrak. Beberapa puluh, bukan ribuan.

Mengenkripsi semuanya berarti mempertaruhkan seluruh timbunan seumur hidupmu
pada satu kata sandi yang harus kamu ingat selamanya. Itu risiko yang jauh
lebih besar daripada yang sedang kamu hindari.

---

## 8. Ringan — dengan angka, bukan janji

Tanpa angka, "ringan" akan pelan-pelan bocor. Jadi dijadikan uji yang gagal
kalau dilanggar:

| Yang diukur | Batas |
|---|---|
| Buka sampai kotak siap diketik | **< 700 ms** |
| Ketik di pencarian → hasil tergambar | **< 50 ms** untuk 5.000 entri |
| Tekan Drop → kotak kosong lagi | **< 100 ms** |
| Ukuran seluruh aplikasi | **< 250 KB**, tanpa framework |

Yang menjaganya: tetap vanilla, tanpa build; daftar hasil digulung
(virtualized) di atas 200 kartu; thumbnail dari IndexedDB, tidak pernah dari
jaringan; huruf dibenamkan supaya tidak ada layar berkedip menunggu font.

---

## 9. Jalan ke Play Store

Sudah PWA yang sah, jadi tinggal dibungkus **TWA** lewat PWABuilder.

- Akun developer Google Play: **$25 sekali seumur hidup** — bukan tahunan.
- Syarat yang belum ada: **domain yang kamu kuasai penuh**, untuk berkas
  verifikasi di akarnya. Ini satu-satunya hal di seluruh rencana yang menuntut
  perpanjangan tahunan — dan karena itu ditaruh **paling akhir**, saat sudah
  jelas aplikasinya bertahan.
- Untuk versi publik: **tanpa server, tanpa akun**, dan itu dijadikan jualannya —
  *"catatanmu tidak pernah meninggalkan HP-mu."* Cadangan Sheets/Drive tetap
  ada sebagai setelan lanjutan bagi yang mau. Nol ongkos jalan.
- **Bukan iklan.** Iklan menaruh dinding visual dan satu keputusan tambahan di
  layar yang seluruh gunanya adalah ketiadaan keduanya. Berbayar sekali, kecil,
  jauh lebih cocok — dan sejalan: bayar sekali, lalu tidak diganggu lagi.

---

## 10. Urutan kerja

Urutannya bukan dari yang mudah, tapi dari yang paling menyakitkan sekarang.

| | Isi | Kamu | Aku |
|---|---|---|---|
| **0** | Repo privat, pindah Netlify, LICENSE, ganti nama jadi Laci | 10 menit | ½ hari |
| **1** | Pasang Apps Script + cadangan, **lalu pakai sehari-hari** | 10 menit + sebulan | — |
| **2** | **Berkas → Drive**, thumbnail, unduh, OCR AI | tempel folder Drive | 2–3 hari |
| **3** | Sekali pakai + hapus permanen sampai ke Sheet & Drive | — | 1 hari |
| **4** | Kunci layar + enkripsi selektif | pilih kata sandi | 1–2 hari |
| **5** | Pencarian bahasa manusia + AI saat nol hasil | — | 1 hari |
| **6** | To-do & habit sebagai keadaan | — | 2 hari |
| **7** | Domain + TWA + Play Store | beli domain, $25 | 1 hari |

**Tahap 1 tidak bisa dilompati.** Bukan formalitas: kalau sistem ini tidak
bertahan sebulan di tanganmu sendiri, tidak ada gunanya membangun tujuh tahap
di atasnya. Semua pendahulunya mati di bulan pertama, dan tidak satu pun mati
karena kekurangan fitur.

Tahap 2 boleh mulai berbarengan dengan tahap 1 — masalah berkas itu nyata dan
sudah ada sekarang.

**Tahap 6 sengaja hampir terakhir.** To-do dan habit adalah dua fitur yang
paling gampang dibayangkan dan paling sering tidak dipakai. Rangkanya disiapkan
dari sekarang (lihat bagian 3), tapi pengisiannya menunggu bukti — kamu sendiri
yang menulis prinsipnya: *yang dibatasi isinya, bukan bentuknya.*

---

## 11. Yang saya sarankan JANGAN dikerjakan

Bagian ini sama pentingnya dengan yang di atas.

- **Iklan.** Alasannya di bagian 9.
- **Daftar catatan terbaru di layar depan.** Perbaikan yang paling sering
  terpikir, dan yang membatalkan seluruh gunanya.
- **Sinkron dua arah otomatis.** Melahirkan "versi mana yang menang" — jenis
  pertanyaan yang aplikasi ini ada untuk menghapusnya.
- **Folder, tag bertingkat, papan kanban.** Semuanya memindahkan kerja menyusun
  kembali ke pundakmu.
- **Backend sendiri sekarang.** Menambah tagihan bulanan dan titik gagal, untuk
  satu pengguna. Nanti, kalau memang ada pengguna lain.
- **Membangun ulang dari nol.** Membuang inti teruji dan 42 uji untuk sampai ke
  tempat yang sama.

---

## 12. Yang saya butuh darimu

1. **Nama: Laci?** Kalau ya, saya ganti sekarang — mumpung gratis.
2. **Folder Drive**: satu folder khusus, atau dibiarkan aplikasinya yang buat?
3. **Enkripsi**: setuju hanya untuk entri bertanda rahasia, bukan semuanya?
4. **Mulai dari tahap 0+2** (berkas & Drive), atau ada yang lebih menyakitkan
   yang saya lewatkan?
