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

**Namanya sekarang "Cortex Space", dan nama itu kulit.** Dia cuma ditulis di
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
   yang paling sering dilakukan, jadi harus yang paling murah — dan karena itu
   **kotak drop ITU kotak pencariannya**: tiap huruf langsung menyaring daftar
   di bawahnya, tanpa Enter, tanpa pindah layar. Jangan pernah menambahkan
   tombol atau layar Cari terpisah; kalau isinya sama, layar kedua cuma
   menyalin dan tombolnya jadi langkah tambahan.
4. **Tidak ada yang benar-benar terhapus.** Yang basi tenggelam. Tapi
   peringkat itu saluran keluar, **bukan pengganti rak**: yang tenggelam
   berhenti muncul, dan itu tidak sama dengan tersusun. Gudang yang isinya
   sepuluh ribu keping lepas tetap gudang berantakan walau yang basi sudah
   diam. Karena itu label bukan hiasan — **label itu ruangan**, dan tiap
   keping harus mendarat di salah satunya tanpa kamu memutuskan apa pun.
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
public/index.html   kerangka semua layar (mulai, utama/Drop, tulis/Note,
                    tugas/To Do, note/Storage, catat, setelan).
                    EMPAT pintu di kepala: Drop - Note - To Do - Storage,
                    digambar dari alur.js ke <div data-tab>
                    TIDAK ADA layar hasil dan TIDAK ADA tombol Cari: kotak drop
                    itu sendiri pencariannya, hasilnya di bawahnya
                    Layar tulis didatangi dari hasil pencarian DAN dari
                    tombol bulat di layar Note - tapi tetap tidak pernah dari
                    layar Drop: di sana dia pilihan palsu yang menagih jawaban
                    sebelum kamu tahu tulisanmu panjang atau pendek
                    Pindah pintu bisa lewat GESER kiri-kanan di badan layar:
                    kepala itu ujung terjauh dari jempol, jadi jangan pernah
                    jadikan ketukan kepala satu-satunya jalan. Gesernya dengar
                    'touchstart/touchend' dulu, pointer cuma untuk tetikus -
                    kalau keduanya jalan bersamaan satu geseran jadi dua
                    lompatan
public/bawaan.js    SATU-SATUNYA tempat nama aplikasi & model AI ditulis
public/bahasa.js    LAPISAN bahasa, bukan pengganti. Teks tetap ditulis
                    Indonesia di seluruh kode; berkas ini menukarnya jadi
                    Inggris tepat sebelum dibaca mata, lewat MutationObserver.
                    Kuncinya kalimat Indonesianya SENDIRI - bukan kunci
                    simbolis - supaya kodenya tetap terbaca apa adanya.
                    BAWAANNYA INGGRIS. Yang TIDAK PERNAH diterjemahkan: nama
                    pintu (Drop/Note/To Do/Storage), nama aplikasi, dan apa pun
                    yang ditulis pemakainya - dijaga penanda data-asli. Uji
                    terimanya MENYAPU tiap layar mencari sisa kalimat
                    Indonesia; menambah kalimat baru tanpa terjemahannya akan
                    gagal di sana.
public/gaya.css     gaya; SATU tema putih, tidak mengikuti setelan HP
public/simpan.js    IndexedDB — entri, berkas (blob), setelan, cadangan
public/otak.js      SEMUA yang menebak, tanpa AI: baca jenis, susun judul dari
                    alamat, bakukan istilah judul (Inggris dulu kalau bentrok:
                    Link bukan Tautan), betulkan kategori salah ketik, tarik
                    kata kunci, pisahkan elemen berpola, nilai hasil pencarian,
                    urai label rak (nama pendek + kata panjang sesudah '='),
                    susun gudang bertingkat dari namanya sendiri, lengkapi
                    nama gudang sambil diketik, baca gudang dari teks drop
public/awan.js      Google Drive & Sheets langsung — folder dan spreadsheet
                    dibuat SENDIRI oleh aplikasi; cakupan cuma drive.file
public/pelabel.js   satu-satunya bagian ber-AI: judul + elemen + tag + OCR,
                    plus OBROLAN (teks & gambar) untuk mode AI.
                    Lewat proxy milik PEMBUAT; kunci tidak pernah ada di
                    perangkat pemakai. Daftar tag lama DAN daftar nama elemen
                    ikut dikirim supaya keduanya tidak beranak sendiri;
                    nama elemen menyebut JENIS benda, tidak pernah pemiliknya.
                    Obrolan menjawab teks biasa, BUKAN JSON seperti yang lain,
                    dan karakternya asisten pribadi (ARAHAN_OBROL): seimbang
                    dengan pertanyaannya, SATU rekomendasi bukan daftar pilihan
public/tugas.js     to-do berdiri sendiri: centang, penting, Hari Ini, tenggat,
                    ulang, langkah, catatan, penanda BELUM DIBACA.
                    SATU daftar, tidak dibagi bagian "Berulang" lagi - Berulang
                    sudah punya saringannya sendiri di baris atas.
                    "Hari ini" = TENGGATNYA hari ini atau sudah lewat, plus
                    yang kamu tandai sendiri - BUKAN yang dibuat hari ini.
                    Urutan "Semua" = terbaru di atas, titik; yang berprioritas
                    (tertunggak - penting - tenggat terdekat) cuma di saringan
                    lain, karena yang mendesak sudah punya rumahnya sendiri. Dua jalur masuk: layar To Do, dan
                    cip Todo di layar Drop.
                    Pembaca tenggat dari kalimat mengerti DUA BAHASA sekaligus
                    dan tidak pernah mengikuti setelan bahasa: yang diketik
                    jari tidak ikut berganti waktu setelannya digeser. Sisi
                    Inggrisnya sengaja lebih ketat - nama hari cuma bentuk
                    lengkap ("sat"/"wed"/"sun" itu kata biasa), dan tanggal
                    telanjang wajib berakhiran urutan (25th, bukan 25).
                    Pembedanya ACTION, bukan tenggat -
                    tugas tanpa tanggal itu sah; yang cuma perlu DIINGAT tanpa
                    action itu drop biasa. Daftar ganda lewat keyword yang
                    sudah ada - opsional, tidak pernah wajib.
                    Menumpang di toko yang sama supaya ikut cadangan, tapi
                    TIDAK pernah muncul di pencarian catatan, tidak dihitung
                    di "N tersimpan", dan tidak pernah dikirim ke AI
public/kunci.js     enkripsi SELEKTIF: cuma yang kamu tandai. Isi & elemen
                    dikunci, judul & tag tetap terbuka supaya masih bisa
                    ditemukan. Yang terkunci tidak pernah dikirim ke AI
public/sinkron.js   cadangan satu arah ke Drive; tidak pernah di jalur drop
public/alur.js      alur UI — semua layar, drop, cari, catat, setelan.
                    LAYAR NOTE ('l-tulis') itu RUANG MENULIS, bukan hasil
                    saringan Drop: FOLDER + daftar tulisan + pencariannya
                    sendiri + satu tombol bulat "tulis baru", dan layar tulisnya
                    punya tombol Simpan yang bisa ditekan.
                    FOLDERNYA DAFTAR SENDIRI ('folderNote' di setelan), dibuat
                    TANGAN, dan tulisan menyimpannya di kolom 'folder' - BUKAN
                    menumpang kategori. Rak gudang lahir dari catatan yang jatuh
                    dan disortir mesin; folder lahir karena kamu memutuskan ada
                    tempat yang perlu diisi. Menyatukannya membuat lima belas
                    rak Drop muncul sebagai folder kosong yang tidak pernah
                    dibuat siapa pun. Yang kosong tetap tampil: kamu membuat
                    folder justru supaya ada tempat menulis. Folder bisa dipilih
                    dan dihapus; isinya TIDAK ikut terhapus, cuma keluar folder.
                    MENGHAPUS RAK STORAGE MELEPAS ISINYA, bukan mengosongkan
                    kategorinya saja dan bukan pula mencabut tagnya. Rak
                    Storage lahir dari isinya, dan alamat satu catatan bukan
                    cuma kolom kategori: begitu kategorinya kosong, alamatnya
                    jatuh ke tag buatan AI - dan tag itu hampir selalu kata
                    yang sama dengan nama raknya, jadi raknya lahir kembali
                    seketika (pesannya lewat, foldernya tetap utuh). Tapi
                    mencabut tagnya juga salah dua kali: tag itu kata kunci
                    pencarian, dan tag yang TERSISA lantas jadi alamat - satu
                    rak dihapus, dua rak baru lahir ("invoice", "brief") yang
                    tidak pernah dibuat siapa pun. Penandanya sendiri yang
                    dipakai: kolom 'rakLepas', dan selama dia menyala alamatnya
                    "Belum berlabel" apa pun tagnya. Berakhir sendiri begitu
                    kamu menaruhnya di rak lain (lihat taruhFolder). Ikut
                    dicadangkan - kolomnya DI EKOR KOLOM, seperti semua kolom
                    baru. Umpan uji untuk ini WAJIB bertag: catatan tanpa tag
                    jatuh ke "Belum berlabel" dengan sendirinya, dan itu yang
                    dulu menyembunyikan bugnya.
                    Folder Note tidak kena aturan ini: dia punya daftarnya
                    sendiri, dan tag catatan tidak ada urusannya dengan tempat
                    yang kamu buat tangan.
                    DI AKAR YANG TAMPIL FOLDER SAJA - isinya baru terlihat
                    sesudah foldernya dibuka; yang belum berfolder punya
                    barisnya sendiri. Folder tujuan pindah DIPILIH, tidak
                    diketik. Membuka folder lalu "tulis baru" mengisi
                    judulnya dengan nama folder itu, dan ekor judul yang PERNAH
                    KAMU PAKAI di folder itu ditawarkan sebagai cip
                    ('ekorJudul' di setelan) - tawaran, bukan tebakan.
                    Bilah pilih SATU untuk dua layar (Note & Storage),
                    melayang di bawah: buang, gabung, pindah - dan FOLDER ikut
                    bisa dipilih di keduanya. Tapi foldernya BUKAN benda yang
                    sama: folder Note dari 'folderNote', folder Storage dari
                    rak tiap catatan. Yang ditawarkan dialog pindah HARUS
                    folder layar itu sendiri. Pindah
                    ikut mengganti kolom 'folder' saja - judulnya tidak
                    diutak-atik. Penandanya kolom
                    'tulisan', BUKAN jenis tersendiri - jenis yang beda bikin
                    dia luput dari saringan, kartu, dan pemisahan elemen.
                    Tulisan tetap ikut terjaring pencarian utama: yang
                    ditambahkan layar Note pintu yang lebih sempit, bukan
                    dinding kedua.
                    MEMILIH BANYAK dimulai dari TEKAN LAMA - kartu maupun
                    folder, di ketiga layar yang punya bilah pilih. Itu
                    kebiasaan dari WhatsApp, bukan penemuan baru, jadi tombol
                    "Pilih" tetap ada tapi bukan lagi satu-satunya jalan.
                    DUA HAL YANG CUMA ADA DI JARI, dan keduanya sudah pernah
                    membuat fitur ini mati diam-diam: jari yang kelihatannya
                    diam tetap bergetar 1-2px (jadi ada ambang geser, bukan
                    batal di piksel pertama), dan MENGANGKAT jari melahirkan
                    satu klik di tempat yang sama - klik itu harus DITELAN,
                    kalau tidak dia mencabut kembali yang baru ditandai dan
                    yang terlihat cuma bilah pilih berisi nol. Uji yang
                    menembakkan 'pointerdown' telanjang tidak bisa melihat
                    keduanya; harus konteks hasTouch dengan getaran dan
                    angkatan sungguhan.
                    Yang terpilih HARUS kelihatan beda (.dipilih) - kalau tidak,
                    orang lupa tadi menandai yang mana dan batal semuanya.
                    Pilihan TERKUNCI di layarnya: pindah pintu membatalkannya,
                    dan selama memilih geser antar-pintu mati. Membawa pilihan
                    setengah jadi ke layar lain bikin aksinya bercabang, dan
                    yang kena hapus bukan yang dilihat.
                    Di dalam folder ada PANAH KEMBALI 40px di samping remah
                    jejaknya: remahnya benar tapi terlalu kecil untuk jempol.
                    Di layar Note, MENYENTUH KARTU = LANJUT MENULIS (bukan
                    membuka rincian di tempat seperti di hasil dan Storage).
                    Layar 'l-note' itu STORAGE - gudang berfolder, isinya
                    semua yang pernah jatuh.
                    LAYAR TULIS TIDAK PUNYA KOLOM KATEGORI, dan jangan
                    dikembalikan: gudangnya dibaca dari JUDUL, aturan yang sama
                    persis dengan kotak Drop. Yang tampil cuma kabarnya. Judul
                    tanpa nama gudang tidak mengosongkan rak yang lama.
                    Doknya: salin (ikon) + Simpan.
                    Teks bayangan melengkapi nama gudang sambil diketik;
                    yang menerima PANAH di ujung ekornya - satu-satunya bagian
                    bayangan yang duduk DI ATAS kotak teks, letaknya diukur
                    dari ujung ekor, bukan ditebak dari jumlah huruf.
                    Bisa juga Tab / panah kanan di ujung.
                    Kotak + tombol + kedua lacinya satu blok "dok" yang SELALU
                    menempel di bawah; lacinya membuka ke bawah.
                    Di atas kotak: cip gudang, lalu cip saringan jenis.
                    KEDUANYA SATU BARIS, tidak pernah melipat - yang melipat
                    mendorong dok naik dan layarnya bergoyang di bawah jempol.
                    Saringan itu ikon telanjang, angkanya menumpang DI ATAS
                    ikon (dipatok di kanan, jadi ratusan tumbuh ke KIRI); yang
                    nol tidak digambar. Reset cip PALING KANAN, sebelah Pin -
                    jangan naikkan lagi ke kepala, itu ujung terjauh dari
                    jempol. Angka "N tersimpan" sudah dibuang dan jangan
                    dikembalikan.
                    Isi kotak, ala WhatsApp: AI - [teks] - klip - Todo, lalu
                    Drop di luar. EMPAT ikon waktu diam, TIGA waktu mengetik:
                    ikon AI pergi di mode Drop begitu ada yang diketik, klip
                    dan Todo pergi di mode AI.
                    MODE AI: satu ikon tepat DI ATAS tombol Drop, dan ikon itu
                    yang mengubah arti tombol di bawahnya - selama menyala,
                    kotaknya berhenti mencari dan Drop berhenti menyimpan.
                    Ketukan kedua di ikon yang sama mengembalikan semuanya.
                    Riwayat obrolan tinggal di SETELAN, bukan di toko entri:
                    dari sana dia ikut cadangan, dan tetap di luar pencarian,
                    di luar "N tersimpan", dan di luar bahan pelabelan AI.
                    Yang layak jadi timbunan masuk lewat tombol Drop di tiap
                    jawaban - satu ketukan, bukan otomatis
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

Sebelum menyentuh kode, jalankan dulu `node uji/uji-terima.mjs` (599 lulus).
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
  Terjemahan Inggrisnya menyusul di `public/bahasa.js`, TIDAK di tempat teksnya
  ditulis - jadi menambah kalimat baru tetap satu baris Indonesia apa adanya.
- **Komentar menjelaskan KENAPA, bukan APA.** Kalau satu keputusan bisa
  disalahpahami sebagai kekeliruan, tulis alasannya di situ. Contoh gayanya ada
  di kepala tiap berkas.
- Kepala berkas pakai blok `/* ===== … ===== */`.
- CSS: variabel pendek (`--g` dasar, `--p` permukaan, `--i` tinta, `--m` redup,
  `--l` garis, `--a` aksen tinta, `--ap` aksen alas, `--at` tinta di atas
  aksen). SATU tema, putih, di semua layar - `prefers-color-scheme` sengaja
  TIDAK dipakai lagi: dua tema berarti tiap suntingan gaya harus diperiksa dua
  kali, dan aplikasinya berganti rupa tanpa diminta.
- Sasaran sentuh minimal 44px. Ini dipakai satu tangan sambil mengerjakan hal lain.
- Baris tombol dibaca dari KANAN: jempol kanan bertumpu di sudut kanan bawah,
  jadi yang paling sering ditekan duduk paling kanan (Semua · Cari · Drop).
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
