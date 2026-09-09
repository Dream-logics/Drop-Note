# Cangkang

Bulatan melayang di atas aplikasi lain. Diketuk sekali, kotak tulis terbuka
setengah layar — tanpa pulang ke layar depan, tanpa usapan sudut yang harus
dilatih.

Cangkang ini **tidak punya fitur sendiri**. Isinya satu kotak tulis; yang
ditulis di situ **Salin** ke papan klip, atau **Kirim** lewat tombol Bagikan
Android ke Cortex yang terpasang — jalur `share_target` yang sudah ada. Seluruh
aplikasinya tetap di `public/`.

**Tidak ada WebView di dalamnya, dan itu bekas luka.** Dua terbitan pertama
memuat aplikasi webnya di WebView dan dua-duanya sampai ke HP sebagai petak
putih polos: kepala, tombol, dan teksnya tergambar semua, cuma WebView-nya
tidak. Karena di sini tidak ada Android SDK, tiap tebakan perbaikan dibayar
dengan satu pemasangan tangan — jadi yang dipilih bentuk yang tidak punya
bagian rewel sama sekali. Jangan kembalikan WebView-nya tanpa perangkat
sungguhan untuk mengujinya.

## Memasang

APK-nya tidak dibangun di sini — lingkungan tempat kodenya ditulis tidak punya
Android SDK. Yang membangun GitHub Actions, dan hasilnya selalu ada di satu
alamat yang tidak pernah berganti:

**https://github.com/Dream-logics/Drop-Note/releases/download/cangkang/cangkang.apk**

1. Ketuk tautan itu di HP (tidak perlu masuk akun, bukan zip).
2. Pasang (izinkan "pasang dari sumber ini" waktu ditanya).
3. Buka aplikasinya sekali → **Nyalakan bulatan** → beri izin
   *"tampilkan di atas aplikasi lain"*.

Tiap dorongan ke `main` yang menyentuh `cangkang/` menimpa berkas di alamat itu,
jadi tautannya tidak pernah perlu dicari ulang.

Sesudah itu layar ini tidak perlu dibuka lagi.

## Yang perlu diketahui

- **Bulatannya bertahan** sampai kamu menekan ✕ di kepala jendelanya. Restart HP
  tidak mematikannya (`PenerimaNyala`); pembersih memori sistem menghidupkannya
  lagi (`START_STICKY`).
- **Tinggi jendelanya diseret** dari kepalanya, dan diingat. Bawaannya sepertiga
  layar.
- **Tombol Kembali mengecilkan**, tidak menutup.
- **Naskahnya disimpan tiap ketukan**, jadi selamat walau prosesnya dibersihkan
  sistem waktu kamu sedang membaca aplikasi sebelah.
- **Tidak ada penyimpanan kedua.** Kotak ini scratchpad; satu-satunya saluran
  keluarnya "Kirim", dan itu mendarat di timbunan Cortex yang sama.
