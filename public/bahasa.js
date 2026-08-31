/* ============================================================================
   Bahasa layar
   ============================================================================
   Aplikasinya ditulis dalam bahasa Indonesia - komentar, nama variabel, dan
   tiap kalimat di layar. Itu tidak berubah, dan tidak boleh berubah: sumbernya
   satu bahasa, dan satu bahasa berarti satu tempat yang perlu dibetulkan kalau
   ada kalimat yang salah.

   Yang ditambahkan di sini LAPISAN, bukan pengganti. Teksnya tetap ditulis
   Indonesia di seluruh kode; berkas ini yang menukarnya jadi Inggris tepat
   sebelum dibaca mata. Akibatnya menambah satu kalimat baru di mana pun tidak
   pernah butuh menyentuh berkas ini dua kali - kalimatnya jalan apa adanya,
   dan terjemahannya menyusul di satu tempat.

   KENAPA BUKAN KUNCI SIMBOLIS (t('simpan.tombol')). Karena kuncinya akan
   dipakai di kode, dan kode yang penuh kunci berhenti bisa dibaca: kamu tidak
   lagi tahu tombolnya bertuliskan apa tanpa membuka berkas lain. Di sini
   kuncinya kalimat Indonesianya sendiri, jadi kodenya tetap terbaca apa adanya
   walau terjemahannya hilang.

   YANG TIDAK PERNAH DITERJEMAHKAN:
   - Nama pintu: Drop, Note, To Do, Storage. Itu nama tempat, bukan kalimat -
     dan nama tempat yang berganti bahasa berarti jarimu harus belajar ulang.
   - Nama aplikasi.
   - APA PUN YANG KAMU TULIS SENDIRI: judul catatan, isinya, tag, nama folder,
     nama rak. Dijaga dengan penanda data-asli di tempat yang menggambarnya -
     tanpa itu, catatan berjudul "Simpan" akan berubah jadi "Save" di layar,
     dan yang terbaca bukan terjemahan melainkan data yang rusak.
   ============================================================================ */
(function (global) {
  'use strict';

  /* Terjemahan utuh: kunci = kalimat Indonesianya apa adanya. */
  var EN = {
    /* --- layar Drop --- */
    'Tulis atau cari…': 'Type or search…',
    'Tanya apa saja…': 'Ask anything…',
    'Gambar apa?': 'Picture of what?',
    'Terbaca': 'Read as',
    'Terima tebakan': 'Accept suggestion',
    'Tutup hasil': 'Close results',
    'Lampiran': 'Attach',
    'Jadikan tugas': 'Make it a task',
    'Mode AI': 'AI mode',
    'Kamera': 'Camera',
    'Berkas': 'File',
    'Gambar': 'Image',
    'Daftar': 'List',
    'Link': 'Link',
    'Tempel link': 'Paste links',
    'Tempel apa saja — yang berbentuk alamat akan dipisah sendiri':
      'Paste anything — whatever looks like a link is split out on its own',
    'Belum ada alamat yang terbaca.': 'No links read yet.',
    '+ baris': '+ row',
    'Tersimpan langsung di perangkat, tanpa menunggu jaringan.':
      'Saved straight to your device, no network needed.',
    'Kotaknya masih kosong': 'The box is still empty',
    'Belum ada yang ditulis': 'Nothing written yet',
    'Judul disusun dari alamatnya, tanpa jaringan.':
      'Title built from the address, no network needed.',
    'Tautan terbaca': 'Link read',
    'Diterima dari Bagikan': 'Received from Share',

    /* --- saringan --- */
    'Semua': 'All',
    'Teks': 'Text',
    'Pin': 'Pin',
    'Reset': 'Reset',
    'Petak besar': 'Large grid',
    'Petak sedang': 'Medium grid',
    'Petak kecil': 'Small grid',
    'Belum ada yang berjenis ini.': 'Nothing of this kind yet.',

    /* --- kartu --- */
    'Pin ke atas': 'Pin to top',
    'Lepas pin': 'Unpin',
    'Dipin ke atas': 'Pinned to top',
    'Pin dilepas': 'Unpinned',
    '(tanpa judul)': '(untitled)',
    'tanpa judul': 'untitled',
    'Salin': 'Copy',
    'Ubah': 'Edit',
    'Arsipkan': 'Archive',
    'Semua sudah tersalin': 'Copied',
    'Tidak bisa menyalin di sini': 'Cannot copy here',
    'Unduh berkas': 'Download file',
    'Berkasnya tidak ketemu': 'File not found',
    'Berkasnya belum bisa diambil. Coba lagi sebentar.':
      'The file cannot be fetched yet. Try again in a moment.',
    'sering dipakai': 'used often',

    /* --- waktu --- */
    'Hari ini': 'Today',
    'Kemarin': 'Yesterday',
    'Besok': 'Tomorrow',
    'Lusa': 'In two days',
    'Pekan depan': 'Next week',
    'Tanpa tenggat': 'No due date',
    'baru saja': 'just now',
    /* Nama hari dipakai kartu tugas untuk tenggat dalam pekan ini ("Jumat").
       Tanpa ini, satu-satunya kata Indonesia yang tersisa di antarmuka Inggris
       justru muncul di tempat yang paling sering dilirik. Aman ditukar
       mentah-mentah: yang ditulis pemakainya dijaga penanda data-asli, dan
       "Minggu" sebagai satuan waktu tidak pernah berdiri sendiri di layar. */
    'Minggu': 'Sunday',
    'Senin': 'Monday',
    'Selasa': 'Tuesday',
    'Rabu': 'Wednesday',
    'Kamis': 'Thursday',
    'Jumat': 'Friday',
    'Sabtu': 'Saturday',

    /* --- layar Note --- */
    'Cari di catatanmu…': 'Search your notes…',
    '+ Folder': '+ Folder',
    'Folder baru': 'New folder',
    'Tulis catatan baru': 'Write a new note',
    'Belum berfolder': 'No folder yet',
    /* Bukan nama rak, melainkan kalimat aplikasi untuk "belum ditaruh di
       mana-mana" - jadi dia satu-satunya baris folder yang ikut diterjemahkan. */
    'Belum berlabel': 'No shelf yet',
    'Semua folder': 'All folders',
    'Belum ada tulisan.': 'Nothing written yet.',
    'Yang panjang — brief, instruksi, rancangan — ditulis di sini,':
      'The long ones — briefs, instructions, plans — belong here,',
    'bukan di kotak Drop.': 'not in the Drop box.',
    'Tidak ada tulisan yang cocok.': 'No note matches.',
    'Folder itu sudah ada': 'That folder already exists',
    'Belum ada folder — buat satu dulu': 'No folders yet — make one first',
    'Ketuk folder tujuannya.': 'Tap the folder to move them to.',
    'Nama pendek satu-dua kata. Sub foldernya dibuat dari dalam sini.':
      'A short name, one or two words. Sub-folders are made from inside it.',
    'Foldernya kosong, jadi tidak ada yang ikut hilang.':
      'The folder is empty, so nothing goes with it.',
    'rak': 'shelves',

    /* --- layar Gallery --- */
    /* "Gallery" TIDAK diterjemahkan: dia nama pintu, sama seperti Drop, Note,
       To Do, dan Storage - nama tempat yang berganti bahasa berarti jari harus
       belajar ulang. Yang di dalamnya kalimat layar biasa. */
    'Cari gambar…': 'Search images…',
    'Semua album': 'All folders',
    'Belum beralbum': 'No folder yet',
    'Ambil foto': 'Take a photo',
    'Unggah gambar': 'Upload images',
    'Kamera': 'Camera',
    'Unggah': 'Upload',
    'Belum ada gambar dari sini.': 'Nothing from here yet.',
    'Tidak ada gambar yang cocok.': 'No image matches.',
    'Memasukkan…': 'Adding…',
    'album': 'folders',

    /* --- layar tulis --- */
    'Judul': 'Title',
    'Tulis di sini. Boleh sepuluh kata hari ini, sepuluh lagi besok.':
      'Write here. Ten words today, ten more tomorrow.',
    'Tulis apa saja…': 'Write anything…',
    'Simpan': 'Save',
    'Salin seluruh tulisan': 'Copy the whole note',
    'Riwayat': 'History',
    'Kembali': 'Back',
    'tersimpan': 'saved',
    'menyimpan…': 'saving…',
    'gagal menyimpan': 'save failed',
    'Tersimpan': 'Saved',
    'Versi dipulihkan': 'Version restored',
    'Belum berlabel — AI menyortirnya nanti': 'No shelf yet — AI will sort it later',
    'Kunci catatan ini': 'Lock this note',
    'Buka kunci catatan ini': 'Unlock this note',
    'Terkunci · tidak akan dikirim ke AI': 'Locked · never sent to the AI',
    'Terkunci lagi': 'Locked again',
    'Kuncinya dilepas': 'Unlocked',
    'Terkunci — buka lewat tombol ubah': 'Locked — open it with the edit button',
    'Terkunci — sandinya belum dibuka': 'Locked — passphrase not unlocked yet',
    'Terkunci. Buka kuncinya di Setelan untuk membacanya.':
      'Locked. Unlock it in Settings to read it.',
    'Pasang sandi dulu di Setelan': 'Set a passphrase in Settings first',
    'Buka kuncinya dulu di Setelan': 'Unlock it in Settings first',
    'Peramban ini tidak punya Web Crypto': 'This browser has no Web Crypto',
    'Dihapus permanen': 'Deleted permanently',

    /* --- memilih banyak --- */
    'Pilih': 'Select',
    'Ketuk yang mau dipilih': 'Tap what you want to select',
    'Gabung': 'Merge',
    'Buang': 'Discard',
    'Pindah': 'Move',
    'Batal': 'Cancel',
    'Lanjut': 'Continue',
    'Masuk arsip, bukan hilang — masih bisa dikembalikan dari Setelan.':
      'Goes to the archive, not gone — you can bring it back from Settings.',
    'Yang lain masuk arsip, tidak hilang.': 'The rest go to the archive, not gone.',
    'Ini yang terakhir — sesudah ini benar-benar hilang, tidak bisa dikembalikan.':
      'This is the last stop — after this it is really gone, with no way back.',

    /* --- mode AI --- */
    'Jawab': 'Answer',
    'Belum ada yang ditanyakan.': 'Nothing asked yet.',
    'Jawabannya bisa langsung di-drop jadi catatan.':
      'Any answer can be dropped straight into a note.',
    'AI belum menyala — nyalakan di Setelan.': 'AI is off — turn it on in Settings.',
    'AI belum menyala — nyalakan di Setelan': 'AI is off — turn it on in Settings',
    'Kosongkan obrolan': 'Clear the chat',
    'Kosongkan obrolan?': 'Clear the chat?',
    '(jawabannya kosong)': '(the answer came back empty)',
    'Belum ada yang diminta': 'Nothing asked for yet',
    'AI tidak mengembalikan gambar': 'The AI returned no image',

    /* --- To Do --- */
    'Tambah': 'Add',
    /* Kata contohnya IKUT diterjemahkan - ini satu-satunya teks di aplikasi
       yang isinya perintah, bukan keterangan. Menyalin "besok" apa adanya ke
       antarmuka Inggris berarti mengiklankan kata yang, sampai versi ini,
       memang tidak dimengerti pembacanya. Pembacanya sekarang mengerti
       keduanya, jadi contoh yang ditawarkan cukup yang sebahasa dengan
       layarnya. */
    'Tambah tugas — tulis “besok”, “jumat”, “tgl 25”':
      'Add a task — write “tomorrow”, “friday”, “the 25th”',
    'Penting': 'Important',
    'Berulang': 'Repeating',
    'Selesai': 'Done',
    'Harian': 'Daily',
    'Mingguan': 'Weekly',
    'Bulanan': 'Monthly',
    'Berhenti': 'Stop',
    'Tidak berulang': 'Does not repeat',
    'Belum ada tugas.': 'No tasks yet.',
    'Belum ada yang diselesaikan.': 'Nothing finished yet.',
    'Tidak ada yang jatuh tempo hari ini.': 'Nothing is due today.',
    'Yang muncul di sini: tenggatnya hari ini atau sudah lewat, plus yang kamu tandai sendiri untuk hari ini.':
      'What shows up here: due today or overdue, plus whatever you marked for today yourself.',
    'Tambahkan ke Hari ini': 'Add to Today',
    'Ada di Hari ini': 'In Today',
    'Masuk To Do': 'Added to To Do',
    'Lainnya': 'More',
    'Catatan': 'Note',
    'Tenggat': 'Due',
    'Ulang': 'Repeat',
    'Langkah': 'Steps',
    'Dibuang': 'Discarded',
    'Urungkan': 'Undo',
    'Tidak ada yang tertunda': 'Nothing pending',

    /* --- Storage --- */
    'Cari di semua folder…': 'Search every folder…',
    'Belum ada catatan.': 'No notes yet.',
    'Jatuhkan sesuatu dulu lewat Drop.': 'Drop something in first.',
    'Folder ini sudah kosong.': 'This folder is empty now.',
    'Tidak ada yang cocok.': 'Nothing matches.',
    'Coba satu kata saja — pencarian ini memaafkan.':
      'Try just one word — this search is forgiving.',

    /* --- Setelan --- */
    'Setelan': 'Settings',
    'Bahasa': 'Language',
    'Indonesia': 'Indonesia',
    'Bahasa layar. Nama pintu — Drop, Note, To Do, Storage — sengaja tidak ikut diterjemahkan: itu nama tempat, dan nama tempat yang berganti bahasa membuat jarimu harus belajar ulang.':
      'Interface language. The four doors — Drop, Note, To Do, Storage — deliberately stay as they are: those are place names, and place names that change language make your fingers learn the app twice.',
    'Cadangkan ke Google-mu': 'Back up to your Google',
    'Cadangan aktif': 'Backup on',
    'Cadangan manual': 'Manual backup',
    'Kirim sekarang': 'Send now',
    'Pulihkan dari Drive': 'Restore from Drive',
    'Hubungkan Google': 'Connect Google',
    'Sambungkan ulang Google': 'Reconnect Google',
    'Tersambung ke Drive-mu': 'Connected to your Drive',
    'Belum tersambung': 'Not connected',
    'Mati — catatanmu cuma ada di HP ini.': 'Off — your notes live only on this phone.',
    'Tanpa ini, catatanmu cuma ada di HP ini. Aplikasi membuat sendiri folder di Drive-mu — kamu tidak perlu menyiapkan apa pun.':
      'Without this, your notes live only on this phone. The app makes its own folder in your Drive — you set up nothing.',
    'Tidak ada yang perlu dipulihkan': 'Nothing to restore',
    'Menyiapkan folder dan spreadsheet…': 'Preparing folder and spreadsheet…',
    'Menyiapkan…': 'Preparing…',
    'Mengirim…': 'Sending…',
    'Menarik…': 'Pulling…',
    'Mengambil…': 'Fetching…',
    'Mencoba…': 'Trying…',
    'Menyalin ke Drive…': 'Copying to Drive…',
    'Membuka izin Google…': 'Opening the Google consent screen…',
    'Memeriksa kunci…': 'Checking the key…',
    'Bantuan AI': 'AI help',
    'Menambal konteks yang tidak sempat ditulis': 'Filling in the context you had no time to write',
    'Mati': 'Off',
    'Hemat': 'Light',
    'Penuh': 'Full',
    'Nyala': 'On',
    'Kunci Gemini': 'Gemini key',
    'Layanan AI belum ditanam di aplikasi ini.': 'No AI service is wired into this build.',
    'Semua yang lain tetap jalan seperti biasa.': 'Everything else keeps working as usual.',
    'Mode pengembang: memakai kunci di perangkat ini.':
      'Developer mode: using the key on this device.',
    'Hubungkan Google dulu supaya bantuan AI bisa mengenalimu.':
      'Connect Google first so the AI service can recognise you.',
    'Label rak': 'Shelf labels',
    'Barisan tetap di layar hasil': 'The standing row on the results screen',
    'Tag andalan': 'Go-to tags',
    'Rak yang kamu sudah tahu akan dipakai': 'Shelves you already know you will use',
    'Kunci rahasia': 'Secret key',
    'Brankas': 'Vault',
    'Catatan yang kamu tandai gembok': 'Notes you mark with the padlock',
    'Pasang sandi': 'Set a passphrase',
    'Sandi baru, minimal 6 huruf': 'New passphrase, at least 6 characters',
    'Sandinya tidak disimpan di mana pun. Lupa sandi berarti isinya hilang selamanya — tidak ada yang bisa mengembalikannya, termasuk aku.':
      'The passphrase is stored nowhere. Forget it and the contents are gone for good — nobody can bring them back, me included.',
    'Kuncinya terbuka': 'Unlocked',
    'Kuncinya sedang terbuka': 'Currently unlocked',
    'Sandi terpasang · kuncinya terbuka': 'Passphrase set · currently unlocked',
    'Belum dipasang': 'Not set',
    'Tampilan': 'Appearance',
    'Warna aksen': 'Accent colour',
    'Yang berganti cuma aksennya — dasarnya tetap putih redup. Aplikasi yang dibuka puluhan kali sehari selama bertahun-tahun boleh sesekali ganti baju.':
      'Only the accent changes — the base stays soft white. An app opened dozens of times a day for years is allowed a new coat now and then.',
    'Teal': 'Teal',
    'Nila': 'Indigo',
    'Plum': 'Plum',
    'Tanah': 'Clay',
    'Sendiri': 'Custom',
    'Penyimpanan di perangkat': 'On-device storage',
    'Timbunanmu ada di sini': 'Your pile lives here',
    'Catatanmu cuma ada di HP ini. Menghapus “cookies and site data” akan menghapus semuanya.':
      'Your notes live only on this phone. Clearing “cookies and site data” wipes all of it.',
    'Salinan teks ke berkas': 'A text copy to a file',
    'Ekspor': 'Export',
    'Impor': 'Import',
    'Isi berkas sengaja tidak ikut — satu cadangan bisa ratusan megabita dan gagal di tengah jalan. Yang diekspor teksnya, bagian yang tidak tergantikan.':
      'File contents are deliberately left out — one backup could run to hundreds of megabytes and fail halfway. What is exported is the text, the part nothing replaces.',
    'Arsip': 'Archive',
    'Yang sudah lewat, tapi tidak dibuang': 'Past its moment, but not thrown away',
    'Belum ada yang diarsipkan.': 'Nothing archived yet.',
    'Kembalikan': 'Restore',
    'Hapus semua': 'Delete all',
    'Geser kartu ke kiri di layar hasil untuk mengarsipkannya. Yang diarsipkan berhenti muncul di pencarian — datanya tetap utuh di sini, dan bisa dikembalikan kapan saja.':
      'Swipe a card left on the results screen to archive it. Archived notes stop showing up in search — the data stays whole here, and comes back whenever you want.',
    'Bahaya': 'Danger',
    'Kosongkan semua data': 'Wipe all data',
    'Kosongkan': 'Wipe',
    'Semua data dikosongkan': 'All data wiped',
    'Status:': 'Status:',
    'Uji kunci': 'Test the key',
    'Buka kunci': 'Unlock',
    'Kunci lagi sekarang': 'Lock it again now',
    'Sandi': 'Passphrase',
    'Kunci Gemini (khusus pengembang)': 'Gemini key (developers only)',
    'OAuth Client ID (khusus pengembang)': 'OAuth Client ID (developers only)',
    'Kunci di HP tidak bisa disembunyikan': 'A key on the phone cannot be hidden',
    /* Baris status cadangan dirakit dari beberapa potong, dan tiap potongnya
       masuk sebagai simpul teks sendiri. Diterjemahkan potong demi potong -
       mencocokkan kalimat utuhnya tidak bisa diandalkan di sini, karena
       potongan pertamanya sudah tertukar duluan. */
    'Terakhir berhasil:': 'Last success:',
    '· belum terkirim:': '· not yet sent:',
    'Percobaan terakhir gagal:': 'Last attempt failed:',
    'belum pernah': 'never',
    'barusan': 'just now',
    'tidak pernah': 'never',
    'sementara': 'temporary',
    /* Ekor kalimat penyimpanan, kalau blok utuhnya tidak kena - angkanya
       berubah tiap kali dihitung ulang, jadi cocokan utuhnya rapuh. */
    '. Browser boleh membuangnya saat penyimpanan HP sesak — dan menghapus “cookies and site data” tetap menghapus semuanya.':
      '. The browser may throw it away when phone storage runs tight — and clearing “cookies and site data” still wipes everything.',
    'Mulai': 'Start',
    'Simpan dulu, cari nanti.': 'Drop it now, find it later.',
    'Dua-duanya boleh dilewati. Aplikasinya jalan penuh tanpa keduanya, dan bisa dipasang kapan saja dari Setelan.':
      'Both can be skipped. The app runs in full without either, and both can be set up any time from Settings.',
    'ambil di AI Studio': 'get one at AI Studio',
    'ditemukan': 'found',
    'sementara': 'for now',
    'ini': 'this',
    'tidak pernah dikirim ke AI': 'never sent to the AI',
    'untuk membuka tombolnya.': 'to unlock the button.',
    'baris': 'rows',

    /* --- galat --- */
    'Client ID Google belum diisi': 'The Google Client ID is empty',
    'Izin Google ditolak': 'Google permission was refused',
    'Masuk Google gagal': 'Google sign-in failed',
    'Tidak ada jawaban dari Google': 'No answer from Google',
    'Tidak bisa memuat Google Sign-In': 'Could not load Google Sign-In',
    'Tidak bisa membaca akun': 'Could not read the account',
    'Jawaban tidak dikenali': 'The answer was not recognised',
    'Berkas cadangan tidak dikenali': 'That backup file was not recognised'
  };

  /* Yang DIRAKIT dari potongan - angka plus kata. Kalimat utuhnya tidak pernah
     ada di kode, jadi dia tidak bisa dicari di kamus di atas; yang dicocokkan
     bentuknya. Urutannya penting: yang lebih khusus lebih dulu. */
  /* Delapan dari dua belas singkatan bulan sudah sama di kedua bahasa (Jan,
     Feb, Mar, Apr, Jun, Jul, Sep, Nov) - yang perlu ditukar cuma empat. Ini
     satu-satunya pola yang penggantinya sebuah FUNGSI: menuliskannya sebagai
     empat pola terpisah berarti empat baris yang mengerjakan satu hal, dan
     tanggalnya masih ditempeli jam ("3 Mei · 14.20") jadi yang dicocokkan
     kepalanya saja, bukan seluruh simpulnya. */
  var BULAN_EN = { Mei: 'May', Agu: 'Aug', Okt: 'Oct', Des: 'Dec' };

  var POLA = [
    [/^(\d{1,2}) (Mei|Agu|Okt|Des)\b/, function (_, d, b) { return d + ' ' + BULAN_EN[b]; }],
    [/^(\d+) hasil$/, '$1 results'],
    [/^Kosong$/, 'Empty'],
    [/^(\d+) catatan$/, '$1 notes'],
    [/^(\d+) tulisan$/, '$1 notes'],
    [/^(\d+) dipilih$/, '$1 selected'],
    [/^(\d+) catatan · (\d+) folder dipilih$/, '$1 notes · $2 folders selected'],
    [/^(\d+) catatan dipilih$/, '$1 notes selected'],
    [/^(\d+) gambar dipilih$/, '$1 images selected'],
    [/^(\d+) gambar · (\d+) folder dipilih$/, '$1 images · $2 folders selected'],
    [/^(\d+) folder dipilih$/, '$1 folders selected'],
    [/^(\d+) diarsipkan$/, '$1 archived'],
    [/^(\d+) label$/, '$1 labels'],
    [/^(\d+) tag andalan$/, '$1 go-to tags'],
    /* Satu rak bukan "1 shelves". Jamak yang salah di baris yang dilihat tiap
       hari terbaca sebagai aplikasi yang tidak selesai dikerjakan. */
    [/^1 rak$/, '1 shelf'],
    [/^(\d+) rak$/, '$1 shelves'],
    [/^(\d+) langkah$/, '$1 steps'],
    [/^(\d+) belum selesai$/, '$1 unfinished'],
    [/^(\d+) entri · (.+) terpakai$/, '$1 entries · $2 used'],
    [/^(\d+) catatan masuk arsip$/, '$1 notes archived'],
    [/^(\d+) catatan digabung$/, '$1 notes merged'],
    [/^(\d+) catatan dihapus permanen$/, '$1 notes deleted for good'],
    [/^(\d+) catatan dipulihkan$/, '$1 notes restored'],
    [/^(\d+) catatan naik ke Drive$/, '$1 notes sent to Drive'],
    [/^(\d+) catatan pindah ke “(.+)”$/, '$1 notes moved to “$2”'],
    [/^Buang (\d+) catatan\?$/, 'Discard $1 notes?'],
    [/^Gabung (\d+) catatan\?$/, 'Merge $1 notes?'],
    [/^Hapus (\d+) catatan dari arsip\?$/, 'Delete $1 notes from the archive?'],
    [/^Hapus folder “(.+)”\?$/, 'Delete the folder “$1”?'],
    [/^Pindahkan (\d+) catatan ke mana\?$/, 'Move $1 notes where?'],
    [/^Folder “(.+)” dibuat$/, 'Folder “$1” created'],
    [/^Folder “(.+)” dihapus$/, 'Folder “$1” deleted'],
    [/^(\d+) gambar di dalamnya TIDAK ikut terhapus — mereka keluar ke “Belum beralbum”\.$/,
     'The $1 images inside are NOT deleted — they move out to “No folder yet”.'],
    [/^Memasukkan (\d+) gambar…$/, 'Adding $1 images…'],
    [/^(\d+) gambar masuk$/, '$1 images added'],
    [/^1 album$/, '1 folder'],
    [/^(\d+) album$/, '$1 folders'],
    [/^Dibuat di dalam “(.+)”\. Cukup nama pendeknya\.$/,
     'Created inside “$1”. Just the short name is enough.'],
    [/^Folder “(.+)” belum ada$/, 'There is no folder “$1”'],
    [/^(\d+) tulisan di dalamnya TIDAK ikut terhapus — mereka naik ke “(.+)”\.$/,
     'The $1 notes inside are NOT deleted — they move up to “$2”.'],
    [/^(\d+) tulisan di dalamnya TIDAK ikut terhapus — mereka keluar ke “Belum berfolder”\.$/,
     'The $1 notes inside are NOT deleted — they move out to “No folder yet”.'],
    [/^(\d+) catatan di dalamnya TIDAK ikut terhapus — mereka keluar ke “Belum berlabel”\.$/,
     'The $1 notes inside are NOT deleted — they move out to “No shelf yet”.'],
    [/^(\d+) pesan hilang dari layar ini\. Yang sudah kamu Drop tetap tersimpan\.$/,
     '$1 messages vanish from this screen. Anything you already dropped stays saved.'],
    [/^(\d+) link terbaca$/, '$1 link read'],
    [/^(\d+) link terbaca — tiap satunya bisa disalin sendiri$/,
     '$1 links read — each one can be copied on its own'],
    [/^(\d+) menit lalu$/, '$1 min ago'],
    [/^(\d+) jam lalu$/, '$1 h ago'],
    [/^(\d+) hari lalu$/, '$1 d ago'],
    [/^(\d+) hari lewat$/, '$1 d overdue'],
    [/^Hari ini · (.+)$/, 'Today · $1'],
    [/^Kemarin · (.+)$/, 'Yesterday · $1'],
    [/^Tersimpan · #(.+)$/, 'Saved · #$1'],
    [/^Masuk To Do · (.+)$/, 'Added to To Do · $1'],
    [/^Gagal: (.+)$/, 'Failed: $1'],
    [/^Gagal menyimpan: (.+)$/, 'Could not save: $1'],
    [/^Gagal memulihkan: (.+)$/, 'Could not restore: $1'],
    [/^Gagal mengunci: (.+)$/, 'Could not lock: $1'],
    [/^Impor gagal: (.+)$/, 'Import failed: $1'],
    [/^Kunci ditolak: (.+)$/, 'Passphrase rejected: $1'],
    [/^Penyimpanan tidak bisa dibuka: (.+)$/, 'Storage could not be opened: $1'],
    [/^Semuanya masuk ke “(.+)” — yang paling baru kamu sentuh\. (.*)$/,
     'Everything goes into “$1” — the one you touched most recently. $2']
  ];

  /* KALIMAT YANG TERPOTONG TAG. Beberapa keterangan panjang punya <b> atau
     <a> di tengahnya, jadi di mata pengurai dia bukan satu kalimat melainkan
     tiga potongan - dan menerjemahkan potongan berarti separuh Indonesia
     separuh Inggris di satu baris. Yang dicocokkan di sini seluruh isi
     elemennya sekaligus, tag dan semuanya. */
  var BLOK_EN = {
    'Belum ada gambar.<br>Potret sekarang, atau unggah dari galeri HP-mu.<br>Yang kamu drop juga mendarat di sini sendiri.':
      'No images yet.<br>Take one now, or upload from your phone gallery.<br>Whatever you drop lands here on its own.',
    '<b>Hemat</b> memberi judul dan kata kunci pada catatan. <b>Penuh</b> juga membaca isi foto dan PDF — KTP, kontrak, struk jadi bisa dicari lewat isinya. Keduanya berjalan di belakang layar dan boleh gagal diam-diam.':
      '<b>Light</b> gives each note a title and keywords. <b>Full</b> also reads what is inside photos and PDFs — IDs, contracts, receipts become searchable by their contents. Both run in the background and are allowed to fail quietly.',

    'Catatan yang kamu tandai gembok <b>tidak pernah dikirim ke AI</b>, dan isinya naik ke Drive sudah berupa sandi. Judul dan tagnya tetap terbuka — supaya catatannya masih bisa <b>ditemukan</b>, cuma tidak bisa dibaca.':
      'Notes you mark with the padlock are <b>never sent to the AI</b>, and what reaches Drive is already ciphertext. Title and tags stay in the clear — so the note can still be <b>found</b>, just not read.',

    'Satu baris satu label — nama proyek, divisi, atau perusahaan. Pendekkan namanya supaya sebaris muat banyak; yang harus digulir jauh tidak akan dipakai. Kalau singkatannya cuma ada di kepalamu, tulis kata panjangnya sesudah <b>=</b> (<i>Cons = construction, konstruksi</i>) supaya tag buatan AI ikut tertangkap. Urutannya tidak diacak ulang, jadi jarimu bisa hafal tempatnya.':
      'One label per line — a project, a division, a company. Keep the names short so a row holds many; whatever needs a long scroll never gets used. If the abbreviation only exists in your head, write the long words after <b>=</b> (<i>Cons = construction, konstruksi</i>) so AI-made tags land there too. The order is never reshuffled, so your fingers can learn it.',

    'Tulis di sini tag yang pasti sering kamu pakai — nama proyek, nama klien, jenis barang. Daftar ini ikut dikirim ke AI tiap kali melabeli, jadi dia memakai tag <b>ini</b> dan tidak mengarang sinonimnya sendiri. Pisahkan dengan spasi atau baris baru; pagarnya boleh tidak ditulis.':
      'Write the tags you know you will keep using — project names, client names, kinds of thing. This list rides along every time the AI labels something, so it reuses <b>these</b> instead of inventing synonyms of its own. Separate them with spaces or new lines; the hash is optional.',

    'Semua entri dan berkas di perangkat ini hilang, tanpa urung. Yang sudah naik ke Drive tetap aman. Ketik <b>HAPUS</b> untuk membuka tombolnya.':
      'Every entry and file on this device is gone, with no undo. Whatever already reached Drive stays safe. Type <b>HAPUS</b> to unlock the button.',

    'Layanan AI belum ditanam di aplikasi ini. Untuk mencoba sendiri, tempel kunci Gemini-mu — <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">ambil di AI Studio</a>, gratis. (khusus pengembang)':
      'No AI service is wired into this build. To try it yourself, paste your own Gemini key — <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">get one at AI Studio</a>, free. (developers only)',

    'Di aplikasi yang seluruhnya jalan di browser, <b>kunci API tidak bisa benar-benar disembunyikan</b>. Ini mode pengembang — untuk pemakai biasa, kuncinya tinggal di layanan dan tidak pernah sampai ke perangkat.':
      'In an app that runs entirely in the browser, <b>an API key cannot truly be hidden</b>. This is developer mode — for ordinary users the key lives at the service and never reaches the device.'
  };

  /* Yang dirakit: angka di depan, kalimat tetap sesudahnya. */
  var BLOK_POLA = [
    /* Nama aplikasinya berdiri di tengah kalimat, jadi yang dicocokkan
       bentuknya - bukan kalimat utuhnya. */
    [/^Folder <b>(.+)<\/b> berisi cadangan dan berkasmu\. Cadangan berjalan saat aplikasi dibuka, di belakang layar, dan <b>tidak pernah<\/b> di jalur drop\.$/,
     'The <b>$1</b> folder holds your backup and your files. Backups run when the app opens, in the background, and <b>never</b> on the drop path.'],

    [/^(\d+) entri · (.+) terpakai<br>Status: <b>sementara<\/b>\. Browser boleh membuangnya saat penyimpanan HP sesak — dan menghapus “cookies and site data” tetap menghapus semuanya\.$/,
     '$1 entries · $2 used<br>Status: <b>temporary</b>. The browser may throw it away when phone storage runs tight — and clearing “cookies and site data” still wipes everything.']
  ];

  /* Elemen yang isinya dicocokkan UTUH lebih dulu, sebelum simpul teksnya
     disentuh satu-satu. */
  var BLOK_PILIH = '.set-ket, .kosong, .tanya-ket, .mulai-ket';

  function terjemahBlok(el) {
    var isi = el.innerHTML.trim();
    if (!isi) return false;
    if (BLOK_EN[isi]) { el.innerHTML = BLOK_EN[isi]; return true; }
    for (var i = 0; i < BLOK_POLA.length; i++) {
      if (BLOK_POLA[i][0].test(isi)) {
        el.innerHTML = isi.replace(BLOK_POLA[i][0], BLOK_POLA[i][1]);
        return true;
      }
    }
    return false;
  }

  /* Tempat yang TIDAK PERNAH disentuh. Dua jenis: yang isinya tulisanmu
     sendiri (data-asli), dan yang isinya memang bukan kalimat layar. Tanpa
     ini, catatan berjudul "Simpan" akan berubah jadi "Save" - dan yang terbaca
     bukan terjemahan, melainkan data yang rusak. */
  /* Dua daftar, karena dua hal yang berbeda. Isi <textarea> itu tulisanmu -
     tidak pernah disentuh. Tapi placeholder-nya kalimat layar, dan itu harus
     ikut diterjemahkan; menyamakan keduanya membuat tulisan "Tanya apa
     saja…" tetap Indonesia di tengah layar Inggris. */
  var LEWAT_TEKS = 'textarea, script, style, [data-asli]';
  var LEWAT_ATRIBUT = '[data-asli]';

  var kode = 'en';
  var jalan = false;

  function terjemah(s) {
    var inti = String(s);
    if (EN[inti]) return EN[inti];
    for (var i = 0; i < POLA.length; i++) {
      if (POLA[i][0].test(inti)) return inti.replace(POLA[i][0], POLA[i][1]);
    }
    return null;
  }

  function bolehSentuh(n) {
    var e = n.parentElement;
    return !!e && !e.closest(LEWAT_TEKS);
  }

  /* Satu simpul teks diterjemahkan UTUH, bukan potong-potong. Mengganti kata
     di tengah kalimat berarti separuh Indonesia separuh Inggris di satu baris,
     dan itu terbaca lebih buruk daripada tidak diterjemahkan sama sekali. */
  function tukarTeks(n) {
    var asal = n.nodeValue;
    var inti = asal.trim();
    if (!inti) return;
    var baru = terjemah(inti);
    if (baru === null || baru === inti) return;
    /* Spasi di kiri-kanan dipertahankan: dia yang memisahkan potongan kalimat
       yang dirakit dari beberapa simpul. */
    n.nodeValue = asal.replace(inti, baru);
    n.__asalTeks = asal;
  }

  var ATRIBUT = ['placeholder', 'aria-label', 'title'];

  /* MENULIS HANYA KALAU BENAR-BENAR BERUBAH, dan ini bukan penghematan -
     ini syarat hidup. Pengamat di bawah menyala pada tiap penulisan atribut,
     termasuk penulisan yang isinya sama persis; menulis ulang nilai yang sama
     berarti dia memanggil dirinya sendiri tanpa akhir, dan halamannya tidak
     pernah selesai berubah - Playwright pun menyerah menunggunya diam. */
  function tukarAtribut(el) {
    ATRIBUT.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var v = String(el.getAttribute(a));
      var inti = v.trim();
      if (!inti) return;
      var baru = terjemah(inti);
      if (baru === null || baru === inti) return;
      el.setAttribute(a, baru);
    });
  }

  function pasang(akar) {
    if (kode !== 'en') return;
    var a = akar || document.body;
    if (!a) return;
    jalan = true;
    try {
      if (a.nodeType === 3) { if (bolehSentuh(a)) tukarTeks(a); return; }
      if (a.nodeType !== 1 && a.nodeType !== 9) return;
      if (a.nodeType === 1 && a.closest && a.closest(LEWAT_ATRIBUT)) return;
      /* Blok dulu: kalau seluruh isinya ketemu, simpul teks di dalamnya tidak
         perlu - dan tidak boleh - disentuh lagi. */
      if (a.nodeType === 1) {
        var blok = a.matches && a.matches(BLOK_PILIH) ? [a] : [];
        if (a.querySelectorAll) {
          Array.prototype.forEach.call(a.querySelectorAll(BLOK_PILIH),
            function (x) { blok.push(x); });
        }
        blok.forEach(function (x) { if (terjemahBlok(x)) x.setAttribute('data-asli', ''); });
      }
      var jalanTeks = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      var n, daftar = [];
      while ((n = jalanTeks.nextNode())) daftar.push(n);
      daftar.forEach(function (x) { if (bolehSentuh(x)) tukarTeks(x); });
      if (a.nodeType === 1) tukarAtribut(a);
      var el = a.querySelectorAll ? a.querySelectorAll('[placeholder],[aria-label],[title]') : [];
      Array.prototype.forEach.call(el, tukarAtribut);
    } finally { jalan = false; }
  }

  /* Diamati, bukan dipanggil dari tiap tempat yang menggambar. Kalau tiap
     penggambar harus ingat memanggil ini, satu penggambar baru yang lupa
     memanggilnya akan menampilkan Indonesia di tengah layar Inggris - dan
     lupanya baru ketahuan berminggu-minggu kemudian. */
  function amati() {
    if (!global.MutationObserver) return;
    var tunggu = [];
    var jam = null;
    var mata = new MutationObserver(function (rekam) {
      if (jalan) return;
      rekam.forEach(function (r) {
        Array.prototype.forEach.call(r.addedNodes, function (n) { tunggu.push(n); });
        /* INDUKNYA IKUT, bukan cuma simpul yang baru masuk. Kalimat yang
           terpotong <b> di tengahnya masuk sebagai beberapa simpul terpisah -
           dan yang perlu dicocokkan utuh justru induknya, bukan potongannya.
           Tanpa baris ini, "Terakhir berhasil: <b>…</b> · belum terkirim:"
           diterjemahkan separuh-separuh. */
        if (r.target) tunggu.push(r.target);
      });
      if (jam) return;
      jam = setTimeout(function () {
        jam = null;
        var isi = tunggu;
        tunggu = [];
        isi.forEach(function (n) { pasang(n); });
      }, 0);
    });
    mata.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ATRIBUT
    });
  }

  /* Bahasa BAWAANNYA INGGRIS. Aplikasinya ditulis Indonesia, tapi yang
     memakainya belum tentu - dan yang membuka aplikasi asing dalam bahasa yang
     tidak dia mengerti berhenti di layar pertama. */
  function pilih(x) {
    var baru = x === 'id' ? 'id' : 'en';
    if (baru === kode) return false;
    kode = baru;
    /* Berbalik ke Indonesia berarti memuat ulang: sumbernya memang Indonesia,
       jadi menggambar ulang dari nol lebih jujur - dan jauh lebih murah -
       daripada menyimpan kamus terbalik yang harus dijaga tetap sepadan. */
    return true;
  }

  function sekarang() { return kode; }

  global.TBahasa = {
    pilih: pilih, sekarang: sekarang, pasang: pasang, amati: amati,
    t: function (s) { return kode === 'en' ? (terjemah(s) || s) : s; },
    /* Cuma untuk uji: memastikan tidak ada kalimat layar yang terlewat. */
    kamusUji: function () { return EN; },
    polaUji: function () { return POLA; }
  };
})(window);
