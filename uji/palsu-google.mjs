/* Tiruan Drive + Sheets, seluruhnya di memori. Dipakai supaya kode klien yang
   asli benar-benar dijalankan - bukan diganti mock - tanpa menyentuh jaringan. */
export function buatGooglePalsu() {
  const berkas = new Map();        /* id -> {name, mimeType, parents, isi} */
  const lembar = new Map();        /* sheetId -> baris[][] */
  const waktuLembar = new Map();   /* sheetId -> kapan terakhir ditulis */
  let urut = 0;
  const negara = { panggilan: 0, tolakSekali: false, ditolak: 0 };

  const idBaru = (aw) => aw + (++urut);

  /* Lewat 26 kolom, Sheets memakai dua huruf: AA, AB, ... Membaca cuma huruf
     pertama membuat tiruan ini memotong rentang diam-diam, dan uji pulihkan
     gagal seolah aplikasinya yang salah. */
  function huruf(k) {
    let n = 0;
    for (let i = 0; i < k.length; i++) n = n * 26 + (k.charCodeAt(i) - 64);
    return n;
  }

  function uraiRentang(r) {
    const t = decodeURIComponent(r).replace(/^'|'$/g, '');
    const [, sisi] = t.includes('!') ? t.split('!') : [null, t];
    const m = sisi.match(/^([A-Z]+)(\d*):([A-Z]+)(\d*)$/);
    if (!m) return null;
    return { k1: huruf(m[1]), b1: m[2] ? +m[2] : null, k2: huruf(m[3]), b2: m[4] ? +m[4] : null };
  }

  function jawab(obj, status = 200) {
    return { status, contentType: 'application/json', body: JSON.stringify(obj) };
  }

  function tangani(url, metode, badan) {
    negara.panggilan++;
    /* Menirukan token yang sudah dicabut di sisi Google: kelihatan sah dari
       sisi aplikasi (belum lewat masa berlakunya) tapi ditolak. Ini keadaan
       yang sebenarnya bikin 401 muncul tiap kali aplikasinya baru dibuka. */
    if (negara.tolakSekali) { negara.tolakSekali = false; negara.ditolak++; return jawab({ error: { message: 'Invalid Credentials' } }, 401); }
    const u = new URL(url);
    const j = badan ? (() => { try { return JSON.parse(badan); } catch (e) { return null; } })() : null;

    /* ---------------- Drive ---------------- */
    if (u.pathname.startsWith('/upload/drive/v3/files')) {
      const isi = (badan.split('\r\n\r\n')[2] || '').split('\r\n--')[0];
      /* PATCH menimpa berkas yang sudah ada. Tanpa ini tiap penyimpanan
         melahirkan salinan bernama sama, dan uji tidak akan pernah melihat
         bug yang paling mungkin terjadi di Drive sungguhan. */
      const idLama = u.pathname.slice('/upload/drive/v3/files'.length).replace(/^\//, '');
      if (metode === 'PATCH' && idLama && berkas.has(idLama)) {
        const f = berkas.get(idLama);
        f.isi = isi;
        f.modifiedTime = new Date(Date.now() + (++urut)).toISOString();
        return jawab({ id: idLama });
      }
      const nama = (badan.match(/"name"\s*:\s*"([^"]*)"/) || [])[1] || 'berkas';
      const induk = (badan.match(/"parents"\s*:\s*\["([^"]*)"\]/) || [])[1] || null;
      const id = idBaru('f');
      berkas.set(id, { name: nama, mimeType: 'application/octet-stream', parents: [induk],
                       isi, createdTime: new Date(Date.now() + (++urut)).toISOString(),
                       modifiedTime: new Date().toISOString() });
      return jawab({ id });
    }
    if (u.pathname === '/drive/v3/files' && metode === 'GET') {
      const q = u.searchParams.get('q') || '';
      const nama = (q.match(/name='([^']*)'/) || [])[1];
      const mime = (q.match(/mimeType='([^']*)'/) || [])[1];
      const induk = (q.match(/'([^']*)' in parents/) || [])[1];
      /* mimeType boleh TIDAK disebut: berkas JSON setelan dicari lewat namanya
         saja. Mewajibkannya membuat pencarian itu tidak pernah ketemu, dan
         setelannya lahir berkali-kali sebagai berkas baru. */
      const cocok = [...berkas.entries()].filter(([, f]) =>
        f.name === nama && (!mime || f.mimeType === mime) &&
        (!induk || (f.parents || []).includes(induk)));
      return jawab({ files: cocok.map(([id, f]) => ({
        id, name: f.name,
        createdTime: f.createdTime || new Date(0).toISOString(),
        modifiedTime: f.modifiedTime || new Date(0).toISOString()
      })) });
    }
    if (u.pathname === '/drive/v3/files' && metode === 'POST') {
      const id = idBaru(j.mimeType.includes('spreadsheet') ? 's' : 'd');
      berkas.set(id, { name: j.name, mimeType: j.mimeType, parents: j.parents || [], isi: '',
                       createdTime: new Date(Date.now() + (++urut)).toISOString() });
      if (j.mimeType.includes('spreadsheet')) lembar.set(id, []);
      return jawab({ id });
    }
    if (u.pathname.startsWith('/drive/v3/files/')) {
      const id = u.pathname.split('/').pop();
      if (metode === 'DELETE') { berkas.delete(id); return jawab({}); }
      if ((u.searchParams.get('fields') || '').includes('modifiedTime')) {
        const f = berkas.get(id);
        return jawab({ modifiedTime: (f && f.modifiedTime) || waktuLembar.get(id) ||
                                     new Date(0).toISOString() });
      }
      if (u.searchParams.get('alt') === 'media') {
        const f = berkas.get(id);
        if (!f) return jawab({ error: { message: 'tidak ada' } }, 404);
        return { status: 200, contentType: 'application/octet-stream', body: f.isi };
      }
    }

    /* ---------------- Sheets ---------------- */
    const ms = u.pathname.match(/^\/v4\/spreadsheets\/([^/:]+)/);
    if (ms) {
      const sid = ms[1];
      if (!lembar.has(sid)) lembar.set(sid, []);
      const baris = lembar.get(sid);
      const sisa = u.pathname.slice(ms[0].length);
      /* Tiap tulisan memajukan waktunya - itu yang dibaca tarik() untuk
         memutuskan perlu menarik seluruh tabel atau tidak. */
      if (metode !== 'GET') waktuLembar.set(sid, new Date(Date.now() + (++urut)).toISOString());

      if (sisa === '' && metode === 'GET') {
        return jawab({ sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] });
      }
      if (sisa === ':batchUpdate') {
        (j.requests || []).forEach((r) => {
          const d = r.deleteDimension && r.deleteDimension.range;
          if (d) baris.splice(d.startIndex - 1, d.endIndex - d.startIndex);
        });
        return jawab({});
      }
      if (sisa === '/values:batchUpdate') {
        (j.data || []).forEach((d) => {
          const r = uraiRentang(d.range.split('!')[1]);
          /* Menulis lewat ujung meninggalkan lubang di larik, dan lubang itu
             bikin pembacaan berikutnya meledak. Sheets sungguhan mengisinya
             dengan baris kosong; tiruan yang tidak menirunya membuat uji dua
             perangkat gagal seolah aplikasinya yang salah. */
          for (let i = baris.length; i < r.b1 - 2; i++) baris[i] = [];
          baris[r.b1 - 2] = d.values[0];
        });
        return jawab({ totalUpdatedRows: (j.data || []).length });
      }
      /* ':clear' ikut dikenali. Tanpa ini rentangnya terbaca sebagai
         "'Tag'!A1:A:clear", uraiRentang menyerah, dan tiruannya meledak -
         padahal yang salah tiruannya, bukan aplikasinya. */
      const mv = sisa.match(/^\/values\/(.+?)(:append|:clear)?$/);
      if (mv) {
        /* Tiruan ini tidak memodelkan tab terpisah - satu sheetId, satu larik.
           Jadi ':clear' TIDAK BOLEH mengosongkan larik itu: yang dibersihkan
           aplikasinya cuma tab tag, dan mengosongkan larik berarti seluruh
           entri lenyap tiap kali daftar tag berubah. Tab tag memang tidak
           pernah dibaca balik, jadi mendiamkannya itu tiruan yang jujur. */
        if (mv[2] === ':clear') return jawab({});
        const r = uraiRentang(mv[1]);
        if (!r) return jawab({ error: { message: 'rentang tiruan tidak terbaca: ' + mv[1] } }, 400);
        if (mv[2]) { (j.values || []).forEach((v) => baris.push(v)); return jawab({}); }
        if (metode === 'PUT') { return jawab({}); }          /* baris kepala: tidak disimpan */
        const potong = baris.map((b) => (b || []).slice(r.k1 - 1, r.k2));
        return jawab({ values: potong });
      }
    }

    return jawab({ error: { message: 'jalur palsu tidak dikenal: ' + u.pathname } }, 404);
  }

  return { tangani, berkas, lembar, waktuLembar, negara };
}

/* Google Sign-In diganti sepenuhnya: uji ini menguji kode kita, bukan milik Google.

   DUA SIFAT ASLINYA SENGAJA DITIRU, karena justru itu yang dulu bikin galat di
   ketukan pertama:

   1. Jawabannya TIDAK seketika. Yang seketika menyembunyikan setiap perlombaan.
   2. `callback` cuma SATU slot, dan permintaan kedua menimpanya. Jadi kalau
      aplikasi mengajukan dua permintaan bersamaan, yang pertama kehilangan
      callback-nya dan menggantung selamanya - persis seperti aslinya.

   window.__mintaToken menghitung berapa kali Google benar-benar dimintai, jadi
   uji bisa memastikan yang kedua ikut menunggu, bukan mengajukan sendiri. */
export const STUB_GIS = `
  window.__mintaToken = 0;
  window.google = { accounts: { oauth2: { initTokenClient(cfg) {
    return { _cfg: cfg, callback: null, error_callback: null,
      requestAccessToken() {
        window.__mintaToken++;
        var k = this;
        setTimeout(function () {
          k.callback({ access_token: 'token-palsu', expires_in: 3600 });
        }, 30);
      } };
  } } } };
`;
