# Mockup — Drop Note (note app)

Berkas sumber artboard untuk kanvas desain.
Berkas hasil rakitan (~2 MB) sengaja tidak disimpan di sini — dia
dirakit ulang dari berkas-berkas ini setiap kali ada perubahan.

Kanvas: https://claude.ai/code/artifact/580ead35-e8fa-4841-b9c2-e83874afa795

## Isi

| berkas | layar |
|---|---|
| `Main.dc.html`   | Opsi A — Drop |
| `AHasil.dc.html` | Opsi A — Cari |
| `BDrop.dc.html`  | Opsi B — Drop |
| `BHasil.dc.html` | Opsi B — Cari |
| `CDrop.dc.html`  | Opsi C — Drop |
| `CHasil.dc.html` | Opsi C — Cari |
| `canvas.json`    | tata letak kanvas + catatan tempel |

## Tiga arah

Ketiganya sama dalam hal: satu kotak untuk drop sekaligus cari,
2 tombol, hasil berupa judul + link bersih + ikon salin, layar depan
kosong. Yang dibedakan hanya **cara kategori masuk**:

- **A — Satu Kotak.** Kategori diketik sendiri (`#`). Paling
  predictable, tapi mengetik tiap kali.
- **B — Tebak Otomatis.** Judul link ditarik otomatis, kategori
  diusulkan, salah ketik dibetulkan. Effort terkecil, tapi tebakan
  yang meleset terasa tidak predictable. Butuh Gemini.
- **C — Rak.** Kategori diketuk, bukan diketik. Nol salah ketik,
  tapi makan ruang layar.

Warna dan huruf mengikuti editor yang sudah ada:
Plus Jakarta Sans, emas `#CBA158`, dasar `#0f1115`.
