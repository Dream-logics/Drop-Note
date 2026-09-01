/* ============================================================================
   Identitas & bawaan
   ============================================================================
   SATU-SATUNYA tempat nama aplikasi ditulis di dalam kode.

   Nama itu kulit. Jiwa dan raganya - nama basis data, nama berkas, nama
   global, nama kolom - sengaja tidak menyebut merek sama sekali, supaya
   mengganti nama besok cuma menyentuh berkas ini, judul di index.html, dan
   manifest. Tidak ada satu pun data yang perlu dipindah.

   Yang TIDAK BOLEH ikut berubah selamanya, apa pun nama aplikasinya:
   - DB       'simpanan'   -> menggantinya membuang seluruh timbunan pemakai
   - Singgahan'singgahan-*'
   - Global   TSimpan, TOtak, TPelabel, TAwan, TSinkron, TAlur
   ============================================================================ */
(function (global) {
  'use strict';

  global.TBawaan = {
    nama: 'Cortex Space',
    tagline: 'Simpan dulu, cari nanti.',

    /* Model Gemini. Flash-Lite dipilih bukan karena murah saja: tugasnya cuma
       memberi judul dan kata kunci, dan model terkecil sudah cukup untuk itu.
       Yang memakainya adalah proxy, bukan aplikasi ini. */
    model: 'gemini-3.5-flash-lite',

    /* Dua model lain, dan keduanya cuma dipakai di layar Obrol - satu-satunya
       tempat AI diajak BICARA, bukan bekerja di belakangmu. Flash-Lite di atas
       sengaja tidak dipakai di sana: memberi judul dan menjawab pertanyaan itu
       dua pekerjaan yang beda beratnya, dan yang kedua yang kamu tunggui. */
    modelObrol: 'gemini-3.5-flash',
    modelGambar: 'gemini-3.5-flash-image',

    /* Label rak: barisan tetap di layar hasil, satu ketuk sama dengan menyaring.
       Isinya nama proyek, divisi, dan perusahaan - bukan jenis catatan - karena
       itulah yang benar-benar dipakai orangnya untuk memilah.

       Panjang namanya tidak dibatasi - "Amara Operasional" boleh ditulis utuh,
       dan yang memendekkannya cuma tampilan. Kata sesudah '=' ikut dihitung
       sebagai label yang sama, dan itu ada untuk SATU keadaan: kata yang
       dipakai AI berbeda dari kata di kepala pemakainya ("PS" vs
       "ProjectSpace"). Bukan kamus sinonim.
       Ini cuma NILAI AWAL: begitu aplikasinya dipasang, daftarnya jadi milik
       pemakainya dan disunting di Setelan. */
    labelAwal: [
      'MAP',
      'Amara = amaraliving',
      'Ngoffee = ngopi, coffee',
      'PS = projectspace',
      'Ultima',
      'Cons = construction, konstruksi, bangunan',
      'FnB Dev = fnb, makanan, minuman',
      'Intr Dev = interior, interiordev',
      'Kiddo = kids, anak',
      'Various = lain, umum'
    ],

    /* ===================== POHON: AKAR - INTEREST - SUB =====================
       TIGA TINGKAT, dan tingkat teratas DIPASANG SISTEM.

       Kenapa ada tingkat ketiga: sembilan main board sejajar sudah di batas
       yang bisa dipindai mata; di lima belas dia dinding. Yang terjadi di
       lapangan - pemakainya menambal sendiri dengan menaruh "Biz -" di depan
       tiap nama, lalu pusing membacanya, sampai sadar dia sedang mengarang
       satu tingkat yang belum ada tempatnya. Kalau orangnya sendiri sudah
       mengarangnya, tingkat itu memang dibutuhkan.

       AKARNYA TIDAK DIPIKIRKAN PEMAKAINYA. Dia daftar tetap, disiapkan di
       sini, dan gunanya MEMICU - "Subject" mengingatkan mahasiswa bahwa mata
       kuliah punya tempatnya sendiri; "Social" mengingatkan bahwa yang bukan
       kerjaan juga layak disimpan. Yang dipikirkannya cuma dua tingkat di
       bawahnya: INTEREST (bidangnya) dan SUB INTEREST (urusannya).

       Tingkatnya dibaca dari NAMA, aturan yang sama persis dengan dua tingkat
       sebelumnya: "Business FNB Menu Promo" itu sub dari "Business FNB", yang
       itu sendiri interest di dalam akar "Business". Tidak ada mekanik baru,
       tidak ada kolom induk yang bisa jadi yatim.

       AKAR TIDAK BISA DIHAPUS ATAU DIGANTI NAMA, dan itu bukan kekakuan: dia
       tulang punggung, bukan isi. Yang kamu buang atau namai ulang selalu
       interest dan sub-nya. */
    akarAwal: ['Business', 'Personal', 'Project', 'Social', 'Subject',
               'Tools', 'Work'],

    /* Pohon awal: akarnya lengkap, dan isinya cuma contoh yang bisa langsung
       dipakai. Sama seperti daftar lain di berkas ini, ini NILAI AWAL -
       disunting di Setelan, dan mengubah baris ini tidak menyentuh pohon yang
       sudah terlanjur ada di perangkat siapa pun. */
    boardAwal: [
      'Business',
      'Business Construction',
      'Business Construction Material',
      'Business Construction Structure',
      'Business Construction Inspiration',
      'Business Construction Teknik',
      'Business Construction Apps',
      'Business FNB',
      'Business FNB Concept',
      'Business FNB Inspiration',
      'Business FNB Menu Baru',
      'Business FNB Menu Promo',
      'Business FNB Ide Promo',
      'Business FNB Operational',
      'Business FNB Pricing',
      'Business FNB Ngoffee',
      'Business FNB Project Space',
      'Business FNB Apps',
      'Business Hampers',
      'Business Hampers Isi Hamper',
      'Business Hospitality',
      'Business Hospitality Hotel Inspiration',
      'Business Hospitality Kost Inspiration',
      'Business Hospitality Villa Inspiration',
      'Business Hospitality Guest House Inspiration',
      'Business Hospitality Kontrakan Inspiration',
      'Business Hospitality Warehouse Inspiration',
      'Business Hospitality Living Java',
      'Business Hospitality Red Doorz',
      'Business Hospitality Ultima Bdg',
      'Business Hospitality Apps',
      'Business Interior',
      'Business Interior Furnishing',
      'Business Interior Living Room',
      'Business Interior Kitchen',
      'Business Interior Bedroom',
      'Business Interior Lighting',
      'Business Interior Accessories',
      'Business Interior Apps',
      'Business Property',
      'Business Property Inspiration',
      'Business Property Facade',
      'Business Property Layout',
      'Business Property Sales Marketing',
      'Business Property Amara Living',
      'Business Property Lead Centre Apps',

      'Personal',
      'Personal Life Style',
      'Personal Motivation',
      'Personal Motivation Quote',
      'Personal Motivation Renungan',

      'Project',
      'Social',
      'Subject',

      'Tools',
      'Tools Apps Dev',
      'Tools Apps Dev Cortex',
      'Tools Apps Dev Shamira Creative',

      'Work',

      'Other and Various'
    ],

    /* RUANGAN TERAKHIR, dan dia satu-satunya akar yang menampung gambar
       langsung. Foto antariksa tidak punya bidang di daftar mana pun, dan itu
       bukan kegagalan - hidupmu memang lebih luas daripada bidang usahamu.

       Yang dilawan bukan keberadaannya, tapi ketiadaannya: tanpa ruangan ini,
       yang tidak cocok mendarat di "Belum berboard" - baris yang bunyinya
       seperti kesalahan, dan yang isinya makin lama makin dihindari sampai
       tidak pernah dibuka lagi.

       AI TIDAK MEMBUAT APA PUN DI DALAMNYA. Ruangan di dalam ruang tunggu
       membatalkan gunanya ruang tunggu. */
    boardLain: 'Other and Various',

    /* ===================== AKHIRAN =====================
       Satu-satunya kosakata yang boleh dipakai AI untuk MEMBUAT sub board.

       Dulu daftar board tertutup rapat: AI memilih, tidak pernah menambah.
       Itu separuh benar. Yang membuat taksonomi meleleh bukan PERTUMBUHAN,
       tapi PENAMAAN BEBAS - tag mati karena mesin boleh mengarang kata: #sofa,
       #kursi, #seating untuk satu benda. Kalau yang boleh dikarang cuma ADA
       atau TIDAK ADA barisnya, dan katanya diambil dari daftar tertutup,
       pertumbuhannya aman: dua foto kopi selalu mendarat di ruangan yang sama,
       karena cuma ada satu kata yang mungkin dipakai.

       Jadi AI cuma boleh menggabungkan dua potong yang SUDAH ADA: nama main
       board yang kamu tulis, plus satu akhiran dari sini. "Daily Life" +
       "Inspiration". Aplikasinya yang menuliskan barisnya, bukan modelnya -
       satu nama yang tidak ada di dua daftar itu tidak akan pernah lahir.

       Daftarnya BUKAN karangan: ini kata yang sudah ada di pohonnya sendiri.
       "Inspiration" muncul di empat dari tujuh main board, "Apps" di lima.
       Sumbunya memang sudah ada; ini cuma menamainya.

       ONGKOSNYA HARUS DISEBUT: AI tidak akan pernah membuat "Interior
       Terrace". Nama ruangan itu BENDA, dan begitu benda boleh dikarang kita
       kembali ke #sofa lawan #kursi. Foto terrace mendarat di "Interior
       Inspiration" - dan yang membereskannya Ubah nama & Gabung di Gallery,
       bukan kelonggaran di sini.

       Sama seperti pohonnya, ini cuma NILAI AWAL; disunting di Setelan. */
    akhiranAwal: ['Inspiration', 'Concept', 'Material', 'Layout', 'Menu',
                  'Promo', 'Pricing', 'Operational', 'Progress', 'Apps',
                  /* JARING TERAKHIR DI DALAM INTEREST. Kalau tidak ada satu
                     akhiran pun yang pas, gambarnya tetap tidak boleh berhenti
                     di pintu ruangan: interest yang menampung foto lepas di
                     samping sub-nya persis timbunan yang dilawan aplikasi ini.
                     Jadi ada dua tingkat ruang tunggu - satu untuk "bidangnya
                     tidak ketemu" (boardLain), satu untuk "bidangnya ketemu,
                     kamarnya tidak" (ini). Dibuat waktu pertama dibutuhkan,
                     bukan disiapkan kosong di tiap interest: sembilan baris
                     kosong menambah panjang pohon tanpa menambah satu jawaban
                     pun. */
                  'Various'],

    /* Alamat proxy AI milik PEMBUAT aplikasi (Apps Script /exec).
       Kunci Gemini tinggal di sana, tidak pernah di perangkat siapa pun.
       Pemakai tidak membawa kunci, tidak membeli kunci, tidak tahu ada kunci -
       dia cuma dikenali dari email Google-nya, lalu dilayani atau tidak.

       Kosong di sini berarti aplikasinya jalan tanpa AI sama sekali. Itu
       keadaan yang sah dan lengkap, bukan keadaan rusak. */
    alamatAI: '',

    /* OAuth Client ID Google. Ini BUKAN rahasia - dia memang terbaca di semua
       aplikasi browser, dan yang menjaganya adalah daftar origin yang kamu
       daftarkan di Google Cloud Console. Kosong di sini berarti pemakainya
       menempelkannya sendiri sekali di layar Setelan. */
    clientId: '376616148815-6j81udqlnh9r0mdrfkgi2jg8lmnp2k7j' +
              '.apps.googleusercontent.com',

    /* drive.file: aplikasi cuma bisa menyentuh berkas yang DIA sendiri buat -
       isi Drive pemakai yang lain tidak terlihat sama sekali.
       userinfo.email: supaya proxy AI bisa memastikan siapa yang memanggil.
       Keduanya tidak dianggap sensitif oleh Google, jadi tidak perlu
       peninjauan dan layar izinnya tidak menakutkan. */
    lingkup: 'https://www.googleapis.com/auth/drive.file ' +
             'https://www.googleapis.com/auth/userinfo.email'
  };
})(window);
