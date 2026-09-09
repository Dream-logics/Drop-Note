# Cangkang

Bulatan melayang di atas aplikasi lain. Diketuk sekali, aplikasi webnya terbuka
sebagai jendela setengah layar — tanpa pulang ke layar depan, tanpa usapan sudut
yang harus dilatih.

Cangkang ini **tidak punya fitur sendiri**. Isinya WebView yang memuat
`https://dream-logics.github.io/Drop-Note/`; seluruh aplikasinya tetap di
`public/`. Yang ditambahkan Android cuma tiga hal yang memang tidak bisa
dilakukan halaman web: menggambar di atas aplikasi lain, bertahan sesudah HP
restart, dan satu ubin di Setelan Cepat.

## Memasang

APK-nya tidak dibangun di sini — lingkungan tempat kodenya ditulis tidak punya
Android SDK. Yang membangun GitHub Actions:

1. Buka tab **Actions** → alur kerja **Cangkang** → jalankan (atau tunggu
   dorongan berikutnya yang menyentuh `cangkang/`).
2. Unduh artefak **cangkang-apk**, buka zip-nya.
3. Pasang APK-nya di HP (izinkan "pasang dari sumber ini" waktu ditanya).
4. Buka aplikasinya sekali → **Nyalakan bulatan** → beri izin
   *"tampilkan di atas aplikasi lain"*.

Sesudah itu layar ini tidak perlu dibuka lagi.

## Yang perlu diketahui

- **Bulatannya bertahan** sampai kamu menekan ✕ di kepala jendelanya. Restart HP
  tidak mematikannya (`PenerimaNyala`); pembersih memori sistem menghidupkannya
  lagi (`START_STICKY`).
- **Tinggi jendelanya diseret** dari kepalanya, dan diingat. Bawaannya sepertiga
  layar.
- **Tombol Kembali mengecilkan**, tidak menutup — tulisan yang belum di-drop
  tetap utuh karena WebView-nya tidak pernah dihancurkan waktu dikecilkan.
- **Belum ada sinkron Google di dalam jendela ini.** Google menolak OAuth di
  dalam WebView (`disallowed_useragent`), jadi penyimpanannya masih terpisah
  dari Cortex yang dipasang sebagai PWA. Jembatan tokennya menyusul; sampai itu
  ada, jendela ini paling enak dipakai untuk mengarang lalu menyalin.
