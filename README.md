# Drop Note

Satu kotak untuk menimbun catatan, satu pencarian untuk mengambilnya kembali.

PWA, dipakai di HP, tanpa server. Semua tulis dan semua cari terjadi di
perangkat (IndexedDB) — nol detik, jalan tanpa sinyal.

## Keadaan

**Jalan.** Empat layar hidup (utama, hasil, catat, setelan), bisa dipasang
di HP, menerima tombol Bagikan dari aplikasi lain, dan terbuka penuh tanpa
sinyal. Cadangan harian ke Google Sheets. Uji terima: `node uji/uji-dropnote.mjs` — 42 lulus.

Sisanya penyempurnaan, ada di `docs/SISA-KERJA.md`.

## Menjalankan

Tidak ada build step. Sajikan `public/` lewat HTTP apa pun:

```
npx http-server public -p 8080
```

Harus lewat HTTP, bukan `file://` — service worker dan clipboard menolak
berjalan di sana.

## Bacaan

| berkas | isi |
|---|---|
| `CLAUDE.md` | **baca ini dulu** — kenapa bentuknya begini, dan apa yang tidak boleh dilanggar |
| `docs/RANCANGAN.md` | alasan di balik rancangannya |
| `docs/SISA-KERJA.md` | yang belum dikerjakan, cukup rinci untuk langsung jalan |
| `docs/APPS-SCRIPT.md` | pasang cadangan ke Google Sheets — langkah dan kodenya |
| `docs/mockup/` | sumber mockup UI — tiga arah, yang dipilih: B |

## Uji terima

```
node uji/uji-dropnote.mjs
```

Butuh Playwright + Chromium. Yang dijaga bukan kerapian kode, melainkan
lima janji: drop → cari → ketemu **dengan jaringan mati total**; **drop tidak
memanggil jaringan sama sekali** meski cadangan nyala; layar depan tanpa satu
pun kartu; salah ketik kategori mendarat di rak yang sudah ada; dan merevisi
memperbarui baris yang sama dengan versi lama tetap tersimpan.
