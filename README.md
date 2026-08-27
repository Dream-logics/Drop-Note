# Drop Note

Satu kotak untuk menimbun catatan, satu pencarian untuk mengambilnya kembali.

PWA, dipakai di HP, tanpa server. Semua tulis dan semua cari terjadi di
perangkat (IndexedDB) — nol detik, jalan tanpa sinyal.

## Keadaan

**Belum bisa dijalankan.** `public/dropnote.js` (alur UI) belum ada.
Lihat `docs/SISA-KERJA.md`.

Sudah jadi: kerangka HTML, gaya, lapis penyimpanan, dan seluruh otak
(deteksi jenis, judul dari alamat, koreksi kategori, kata kunci, pencarian).

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
| `docs/mockup/` | sumber mockup UI — tiga arah, yang dipilih: B |
