/* ============================================================================
   Drop Note — pelabel (satu-satunya bagian yang memakai AI)
   ============================================================================
   Tugasnya satu kalimat: memberi judul dan kata kunci yang MEMAKAI KATA YANG
   NANTI DIPAKAI UNTUK MENCARI - bukan kata yang kebetulan ada di isinya.

   Dan alasannya bukan kecanggihan. Memberi judul yang bagus itu menuntut
   keputusan, dan keputusan adalah ongkos yang paling mahal buat orang yang
   seharian sudah dikejar pekerjaan lain. Kalau pekerjaan itu dilempar balik
   ke pemakainya, aplikasi ini mati dalam seminggu seperti semua pendahulunya.
   Jadi AI di sini membayar ongkos itu. Itu saja.

   TIGA ATURAN YANG TIDAK BOLEH DILANGGAR

   1. Tidak pernah di jalur masuk. Nge-drop tidak boleh menunggu jaringan
      sedetik pun. Pelabelan berjalan belakangan, atas antrean yang tertinggal.
   2. Borongan. Sekali panggil untuk banyak entri - lebih murah, dan lebih
      jarang kena batas pemakaian.
   3. Gagal itu wajar. Tidak ada sinyal, kunci salah, kuota habis - entrinya
      tetap tersimpan dan tetap bisa dicari lewat label logic. Antreannya
      dicoba lagi nanti. Tidak ada yang hilang kalau AI tidak pernah jalan
      sama sekali.
   ============================================================================ */
(function (global) {
  'use strict';

  var MODEL_BAWAAN = 'gemini-flash-lite-latest';
  var SEKALI = 12;          /* entri per panggilan */
  var jalan = false;

  function pesanan(entri) {
    return entri.map(function (e, i) {
      var isi = (e.isi || '').slice(0, 700);
      var daftar = (e.daftar || []).map(function (b) { return b.teks; }).join('; ').slice(0, 300);
      return [
        '--- ' + i + ' ---',
        'jenis: ' + e.jenis,
        e.kategori ? 'kategori: ' + e.kategori : '',
        e.namaBerkas ? 'berkas: ' + e.namaBerkas : '',
        isi ? 'isi: ' + isi : '',
        daftar ? 'daftar: ' + daftar : ''
      ].filter(Boolean).join('\n');
    }).join('\n');
  }

  var ARAHAN =
    'Kamu membantu seseorang menemukan kembali catatannya sendiri berbulan-bulan kemudian.\n' +
    'Untuk setiap entri, hasilkan:\n' +
    '- judul: ringkas, maksimal 8 kata, memakai kata yang akan diingat orangnya, bukan menyalin isi.\n' +
    '- label: 4 sampai 8 kata kunci huruf kecil. Sertakan nama proyek, lingkungan (uji/produksi),\n' +
    '  nama klien, dan sebutan lain yang mungkin dipakai orang itu saat mencari - termasuk yang\n' +
    '  TIDAK tertulis di isinya tapi jelas dari konteks.\n' +
    'Bahasa Indonesia, kecuali istilah teknis yang memang lazim Inggris.\n' +
    'Jawab HANYA JSON: {"hasil":[{"i":0,"judul":"...","label":["..."]}]}';

  function urai(teks) {
    var t = String(teks || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  }

  /* --- lewat proxy Apps Script: kunci tinggal di server, tidak pernah di HP --- */
  function lewatProxy(alamat, entri) {
    return fetch(alamat, {
      method: 'POST',
      /* text/plain sengaja: bikin permintaan ini "sederhana" menurut CORS,
         jadi tidak ada preflight OPTIONS - yang tidak dijawab Apps Script. */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ tugas: 'label', arahan: ARAHAN, entri: pesanan(entri) })
    }).then(function (r) {
      if (!r.ok) throw new Error('Proxy menjawab ' + r.status);
      return r.text();
    }).then(function (t) {
      var j = urai(t);
      if (j && j.teks) return urai(j.teks);
      return j;
    });
  }

  /* --- langsung ke Gemini: kunci ada di perangkat ini --- */
  function lewatGemini(kunci, model, entri) {
    var alamat = 'https://generativelanguage.googleapis.com/v1beta/models/' +
                 encodeURIComponent(model || MODEL_BAWAAN) + ':generateContent';
    return fetch(alamat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': kunci },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ARAHAN }] },
        contents: [{ role: 'user', parts: [{ text: pesanan(entri) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error && j.error.message) || ('Gemini menjawab ' + r.status));
        return j;
      });
    }).then(function (j) {
      var bagian = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
                   j.candidates[0].content.parts && j.candidates[0].content.parts[0];
      return urai(bagian && bagian.text);
    });
  }

  function siap(setelan) {
    if (!setelan) return false;
    if (setelan.modeAI === 'mati') return false;
    if (setelan.modeAI === 'proxy') return !!setelan.alamatProxy;
    return !!setelan.kunciGemini;
  }

  /* Satu putaran atas antrean yang belum berlabel AI. Mengembalikan jumlah
     entri yang berhasil diperbarui; 0 berarti tidak ada kerjaan atau gagal. */
  function putaran(setelan) {
    if (jalan || !siap(setelan)) return Promise.resolve(0);
    jalan = true;

    return TSimpan.semua().then(function (semua) {
      var antre = semua.filter(function (e) { return !e.diLabeliAI && !e.pensiun; }).slice(0, SEKALI);
      if (!antre.length) return 0;

      var janji = setelan.modeAI === 'proxy'
        ? lewatProxy(setelan.alamatProxy, antre)
        : lewatGemini(setelan.kunciGemini, setelan.model, antre);

      return janji.then(function (jawab) {
        var hasil = (jawab && jawab.hasil) || [];
        if (!hasil.length) throw new Error('Jawaban AI kosong');
        var tulis = hasil.map(function (h) {
          var e = antre[h.i];
          if (!e) return null;
          /* Judul yang sudah diketik sendiri tidak pernah ditimpa. Ini punya
             pemakainya - AI cuma mengisi yang masih kosong atau yang tadinya
             disusun otomatis. */
          if (!e.judulManual && h.judul) e.judul = String(h.judul).slice(0, 90);
          var tambahan = (h.label || []).map(function (l) { return TOtak.normal(l); }).filter(Boolean);
          var gabung = (e.label || []).slice();
          tambahan.forEach(function (l) { if (gabung.indexOf(l) < 0) gabung.push(l); });
          e.label = gabung.slice(0, 50);
          e.diLabeliAI = true;
          return TSimpan.taruh(e);
        }).filter(Boolean);
        return Promise.all(tulis).then(function () { return tulis.length; });
      });
    }).catch(function (err) {
      /* Sengaja diam. Gagal melabeli bukan kabar buruk buat pemakainya -
         entrinya tersimpan, pencariannya jalan, antrean dicoba lagi nanti. */
      if (global.console && console.debug) console.debug('[Drop Note] pelabelan tertunda:', err.message);
      return 0;
    }).then(function (n) { jalan = false; return n; },
            function () { jalan = false; return 0; });
  }

  /* Uji kunci/proxy dari layar Setelan - ini yang boleh berisik. */
  function coba(setelan) {
    var contoh = [{
      jenis: 'tautan', kategori: '',
      isi: 'https://script.google.com/macros/s/AKfycbwkJFjKtM6Mj/dev'
    }];
    var janji = setelan.modeAI === 'proxy'
      ? lewatProxy(setelan.alamatProxy, contoh)
      : lewatGemini(setelan.kunciGemini, setelan.model, contoh);
    return janji.then(function (j) {
      if (!j || !j.hasil || !j.hasil.length) throw new Error('Tersambung, tapi jawabannya tidak dikenali');
      return j.hasil[0];
    });
  }

  global.TPelabel = { putaran: putaran, coba: coba, siap: siap, MODEL_BAWAAN: MODEL_BAWAAN };
})(window);
