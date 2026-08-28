# Drop Memory

Satu kotak untuk menimbun catatan, satu pencarian untuk mengambilnya kembali.

PWA, dipakai di HP, tanpa server. Semua tulis dan semua cari terjadi di
perangkat (IndexedDB) — nol detik, jalan tanpa sinyal.

## Keadaan

**Jalan.** Lima layar hidup (mulai, utama, hasil, catat, setelan), bisa dipasang
di HP, menerima tombol Bagikan dari aplikasi lain, dan terbuka penuh tanpa sinyal.

Cadangan ke Google Drive **swalayan**: folder dan spreadsheet dibuat sendiri oleh
aplikasi, pemakainya cukup menekan satu tombol. Berkas naik ke Drive dan
thumbnail-nya tinggal di HP. AI (Gemini `gemini-3.5-flash-lite`) memberi judul,
kata kunci, dan membaca isi foto/PDF supaya bisa dicari.

Uji terima: `node uji/uji-terima.mjs` — 51 lulus.

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
| `docs/GOOGLE.md` | satu langkah pembuat (OAuth Client ID) + kunci Gemini |
| `docs/PROPOSAL-V2.md` | rencana bertahap yang sedang dikerjakan |
| `docs/mockup/` | sumber mockup UI — tiga arah, yang dipilih: B |

## Uji terima

```
node uji/uji-terima.mjs
```

Butuh Playwright + Chromium. Yang dijaga bukan kerapian kode, melainkan
enam janji: drop → cari → ketemu **dengan jaringan mati total**; **drop tidak
memanggil jaringan sama sekali** meski cadangan nyala; layar depan tanpa satu
pun kartu; salah ketik kategori mendarat di rak yang sudah ada; merevisi
memperbarui baris yang sama dengan versi lama tetap tersimpan; dan folder Drive
serta spreadsheet dibuat aplikasi, bukan pemakainya.
