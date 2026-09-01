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
   diam. Karena itu **board itu ruangan**, dan tiap keping harus mendarat di
   salah satunya tanpa kamu memutuskan apa pun. Pohonnya TERTUTUP: AI memilih
   dari situ, tidak pernah menambah barisnya — daftar alamat yang boleh
   ditambah mesin melar sampai tidak ada dua foto yang tinggal di ruangan yang
   sama, dan gudang dengan seribu ruangan sama saja dengan gudang tanpa
   ruangan. Hashtag sudah dicoba dan **dibuang seluruhnya**; yang menggantikan
   kata kunci adalah DESKRIPSI (lihat pelabel.js).
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
                    LIMA pintu di kepala: Drop - Note - To Do - Storage -
                    Gallery, digambar dari alur.js ke <div data-tab>.
                    Lima nama tidak muat BERSEBELAHAN dengan ikonnya di HP,
                    jadi di bawah 480px ikonnya NAIK ke atas namanya. Yang
                    dibayar tinggi baris; ikon tidak pernah dibuang dan nama
                    pintu tidak pernah dipotong
                    GAMBAR YANG DIKETUK membuka '#lihat' - preview, bukan
                    lapisan hitam: ada namanya, sumber/tanggal/ukuran/board,
                    driver, deskripsi AI (dipotong dua baris), tombol Tutup.
                    Empat jalan keluar dan semuanya wajib: tombol, ketuk latar,
                    Escape, dan tombol Kembali HP (satu langkah riwayat
                    didorong waktu membuka - tanpa itu Kembali meninggalkan
                    layarnya, dan itu yang terbaca sebagai "beku"). Ketukan di
                    keterangannya TIDAK menutup. z-index 40, DI ATAS dok kamera
                    Gallery - kalau di bawah, yang duduk di sudut kanan bawah
                    tombol kamera dan mengetuknya memotret
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
                    pintu (Drop/Note/To Do/Storage/Gallery), nama aplikasi, dan apa
                    pun yang ditulis pemakainya - dijaga penanda data-asli. Uji
                    terimanya MENYAPU tiap layar mencari sisa kalimat
                    Indonesia; menambah kalimat baru tanpa terjemahannya akan
                    gagal di sana.
public/gaya.css     gaya; SATU tema putih, tidak mengikuti setelan HP
public/simpan.js    IndexedDB — entri, berkas (blob), setelan, cadangan
public/otak.js      PENCARIANNYA menilai judul 6, driver 6, label 5,
                    DESKRIPSI GAMBAR 5, elemen/kategori/folder/board 4, badan
                    catatan teks 3, nama berkas 3.
                    Deskripsi gambar dinilai 5 karena dia MENGGANTIKAN tag,
                    jadi dia mewarisi bobotnya - kalau dinilai 3 seperti badan
                    catatan biasa, yang terjadi cuma menukar yang kuat dengan
                    yang lemah. Cuma untuk gambar: di catatan teks, isi itu
                    ratusan kata yang tidak dipilih untuk dicari.
                    BOARD disimpan dengan NAMA PENUHNYA ("FNB Menu Promo"),
                    jadi satu pencocokan substring menjaring main board dan sub
                    board sekaligus. Nama tempat yang kamu namai sendiri
                    ('folder' Note + 'album'/board) gampang terlupa waktu
                    menambah kolom tempat baru - dan akibatnya foto di board
                    "Kopo Project" tidak ketemu waktu dicari "Kopo", padahal
                    boardnya tertulis di layar.
                    SEMUA yang menebak, tanpa AI: baca jenis, susun judul dari
                    alamat, bakukan istilah judul (Inggris dulu kalau bentrok:
                    Link bukan Tautan), betulkan kategori salah ketik, tarik
                    kata kunci, pisahkan elemen berpola, nilai hasil pencarian,
                    urai label rak (nama pendek + kata panjang sesudah '='),
                    susun gudang bertingkat dari namanya sendiri, lengkapi
                    nama gudang sambil diketik, baca gudang dari teks drop.
                    cocokLabel membaca kategori DAN board: sejak tag dibuang,
                    alamat gambar cuma tinggal boardnya, jadi tanpa itu label
                    rak berhenti menjaring gambar sama sekali
public/awan.js      Google Drive & Sheets langsung — folder dan spreadsheet
                    dibuat SENDIRI oleh aplikasi; cakupan cuma drive.file
public/pelabel.js   satu-satunya bagian ber-AI: judul + deskripsi + elemen +
                    BOARD + OCR, plus OBROLAN (teks & gambar) untuk mode AI.
                    Lewat proxy milik PEMBUAT; kunci tidak pernah ada di
                    perangkat pemakai. POHON BOARD dikirim utuh sebagai daftar
                    PILIHAN - bukan sekadar konteks; jawaban yang tidak ada di
                    daftar dibuang pilihBoard(), bukan disimpan apa adanya.
                    Alamat yang tidak ada barisnya lebih buruk daripada tanpa
                    alamat: yang tanpa alamat masih kelihatan di "Belum
                    berboard", yang salah nama hilang sama sekali. Daftar nama
                    elemen ikut dikirim supaya tidak beranak sendiri; nama
                    elemen menyebut JENIS benda, tidak pernah pemiliknya.
                    'albumManual' MENGUNCI alamat yang kamu tentukan sendiri -
                    AI cuma mengisi yang kosong, sama persis dengan judulManual
                    Obrolan menjawab teks biasa, BUKAN JSON seperti yang lain,
                    dan karakternya asisten pribadi (ARAHAN_OBROL): seimbang
                    dengan pertanyaannya, SATU rekomendasi bukan daftar pilihan
public/alur.js      (lanjutan) LAYAR GALLERY ('l-galeri') - pintu kelima,
                    untuk timbunan terbesar: foto. Isinya SEMUA entri
                    berjenis 'gambar' yang sudah ada, jadi tiap tangkapan layar
                    yang kamu drop mendarat di sini sendiri - tidak ada satu
                    keputusan pun ditambahkan di jalur masuk. Ruangannya POHON
                    BOARD ('board' di setelan, bawaannya 'boardAwal'), dua
                    tingkat, bertingkat lewat
                    awalan nama, kolomnya 'album' - BUKAN menumpang 'folder'
                    milik Note. Saringannya SUMBER ('sumber': kamera/unggah/
                    kosong=drop), bukan jenis: di layar ini semuanya gambar.
                    Kamera dan unggahan menyimpan LANGSUNG jadi entri di board
                    yang sedang dibuka, bukan jadi lampiran kotak Drop. Di akar
                    tampil board saja - KECUALI kalau belum ada satu pun,
                    karena satu baris "Belum berboard" yang menyembunyikan dua
                    puluh ribu foto adalah dinding tanpa alasan. Dok kameranya
                    PERGI selama memilih: dia duduk di sudut yang sama dengan
                    bilah pilih dan akan menutupi Batal.
                    TIDAK ADA "+ Folder" di layar ini. Pohonnya dikurasi di SATU
                    tempat, di Setelan - dua pintu untuk menumbuhkan daftar yang
                    sama berarti daftarnya tumbuh tanpa ada yang pernah melihat
                    keseluruhannya, dan pohon yang tidak pernah dilihat utuh
                    persis yang mau dihindari.
                    SATU PERTANYAAN PER SESI, DAN ITU DRIVER. Dulu di sini ada
                    dialog "masuk folder mana?" sesudah tiap jepretan; itu sudah
                    dibuang. Ada DUA pertanyaan dan cuma satu yang bisa dijawab
                    manusia: "kamu lihat apa?" (cuma kamu yang tahu) dan "masuk
                    board mana?" (terjemahan dari jawaban pertama ke daftar yang
                    sudah kamu tulis sendiri - mesin bisa, dan mesin melihat
                    gambarnya). Jadi alamatnya DIBIARKAN KOSONG sampai AI
                    memilihnya; menerkanya di jalur masuk berarti dua sistem
                    memilih alamat, dan yang kedua selalu yang lebih miskin.
                    SESI LENGKET ISINYA DRIVER, bukan album ('driverLengket' +
                    'driverLengketPada'). Di lapangan orang memotret BERUNTUN:
                    sepuluh jepretan dalam lima menit, semuanya satu sudut
                    pandang. Jadi jepretan berikutnya MEWARISI drivernya dan
                    yang ditawarkan cuma jalan keluarnya ("Ganti") -
                    mendiamkannya berarti menerima, nol ketukan untuk hal yang
                    paling sering benar. Warisannya KEDALUWARSA SATU JAM,
                    bergulir dari jepretan terakhir: satu foto jam sepuluh pagi
                    dan satu foto jam empat sore itu dua kejadian, dan salah
                    sudut pandang lebih buruk daripada tanpa sudut pandang -
                    yang salah tidak pernah kamu curigai.
                    Gambarnya SUDAH TERSIMPAN sebelum satu dialog pun muncul -
                    dialog driver itu tawaran di belakang, bukan gerbang di
                    depan; aturan nomor satu tidak punya pengecualian, bahkan
                    untuk aturan yang bagus. Bilah sesi di atas dok kamera
                    membacakan DRIVERNYA (alamat masih bisa dipindah kapan saja;
                    sudut pandang yang basi tidak ketahuan); silangnya menutup
                    sesi - "use last scene set up until it dropped".
                    DRIVER ('driver' di entri) - yang diketik waktu memotret
                    BUKAN ALAMAT, TAPI NIAT. Dua
                    tiga kata: "interior mesjid", "sofa unik minimalis". Satu
                    foto tidak punya satu isi, dia punya isi MENURUT drivernya:
                    foto masjid yang sama dengan driver "karpet mesjid" jadi
                    barang lain sama sekali, dan foto QR menu di resto itu FNB
                    kalau yang dipikirkan restonya, Apps Dev kalau yang
                    dipikirkan produknya. Bendanya sama; sudut pandangnya
                    milik pemakainya, dan CUMA DIA yang tahu - itu sebabnya AI
                    tidak pernah menebaknya dari gambarnya (yang dia lihat di
                    foto masjid "beberapa orang sholat": benar, dan meleset
                    total). Dari driver turun semuanya: judul, deskripsi, dan
                    boardnya. Disimpan MENTAH dan dinilai 6 di pencarian - itu
                    satu-satunya teks di entri yang lahir dari kepalanya.
                    Ditanya SEKALI di jepretan pertama lalu mewaris sesesi;
                    "Ganti" menanyakannya LAGI (menekan Ganti berarti
                    konteksnya berpindah, bukan alamatnya yang salah).
                    BERDIRI DI DALAM BOARD MENJAWAB "KE MANA", BUKAN "APA YANG
                    KAMU LIHAT" - dua pertanyaan, dan menyamakannya adalah
                    kesalahan yang paling mahal di sini: dulu memotret dari
                    dalam board melewati pertanyaan driver sama sekali, lalu
                    fotonya berangkat tanpa sudut pandang dan jatuh ke pembaca
                    dokumen. Yang kembali "Ruang Tamu Modern" untuk board
                    Bedroom. Jadi boardnya
                    tidak ditanya lagi, drivernya TETAP ditagih sekali per sesi.
                    Alamat yang begitu DIKUNCI 'albumManual' - kalau tidak,
                    pelabelan yang berjalan di belakang memindahkannya ke board
                    pilihan AI, membatalkan jawaban yang barusan kamu berikan.
                    RUTE ARAHAN dipilih fotoReferensi(e), BUKAN ada-tidaknya
                    driver: kamera/unggah selalu arahan gambar (kamera tidak
                    pernah menghasilkan faktur), dan yang jatuh lewat Drop
                    tanpa driver tetap pembaca dokumen.
                    Driver yang datang belakangan memicu pelabelan ULANG.
public/bawaan.js    (lanjutan) POHON BOARD ('boardAwal', disunting lewat menu
                    di Setelan) - SATU pohon, dua tingkat, dan dia satu-satunya
                    alamat. Main board bidangnya, sub board urusannya di dalam
                    bidang itu. Susunannya dibaca dari NAMA ("FNB Menu Promo"
                    otomatis anak "FNB"), jadi tidak ada kolom induk yang bisa
                    jadi yatim - tapi awalannya DIPASANG APLIKASINYA lewat
                    "+ Sub", bukan dituntut dari jarinya. Menyuruh orang menebak
                    sendiri bahwa namanya wajib diawali nama induknya berarti
                    sub boardnya tidak pernah terbentuk: yang terjadi dia
                    mengetik "Kitchen" dan itu mendarat di akar.
                    DAFTARNYA TERTUTUP. AI memilih dari sini, tidak pernah
                    menambah barisnya - dan itu KEBALIKAN aturan tag yang lama
                    (daftar tag sengaja terbuka, karena tag yang meleset cuma
                    pintu tambahan yang tidak terpakai). Alamat lain ceritanya.
                    Kalau tidak ada sub yang cocok, jawabannya main board-nya
                    saja; itu jawaban yang SAH, bukan kegagalan - "Interior"
                    tanpa sub lebih benar daripada foto masjid yang dipaksa
                    masuk "Interior Bedroom", dan ruangan yang belum
                    terdefinisi (masjid, entrance, terrace) memang tinggal di
                    situ sampai pemakainya membuatkan kamarnya.
                    Menghapus main board IKUT menghapus anaknya - kalau tidak,
                    anaknya naik ke akar dan jadi main board "FNB Menu Promo"
                    yang tidak pernah dibuat siapa pun. Isinya TIDAK ikut
                    terhapus; dia cuma keluar dari boardnya.
                    KENAPA DUA PROMO: "FNB Menu Promo" itu menunya sendiri,
                    "FNB Ide Promo" cara menjualnya - billboard menarik yang
                    dipotret di jalan tidak punya menu sama sekali, tapi dia ide
                    promo yang paling berharga. Dua benda, dua kamar.
                    Motivation ada di situ bukan tempelan: yang menginspirasi di
                    tengah jalan tidak punya proyek dan tidak akan pernah
                    punya, dan keberadaannya yang bikin daftar ini daftar
                    MILIKNYA, bukan daftar bisnis.
public/pelabel.js   (lanjutan) TIDAK ADA TAG SAMA SEKALI, dan itu keputusan
                    yang disengaja, bukan yang belum dikerjakan. Hashtag buatan
                    mesin MELAR dan tidak pernah konvergen: sebulan kemudian ada
                    #sofa, #kursi, dan #seating untuk satu benda, dan pemiliknya
                    tidak mengenali satu pun waktu mencari. Kata yang tidak dia
                    ingat bukan pintu masuk, cuma hiasan di kartu - dan hiasan
                    yang menyaru sebagai pintu masuk lebih buruk daripada tidak
                    ada. Kolom 'tag' masih ada di KOLOM cadangan tapi berhenti
                    diisi: membuangnya menggeser dua puluh kolom di belakangnya
                    dan seluruh cadangan lama ikut bergeser diam-diam.
                    ARAHAN GAMBAR TERPISAH dan PENDEK (~1200 karakter
                    lawan ~8000 milik arahan label). Yang panjang bikin model
                    kehilangan fokus, dan yang tenggelam justru drivernya -
                    dibuktikan di lapangan: prompt tiga kalimat buatan
                    pemakainya mengalahkan arahan dua ratus baris aplikasi ini
                    pada gambar yang sama. Sebabnya arahan panjang itu PEMBACA
                    DOKUMEN (faktur, KTP) yang ditempeli paragraf driver, dan
                    isinya masih menyuruh "sebutkan jenis dokumennya" dan
                    "jangan menafsirkan" - dua perintah yang bertabrakan
                    langsung dengan sudut pandang.
                    DESKRIPSI 2-3 KALIMAT, dan isinya ditentukan: nama objek,
                    gaya, kategori, bentuk, fungsi, satu hal unik yang benar-
                    benar terlihat. Satu kalimat tidak muat enam. Ditulis DARI
                    SUDUT PANDANG driver, bukan dari yang paling menonjol di
                    gambar - foto masjid dengan driver "interior mesjid"
                    menghasilkan kalimat tentang elemen interiornya; yang sama
                    dengan "karpet mesjid" menghasilkan kalimat tentang motif
                    karpetnya. Bendanya satu, deskripsinya dua, keduanya benar.
                    Sebutannya harus kata yang akan dia ketik lagi enam bulan
                    kemudian, bukan bahasa katalog - dia satu-satunya kata kunci
                    yang dipunyai gambar ini.
                    BAHASA JAWABAN MENGIKUTI BAHASA DRIVER. Kalau dia mengetik
                    Inggris, jawabannya tidak boleh pulang Indonesia
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
                    dikunci, judul & board tetap terbuka supaya masih bisa
                    ditemukan. Yang terkunci tidak pernah dikirim ke AI
public/sinkron.js   SINKRON DUA ARAH lewat Drive; tidak pernah di jalur drop.
                    Dulu cadangan satu arah, dan itu benar selama ini cuma
                    aplikasi HP. Dia dipakai di EMPAT perangkat (HP, tablet,
                    laptop, PC), dan di situ satu arah salah bentuk: kamu
                    menulis di laptop, membuka HP, layarnya kosong - yang
                    terbaca bukan "belum saya tarik" tapi "datanya hilang",
                    dan sekali itu terbaca kepercayaannya ikut hilang.
                    TARIK jalan sendiri: waktu aplikasinya dibuka, waktu
                    kembali dari aplikasi lain (di HP PWA jarang benar-benar
                    ditutup), dan didorong 8 detik sesudah ada yang berubah.
                    Tarikan MEMERIKSA modifiedTime dulu - menarik dua puluh
                    ribu baris tiap kali dibuka itu ongkos harian untuk jawaban
                    yang hampir selalu "tidak ada yang baru".
                    SETELAN IKUT PINDAH lewat 'setelan.json' di folder yang
                    sama, MENANGNYA PER KUNCI (peta 'setelanWaktu', dicap di
                    dalam TSimpan.setel - satu corong, bukan belasan pemanggil,
                    dan dibaca SEGAR dari basis data karena salinan di memori
                    tidak pernah ikut berubah). Kalau seluruh berkas yang
                    menang, menambah folder di HP menghapus board yang baru
                    ditulis di laptop. Yang ikut cuma ISI KEPALA (label, board,
                    folderNote, namaElemen, ekorJudul, obrolan).
                    YANG TIDAK PERNAH IKUT: tampilan (tema, bahasa, gayaGaleri
                    - berganti sendiri tanpa diminta itu kehilangan kendali)
                    dan SESI (driverLengket - itu kenyataan fisik, kamu sedang
                    berdiri di masjid; menularkannya ke PC bikin unggahan di
                    kantor berangkat dengan sudut pandang survey)
public/awan.js      (lanjutan) cariAtauBuat PUNYA PENJAGA BALAPAN. Dua
                    perangkat yang pertama kali dibuka pada menit yang sama
                    sama-sama tidak menemukan apa pun lalu sama-sama membuat -
                    hasilnya dua folder bernama sama dan dua perangkat yang
                    tidak akan pernah bertemu, TANPA SATU PESAN GALAT PUN.
                    Jadi sesudah membuat dicari LAGI; yang tertua menang
                    (seri diputus id, supaya semua perangkat memilih yang sama)
                    dan punya sendiri dibuang - aman, dia baru lahir dan kosong.
                    pageSize harus >1: dengan 1, tabrakannya bahkan tidak
                    kelihatan. tulisJson lewat penjaga yang sama, kalau tidak
                    setelan.json beranak dan tiap perangkat menulis ke
                    salinannya sendiri
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
                    kategorinya saja. Alamat satu catatan bukan cuma kolom
                    kategori: begitu kategorinya kosong, alamatnya jatuh ke
                    board pilihan AI - dan raknya lahir kembali seketika
                    (pesannya lewat, foldernya tetap utuh). Penandanya sendiri
                    yang dipakai: kolom 'rakLepas', dan selama dia menyala
                    alamatnya "Belum berlabel" apa pun boardnya. Berakhir
                    sendiri begitu kamu menaruhnya di rak lain (lihat
                    taruhFolder). Ikut dicadangkan - kolomnya DI EKOR KOLOM,
                    seperti semua kolom baru. Umpan uji untuk ini WAJIB
                    berboard: catatan tanpa board jatuh ke "Belum berlabel"
                    dengan sendirinya, dan itu yang dulu menyembunyikan bugnya.
                    Folder Note tidak kena aturan ini: dia punya daftarnya
                    sendiri, dan board catatan tidak ada urusannya dengan
                    tempat yang kamu buat tangan.
                    DI AKAR YANG TAMPIL FOLDER SAJA - isinya baru terlihat
                    sesudah foldernya dibuka; yang belum berfolder punya
                    barisnya sendiri. Folder tujuan pindah DIPILIH, tidak
                    diketik. Membuka folder lalu "tulis baru" mengisi
                    judulnya dengan nama folder itu LENGKAP sampai akarnya
                    ("Prompt Cortex", bukan "Cortex"), dan menambahkan "(2)",
                    "(3)" kalau judul itu sudah ada. Nomornya dihitung dari
                    yang SUDAH ADA, bukan dari hitungan yang disimpan -
                    hitungan simpanan meleset begitu satu tulisan dibuang.
                    Yang pertama tidak bernomor. Perbandingannya JANGAN lewat
                    TOtak.normal(): normal() membuang semua tanda baca, tanda
                    kurungnya sekalian, jadi "(2)" jatuh jadi "2" dan yang
                    ketiga ikut bernomor (2). Ekor judul yang PERNAH KAMU PAKAI
                    di folder itu ditawarkan sebagai cip ('ekorJudul' di
                    setelan) - tawaran, bukan tebakan.
                    SUSUNAN FOLDER DIBACA DARI NAMANYA: "Prompt Cortex" itu
                    anak "Prompt", tanpa batas tingkat. Tapi AWALANNYA DIPASANG
                    APLIKASI, bukan diketik pemakainya - "+ Folder" membuat
                    folder di tempat kamu berdiri, jadi di dalam "Prompt" kamu
                    cukup mengetik "Cortex". Menyuruh orang menebak sendiri
                    bahwa namanya wajib diawali nama induknya berarti sub
                    foldernya tidak pernah terbentuk: yang terjadi dia mengetik
                    "Test level 2" dan itu mendarat di akar. Barisnya menulis
                    NAMA PENDEKNYA saja (di dalam "Prompt", anaknya tertulis
                    "Cortex"); nama panjangnya tetap identitasnya. Panah kembali
                    naik SATU tingkat, tidak melompat ke akar.
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
                    nol tidak digambar.
                    CIP GAMBAR ITU PINTU, bukan saringan: dia membuka Gallery
                    sambil membawa ketikannya (atau nama rak yang aktif). Layar
                    Drop TIDAK lagi menggambar petak gambar sama sekali - dua
                    tempat yang menggambar petak yang sama berarti perbaikan di
                    satu tempat tidak sampai ke tempat lain, dan yang di Drop
                    selalu yang lebih miskin. Bentuknya bergaris putus-putus,
                    kosakata yang di aplikasi ini sudah berarti "jalan pintas,
                    bukan keadaan" (sama dengan Reset dan "+ Folder"). Reset cip PALING KANAN, sebelah Pin -
                    jangan naikkan lagi ke kepala, itu ujung terjauh dari
                    jempol. Angka "N tersimpan" sudah dibuang dan jangan
                    dikembalikan.
                    Isi kotak, ala WhatsApp: AI - [teks] - klip - Todo -
                    KAMERA, lalu Drop di luar. LIMA ikon waktu diam, TIGA waktu
                    mengetik: ikon AI dan kamera pergi di mode Drop begitu ada
                    yang diketik (foto yang kamu ambil tidak ada hubungannya
                    dengan kalimat yang sedang kamu tulis, dan kotaknya butuh
                    tempatnya justru saat isinya paling panjang); klip, Todo,
                    dan kamera pergi di mode AI. Di bawah 400px ikonnya
                    MENYUSUT, tidak ada yang dibuang - yang dibuang pasti yang
                    sedang dibutuhkan orangnya.
                    IKON KAMERA ITU JALAN PINTAS KE GALLERY, BUKAN LAMPIRAN.
                    Bedanya dengan klip di sebelahnya bukan bentuk berkasnya,
                    tapi ke mana barangnya pergi: klip menempelkan gambar pada
                    catatan yang sedang diketik, kamera menyimpannya LANGSUNG
                    jadi entri Gallery lewat isian yang sama persis dengan dok
                    kamera di sana - sesi dan pertanyaan drivernya ikut sama.
                    Dua jalur masuk yang menghasilkan dua bentuk barang adalah
                    cara tercepat membuat satu tumpukan jadi dua tumpukan yang
                    tidak pernah bertemu. Layarnya TIDAK ikut berpindah, dan
                    alamatnya DIKOSONGKAN - board yang kebetulan terakhir
                    dibuka di Gallery tidak menjawab "ke mana" untuk foto yang
                    diambil dari sini.
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

Sebelum menyentuh kode, jalankan dulu `node uji/uji-terima.mjs` (735 lulus).
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
