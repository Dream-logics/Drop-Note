/* ===== Alamat — satu-satunya tempat alamat aplikasinya ditulis ===== */

package id.dreamlogics.cangkang

// Yang dimuat jendela melayang ini aplikasi web yang SUDAH TERBIT, bukan
// salinan yang ikut dibungkus ke dalam APK. Sebabnya ongkos: aplikasi webnya
// disunting hampir tiap hari, dan kalau isinya ikut dibungkus, tiap satu baris
// CSS menuntut APK baru yang harus dipasang tangan. Muatan pertamanya butuh
// sinyal; sesudah itu service worker-nya menyinggahi semuanya dan jendela ini
// jalan penuh tanpa jaringan, sama dengan aplikasinya di peramban.
const val ALAMAT = "https://dream-logics.github.io/Drop-Note/"

// Bawaan tinggi jendelanya, pecahan dari tinggi layar. Ini angka yang dia minta
// sendiri: untuk mengetik prompt panjang sambil melihat aplikasi lain,
// seperempat layar sudah cukup - dan sisa layarnya justru yang dibaca.
const val TINGGI_BAWAAN = 0.32f

// Batasnya. Bawah: di bawah ini kotak ketiknya tidak muat sebaris pun sesudah
// papan ketik naik. Atas: jendela yang menutupi hampir seluruh layar berhenti
// jadi jendela melayang dan jadi aplikasi biasa - yang dilihat di sebelahnya
// hilang, dan itu satu-satunya alasan cangkang ini ada.
const val TINGGI_MIN = 0.22f
const val TINGGI_MAKS = 0.85f

const val PREF = "cangkang"
const val PREF_NYALA = "nyala"
const val PREF_X = "bulatanX"
const val PREF_Y = "bulatanY"
const val PREF_TINGGI = "tinggiPanel"
