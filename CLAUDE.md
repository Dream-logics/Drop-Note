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
   salah satunya tanpa kamu memutuskan apa pun.

   **Pohonnya TIGA TINGKAT: akar - interest - sub interest.** Akarnya
   (`akarAwal` di bawaan.js — Business, Personal, Project, Social, Subject,
   Tools, Work) DIPASANG SISTEM dan sehari-hari tidak dipikirkan pemakainya;
   yang dia isi cuma dua tingkat di bawahnya. Gunanya MEMICU: "Subject"
   mengingatkan mahasiswa bahwa mata kuliah punya tempatnya sendiri.
   Kenapa tingkat ketiga ada: sembilan interest sejajar sudah di batas yang
   bisa dipindai mata, di lima belas dia dinding — dan pemakainya sendiri
   sudah menambal dengan menaruh "Biz –" di depan tiap nama, artinya
   tingkat itu memang dibutuhkan (dan tambalan itu diam-diam mematikan
   `bacaBoardDariDriver`, karena nama yang diketik jari tidak cocok lagi).
   AKAR TIDAK BISA DIISI GAMBAR LANGSUNG dan TIDAK BISA DIHAPUS — dia tulang
   punggung, bukan ruangan. Di Gallery barisnya BISA diketuk (yang muncul
   interest-nya, bukan foto), di Setelan kepalanya tidak. Menjadikannya tempat
   menaruh foto berarti menambah satu ketukan ke tiap foto; memberinya silang
   berarti satu ketukan yang meleset melenyapkan seluruh bidang beserta
   sub-nya, dan itu satu-satunya ketukan yang tidak bisa dibatalkan.
   **TAPI AKARNYA TETAP MILIK PEMAKAINYA:** bisa DITAMBAH ("+ Akar baru", di
   dasar menu Setelan) dan DINAMAI ULANG (pensil di kepalanya; anaknya ikut
   berganti nama, isinya tidak pindah ke mana-mana). Daftar bawaannya tebakan
   tentang hidup orang lain — "Subject" tidak berarti apa-apa buat yang sudah
   lulus. Yang tertutup buat AI, bukan buat jarinya: **AI tidak pernah
   menyentuh tingkat akar sama sekali.**
   Yang ditambah/dinamai sendiri dicatat di setelan **`akarTangan`** (ikut
   sinkron), dan `akarSistem()`/`TPelabel.daftarAkar()` membaca gabungan
   keduanya. Catatan itu terpisah dari pohonnya karena pohonnya cuma daftar
   nama datar: tingkat dibaca dari awalan, dan akar tidak punya awalan untuk
   dibaca. Tanpa catatan itu, akar buatan tangan turun pangkat jadi interest
   yatim di bawah "Tanpa akar" — dan yang terbaca bukan "belum kucatat" tapi
   "tombolnya salah menaruhnya".

   **Pohonnya boleh tumbuh; KATANYA yang tertutup.** Yang membuat taksonomi
   meleleh bukan pertumbuhan, tapi PENAMAAN BEBAS — tag mati karena mesin
   boleh mengarang kata (#sofa, #kursi, #seating untuk satu benda). Jadi AI
   cuma boleh menggabungkan dua potong yang SUDAH tertulis: nama INTEREST +
   satu AKHIRAN dari daftar tertutup (`akhiranAwal` di bawaan.js). Interest
   tetap tanganmu — atapnya tidak pernah tumbuh sendiri, dan AKARNYA tidak
   pernah ditumbuhi sama sekali ("Business Inspiration" ruangan yang tidak
   menjawab apa pun). Penggabungannya
   dikerjakan `pilihBoard()`, bukan modelnya: nama yang tidak ada di dua
   daftar itu tidak akan pernah lahir.
   Ongkosnya harus disebut: AI tidak akan pernah membuat "Interior Terrace" —
   nama ruangan itu BENDA, dan begitu benda boleh dikarang kita kembali ke
   #sofa lawan #kursi. Yang membereskannya **Ubah nama & Gabung di Gallery**,
   bukan kelonggaran di arahannya.
   Hashtag sudah dicoba dan **dibuang seluruhnya**; yang menggantikan kata
   kunci adalah DESKRIPSI (lihat pelabel.js).
5. **Layar depan kosong.**
6. **Judul yang diketik sendiri tidak pernah ditimpa AI** (`judulManual`).
7. **Swalayan.** Folder Drive dan spreadsheet dibuat aplikasi, bukan pemakainya.
   Satu-satunya yang diminta darinya: kunci Gemini, dan itu pun boleh dilewati.
   **Client ID Google tidak pernah ditanyakan ke pemakai** — itu ditanam sekali
   di `bawaan.js` oleh pembuatnya, dan isiannya cuma muncul kalau masih kosong.
   **YANG DITANAM PEMBUATNYA MENANG ATAS YANG TERSIMPAN DI PERANGKAT**
   (`clientId()` di awan.js), dan urutan itu bukan selera. Dulu terbalik, dan
   itu jebakan yang tidak punya jalan keluar: Client ID yang pernah ditempel
   sekali waktu masih uji coba terus dikirim ke Google SELAMANYA — sementara
   isian untuk mengubahnya cuma digambar kalau `bawaan.js` masih kosong, jadi
   begitu pembuatnya menanam miliknya, nilai basi tadi tidak terlihat DAN tidak
   bisa dihapus. Yang kembali dari Google: *"Error 401: invalid_client — no
   registered origin"*, dan di jendela penyamaran tidak pernah muncul karena di
   sana tidak ada yang tersimpan — jadi yang kelihatan seperti "peramban ini
   bermasalah" sebenarnya "aplikasi ini mengirim Client ID yang salah, dan cuma
   di peramban yang pernah dipakai". Yang basi sekarang DIBUANG waktu memuat,
   bukan cuma dikalahkan.
   Setelan menuliskan ASAL HALAMAN dan CLIENT ID YANG DIKIRIM waktu belum
   tersambung: penolakan Google tidak pernah menyebut client mana yang
   ditolaknya, jadi selama dua nilai itu tidak kelihatan, satu-satunya cara
   mengetahuinya adalah menebak.
   **MEMILIH AKUN BUKAN RITUAL HARIAN.** Dua hal yang menjaganya, keduanya di
   `awan.js`: (1) `hangatkan()` cuma berjalan kalau perangkat ini MEMANG PERNAH
   tersambung (`pernahMasuk`: ada `sheetId` atau `akunEmail`) — penjaganya dulu
   cuma "ada Client ID", padahal Client ID selalu ada, jadi tiap pembukaan
   aplikasi memicu permintaan token dan Google menjawabnya dengan pemilih akun;
   (2) `prompt: 'consent'` cuma untuk izin PERTAMA, sesudah itu `''` plus
   `hint: akunEmail` — `'consent'` artinya "tampilkan SELALU", dan tanpa `hint`
   pemilih akun muncul bukan karena izinnya kurang tapi karena Google tidak
   tahu akun mana yang dimaksud. `akunEmail` disimpan waktu tersambung, dan itu
   satu-satunya gunanya.
   **TIDAK ADA PEKERJAAN LATAR YANG BOLEH MEMBUKA JENDELA GOOGLE.** Penjaganya
   SATU, di `ambilToken()`: permintaan diam-diam GAGAL SEKETIKA kalau perangkat
   ini belum pernah tersambung. Ditaruh di situ, bukan di tiap pemanggil, karena
   pemanggilnya banyak dan semuanya berjalan sendiri — penghangat, cadangan,
   tarikan sinkron, pelabelan AI sesudah tiap drop — dan satu yang lupa bukan
   galat, tapi layar pilih akun di tengah pekerjaan. `prompt: ''` BUKAN jaminan
   tanpa layar: kalau izinnya belum pernah diberikan, Google tetap membuka
   pemilih akun.
   Akibatnya yang harus disebut: **perangkat baru DIAM sampai kamu menekan
   Hubungkan sekali** — OAuth memang menuntut satu sentuhan per peramban.
   Sesudah itu dia mengisi dirinya sendiri sampai penuh, tanpa satu tombol lagi.
   Uji terimanya dulu menuntut "terisi sendiri tanpa satu tombol pun", dan itu
   tidak bisa ada bersama aturan di atas; yang menang keluhan lapangan.
   **TIDAK ADA GOOGLE SEBELUM LAYARNYA TERGAMBAR.** `requestAccessToken()` GIS
   SELALU membuka jendela `accounts.google.com`; `prompt: ''` cuma membuatnya
   menutup sendiri sesudah beberapa detik. Jadi satu saja permintaan token di
   pembukaan berarti *"One moment please…"* mendahului layar aplikasinya — dan
   aplikasi yang dipakai memotret sesuatu di jalan tidak boleh punya ruang
   tunggu. Dua yang menjaganya: (1) **tokennya DISIMPAN** (`gToken`,
   `gTokenSampai`, dimuat `TAwan.muatToken()` sebelum apa pun berangkat), jadi
   di dalam satu jam pembukaan berikutnya tidak memanggil Google sama sekali;
   (2) pelabelan, cadangan, dan tarikan sinkron **ditunda** `JEDA_AWAN_AWAL`
   sesudah layarnya tergambar. `hangatkan()` DIBUANG — dia lahir karena
   tokennya cuma di memori, dan yang tersisa darinya cuma satu jendela Google
   di tiap pembukaan.
   Menyimpan token itu memang melonggarkan aturan lama "tidak pernah ke disk",
   dan itu disengaja: umurnya sejam, cakupannya cuma `drive.file` + surel, dan
   dia tinggal di IndexedDB yang sama dengan seluruh catatannya — yang bisa
   membacanya sudah memegang semuanya.
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
public/otak.js      PENCARIANNYA "DAN", BUKAN "ATAU", DAN TANPA PELONGGARAN.
                    Semua kata harus ketemu; urutannya tidak diikat. Dulu ada
                    jaring pengaman: kalau tidak ada satu pun entri yang memuat
                    semua katanya, syaratnya turun jadi "salah satu" supaya
                    layarnya tidak kosong. Di lapangan hasilnya kebalikannya -
                    "cangkir kopi" mengembalikan 2 hasil yang benar, "cangkir
                    kopi hitam" mengembalikan 40 dan tidak satu pun benar:
                    laptop naik karena "hitam", kamar tidur karena "kopi".
                    Makin lengkap yang diketik makin buruk hasilnya, dan sekali
                    itu terlihat orangnya berhenti mengetik kata ketiga
                    selamanya - padahal kata ketiga yang paling menyempitkan.
                    Layar kosong itu jawaban jujur; 40 hasil salah itu
                    pekerjaan baru.
                    Menilai judul 6, driver 6, label 5,
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
public/pelabel.js   SATU FOTO SATU PANGGILAN. antreLabel MELEWATI yang punya
                    berkas terbaca (bisaDibaca) - itu bagiannya bacaBerkas.
                    Tanpa saringan itu tiap foto berangkat DUA KALI: sekali
                    lewat antreLabel tanpa gambarnya (cuma nama berkas +
                    driver), sekali lagi lewat bacaBerkas yang benar-benar
                    melihat gambarnya. Ongkosnya dua kali lipat, dan yang lebih
                    buruk: keduanya menulis deskripsi lalu yang kedua
                    DITEMPELKAN di bawah yang pertama (aturan "sudut pandang
                    kedua"), jadi satu benda dijelaskan dua kali dengan kata
                    yang beda-beda tipis.
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
                    milik Note.
                    Kamera dan unggahan menyimpan LANGSUNG jadi entri di board
                    yang sedang dibuka, bukan jadi lampiran kotak Drop. Di akar
                    tampil board saja - KECUALI kalau belum ada satu pun,
                    karena satu baris "Belum berboard" yang menyembunyikan dua
                    puluh ribu foto adalah dinding tanpa alasan. Dok kameranya
                    PERGI selama memilih: dia duduk di sudut yang sama dengan
                    bilah pilih dan akan menutupi Batal.
                    KEPALANYA TIGA TOMBOL: Home - All - View. Home mengembalikan
                    layar seperti baru dibuka (akar, tanpa kueri, tanpa saringan,
                    menu tertutup) - satu ketukan, bukan empat di empat tempat.
                    All MENEMBUS board: yang tampil semua gambarnya, karena
                    kadang yang kamu cari cuma "yang tadi" dan yang tadi tidak
                    punya alamat di kepalamu; dia keadaan, tidak ikut disimpan.
                    DI DALAM BOARD, SUB-NYA DIGAMBAR SEBAGAI LACI: nama, angka,
                    dan gambarnya tepat di bawahnya begitu dibuka (laciHtml).
                    Sebelumnya barisnya cuma nama dan angka, dan satu-satunya
                    cara melihat isinya adalah masuk lalu keluar lagi - tiga
                    ketukan untuk pertanyaan yang jawabnya "oh, bukan yang ini".
                    Tiap laci berdiri sendiri; membuka yang satu tidak menutup
                    yang lain, karena yang sering terjadi membandingkan dua laci.
                    DUA SASARAN DI SATU BARIS, keduanya 40px: barisnya
                    mengintip ('data-laci'), panah di ujung kanan
                    ('laci-masuk') benar-benar pindah. Barisnya tetap membawa
                    'data-galeri-folder' supaya TEKAN LAMA masih menandainya
                    untuk dibuang/gabung/pindah - yang mengintip dibaca duluan
                    dan sengaja dilewati selama memilih.
                    LACINYA BERSARANG, BUKAN MENELAN: yang digambar di dalamnya
                    sub foldernya sebagai laci lagi, LALU gambar yang memang
                    tinggal di baris itu sendiri. Dulu isinya seluruh subtree
                    sebagai satu tumpukan rata, dan sub foldernya lenyap dari
                    layar - yang terbaca bukan "isinya diperlihatkan" tapi
                    "susunannya hilang", dan susunan yang hilang begitu diintip
                    bikin mengintip berhenti bisa dipercaya. Jumlah laci anak +
                    gambar langsungnya persis sama dengan angka di barisnya;
                    angka yang tidak cocok dengan isinya lebih buruk daripada
                    tidak berangka. Buka/tutup semua di kepalanya, dan
                    "buka semua" MENEMBUS sampai ke dalam - yang berhenti di
                    tingkat pertama bukan buka semua. Lacinya KEADAAN,
                    tidak ikut disimpan, dan ditutup Home.
                    KELASNYA 'laci-board', BUKAN 'laci' - nama itu sudah dipakai
                    laci lampiran di dok Drop (kartu berbingkai, max-height
                    46vh). Kelas yang bertabrakan tidak pernah bergalat; dia
                    cuma diam-diam mewarisi gaya yang tidak dimaksud, dan di
                    sini akibatnya baris folder jadi kartu putih dan laci yang
                    panjang terpotong separuh layar.
                    GARIS DI BAWAH JUDUL CUMA KALAU LACINYA TERBUKA. Garis yang
                    memisahkan judul dari ruang kosong tidak memisahkan apa pun,
                    dia cuma coretan. Yang memisahkan baris dari baris tetap
                    ada, tapi dipasang sebagai border-top baris BERIKUTNYA -
                    jadi baris terakhir tidak meninggalkan garis menggantung.
                    Panah masuknya dipatok ke '.laci-baris' (top:0;bottom:0),
                    bukan ke seluruh laci: kalau ke lacinya, dia menempel di
                    atas begitu isinya terbuka.
                    View menu turun berisi SATU BARIS saja: ukuran petak
                    (bawaan 'sedang'), dan barisnya MENCIUT begitu dipilih -
                    menu yang tetap terbuka mendorong gambarnya turun justru
                    waktu kamu baru selesai mengatur cara melihatnya.
                    SARINGAN SUMBER SUDAH DIBUANG SELURUHNYA dan jangan
                    dikembalikan: "Kamera / Unggah / Drop" memisahkan tumpukan
                    menurut CARA BARANGNYA MASUK, dan itu bukan pertanyaan yang
                    pernah dibawa mata ke layar ini - yang dicari "foto apa",
                    bukan "lewat pintu mana". Yang benar-benar dipakai dari
                    kelimanya cuma "Semua", dan itu sudah punya tombolnya sendiri
                    di kepala.
                    TIDAK ADA LAGI baris "Belum berboard": dua baris yang
                    mengucapkan pertanyaan yang sama persis ("yang tidak punya
                    rumah"), dan yang pertama bunyinya seperti kesalahan. Yang
                    belum punya alamat tinggal DI DALAM ruang tunggu
                    (tanpaGaleri() dipakai sebagai penampung bangunPohon), dan
                    membukanya menampilkan keduanya - yang album-nya "Other and
                    Various" dan yang album-nya kosong. Namanya cuma muncul lagi
                    kalau ruang tunggunya sendiri kamu hapus: foto yang tidak
                    punya baris untuk ditampilkan sama saja dengan foto yang
                    hilang. Berdiri di ruang tunggu TIDAK mengunci alamat -
                    dia tempat yang isinya belum diputuskan.
                    DI AKAR YANG TAMPIL AKARNYA SAJA (akarBerbagian), sebagai
                    BARIS YANG BISA DIKETUK - bukan kepala bagian yang menggelar
                    seluruh interest sekaligus. Tujuh kepala dengan sepuluh
                    interest di bawah masing-masing itu lima layar HP yang harus
                    digulir sebelum sampai ke baris terakhir, dan yang dicari
                    mata di layar pertama cuma "bidang mana". Ini TIDAK menambah
                    ketukan di jalur masuk - yang bertambah cuma di jalur BACA,
                    dan di situ satu ketukan menukar lima layar gulir. Akarnya
                    tetap tidak menampung gambar langsung: yang muncul sesudah
                    diketuk interest-nya, bukan foto. Lalu GARIS ('.pisah') dan
                    ruang tunggu paling bawah; tanpa garisnya
                    keduanya terbaca sederajat, dan "Other and Various" duduk di
                    antara bidang usahamu seperti salah satunya - padahal dia
                    kebalikannya.
                    AKAR YANG KOSONG TIDAK DIGAMBAR SAMA SEKALI - tujuh baris
                    yang enam di antaranya kosong bukan struktur, itu daftar
                    kosong yang harus digulir. Pohon lama yang belum berakar
                    digambar sederajat dengan akarnya: berlaku maju, bukan mundur.
                    ANGKA DI TIAP BARIS ITU JUMLAH GAMBAR, DAN DIA MENGHITUNG
                    SAMPAI KE DALAM ('total' dari bangunPohon). Dulu barisnya
                    membawa dua angka: "10 album" dan isi langsungnya. Yang
                    dibaca mata cuma yang pertama, dan yang pertama menjawab
                    pertanyaan yang tidak pernah ditanyakan - kamu tidak mencari
                    album, kamu mencari foto. Akibatnya baris bertulis "10 album"
                    diketuk lalu isinya nol, dan angka yang menipu sekali saja
                    berhenti dipercaya selamanya.
                    TIAP INTEREST SELALU PUNYA "<interest> Various", WALAU KOSONG
                    (albumTampak). Yang membuka "Business Hampers" dan cuma
                    melihat "Isi Hamper" tidak punya satu tempat pun untuk hamper
                    yang bukan isinya - jadi dia menaruhnya di interest itu
                    sendiri, dan interest yang menampung foto lepas di samping
                    sub-nya persis timbunan yang dilawan aplikasi ini. Barisnya
                    VIRTUAL, tidak ditanam ke setelan: sebelas baris "Various"
                    yang lahir sendiri di Setelan adalah pohon yang menumbuhi
                    dirinya di belakangmu, dan pohon begitu berhenti terasa
                    milikmu. Jadi sungguhan begitu ada yang benar-benar mendarat
                    di situ (pastikanAlbumAda, dipanggil jalur kamera dan pindah).
                    Akar dan ruang tunggu TIDAK ikut dapat.
                    BOARDNYA BERURUT ABJAD, bukan terbanyak-dulu (bangunPohon
                    dapat penanda 'abjad'). Pohon board kamu tulis sendiri dan
                    jumlahnya tetap; urutan yang berubah mengikuti isinya
                    berarti jari tidak pernah hafal tempatnya. Rak Storage lain
                    ceritanya - dia lahir dari catatan yang jatuh, jadi yang
                    paling ramai memang yang paling mungkin kamu tuju.
                    BARISAN FOTO SESI ('fotoSesi', di kepala akar Gallery):
                    bukti bahwa jepretanmu mendarat, DAN DI MANA. Sesudah
                    memotret layarnya bersih, dan yang terbaca bukan "sudah
                    tersimpan" tapi "tombolnya tidak berfungsi". Tiap petak
                    membawa boardnya, atau "menunggu AI…" kalau belum dipilih -
                    menunggu itu jawaban yang jujur, dan jawaban jujur lebih
                    menenangkan daripada nama board yang diterka. HIDUP DI
                    MEMORI SAJA: memuat ulang atau menutup sesinya
                    membuangnya, karena kabar yang masih menempel besok pagi
                    bukan kabar lagi. Tidak digambar di dalam board - fotonya
                    sudah kelihatan sendiri di bawahnya.
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
                    YANG KAMU KETIK MENANG ATAS TEMPAT KAMU BERDIRI. Keduanya
                    keputusanmu, tapi tidak sama umurnya: drivernya baru saja
                    kamu ketik - satu-satunya teks di entri yang lahir dari
                    kepalamu - sementara board yang kebetulan terbuka bisa saja
                    sisa kunjungan tadi pagi. Jadi kalau drivernya menyebut
                    bidang LAIN, tempat berdirinya DILEPAS, bukan diadu
                    (seJalur di alur.js, dan wajib = sebut.main || albumInduk
                    di taruhBoard). Kalau drivernya diam, tempat berdirinya
                    tetap berlaku - dia satu-satunya jawaban yang ada.
                    AKARNYA WAJIB IKUT DIKIRIM ke bacaBoardDariDriver, DI SEMUA
                    PEMANGGILNYA. taruhDriver pernah memanggilnya tanpa itu, dan
                    akibatnya paling licin dari semua kekeliruan di berkas ini:
                    tanpa daftar akar dia tidak tahu "Business" itu akar, jadi
                    "Business Hampers" terbaca sebagai SUB board - alamat
                    lengkap - lalu DIKUNCI albumManual. Fotonya mendarat di
                    pintu ruangan dan terkunci di situ, dan tiga aturan
                    penempatan tidak ada satu pun yang dijalankan. Yang
                    kelihatan "AI salah memilih" sebenarnya "AI tidak pernah
                    ditanya", dan kekeliruannya tidak kelihatan dari mana pun
                    kecuali dari alamat yang mendarat.
                    DRIVER BOLEH SEKALIAN MENYEBUT ALAMATNYA
                    (TOtak.bacaBoardDariDriver). Ketik nama SUB board -> langsung
                    mendarat di situ dan DIKUNCI, tanpa AI: kamu sudah menjawab.
                    Ketik nama MAIN board -> alamatnya baru separuh, dan yang
                    tersisa ("sub yang mana") justru pertanyaan yang bisa
                    dijawab mesin karena dia melihat gambarnya; pilihBoard
                    menolak jawaban di luar main board itu.
                    COCOKNYA HARUS TIDAK AMBIGU: akhiran telanjang ("Menu")
                    tidak pernah jadi alamat - dia niat, bukan tempat, dan
                    "Daily Life Menu" bisa punya kembaran di bawah main board
                    lain. Dua sub yang sama-sama disebut ("bedroom lighting")
                    jatuh ke induknya, bukan diundi berdasarkan nama terpanjang.
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
                    YANG DIKUNCI CUMA KALAU YANG KAMU MASUKI DAUN. Berdiri di
                    sub interest berarti kamu memang sudah menyebut kamarnya,
                    jadi 'albumManual' dipasang dan AI tidak boleh
                    memindahkannya. Berdiri di WADAH (akar atau interest) baru
                    menjawab separuh, jadi yang dipasang 'albumInduk' - BATAS,
                    bukan kunci: AI wajib menjawab di dalamnya, dan kalau dia
                    berhenti di pintu ruangan jawabannya dinaikkan ke
                    "<interest> Various". Dulu wadah pun dikunci, dan kuncinya
                    memulangkan taruhBoard() di baris pertamanya - fotonya
                    menumpuk di pintu ruangan walau kamarnya sudah ada, dan yang
                    kelihatan seperti "AI salah memilih" sebenarnya "AI tidak
                    pernah ditanya".
                    RUTE ARAHAN dipilih fotoReferensi(e), BUKAN ada-tidaknya
                    driver: kamera/unggah selalu arahan gambar (kamera tidak
                    pernah menghasilkan faktur), dan yang jatuh lewat Drop
                    tanpa driver tetap pembaca dokumen.
                    Driver yang datang belakangan memicu pelabelan ULANG.
public/bawaan.js    (lanjutan) POHON BOARD ('boardAwal', disunting lewat menu
                    di Setelan) - SATU pohon, TIGA TINGKAT, dan dia satu-satunya
                    alamat. AKARNYA ('akarAwal') dipasang sistem: Business,
                    Personal, Project, Social, Subject, Tools, Work. Tidak bisa
                    dihapus dan tidak menampung gambar, dan di Setelan digambar
                    sebagai KEPALA BAGIAN tanpa silang - dia tulang punggung,
                    bukan isi. TAPI BISA DITAMBAH DAN DINAMAI ULANG TANGAN:
                    "+ Akar baru" di dasar menunya, pensil di kepalanya
                    (namaiAkar -> gantiNamaPohon dengan penanda paksaAlbum,
                    karena layarnya Setelan dan diLayarGaleri() akan memilih
                    kolom 'folder' yang sama sekali tidak dimaksud). Yang
                    tertutup buat AI, bukan buat jarinya. Gunanya MEMICU: "Subject"
                    mengingatkan mahasiswa bahwa mata kuliah punya tempatnya
                    sendiri, "Social" bahwa yang bukan kerjaan juga layak
                    disimpan. Interest dan sub interest saja yang dipikirkan
                    pemakainya, dan cuma itu yang bisa dibuang.
                    Interest-nya DILIPAT, satu terbuka, berurut abjad:
                    digelar sekaligus dia sepanjang tiga layar HP, dan waktu
                    semuanya tergelar "+ Sub" milik satu board duduk berdempetan
                    dengan puluhan baris milik board lain - sekali salah ketuk,
                    sub board yang kamu maksud lahir sebagai main board, dan itu
                    tidak kelihatan sampai kamu membuka Gallery. Sekarang TIAP
                    tombol tambah SELALU punya induk dan menyebut nama induknya
                    di tombolnya sendiri: "+ Sub interest di X" duduk DI DALAM
                    panel yang terbuka, "+ Interest di <akar>" di bawah tiap
                    kepala akar. Tidak ada lagi tombol yang melahirkan baris di
                    akar pohon (tambahBoard menolak induk kosong).
                    Interest bidangnya, sub interest urusannya di dalam
                    bidang itu. Susunannya dibaca dari NAMA ("Business FNB Menu
                    Promo" otomatis anak "Business FNB", yang itu sendiri
                    interest di akar "Business"), jadi tidak ada kolom induk yang
                    bisa jadi yatim - tapi awalannya DIPASANG APLIKASINYA lewat
                    tombol tambah, bukan dituntut dari jarinya. Menyuruh orang
                    menebak sendiri bahwa namanya wajib diawali nama induknya
                    berarti sub boardnya tidak pernah terbentuk: yang terjadi dia
                    mengetik "Kitchen" dan itu mendarat di akar.
                    Barisnya menulis NAMA PENDEKNYA saja - di bawah kepala
                    "Business", mengulang "Business" di tiap baris memakan lebar
                    yang justru dibutuhkan nama aslinya.
                    PINDAH KE SUSUNAN BARU CUMA LEWAT TOMBOL "Ganti dengan
                    susunan bawaan" di Setelan. Tidak ada pemindahan otomatis:
                    pohon yang sudah terlanjur ada itu keputusan pemakainya, dan
                    menimpa keputusan orang diam-diam adalah cara tercepat
                    membuat dia berhenti percaya pada apa yang dilihatnya. Pohon
                    lama yang belum berakar tetap digambar apa adanya, di bawah
                    kepala "Tanpa akar" - berlaku maju, bukan mundur.
                    KATANYA TERTUTUP, POHONNYA BOLEH TUMBUH. AI cuma boleh
                    menggabungkan nama INTEREST yang sudah ada dengan satu
                    kata dari 'akhiranAwal' - Inspiration, Concept, Material,
                    Layout, Menu, Promo, Pricing, Operational, Progress, Apps,
                    Various.
                    Daftar itu bukan karangan: "Inspiration" sudah muncul di
                    empat dari tujuh bidang usahanya, "Apps" di lima; sumbunya
                    memang sudah ada, ini cuma menamainya.
                    AKARNYA TIDAK IKUT DITUMBUHI: "Business Inspiration" ruangan
                    yang tidak menjawab apa pun, dan menaruh gambar di situ sama
                    saja dengan tidak menaruhnya (pilihBoard menyaring akar dari
                    daftar sasaran).
                    Sebabnya: interest yang belum punya sub sama sekali akan
                    menampung SEMUANYA, dan timbunan yang dilawan aplikasi ini
                    lahir lagi di dalam ruangan yang baru dibuat untuk
                    mencegahnya. Tapi penamaan bebas yang membunuh tag, bukan
                    pertumbuhannya - jadi yang dibuka jumlahnya, bukan
                    kosakatanya. Interest tetap tanganmu.
                    Barisnya ditulis pilihBoard()+tambahBoardBaru(), bukan
                    modelnya, dan dicatat di 'boardAI' supaya bisa ditandai
                    titik di Setelan - sekali seminggu kamu bisa lihat ruangan
                    mana yang tumbuh tanpa kamu tulis.
                    JAWABAN YANG BERHENTI DI INTEREST DINAIKKAN KE
                    "<interest> Various", bukan dibiarkan di pintu ruangan.
                    Ini keadaan yang dilaporkan di lapangan: ketik "hampers",
                    fotonya mendarat di "Business Hampers" dan menumpuk di situ
                    walau "Isi Hamper" jelas-jelas ada di dalamnya. Interest yang
                    menampung foto lepas di samping sub board-nya persis timbunan
                    yang dilawan aplikasi ini. Jadi ada DUA TINGKAT RUANG TUNGGU:
                    "Other and Various" kalau BIDANGNYA tidak ketemu, dan
                    "<interest> Various" kalau bidangnya ketemu tapi kamarnya
                    tidak. Yang kedua tetap di dalam bidang yang KAMU sebut -
                    jawaban AI yang meleset bukan alasan membuang alamat yang
                    sudah kamu berikan.
                    Menghapus interest IKUT menghapus anaknya - kalau tidak,
                    anaknya naik ke akar dan jadi interest "FNB Menu Promo"
                    yang tidak pernah dibuat siapa pun. Isinya TIDAK ikut
                    terhapus; dia cuma keluar dari boardnya. Akarnya tetap
                    berdiri.
                    KENAPA DUA PROMO: "FNB Menu Promo" itu menunya sendiri,
                    "FNB Ide Promo" cara menjualnya - billboard menarik yang
                    dipotret di jalan tidak punya menu sama sekali, tapi dia ide
                    promo yang paling berharga. Dua benda, dua kamar.
                    Motivation ada di situ bukan tempelan: yang menginspirasi di
                    tengah jalan tidak punya proyek dan tidak akan pernah
                    punya, dan keberadaannya yang bikin daftar ini daftar
                    MILIKNYA, bukan daftar bisnis.
                    'boardLain' = "Other and Various", RUANG TUNGGU, dan
                    satu-satunya akar yang menampung gambar langsung
                    (kepalanya di Gallery duduk DI BAWAH garis, bukan di antara
                    akar sistem). Foto antariksa
                    tidak punya bidang di daftar mana pun, dan itu bukan
                    kegagalan - hidupnya memang lebih luas daripada tujuh bidang
                    usahanya. Yang dilawan bukan keberadaannya tapi
                    KETIADAANNYA: tanpa dia yang tidak cocok mendarat di "Belum
                    berboard", baris yang bunyinya seperti kesalahan dan yang
                    makin lama makin dihindari sampai tidak pernah dibuka lagi.
                    AI TIDAK MEMBUAT SUB DI DALAMNYA - ruangan di dalam ruang
                    tunggu membatalkan gunanya ruang tunggu. Ruang tunggunya
                    cuma dipakai kalau drivernya TIDAK menyebut bidangnya
                    sendiri: kalau kamu sudah bilang "Interior", jawaban AI yang
                    salah bukan alasan memindahkannya ke ruang tunggu.
                    DITANAM SEKALI ke pohon yang sudah terlanjur ada
                    ('boardLainTanam'), bukan tiap kali dimuat - kalau tiap
                    kali, menghapusnya jadi mustahil dan daftar yang menolak
                    disunting berhenti terasa milik siapa pun.
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
                    DESKRIPSI MAKSIMAL 2 KALIMAT, dan isinya YANG MEMBEDAKAN
                    benda ini dari benda sejenis: warna, bahan, merek, ukuran,
                    kondisi, tulisan yang tertera, bentuk tak biasa, latarnya.
                    FUNGSI GENERIK DILARANG TERANG-TERANGAN ("pulpen untuk
                    mencatat", "mobil untuk transportasi", "ini adalah foto…") -
                    semua itu sudah diketahui siapa pun yang membaca namanya,
                    jadi kalimatnya habis tanpa memberi satu pun pintu masuk
                    baru. Satu gambar sudah seribu kata; yang dibutuhkan
                    deskripsi cuma kata yang MEMANGGIL gambar itu kembali, dan
                    fungsi generik tidak memanggil apa pun karena dia berlaku
                    untuk semua benda sejenis. Dua itu BATAS ATAS, bukan sasaran:
                    waktu diminta "2-3 kalimat" yang kembali lima, dan yang
                    ketiga sampai kelima cuma menulis ulang kalimat pertama
                    dengan kata lain. Deskripsi yang harus digulir berhenti
                    dibaca, dan yang berhenti dibaca sama saja dengan tidak
                    ada. Ditegakkan KODENYA lewat potongKalimat(), dipotong di
                    UJUNG KALIMAT - yang putus di tengah kata terbaca sebagai
                    data rusak.
                    KATA "SUDUT PANDANG" DIBUANG DARI ARAHAN GAMBAR, dan cuma
                    katanya - aturannya tetap sama persis. Yang dimaksud
                    "bagian mana dari benda ini yang dibahas"; yang dibaca
                    model "suara siapa yang bercerita", jadi jawabannya pulang
                    sebagai LAPORAN PANDANGAN MATA lengkap dengan pelakunya.
                    Dua baris lain memperparah: "sebutan yang akan DIA ketik
                    lagi" menaruh kata ganti orang di dalam perintahnya
                    sendiri, dan "bukan bahasa katalog" cuma menyebut yang
                    dilarang - yang paling jauh dari katalog itu bahasa
                    percakapan, jadi ke situlah dia pergi, sampai gue-elo.
                    Sekarang larangannya terang-terangan (tidak ada kata ganti
                    orang, tidak menyapa pembaca, tidak ada pelaku) dan
                    registernya diminta lurus: netral dan baku. REGISTERNYA
                    TIDAK BOLEH DISEBUT DENGAN MENAMAI BAHASANYA - "tulis
                    bahasa Indonesia baku" memperbaiki nadanya sambil merusak
                    aturan bahwa jawaban mengikuti bahasa driver.
                    Isinya tetap ditentukan driver, bukan yang paling menonjol
                    di gambar - foto masjid dengan driver "interior mesjid"
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
public/sinkron.js   TIAP TAHAP PUTARAN BERDIRI SENDIRI. Satu putaran dulu satu
                    rantai: bersihkan nisan - unggah berkas - dorong baris.
                    Satu rantai berarti satu tahap yang gagal membunuh SEMUA
                    tahap sesudahnya, diam-diam. Yang terjadi di lapangan:
                    puluhan catatan uji dihapus sekaligus, kiriman nisannya
                    ditolak (terlalu besar / laju dibatasi), dan sejak saat itu
                    tidak ada satu baris pun yang pernah naik lagi - termasuk
                    satu baris teks yang baru diketik. Nisannya juga tidak
                    pernah terhapus dari perangkat itu, jadi lima menit lagi
                    dia mencoba lagi dengan kiriman yang sama besarnya dan
                    gagal dengan cara yang sama. Selamanya, dan kedua perangkat
                    melapor sehat. Menekan "Pulihkan dari Drive" tidak menolong
                    sama sekali: yang rusak sisi PENGIRIMNYA, jadi tidak ada
                    apa pun di tabel untuk ditarik - dan itu yang terbaca
                    sebagai "arsitekturnya salah".
                    Sekarang bersihkanNisan dan unggahAntre MENELAN GALATNYA
                    SENDIRI (.catch di rantainya): yang gagal dicoba lagi di
                    putaran berikutnya, yang lain tetap berangkat sekarang.
                    Membereskan yang lama tidak pernah boleh menyandera yang
                    baru. Nisannya dibatasi NISAN_SEKALI (25) per putaran dan
                    hapus berkasnya BERURUTAN, bukan Promise.all - dua puluh
                    lima penghapusan Drive yang berangkat berbarengan adalah
                    cara tercepat kena batas laju.
public/sinkron.js   GAMBAR YANG LAHIR DI PERANGKAT LAIN PUNYA JALUR MENGGAMBAR
                    SENDIRI, dan sebelum ini dia tidak ada. Foto naik ke Drive
                    lalu blob-nya DIBUANG dari pengirimnya, dan thumbnail-nya
                    tidak ikut tabel (dataURL puluhan kilobyte kali dua puluh
                    ribu tidak muat di satu spreadsheet). Jadi yang sampai ke
                    perangkat kedua entri utuh - judul, board, deskripsi,
                    semuanya benar - dengan 'driveId' saja dan tanpa satu byte
                    gambar. petakHtml/kartuHtml sekarang menggambar
                    'data-drive' untuk keadaan itu, dan pasangGambarKartu
                    mengunduhnya (blobDariDrive, sekali per driveId per sesi)
                    lalu MENULIS thumbnail-nya ke entri lokal - tanpa menyentuh
                    'diubah', karena thumbnail bukan suntingan dan menaikkannya
                    berarti entri itu didorong ulang tiap kali pertama dilihat
                    di perangkat baru.
                    Yang terbaca kalau jalurnya tidak ada bukan "gambarnya
                    belum diunduh" tapi "sinkronnya rusak": petak kosong adalah
                    laporan yang SALAH tentang keadaan yang BENAR, dan itu
                    lebih buruk daripada galat - galat menyuruhmu berhenti,
                    petak kosong menyuruhmu refresh dan reconnect selamanya.
                    'diubah' IKUT NAIK BEGITU driveId DIDAPAT (unggahAntre).
                    Barisnya didorong berdasarkan 'diubah' > batas air, tapi
                    cuma BERKAS_SEKALI (3) berkas yang naik per putaran - jadi
                    foto keempat dan seterusnya barisnya sudah terlanjur
                    terkirim TANPA driveId, dan tanpa cap baru itu id-nya tidak
                    pernah menyusul ke tabel. Akibatnya permanen dan sunyi:
                    entrinya lengkap di perangkat lain, gambarnya kosong
                    SELAMANYA, dan kedua perangkat melapor sinkron.
public/sinkron.js   NISANNYA DITULIS, BUKAN DIBUANG. Menghapus dulu membuang
                    BARISNYA dari spreadsheet lalu membuangnya dari HP -
                    perangkat lain yang sudah terlanjur punya catatan itu tidak
                    pernah tahu apa-apa, karena baris yang hilang dari tabel
                    tidak memberi tahu siapa pun bahwa dia pernah ada. Jumlahnya
                    menyimpang PERMANEN, dan menyimpangnya ke arah yang paling
                    membingungkan: HP 4, laptop 6, dua-duanya melapor sinkron.
                    Sekarang barisnya ditulis ulang sebagai NISAN (id, jenis,
                    dihapus=true, waktu penghapusannya; isinya dikosongkan),
                    mekarkan() membaca 'dihapus' apa adanya - bukan dipaksa
                    false - dan pulihkan() menghapusnya di perangkat ini. Yang
                    belum pernah ada di sini dilewati: tidak ada yang perlu
                    dihapus.
public/sinkron.js   SINKRON DUA ARAH lewat Drive; tidak pernah di jalur drop.
                    Dulu cadangan satu arah, dan itu benar selama ini cuma
                    aplikasi HP. Dia dipakai di EMPAT perangkat (HP, tablet,
                    laptop, PC), dan di situ satu arah salah bentuk: kamu
                    menulis di laptop, membuka HP, layarnya kosong - yang
                    terbaca bukan "belum saya tarik" tapi "datanya hilang",
                    dan sekali itu terbaca kepercayaannya ikut hilang.
                    SINKRON TIDAK PERNAH MENUNGGU DIMINTA, dan tidak boleh
                    punya tombol yang wajib diketuk. Orang yang memakai belasan
                    aplikasi sehari tidak akan pernah ingat menekan "tarik" -
                    yang dia rasakan cuma "Cortex tidak sinkron", dan itu sama
                    buruknya dengan tidak punya Cortex.
                    DROP BARU BERANGKAT SEKARANG, BUKAN LIMA MENIT LAGI.
                    putaran() punya gerbang lima menit supaya denyut berkala
                    tidak menghajar Drive - dan dulu dorongan yang lahir dari
                    drop kamu sendiri ikut kena gerbang itu. Foto yang baru
                    diambil menunggu sampai lima menit sebelum berangkat, lalu
                    beberapa menit lagi sebelum muncul di perangkat lain. Yang
                    terbaca "entri baru tidak sinkron", padahal sinkronnya
                    menunggu jam. Sekarang sundulNaik memanggil
                    putaranCadangan(true) - yang menahan lajunya sudah ada dan
                    sudah cukup: jeda 8 detik di sundulNaik sendiri.
                    KEMBALI MELIHAT LAYARNYA ADALAH PERMINTAANNYA, dan itu
                    yang menggantikan tombol "tarik sekarang". Waktu kamu
                    menoleh ke Cortex, kamu sedang mencari sesuatu yang barusan
                    kamu kirim dari perangkat lain - jadi tarikannya DIPAKSA di
                    situ, tidak menunggu penahan setengah menit. Penahan itu
                    untuk denyut berkala, bukan untuk mata yang baru menoleh.
                    Tombol khusus tidak dipasang dan jangan dipasang: yang
                    lambat ada di sisi PENERIMA, dan tombol di pengirim tidak
                    bisa menyuruh perangkat lain menarik. Yang bisa cuma
                    gerakan yang memang sudah kamu lakukan.
                    EMPAT pemicunya: waktu aplikasinya dibuka, waktu kembali
                    dari aplikasi lain (di HP PWA jarang benar-benar ditutup),
                    DENYUT BERKALA tiap 15 detik selama layarnya terlihat
                    (tanpa ini, laptop yang tabnya dibiarkan terbuka seharian
                    tidak pernah menarik sama sekali - dua pemicu pertama tidak
                    pernah terjadi di sana), dan dorongan 8 detik sesudah ada
                    yang berubah. Denyutnya DIAM waktu layarnya tidak terlihat:
                    menarik tabel untuk layar yang tidak dilihat siapa pun cuma
                    memakan baterai.
                    MENEKAN "HUBUNGKAN" LANGSUNG MENGISI PERANGKATNYA sampai
                    penuh - tarik dulu, baru dorong. Itu satu-satunya sentuhan
                    yang pernah diminta dari perangkat baru, jadi dia harus
                    menyelesaikan pekerjaannya: menekannya lalu melihat layar
                    yang tetap kosong terbaca sebagai "sambungannya gagal", dan
                    yang membaca begitu tidak menekannya kedua kali.
                    Tarikan MEMERIKSA modifiedTime dulu - menarik dua puluh
                    ribu baris tiap kali dibuka itu ongkos harian untuk jawaban
                    yang hampir selalu "tidak ada yang baru".
                    DUA JAM YANG BERBEDA TIDAK PERNAH DIBANDINGKAN. 'tarikCap'
                    menyimpan modifiedTime SPREADSHEET-nya - jam servernya
                    Google - dan CUMA diisi kalau waktunya memang terbaca dari
                    sana. Dulu, kalau pemeriksaannya gagal, yang dicatat malah
                    Date.now(): jam LOKAL perangkat itu. Sejak saat itu dia
                    membandingkan jam server dengan jam lokalnya sendiri,
                    spreadsheet yang baru diubah punya modifiedTime yang lebih
                    KECIL daripada "sekarang" yang terlanjur tercatat, dan
                    pulihkan() tidak pernah dijalankan lagi - selamanya.
                    Yang terlihat di layar justru sehat: pemeriksaannya
                    berhasil, jadi "Terakhir menarik: baru saja", padahal yang
                    berhasil cuma memeriksanya. Laptop berisi 11 catatan
                    sementara HP berisi 55, dan dua-duanya melapor baik-baik
                    saja. Kalau waktunya tidak terbaca, tariknya TETAP JALAN dan
                    capnya dibiarkan - menarik sekali lagi tanpa perlu jauh
                    lebih murah daripada berhenti menarik selamanya.
                    SETELAN IKUT PINDAH lewat 'setelan.json' di folder yang
                    sama, MENANGNYA PER KUNCI (peta 'setelanWaktu', dicap di
                    dalam TSimpan.setel - satu corong, bukan belasan pemanggil,
                    dan dibaca SEGAR dari basis data karena salinan di memori
                    tidak pernah ikut berubah). Kalau seluruh berkas yang
                    menang, menambah folder di HP menghapus board yang baru
                    ditulis di laptop. Yang ikut cuma ISI KEPALA (label, board,
                    boardAI, akhiran, folderNote, namaElemen, ekorJudul,
                    obrolan).
                    YANG TIDAK PERNAH IKUT: tampilan (tema, bahasa, gayaGaleri
                    - berganti sendiri tanpa diminta itu kehilangan kendali)
                    dan SESI (driverLengket - itu kenyataan fisik, kamu sedang
                    berdiri di masjid; menularkannya ke PC bikin unggahan di
                    kantor berangkat dengan sudut pandang survey)
public/awan.js      SATU RUMAH, DAN DIPERIKSA ULANG (samakanRumah di
                    sinkron.js, sekali sejam). rumah() memakai sheetId yang
                    sudah dipatok dan tidak pernah memeriksanya lagi - benar
                    sehari-hari, bencana sekali seumur hidup: dua perangkat yang
                    pernah membuat rumahnya masing-masing terpatok SELAMANYA ke
                    spreadsheet yang berbeda. Yang terlihat di layar dua
                    perangkat sehat sempurna - dorongan berhasil, tarikan
                    berhasil, "belum terkirim: 0" di dua-duanya - sementara HP
                    berisi 55 catatan dan laptop 11. Yang menang tetap YANG
                    TERTUA (aturan yang sama dengan cariAtauBuat, jadi semua
                    perangkat sampai pada jawaban yang sama tanpa berunding);
                    yang kalah TIDAK dihapus, dan yang lokal didorong ulang ke
                    rumah yang benar - tulisBaris menimpa berdasarkan id, jadi
                    tidak ada yang berganda. Kotak Vault menyebut enam huruf
                    terakhir sheetId supaya keadaan ini bisa dilihat mata, bukan
                    ditebak.
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
                    UBAH NAMA ruangan ada di bilah pilih, cuma waktu SATU
                    folder ditandai, dan cuma di layar yang foldernya punya
                    daftar sendiri (Gallery & Note). Dia satu-satunya jalan
                    membereskan pohon yang boleh tumbuh: "Interior Inspiration"
                    yang ternyata berisi tiga puluh foto terrace tinggal
                    diganti namanya, dan ketiga puluhnya ikut - tanpa
                    memindahkan satu foto pun. ANAKNYA IKUT BERGANTI NAMA;
                    tanpa itu anaknya yatim dan naik ke akar sebagai main board
                    yang tidak pernah dibuat siapa pun. Yang diketik nama
                    PENDEKNYA saja. Gabung MENCORET baris yang sudah kosong -
                    memindahkan isinya saja meninggalkan ruangan kosong yang
                    tetap berdiri, dan itu terbaca "gabungnya gagal".
                    PINDAH untuk SATU board = BOARDNYA yang pindah lintas main
                    board, bukan isinya ("Interior Bedroom" -> "Hospitality
                    Bedroom"); isinya dan sub-nya ikut. Ini pasangan wajib dari
                    pohon yang boleh tumbuh: AI membuat ruangan dari akhiran,
                    dan akhiran tidak tahu bidang - tanpa jalan menggesernya,
                    ruangan yang lahir di bidang yang salah cuma bisa dihapus,
                    dan menghapus berarti isinya keluar semua. MAIN BOARD TIDAK
                    BISA DIGESER: dia atapnya, dan atap ditentukan tangan
                    pemakainya. Dua folder atau lebih tetap berarti ISINYA yang
                    pindah.
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
                    Isi kotak, ala WhatsApp: AI - [teks] - klip - Todo, lalu
                    Drop di luar. EMPAT ikon waktu diam, TIGA waktu mengetik:
                    ikon AI pergi di mode Drop begitu ada yang diketik, klip
                    dan Todo pergi di mode AI.
                    KAMERA DAN TULIS BUKAN CIP: sepasang LINGKARAN
                    ('.pintas-bulat') dipatok di ujung kanan baris cip, tepat
                    di atas tombol Drop, DI LUAR kotak yang menggulir.
                    Sebabnya jenis, bukan tempat: baris cip menjawab
                    "perlihatkan yang mana", dua ini menjawab "aku mau MEMBUAT
                    sesuatu sekarang" - dan selama mereka duduk di dalam baris
                    itu, yang paling sering ditekan ikut menggulir keluar layar
                    begitu saringannya bertambah. Badge sesi kameranya pindah
                    ikut ke tombolnya, SELURUHNYA DI DALAM tombolnya: badge
                    yang menggantung bergantung pada kelonggaran baris di
                    sekitarnya, dan kelonggaran itu berubah tiap kali doknya
                    disunting - sudah dua kali cacatnya kembali tanpa ada yang
                    menyentuh badge-nya sama sekali.
                    SHORTCUT LAYAR HOME ANDROID lewat 'shortcuts' di manifest:
                    tekan lama ikon Cortex -> "Tulis" dan "Kamera", dan tiap
                    shortcut bisa diseret keluar jadi ikonnya sendiri. Dari
                    home, menulis catatan jadi SATU ketukan; tanpa itu tiga.
                    Alamatnya ('?aksi=tulis', '?aksi=kamera') DIBERSIHKAN
                    begitu dibaca - kalau tidak, satu kali muat ulang atau
                    tombol Kembali menjalankan perbuatannya lagi, dan yang
                    lahir catatan kosong kedua yang tidak pernah diminta.
                    SEPEREMPAT LAYAR DI DESKTOP, SEKALI SEUMUR PEMASANGAN
                    ('jendelaDiatur'). Aplikasi ini kolom 620px setinggi layar
                    - bentuk HP, dan itu bentuk yang benar: baris teks yang
                    lebih lebar berhenti nyaman dibaca. Konsekuensinya di
                    monitor 2560px dia kolom sempit dengan hampir seribu piksel
                    kosong di kiri dan kanan, dan yang terbaca bukan "aplikasi
                    mungil" tapi "aplikasi yang belum jadi". MANIFEST TIDAK BISA
                    menentukan ukuran jendela - tidak ada bidangnya, dan browser
                    mengabaikan yang dikarang; yang ada cuma resizeTo(), dan itu
                    pun boleh ditolak. Jadi ini USAHA, bukan jaminan. BENTUKNYA
                    KOLOM: setinggi layar penuh, dipatok ke tepi kiri, selebar
                    680 - kolom 620 plus tepinya, dan itu minimumnya bukan
                    pilihan. Jendela yang tingginya separuh menggantung di
                    tengah layar seperti dialog yang lupa ditutup, dan aplikasi
                    ini bukan dialog: dia tempat yang dibiarkan terbuka di
                    samping pekerjaan lain. Dipindah DULU baru diukur - jendela
                    lebar yang diukur lebih dulu terpotong tepi kanan. SEKALI SAJA, dan dicatat SEBELUM dicoba: kalau
                    tiap pembukaan, dia membatalkan ukuran yang diatur sendiri
                    kemarin - jendela yang melompat balik tiap kali dibuka jauh
                    lebih menjengkelkan daripada jendela yang kebesaran sekali.
                    Cuma di jendela TERPASANG dan layar >=900px: di tab biasa
                    resizeTo() mengubah jendela peramban yang isinya bukan cuma
                    aplikasi ini.
                    MANIFESTNYA DILAYANI DARI JARINGAN DULU (sw.js), dan cuma
                    dia: Android membacanya SEKALI waktu ikonnya dipasang, lalu
                    mencetak WebAPK yang isinya tidak berubah lagi. Kalau yang
                    terbaca salinan lama dari singgahan, shortcut-nya tidak
                    pernah ada - dan memasang ulang berapa kali pun tidak
                    menolong, karena yang dibaca ulang salinan yang sama.
                    iOS tidak mendukung ini sama sekali.
                    JALAN PINTAS TULIS: ke layar tulis LANGSUNG, tanpa mampir
                    ke daftar folder.
                    Lewat pintu Note kamu mendarat di daftar folder dulu, dan
                    yang tergambar di situ pertanyaan "mau ditaruh di mana?"
                    sebelum satu huruf pun sempat diketik - padahal yang
                    mendesak kalimatnya. Foldernya DIKOSONGKAN dengan sengaja,
                    dan folder layar Note tidak ikut disentuh: ini lewat, bukan
                    pindah rumah. Kamera TETAP paling kanan - ujung itu punya
                    pemiliknya, dan menggesernya demi tombol yang lebih jarang
                    berarti membayar gerakan tersering untuk yang lebih jarang.
                    CIP KAMERA DI BARIS CIP, DI KANAN RESET - ujung yang paling
                    dekat jempol. SESI YANG MASIH HIDUP DIWAKILI SATU
                    BADGE DI CIPNYA ('.cip-sesi'), kosakata yang sama dengan
                    angka saringan di baris itu: MENUMPANG di atas ikonnya
                    (absolute), jadi tidak menambah satu piksel pun pada tinggi
                    baris maupun lebar cipnya. Ada badge = ada preset menyala;
                    ketuk badge = preset dijatuhkan (dibaca DULUAN di
                    penangannya - dia duduk di dalam tombol kameranya, jadi
                    tanpa penjaga itu satu-satunya jalan keluar jadi jalan
                    masuk). RUANGNYA DI PADDING KOTAK YANG
                    MENGGULIR ('padding-top' di .saring-cip-baris), bukan di
                    luar kotaknya: barisnya 'overflow-x:auto', dan begitu satu
                    sumbu berhenti 'visible' sumbu satunya ikut memotong -
                    potongannya terjadi di tepi PADDING, jadi ruang yang
                    ditaruh di .saring-baris tidak menolong sama sekali. Tanpa
                    ruang itu badge duduk di bahu ikon kamera (dua bentuk yang
                    bersentuhan terbaca sebagai satu bentuk yang rusak) atau
                    kepalanya dipotong. Tinggi barisnya memang bertambah, dan
                    itu memang harganya. Di sudut
                    KIRI, bukan kanan: cip kamera duduk paling ujung kanan,
                    jadi sisi kanannya yang paling mungkin kena tepi layar.
                    Rupa menyalanya SAMA dengan cip saringan yang aktif di
                    baris itu - bukan rupa ketiga yang harus dipelajari
                    sendiri.
                    Dua bentuk lain sudah dicoba dan dua-duanya salah:
                    drivernya ditulis DI DALAM cip (cipnya jadi paling lebar di
                    baris yang menggulir mendatar, lalu terdorong keluar layar
                    kanan), dan bilah sendiri di atas baris cip (satu baris
                    tambahan di dok yang sudah padat - yang dibaca mata cuma
                    kebisingan). Namanya pindah ke title/aria-label, dan itu
                    memang penurunan: yang dijawab badge cuma "ada yang menyala
                    tidak". Yang menggantikannya kabar sesudah memotret - di
                    situ namanya tertulis penuh dengan tombol "Ganti".
                    Cip ini dipakai persis
                    waktu kamu TIDAK di Gallery, jadi bilah sesi di sana tidak
                    pernah terbaca dari sini: yang terjadi kamu memotret,
                    gambarnya langsung masuk tanpa satu pertanyaan pun, dan
                    yang terbaca "kok tidak ditanya foldernya?" - padahal
                    jawabannya "karena sudut pandang tadi masih berlaku".
                    Sudut pandang basi itu satu-satunya kekeliruan di jalur ini
                    yang tidak bisa diperbaiki belakangan; alamatnya masih bisa
                    dipindah kapan saja. Kabar sesudah memotret juga menyebut
                    DRIVERNYA, bukan alamatnya - "Ganti" cuma bisa ditekan
                    kalau kamu tahu apa yang sedang diwarisi. Dia sempat jadi ikon di dalam kotak, di antara
                    klip dan Todo, dan di sana dia tidak pernah terbaca sebagai
                    tombol yang MENGHASILKAN sesuatu: dua tetangganya cuma
                    membuka laci. Dia bukan saringan - tanpa angka, tidak pernah
                    menyala, bergaris putus-putus seperti Reset.
                    ITU JALAN PINTAS KE GALLERY, BUKAN LAMPIRAN. Bedanya dengan
                    klip bukan bentuk berkasnya, tapi ke mana barangnya pergi:
                    klip menempelkan gambar pada catatan yang sedang diketik,
                    kamera menyimpannya LANGSUNG jadi entri Gallery lewat isian
                    yang sama persis dengan dok kamera di sana - sesi dan
                    pertanyaan drivernya ikut sama. Dua jalur masuk yang
                    menghasilkan dua bentuk barang adalah cara tercepat membuat
                    satu tumpukan jadi dua tumpukan yang tidak pernah bertemu.
                    Layarnya TIDAK ikut berpindah, dan alamatnya DIKOSONGKAN -
                    board yang kebetulan terakhir dibuka di Gallery tidak
                    menjawab "ke mana" untuk foto yang diambil dari sini.
                    MODE AI: satu ikon tepat DI ATAS tombol Drop, dan ikon itu
                    yang mengubah arti tombol di bawahnya - selama menyala,
                    kotaknya berhenti mencari dan Drop berhenti menyimpan.
                    Ketukan kedua di ikon yang sama mengembalikan semuanya.
                    Riwayat obrolan tinggal di SETELAN, bukan di toko entri:
                    dari sana dia ikut cadangan, dan tetap di luar pencarian,
                    di luar "N tersimpan", dan di luar bahan pelabelan AI.
                    Yang layak jadi timbunan masuk lewat tombol Drop di tiap
                    jawaban - satu ketukan, bukan otomatis
public/hitung.js    MESIN KALKULATOR, dan dia BUKAN eval(). eval menjalankan
                    apa pun yang bentuknya JavaScript, dan yang mengetik di
                    situ duduk di halaman yang sama dengan seluruh catatannya -
                    satu tempelan dari luar yang kebetulan masuk ke kotak itu
                    jadi kode yang berjalan penuh. Penguraiannya ditulis
                    sendiri (shunting-yard), dan sebagai bonus dia mengerti
                    yang JavaScript sendiri tidak: "2(3+4)", koma desimal, dan
                    pangkat yang mengikat KE KANAN (2^3^2 = 512).
                    Sudutnya DERAJAT, bukan radian: yang mengetik "sin 30" di
                    sela pekerjaan memaksudkan tiga puluh derajat; radian itu
                    jawaban benar untuk pertanyaan yang tidak diajukan.
                    Hasilnya dibulatkan ke 12 angka - itu yang menutup
                    0.1+0.2 = 0.30000000000000004, cacat yang pasti dilihat
                    orang. BERDIRI SENDIRI TANPA DOM, jadi seluruhnya bisa
                    diuji tanpa membuka satu layar pun; kalkulator yang salah
                    hitung adalah cacat yang paling tidak mungkin ketahuan dari
                    melihat layarnya.
                    TAMPILANNYA BUKAN <input>, DAN ITU BUKAN SELERA. Dulu dia
                    kotak isian dan tiap ketukan angka memanggil focus() -
                    akibatnya Chrome menawarkan simpanan autofill-nya di atas
                    papan tombol, dan yang muncul di layar pemakainya Client ID
                    Google sepanjang empat puluh karakter, tiap kali dia
                    mengetuk "7". autocomplete="off" TIDAK MENOLONG: Chrome
                    mengabaikannya untuk tawaran simpanan sendiri. Jadi
                    tampilannya <div> ber-textContent, dan tidak ada satu pun
                    focus() di jalur ketukan. Konsekuensinya papan ketik FISIK
                    berhenti terdengar sendiri, dan itu dibayar penangan
                    'keydown' di tingkat dokumen yang DIPAGARI layarSaat ===
                    'l-hitung' - tanpa pagar itu dia menelan ketikan yang
                    dimaksudkan kotak pencarian.
                    RIWAYATNYA DI MEMORI SAJA, dan itu jawaban dari risetnya -
                    bukan kemalasan. Yang dilakukan kalkulator lain: iOS tidak
                    punya riwayat sama sekali, Casio ilmiah punya penyangga
                    ulang yang hilang begitu dimatikan, Windows menyimpannya
                    per sesi lalu membuangnya waktu ditutup. Cuma kalkulator
                    Google yang menyimpannya selamanya - dan dia satu-satunya
                    yang butuh tombol "Hapus riwayat", persis karena isinya jadi
                    timbunan. Umur pakai riwayat hitung diukur MENIT: yang
                    ditanyakan "tadi berapa?", dan itu ditanyakan di meja yang
                    sama, di pekerjaan yang sama. Angka yang masih menempel
                    besok pagi bukan kabar lagi - aturan yang sama dengan
                    fotoSesi - dan yang benar-benar layak disimpan sudah punya
                    rumahnya: Drop. Jadi mati waktu dimuat ulang, dibatasi
                    RIWAYAT_MAKS (20), tetap punya tombol Bersihkan (saluran
                    keluar tidak boleh cuma "tutup aplikasinya"), dan TIDAK
                    PERNAH ikut setelan maupun cadangan.
                    PANELNYA TERTUTUP SAMPAI DIMINTA ('riwayatBuka', keadaan -
                    bukan setelan). Yang dibuka orang di layar ini
                    kalkulatornya, bukan catatan hitungannya, dan panel yang
                    selalu terbuka merampas tinggi dari papan tombol untuk
                    sesuatu yang dilihat sekali dari sepuluh kali.
                    TOMBOL JAMNYA SELALU ADA, walau riwayatnya kosong. Dulu dia
                    ikut hilang waktu kosong, dan akibatnya yang belum pernah
                    menekan C tidak pernah tahu riwayatnya ada sama sekali -
                    fitur yang cuma muncul sesudah kamu kebetulan memakainya
                    tidak akan pernah ditemukan. Waktu kosong dia menjawab
                    dengan CARA MENGISINYA ("tekan C untuk menyimpan
                    hitungan"), bukan dengan panel kosong: yang menekannya
                    sedang bertanya "apa ini?", dan itu satu-satunya tempat
                    aturan "C menandai satu hitungan selesai" bisa terbaca.
                    "Bersihkan" ikut MENUTUP, bukan cuma mengosongkan: dia
                    dibaca sebagai "sudah, selesai dengan ini", dan panel yang
                    membuka dirinya sendiri lagi di hitungan berikutnya
                    membatalkan yang barusan diminta.
                    KEPALANYA MENYEBUT SENDIRI BAHWA BARISNYA BISA DIKETUK
                    ("Ketuk untuk kirim ke kalkulator"), dan kalimat itu
                    MENGGANTIKAN label "Riwayat": baris riwayat kelihatan
                    seperti catatan, bukan seperti tombol, dan yang tidak
                    pernah mencobanya tidak akan pernah menemukannya.
                    DICATAT WAKTU KAMU BERALIH DARI SATU HITUNGAN, bukan tiap
                    ketukan: hasilnya terhitung sejak huruf pertama, jadi "1",
                    "12", "12×", "12×3" semuanya keadaan yang sah - mencatat
                    semuanya berarti riwayat berisi sembilan bayangan dari satu
                    hitungan. Yang menandai selesai ketukan yang sudah kamu
                    lakukan sendiri: menekan C ("sudah, ganti") atau
                    meninggalkan layarnya (di tampilkanLayar, WAJIB sebelum
                    layarSaat berganti). Tidak ada tombol "=" yang ditambahkan
                    untuk itu - ketukan baru untuk sesuatu yang sudah tersirat
                    adalah ongkos keputusan, dan itu yang paling mahal di
                    aplikasi ini. Angka telanjang tanpa operasi TIDAK dicatat:
                    "36" sendirian tidak menjawab pertanyaan apa pun kalau
                    dibaca lagi nanti.
                    MENGETUK BARISNYA MENGEMBALIKAN OPERASINYA, BUKAN HASILNYA.
                    Yang paling sering dimau sesudah menoleh ke riwayat "yang
                    tadi itu, tapi angkanya beda", dan itu cuma bisa dijawab
                    kalau yang kembali kalimatnya - yang tinggal disunting
                    ekornya. Hasilnya sendiri sudah punya tombol salinnya.
                    SALINNYA MENYALIN ANGKANYA SAJA, tanpa "=" dan tanpa
                    kalimatnya: yang menekannya sedang menempelkannya ke kolom
                    harga atau ke chat, dan di sana "= 36" adalah dua karakter
                    yang harus dihapus lagi. Tombolnya di KIRI hasilnya (yang
                    rata kanan supaya angkanya terbaca berderet) dan
                    disembunyikan selama belum ada hasil.
                    SATU BINGKAI UNTUK SELURUHNYA ('.hitung-badan'): layar,
                    riwayat, dan papan tombol di dalam satu kotak. Dulu cuma
                    layarnya yang berbingkai dan papan tombolnya berdiri lepas
                    di atas halaman - yang terbaca dua benda yang kebetulan
                    bertetangga, bukan satu alat. Yang di dalamnya berhenti
                    berbingkai sendiri: kotak di dalam kotak menggandakan garis,
                    dan yang dibayar lebar isinya di layar yang paling sempit.
                    KARETNYA DIGAMBAR SENDIRI ('hitungTeks' + 'hitungKaret' di
                    alur.js; layarnya cuma cerminannya). Tampilannya bukan
                    kotak isian, jadi dia tidak punya karet bawaan - dan tanpa
                    karet, satu angka salah di tengah
                    "25+36×6+69×3+63+56+65" berarti mengetik ulang dua puluh
                    ketukan untuk membetulkan satu. Itu keluhan lapangannya,
                    apa adanya. TIAP HURUF JADI <span data-i>: mengetuk
                    layarnya untuk menaruh karet adalah gerakan pertama yang
                    dicoba jari, jauh sebelum dia mencari tombol panah, dan
                    ketukan cuma bisa ditebak jatuh di sela mana kalau tiap
                    huruf punya kotaknya sendiri. Paruh kiri = sebelum, paruh
                    kanan = sesudah, sama dengan tiap kotak teks di mana pun.
                    PANAH ◀ ▶ SUDAH DIBUANG dan jangan dikembalikan: mengetuk
                    angkanya langsung menaruh karet di tempat yang diketuk -
                    satu gerakan untuk sesuatu yang panahnya kerjakan dalam
                    lima. Dua tombol yang mengerjakan satu hal berarti yang
                    satu selalu terbaca sebagai "untuk apa ini?", dan itu
                    keluhan yang masuk. Panah papan ketik fisik tetap jalan.
                    '⌫' menghapus yang di KIRI karet, bukan di ujung kalimat.
                    KARETNYA HARUS TEBAL (3px, 1.15em). Yang pertama 2px
                    setinggi satu em, dan di antara angka 22px di layar HP dia
                    tidak terbaca sebagai karet - dia terbaca sebagai cacat
                    rendering. Akibatnya bukan cuma karetnya: begitu dia tidak
                    terlihat, tombol panah di sebelahnya jadi tombol yang
                    "tidak melakukan apa-apa", dan itu keluhan yang masuk.
                    Kanan '.hitung-ketik' dikasih 2px supaya karet di ujung
                    kalimat tidak terpotong tepi kotak yang menggulir.
                    LAJUR SUNTINGNYA TEGAK DI KIRI, DI LUAR KOTAK YANG
                    MENGGULIR, dan MIKRO (22px). Isinya TIGA: riwayat, tempel,
                    salin. Dua bentuk sebelumnya dua-duanya salah. (1) Baris
                    sendiri di bawah hasil: memakan
                    tinggi dari papan tombol DAN menaruh empat kotak abu-abu
                    tepat di jalur baca angkanya. Yang dibaca mata di kotak itu
                    angkanya, dan angkanya rata kanan - jadi sudut kiri atas
                    memang kosong. (2) Dipatok ABSOLUTE di atas teksnya dengan
                    padding-left selebar gerombolannya - dan itu keliru untuk
                    kotak yang MENGGULIR MENDATAR: paddingnya ikut tergulir
                    bersama isinya, jadi begitu kalimatnya lebih panjang dari
                    layar, ekornya lewat di BAWAH tombolnya. Yang terbaca angka
                    yang tertimpa ikon, dan itu keluhan yang masuk.
                    Sekarang dua kolom biasa: lajur tombol, lalu teksnya
                    ('.hitung-teks'). TEGAK, bukan mendatar: yang dibayar cuma
                    22px lebar, sementara bertiga mendatar memakan 74px dari
                    lebar yang justru dibutuhkan angka panjang.
                    22px itu SATU-SATUNYA tempat di aplikasi ini yang
                    melanggar sasaran sentuh 44px, dan itu disengaja: ketiganya
                    jalan pintas yang punya jalan lain yang lebih besar (ketuk
                    layarnya untuk karet, papan ketik untuk tempel). Yang tidak
                    boleh mengecil tombol yang tidak punya jalan lain.
                    TEMPEL MEMBERSIHKAN, BUKAN MENOLAK: angka yang disalin dari
                    mana pun datang membawa "Rp", spasi ribuan, dan satuan di
                    ekornya, dan menolak seluruhnya karena satu karakter
                    berarti mengetik ulang - persis pekerjaan yang mau dihapus
                    tombolnya. TITIKNYA DIBACA DESIMAL, TIDAK PERNAH PEMISAH
                    RIBUAN, dan itu keputusan yang harus disebut karena
                    kelihatannya keliru: "Rp 1.250" masuk sebagai "1,250".
                    Sebabnya "3.141" dan "1.250" bentuknya sama persis - tidak
                    ada aturan yang membedakannya tanpa menebak, dan menebak
                    berarti kadang-kadang membuang ketelitian tanpa satu tanda
                    pun di layar. Yang dipilih kekeliruan yang KELIHATAN.
                    Papan klip yang ditolak peramban DIKATAKAN BESERTA JALAN
                    KELUARNYA ("tekan lama lalu Tempel"): tombol yang diam
                    waktu ditekan terbaca sebagai aplikasi yang rusak, dan
                    "gagal" tanpa jalan keluar sama saja diamnya.
                    ADA JALAN KEDUA, dan dia yang sebenarnya selalu jalan:
                    penangan 'paste' di tingkat dokumen (tempelSistem).
                    readText() minta izin dan di PWA Android penolakannya
                    biasa, bukan kekecualian - sementara Ctrl+V dan "Tempel"
                    dari menu tekan-lama tidak minta izin apa pun, dia langsung
                    mengirim event 'paste' dengan isinya sudah menempel.
                    Didengar di tingkat dokumen karena tidak ada kotak isian
                    yang bisa difokuskan di layar ini, dan PULANG kalau yang
                    aktif INPUT/TEXTAREA.
public/hitung.js    (lanjutan) LAYAR KALKULATORNYA DIPATOK KE TINGGI YANG
                    TERLIHAT ('.pas-layar' + '--tampak', dari visualViewport -
                    lihat pasangTinggiTampak di alur.js). Kalkulator itu satu
                    alat yang dipandang UTUH: papan tombolnya tidak berarti
                    apa-apa kalau separuhnya di bawah lipatan, dan konverter
                    yang harus digulir dulu sebelum kelihatan sama saja dengan
                    konverter yang tidak ada. Dulu layarnya tumbuh apa adanya
                    dan halamannya menggulir - di HP 360x640 meluber 167px, di
                    tablet rebah 33px. BUKAN 100vh: di HP, 100vh memasukkan
                    bilah alamat yang sedang tersembunyi, jadi yang "pas" di
                    sana tetap terpotong di bawah.
                    YANG MENGALAH BERURUTAN: konverter menyusut duluan dan
                    menggulir di dalam kotaknya sendiri (dia dipakai beberapa
                    kali sehari), lalu riwayat (max-height ikut 16vh), baru
                    papan tombolnya - barisnya '1fr' jadi tombolnya MENYUSUT di
                    layar pendek dan MELAR di layar tinggi (38-58px). Lantainya
                    38px, bukan 44px, dan kompromi itu harus disebut: yang 44px
                    memaksa konverternya keluar layar seluruhnya di 360x640,
                    dan tombol yang tidak terlihat sasaran sentuhnya nol.
public/hitung.js    (lanjutan) KONVERSI SATUAN ('SATUAN' + 'konversi'), di
                    ruang kosong di bawah papan tombol. Yang menghitung gaya
                    baut juga yang harus menerjemahkan lbf·ft dari katalog ke
                    N·m; dua aplikasi untuk satu pekerjaan berarti angkanya
                    disalin lewat kepala, dan angka yang lewat kepala adalah
                    angka yang bisa salah.
                    ENAM BELAS KATEGORI, dan isinya bukan daftar lengkap segala
                    satuan yang pernah ada - tiap baris yang tidak pernah
                    dipilih adalah baris yang harus dilewati mata sebelum
                    sampai ke yang dicari. Yang menentukan isinya soal yang
                    benar-benar muncul di teknik mesin & fisika: kekuatan bahan
                    (Pa/MPa/psi/kgf/cm²), baut dan poros (N·m/kgf·m/lbf·ft),
                    motor dan pompa (kW/hp/PS, L/min/GPM/CFM), getaran
                    (Hz/rpm/rad/s), dan gambar kerja yang datang dalam inci
                    sementara mesinnya metrik. N/mm² ditulis terpisah walau dia
                    MPa persis: yang membacanya di gambar kerja menulisnya
                    begitu, dan satuan yang tidak ada di daftar terbaca sebagai
                    "tidak didukung", bukan "cari nama lainnya".
                    BENTUKNYA [nama, faktor, geseran]; geseran ada CUMA untuk
                    suhu, dan dia yang membedakan konversi suhu dari semua yang
                    lain - mengalikan saja menghasilkan 0°C = 0°F, jawaban yang
                    salah dan kelihatan masuk akal. Basis suhunya KELVIN, bukan
                    Celsius: kalau Celsius, tiap satuan lain harus membawa
                    geserannya sendiri dan yang pertama salah tanda tidak akan
                    ketahuan sampai ada yang mengonversi °F ke K.
                    LEWAT BASIS, SELALU - tidak ada tabel pasangan. Tabel
                    pasangan untuk dua belas satuan tekanan berisi seratus tiga
                    puluh dua angka, dan satu saja yang salah ketik tidak akan
                    pernah ketahuan kecuali oleh yang kebetulan memakainya.
                    Satuan di luar kategorinya DITOLAK, bukan dijawab nol.
                    TIGA BARIS, DENGAN SATU LAJUR TINDAKAN DI KANANNYA
                    (salin - tukar - kirim, sejajar). Dulu lima baris: baris
                    tukar sendiri dan baris aksi sendiri, dan dua baris untuk
                    dua ikon adalah tinggi yang dibayar papan tombolnya. Tukar
                    duduk sebaris dengan satuan ASAL karena yang dibaliknya
                    pasangannya; kirim sebaris dengan HASIL karena hasil itu
                    yang dikirimnya. Di bawah 380px label "Konversi satuan"
                    hilang - nama kategorinya sendiri sudah menyebutkannya.
                    HASILNYA HIDUP, tidak ada tombol "Konversi" - sama dengan
                    kalkulatornya sendiri. "→ Hitung" MENGIRIM hasilnya ke
                    karet kalkulator (titik jadi koma, karena mesinnya membaca
                    koma), dan itu yang membedakannya dari konverter mana pun
                    di toko aplikasi: hasil konversi hampir tidak pernah
                    jawaban akhirnya - dia angka yang mau dikalikan luas atau
                    dibagi jumlah baut. Ganti kategori MELEPAS pasangan
                    satuannya: "psi" tidak punya arti di Torsi, dan daftar yang
                    menyisakan pilihan lama akan diam-diam mengonversi yang
                    bukan-bukan. Bawaannya dua yang PERTAMA di tiap kategori,
                    dan urutannya disusun begitu (psi→MPa, lbf·ft→N·m,
                    rpm→rad/s). Kategorinya diingat ('konversiKategori', TIDAK
                    ikut sinkron); yang mengurus poros membuka Torsi tiap hari.
                    NAMA KATEGORINYA diterjemahkan, LAMBANG SATUANNYA tidak
                    (data-asli cuma di dua daftar satuan, bukan di daftar
                    kategori) - psi tetap psi di bahasa mana pun.
                    Isian nilainya type=number, dan itu disengaja sesudah cacat
                    autofill di layar kalkulatornya: Chrome menawarkan simpanan
                    teksnya pada kotak isian teks, tidak pada kotak angka.
                    Penangan keydown kalkulatornya PULANG kalau yang aktif
                    INPUT/SELECT - tanpa itu, angka yang diketik di konverter
                    ikut mendarat di kalkulatornya.
public/alur.js      BARIS PINTUNYA MILIK PEMAKAINYA ('pintuUtama' di setelan,
                    diatur di bagian Menu paling atas Setelan). Enam pintu
                    tidak muat sebaris di HP, dan yang tidak muat dipotong
                    browser di tempat yang tidak kamu pilih - tapi yang keenam
                    tidak pantas dibuang: cuma pemakainya yang tahu mana yang
                    dibuka sepuluh kali sehari. Yang tidak dipilih TIDAK
                    HILANG, dia pindah ke balik pintu TOOLS; yang berubah cuma
                    berapa ketukan untuk sampai ke sana. Maksimal UTAMA_MAKS
                    (5) di baris utama, dan yang keenam DITOLAK DENGAN SUARA -
                    tombol yang tidak melakukan apa pun terbaca sebagai
                    aplikasi yang rusak, bukan sebagai batas yang disengaja.
                    DROP TIDAK BISA DIPINDAH dan barisnya menyebut alasannya:
                    dia jalan masuknya, dan aturan nomor satu menuntut jalan
                    masuk yang tidak pernah butuh dua ketukan. Urutan barisnya
                    mengikuti KATALOG (TAB), bukan urutan pengetukan - baris
                    yang susunannya berubah mengikuti kapan kamu memilihnya
                    berarti jari tidak pernah hafal tempatnya.
                    TOOLS BUKAN LAYAR, dia menu (ditangani di keTab, bukan di
                    penangan kliknya, supaya jalur mana pun yang memanggil
                    keTab ikut benar). Cuma digambar kalau memang ada isinya:
                    pintu yang membuka menu kosong menjanjikan sesuatu lalu
                    tidak memberi apa-apa.
                    MENUNYA TURUN DARI TOMBOLNYA, bukan menempel di tepi atas
                    layar (letakkanMenuAlat, dipanggil tiap kali dibuka).
                    Menu yang lahir di ujung atas HP tidak menunjuk apa pun -
                    dia terbaca sebagai lapisan lain yang kebetulan muncul, dan
                    matanya harus mencari sendiri hubungannya dengan tombol yang
                    barusan diketuk. Letaknya DIUKUR waktu dibuka, bukan dipatok
                    di CSS: baris pintunya berubah tinggi di bawah 480px (ikon
                    naik ke atas nama), jadi angka yang ditebak sekali akan
                    meleset di layar yang lain. Dipatok dari KANAN - tombol
                    Tools duduk di ujung kanan baris, dan menu yang tumbuh ke
                    kanan dari situ keluar layar.
public/gaya.css     (lanjutan) JENDELA PENDEK (@media max-height:560px, DI EKOR
                    BERKAS). Ini bukan HP kecil - ini Cortex yang dibuka
                    sebagai JENDELA MELAYANG di atas aplikasi lain (pop-up view
                    Samsung, freeform, split screen). Kasusnya nyata dan
                    spesifik: mengetik prompt panjang sambil membaca jawaban di
                    aplikasi sebelah, tanpa pulang ke home screen dulu.
                    Di jendela 360x420, sepertiga tingginya habis untuk nama
                    aplikasi dan jarak tepi, dan kotaknya cuma kebagian tiga
                    baris. Yang dipangkas CUMA HIASAN DAN JARAK: nama merek
                    pergi (di jendela sekecil itu dia tidak menjawab satu
                    pertanyaan pun), padding mengecil. Gerigi Setelan TETAP -
                    dia satu-satunya jalan ke setelan dari layar itu - dan
                    KELIMA PINTUNYA TETAP UTUH. Kalau jendela pendek membuang
                    tombol, dia jadi aplikasi kedua yang isinya beda, dan
                    jarinya harus belajar dua tempat.
                    WAJIB DI EKOR BERKAS: '@media' TIDAK menambah kekhususan,
                    jadi '.kotak' di dalamnya kalah dari '.kotak' biasa yang
                    ditulis di baris lebih bawah. Sempat ditaruh di atas dan
                    hasilnya kotaknya tetap 140px tanpa satu galat pun - aturan
                    yang kalah diam-diam adalah cacat CSS yang paling lama tidak
                    ketahuan.
                    BATAS TUMBUH KOTAKNYA IKUT TINGGI JENDELA
                    (tinggiKotakMaks() di alur.js, dan '.kotak{max-height}'
                    HARUS ikut naik bersamanya - kalau cuma satu yang naik,
                    yang satunya jadi batas sebenarnya, diam-diam). 140px benar
                    di HP setinggi layar penuh: di situ kotak yang mengembang
                    terus mendorong hasil pencarian keluar, dan hasil itu yang
                    paling sering dilihat. Tapi di jendela melayang tidak ada
                    hasil yang diperebutkan - yang dilakukan di situ MENGETIK -
                    dan 140px di jendela 420px berarti tiga baris. Diukur dari
                    tinggi jendelanya (40%, maks 220), bukan dipatok angka
                    kedua: jendela melayang ukurannya diseret jari, jadi angka
                    apa pun yang ditebak akan salah di ukuran yang tidak
                    ditebak.
                    LAYAR TULIS ('l-catat') IKUT DIPATOK, dan di sana cacatnya
                    paling parah: '.catat-isi' punya 'min-height:300px' yang
                    tidak pernah menyusut, jadi di jendela 230px dia meluber
                    298px - hampir dua kali tinggi jendelanya - dan yang
                    terpotong justru badan tulisannya sendiri. Layar menulis
                    yang badannya terpotong tidak bisa dipakai menulis sama
                    sekali. Batas 300px itu BENAR di layar penuh (dia yang
                    memberi ruang tulis kesan luas walau tulisannya baru satu
                    baris), jadi yang dilepas cuma di jendela pendek.
                    ADA TIER KEDUA di 360px ('jendela sangat pendek', seperempat
                    layar HP): judul mengecil, jarak dirapatkan, dok menipis -
                    tanpa itu badan tulisannya tinggal 8px, dan 8px bukan
                    tempat menulis. Sesudah dirapatkan: 43px di 230px, 113px di
                    300px. TIDAK ADA SATU TOMBOL PUN YANG DIBUANG di kedua tier
                    - kembali, tersimpan, riwayat, gembok, buang, Simpan
                    semuanya tetap. Yang dihemat kalau membuangnya cuma
                    beberapa piksel; yang dibayar hafalan jarinya.
                    'body:has(#l-catat.aktif)' dipatok CUMA di dalam media
                    query - di layar penuh layar tulis memang boleh tumbuh apa
                    adanya, dan mematoknya di sana mengubah perilaku yang sudah
                    benar tanpa ada yang memintanya.
public/sw.js        service worker — singgahan kerangka + penerima "Bagikan".
                    SATU MUATAN SELALU SATU GENERASI, dan itu perbaikan atas
                    cacat yang menghasilkan laporan lapangan yang tidak masuk
                    akal: "tombolnya ada tapi tidak berfungsi", "kotaknya tidak
                    berbingkai". Halamannya dulu JARINGAN-DULU sementara
                    gaya.css dan alur.js SINGGAHAN-DULU. Akibatnya tiap
                    terbitan baru, sekali: index.html yang terambil versi BARU,
                    gaya dan kodenya masih versi LAMA dari singgahan - karena
                    service worker yang baru belum selesai memasang waktu
                    berkas-berkas itu diminta. Yang tergambar markup baru tanpa
                    gayanya, dan tombol baru yang tidak punya satu pun
                    penangan. Itu BUKAN singgahan basi yang hilang sendiri
                    sesudah refresh; itu satu muatan yang isinya dua generasi,
                    dan yang melihatnya melaporkannya sebagai fitur yang rusak.
                    Sekarang halamannya singgahan-dulu juga. Ongkosnya harus
                    disebut: terbitan baru butuh SATU pembukaan lagi sebelum
                    terlihat (yang pertama memasang service worker barunya,
                    yang kedua memakainya). Terbitan yang telat satu pembukaan
                    jauh lebih murah daripada terbitan yang sampai dalam
                    keadaan rusak. Manifest tetap jaringan-dulu, dan dia
                    satu-satunya - alasannya di berkasnya sendiri.
public/manifest.webmanifest   supaya bisa dipasang di HP
uji/uji-terima.mjs            uji terima (Playwright)
uji/palsu-google.mjs          tiruan Drive+Sheets di memori untuk uji
cangkang/           APK Android TIPIS, dan tipisnya itu aturannya: dia TIDAK
                    punya satu pun fitur sendiri. Isinya WebView yang memuat
                    aplikasi web yang SUDAH TERBIT; yang ditambahkan cuma tiga
                    hal yang memang tidak bisa dilakukan halaman web -
                    menggambar di atas aplikasi lain, bertahan sesudah restart,
                    dan satu ubin Setelan Cepat. Begitu dia mulai menumbuhkan
                    layar sendiri, jadi dua basis kode untuk satu aplikasi, dan
                    yang di Android selalu yang lebih miskin.
                    LAHIR DARI SATU KELUHAN LAPANGAN, bukan dari keinginan
                    punya aplikasi native: memanggil catatan sambil melihat
                    aplikasi lain butuh pulang ke layar depan. Semua jalan
                    bawaan Samsung sudah dicoba dan semuanya BENTUKNYA GESEKAN -
                    laci Edge panel yang tipis (5-6 usapan baru kena), usapan
                    diagonal dari sudut (10-12 kali gagal, yang muncul justru
                    bilah notifikasi). Gerakan yang harus dilatih bukan jalan
                    pintas. Bulatan melayang menggantinya dengan SASARAN yang
                    diam di tempat.
                    SYSTEM_ALERT_WINDOW, bukan Bubbles API: Bubbles di Android
                    11+ dikunci untuk percakapan (wajib sharing shortcut +
                    MessagingStyle + Person) dan aplikasi catatan tidak akan
                    pernah memenuhi syaratnya. Ini juga satu-satunya yang jalan
                    lintas merek; iOS tidak punya padanannya sama sekali.
                    ALAMATNYA DIMUAT DARI JARINGAN, tidak dibungkus ke dalam
                    APK (Alamat.kt, satu-satunya tempat alamatnya ditulis).
                    Aplikasi webnya disunting hampir tiap hari; kalau isinya
                    ikut dibungkus, satu baris CSS menuntut APK baru yang harus
                    dipasang tangan. Muatan pertama butuh sinyal, sesudah itu
                    service worker-nya yang bekerja.
                    WEBVIEW-NYA TIDAK PERNAH DIHANCURKAN waktu dikecilkan -
                    yang dilepas cuma pemasangannya di layar. Tulisan yang belum
                    di-drop tinggal di DOM, dan menghancurkannya berarti kalimat
                    setengah jadi hilang tiap kali kamu menoleh ke aplikasi
                    sebelah: persis kejadian yang bikin cangkang ini ada.
                    Tombol Kembali MENGECILKAN, tidak menutup, karena alasan
                    yang sama.
                    PANELNYA DIPATOK DI ATAS, bukan di bawah: papan ketik naik
                    dari bawah, dan jendela yang duduk di sana tertimpa atau
                    terdorong keluar layar. Bulatannya bawaannya di bawah tengah
                    dan menempel ke tepi terdekat - yang berhenti di dekat tepi
                    atas akan menarik bilah notifikasi waktu diseret, dan yang
                    berhenti di tengah menutupi isi aplikasi di bawahnya.
                    Panelnya BUKAN NOT_FOCUSABLE (tanpa fokus papan ketik tidak
                    pernah muncul, dan jendela yang tidak bisa diketik
                    membatalkan seluruh gunanya); bulatannya NOT_FOCUSABLE
                    supaya tidak menelan papan ketik aplikasi di bawahnya.
                    PANELNYA WAJIB MINTA FLAG_HARDWARE_ACCELERATED SENDIRI, dan
                    ini kekeliruan yang paling mahal di sini: jendela yang
                    dibuat sebuah LAYANAN tidak mewarisi akselerasi dari mana
                    pun - yang mewarisinya jendela milik Activity, dari temanya.
                    WebView tanpa akselerasi menggambar PUTIH POLOS. Halamannya
                    benar-benar termuat, tidak ada satu pun galat di log, dan
                    tidak ada apa pun di layar; yang dilaporkan "aplikasinya
                    kosong sesudah pemasangan yang susah payah".
                    KARENA ITU PETAK PUTIH TIDAK PERNAH DIBIARKAN DIAM: ada satu
                    baris kabar yang menumpang di atas WebView-nya - "Memuat…"
                    lalu pesan galatnya kalau bingkai utamanya gagal, dan
                    ketukan di kabarnya memuat ulang. Aturan yang sama dengan
                    petak gambar kosong di sinkron.js: laporan yang SALAH
                    tentang keadaan yang BENAR lebih buruk daripada galat, karena
                    dia menyuruh orang memasang ulang padahal yang kurang cuma
                    sinyal.
                    BELUM ADA SINKRON GOOGLE DI DALAMNYA, dan itu bukan yang
                    belum sempat dikerjakan: Google MENOLAK OAuth di dalam
                    WebView (disallowed_useragent, sejak 2021), jadi
                    penyimpanannya masih terpisah dari PWA yang terpasang.
                    Jembatan tokennya lewat Play Services, menyusul.
                    APK-NYA DIBANGUN DI CI (.github/workflows/cangkang.yml),
                    dan itu wajib disebut: lingkungan tempat kodenya ditulis
                    tidak punya Android SDK sama sekali, jadi tidak ada satu
                    baris pun di sini yang pernah dikompilasi sebelum didorong.
                    Varian DEBUG, karena debug ditandatangani kunci bawaan dan
                    langsung bisa dipasang.
                    Nama paketnya ('id.dreamlogics.cangkang') TIDAK menyebut
                    merek - aturan yang sama dengan nama basis data: nama paket
                    tidak pernah bisa diubah sesudah dipasang, jadi yang
                    menyebut merek akan berbohong begitu mereknya berganti, dan
                    menggantinya berarti pemasangan baru. Nama aplikasinya cuma
                    di res/values/strings.xml, satu tempat.
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

Sebelum menyentuh kode, jalankan dulu `node uji/uji-terima.mjs` (1014 lulus).
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
