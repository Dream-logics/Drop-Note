/* ============================================================================
   Pelabel — satu-satunya bagian yang memakai AI
   ============================================================================
   Dua tugas, dan keduanya soal yang sama: membuat sesuatu bisa DITEMUKAN
   berbulan-bulan kemudian oleh orang yang sudah lupa menamainya.

   1. LABEL. Catatan lahir dalam tiga detik, jadi konteksnya tidak ikut
      tertulis. Kartu "Link dev photo studio" nanti dicari dengan kata
      "apps A" - dan tidak ada satu pun kata yang cocok.

   2. BACA BERKAS (OCR). Foto KTP bernama IMG_20240312_094512.jpg tidak cocok
      dengan apa pun yang diingat pemiliknya. AI membaca isinya sekali, lalu
      menuliskan kata-kata yang nanti dipakai mencari. Setelah itu pencarian
      biasa - offline, nol biaya - sudah cukup menemukannya.

   Pembagiannya tetap: AI MENULIS sekali saat entri masuk, LOGIC MEMBACA tiap
   kali mencari. Kebalikannya bikin pencarian - hal yang paling sering
   dilakukan - jadi lambat dan berbayar.

   TIGA ATURAN YANG TIDAK BOLEH DILANGGAR

   1. Tidak pernah di jalur masuk. Nge-drop tidak boleh menunggu jaringan
      sedetik pun. Semua di sini berjalan belakangan, atas antrean.
   2. Borongan untuk label. Sekali panggil untuk banyak entri.
   3. Gagal itu wajar dan diam. Entrinya tetap tersimpan dan tetap bisa dicari
      lewat label logic. Aplikasinya jalan penuh kalau AI tidak pernah hidup.
   ============================================================================ */
(function (global) {
  'use strict';

  var AKAR = 'https://generativelanguage.googleapis.com/v1beta/models/';
  var SEKALI = 12;               /* entri per panggilan label */
  var BACA_SEKALI = 2;           /* berkas per putaran - ini yang paling mahal */
  var BACA_MAKS = 5 * 1024 * 1024;
  var jalan = false;

  function model(setelan) {
    return ((setelan && setelan.model) || '').trim() || TBawaan.model;
  }

  function siap(setelan) {
    return !!(setelan && setelan.modeAI && setelan.modeAI !== 'mati' && setelan.kunciGemini);
  }

  /* Satu pintu ke Gemini. Bentuk permintaannya mengikuti REST v1beta:
     POST .../models/<model>:generateContent dengan kunci di header. */
  function tanya(setelan, bagian, arahan) {
    return fetch(AKAR + encodeURIComponent(model(setelan)) + ':generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': setelan.kunciGemini
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: arahan }] },
        contents: [{ role: 'user', parts: bagian }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error && j.error.message) || ('Gemini menjawab ' + r.status));
        return j;
      });
    }).then(function (j) {
      var p = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
              j.candidates[0].content.parts && j.candidates[0].content.parts[0];
      return urai(p && p.text);
    });
  }

  function urai(teks) {
    var t = String(teks || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  }

  /* ===================== label ===================== */

  var ARAHAN_LABEL =
    'Kamu membantu seseorang menemukan kembali catatannya sendiri berbulan-bulan kemudian.\n' +
    'Untuk setiap entri, hasilkan:\n' +
    '- judul: ringkas, maksimal 8 kata, memakai kata yang akan diingat orangnya, bukan menyalin isi.\n' +
    '- label: 4 sampai 8 kata kunci huruf kecil. Sertakan nama proyek, lingkungan (uji/produksi),\n' +
    '  nama klien, dan sebutan lain yang mungkin dipakai orang itu saat mencari - termasuk yang\n' +
    '  TIDAK tertulis di isinya tapi jelas dari konteks.\n' +
    'Bahasa Indonesia, kecuali istilah teknis yang memang lazim Inggris.\n' +
    'Jawab HANYA JSON: {"hasil":[{"i":0,"judul":"...","label":["..."]}]}';

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

  function labeli(setelan, semua) {
    var antre = semua.filter(function (e) {
      return !e.diLabeliAI && !e.pensiun && !e.dihapus && (e.isi || e.namaBerkas || (e.daftar || []).length);
    }).slice(0, SEKALI);
    if (!antre.length) return Promise.resolve(0);

    return tanya(setelan, [{ text: pesanan(antre) }], ARAHAN_LABEL).then(function (jawab) {
      var hasil = (jawab && jawab.hasil) || [];
      if (!hasil.length) throw new Error('Jawaban AI kosong');
      var tulis = hasil.map(function (h) {
        var e = antre[h.i];
        if (!e) return null;
        /* Judul yang sudah diketik sendiri tidak pernah ditimpa. Itu punya
           pemakainya - AI cuma mengisi yang kosong atau yang disusun mesin. */
        if (!e.judulManual && h.judul) e.judul = String(h.judul).slice(0, 90);
        e.label = gabungLabel(e.label, h.label);
        e.diLabeliAI = true;
        e.diubah = Date.now();
        return TSimpan.taruh(e);
      }).filter(Boolean);
      return Promise.all(tulis).then(function () { return tulis.length; });
    });
  }

  function gabungLabel(lama, tambahan) {
    var gabung = (lama || []).slice();
    (tambahan || []).map(function (l) { return TOtak.normal(l); }).filter(Boolean)
      .forEach(function (l) { if (gabung.indexOf(l) < 0) gabung.push(l); });
    return gabung.slice(0, 50);
  }

  /* ===================== baca berkas (OCR) ===================== */

  var ARAHAN_BACA =
    'Kamu membaca satu dokumen atau foto milik seseorang, supaya dia bisa menemukannya lagi\n' +
    'bertahun-tahun kemudian saat dia cuma ingat samar-samar isinya.\n' +
    'Hasilkan:\n' +
    '- judul: maksimal 8 kata, sebutkan jenis dokumennya dan pihak/objek utamanya.\n' +
    '- label: 5 sampai 12 kata kunci huruf kecil - jenis dokumen, nama orang/perusahaan,\n' +
    '  tahun, nomor penting, dan sebutan sehari-hari yang mungkin dipakai mencarinya.\n' +
    '- teks: ringkasan isi terpenting, maksimal 600 karakter. Tulis apa adanya, jangan menafsirkan.\n' +
    'Bahasa Indonesia. Jawab HANYA JSON: {"judul":"...","label":["..."],"teks":"..."}';

  var BISA_DIBACA = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;

  function keBase64(blob) {
    return new Promise(function (terima, tolak) {
      var baca = new FileReader();
      baca.onload = function () {
        var hasil = String(baca.result);
        terima(hasil.slice(hasil.indexOf(',') + 1));
      };
      baca.onerror = function () { tolak(new Error('Berkas tidak terbaca')); };
      baca.readAsDataURL(blob);
    });
  }

  function ambilBlob(setelan, e) {
    if (e.berkasId) {
      return TSimpan.ambilBerkas(e.berkasId).then(function (b) { return b && b.blob; });
    }
    if (e.driveId) return TAwan.unduhBerkas(setelan, e.driveId);
    return Promise.resolve(null);
  }

  function bacaBerkas(setelan, semua) {
    var antre = semua.filter(function (e) {
      return !e.diBacaAI && !e.pensiun && !e.dihapus &&
             (e.berkasId || e.driveId) && BISA_DIBACA.test(e.tipeBerkas || '') &&
             (e.ukuran || 0) <= BACA_MAKS;
    }).slice(0, BACA_SEKALI);
    if (!antre.length) return Promise.resolve(0);

    return antre.reduce(function (rantai, e) {
      return rantai.then(function (n) {
        return ambilBlob(setelan, e).then(function (blob) {
          if (!blob) { e.diBacaAI = true; return TSimpan.taruh(e).then(function () { return n; }); }
          return keBase64(blob).then(function (b64) {
            return tanya(setelan, [
              { inline_data: { mime_type: e.tipeBerkas, data: b64 } },
              { text: 'Baca dokumen ini.' }
            ], ARAHAN_BACA);
          }).then(function (h) {
            if (!h) throw new Error('Dokumen tidak terbaca');
            if (!e.judulManual && h.judul) e.judul = String(h.judul).slice(0, 90);
            e.label = gabungLabel(e.label, h.label);
            /* Teksnya ditaruh di isi, bukan di kolom baru: dengan begitu
               pencarian yang sudah ada langsung menemukannya, tanpa satu baris
               pun perubahan di otak.js. */
            if (!String(e.isi || '').trim() && h.teks) e.isi = String(h.teks).slice(0, 1500);
            e.diBacaAI = true;
            e.diLabeliAI = true;
            e.diubah = Date.now();
            return TSimpan.taruh(e).then(function () { return n + 1; });
          });
        }).catch(function () {
          /* Satu berkas yang gagal dibaca tidak boleh menghentikan antreannya.
             Ditandai supaya tidak dicoba terus-menerus dan menghabiskan kuota. */
          e.diBacaAI = true;
          return TSimpan.taruh(e).then(function () { return n; });
        });
      });
    }, Promise.resolve(0));
  }

  /* ===================== putaran ===================== */

  function putaran(setelan) {
    if (jalan || !siap(setelan)) return Promise.resolve(0);
    jalan = true;
    var total = 0;

    return TSimpan.semua().then(function (semua) {
      return labeli(setelan, semua).then(function (n) {
        total += n;
        return setelan.modeAI === 'penuh' ? bacaBerkas(setelan, semua) : 0;
      }).then(function (n) { total += n; });
    }).catch(function (err) {
      if (global.console && console.debug) console.debug('[pelabelan tertunda]', err.message);
    }).then(function () { jalan = false; return total; },
            function () { jalan = false; return total; });
  }

  /* Uji dari layar Setelan - satu-satunya tempat kegagalan AI boleh berisik. */
  function coba(setelan) {
    var contoh = [{ jenis: 'tautan', kategori: '', isi: 'https://script.google.com/macros/s/AKfycbCONTOH/dev' }];
    return tanya(setelan, [{ text: pesanan(contoh) }], ARAHAN_LABEL).then(function (j) {
      if (!j || !j.hasil || !j.hasil.length) throw new Error('Tersambung, tapi jawabannya tidak dikenali');
      return j.hasil[0];
    });
  }

  global.TPelabel = { putaran: putaran, coba: coba, siap: siap, model: model };
})(window);
