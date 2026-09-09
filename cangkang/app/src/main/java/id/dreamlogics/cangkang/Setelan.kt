/* ===== Setelan — angka dan kunci yang dipakai bersama ===== */

package id.dreamlogics.cangkang

// Bawaan tinggi kotaknya, pecahan dari tinggi layar. Ini angka yang dia minta
// sendiri: untuk mengetik prompt panjang sambil melihat aplikasi lain,
// sepertiga layar sudah cukup - dan sisa layarnya justru yang dibaca.
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

// Naskah yang sedang diketik, disimpan tiap ketukan. Yang membunuh kalimat
// setengah jadi bukan tombol silang, tapi sistem yang membersihkan memori
// diam-diam waktu kamu sedang membaca aplikasi sebelah - dan yang hilang begitu
// tidak pernah kamu curigai sampai kamu membukanya lagi.
const val PREF_NASKAH = "naskah"
