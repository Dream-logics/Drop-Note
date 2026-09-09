/* ===== LayananBulatan — bulatan melayang + kotak tulis yang dibukanya ===== */

package id.dreamlogics.cangkang

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.PixelFormat
import android.graphics.drawable.Icon
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.view.ContextThemeWrapper
import kotlin.math.abs

class LayananBulatan : Service() {

    private lateinit var wm: WindowManager
    private lateinit var pref: SharedPreferences
    private lateinit var konteks: Context

    private var bulatan: View? = null

    private var panel: View? = null
    private var pPanel: WindowManager.LayoutParams? = null
    private var ketik: EditText? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        pref = getSharedPreferences(PREF, Context.MODE_PRIVATE)
        // Layanan tidak punya tema; beberapa widget menolak konteks tanpa tema.
        konteks = ContextThemeWrapper(this, R.style.Tema)
        mulaiLatarDepan()
        pasangBulatan()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            AKSI_BERHENTI -> {
                pref.edit().putBoolean(PREF_NYALA, false).apply()
                stopSelf()
            }
            // Dari ubin Setelan Cepat: yang menekannya sedang ingin MENULIS,
            // bukan sekadar memunculkan bulatan yang harus diketuk sekali lagi.
            AKSI_BUKA -> bukaPanel()
        }
        // STICKY: kalau sistem membunuhnya karena memori, dia dihidupkan lagi -
        // bulatan yang hilang diam-diam terbaca sebagai aplikasi yang rusak.
        return START_STICKY
    }

    override fun onDestroy() {
        simpanNaskah()
        lepas(panel)
        lepas(bulatan)
        super.onDestroy()
    }

    /* ---------- bulatan ---------- */

    private fun pasangBulatan() {
        if (bulatan != null) return
        val d = resources.displayMetrics
        val sisi = (56 * d.density).toInt()

        val v = TextView(konteks).apply {
            text = getString(R.string.huruf_bulatan)
            gravity = Gravity.CENTER
            setBackgroundResource(R.drawable.bulatan_alas)
            textSize = 20f
            setTextColor(0xFFFFFFFF.toInt())
            contentDescription = getString(R.string.nama_app)
        }

        val p = WindowManager.LayoutParams(
            sisi, sisi,
            TYPE_LAPISAN,
            // NOT_FOCUSABLE supaya bulatannya tidak pernah menelan papan ketik
            // aplikasi di bawahnya; NOT_TOUCH_MODAL supaya ketukan di luar
            // bulatannya tetap sampai ke aplikasi itu.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        )
        p.gravity = Gravity.TOP or Gravity.START
        p.x = pref.getInt(PREF_X, d.widthPixels - sisi)
        // Bawaannya di bawah tengah, TIDAK di dekat tepi atas: menyeret sesuatu
        // di pinggir atas layar menarik bilah notifikasi, dan itu persis
        // kekeliruan yang bikin cara lama gagal 10 kali dari 12.
        p.y = pref.getInt(PREF_Y, (d.heightPixels * 0.55f).toInt())

        v.setOnTouchListener(SeretBulatan(p, sisi))
        wm.addView(v, p)
        bulatan = v
    }

    /** Seret memindahkan; ketuk singkat membuka. Dua gerakan, satu sasaran. */
    private inner class SeretBulatan(
        val p: WindowManager.LayoutParams,
        val sisi: Int
    ) : View.OnTouchListener {
        private var x0 = 0
        private var y0 = 0
        private var jariX = 0f
        private var jariY = 0f
        private var mulai = 0L
        private val ambang = ViewConfiguration.get(this@LayananBulatan).scaledTouchSlop

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    x0 = p.x; y0 = p.y
                    jariX = e.rawX; jariY = e.rawY
                    mulai = System.currentTimeMillis()
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    p.x = x0 + (e.rawX - jariX).toInt()
                    p.y = y0 + (e.rawY - jariY).toInt()
                    wm.updateViewLayout(v, p)
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    val geser = abs(e.rawX - jariX) + abs(e.rawY - jariY)
                    if (geser < ambang && System.currentTimeMillis() - mulai < 400) {
                        bukaPanel()
                        return true
                    }
                    // Menempel ke tepi terdekat: bulatan yang berhenti di
                    // tengah layar menutupi isi aplikasi di bawahnya, dan yang
                    // menutupi isi akan disingkirkan, bukan dipakai.
                    val lebar = resources.displayMetrics.widthPixels
                    p.x = if (p.x + sisi / 2 < lebar / 2) 0 else lebar - sisi
                    p.y = p.y.coerceIn(0, resources.displayMetrics.heightPixels - sisi)
                    wm.updateViewLayout(v, p)
                    pref.edit().putInt(PREF_X, p.x).putInt(PREF_Y, p.y).apply()
                    return true
                }
            }
            return false
        }
    }

    /* ---------- kotak tulis ---------- */

    private fun bukaPanel() {
        if (panel != null) return
        bulatan?.visibility = View.GONE

        val isi = susunPanel()

        val p = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            tinggiPanel(),
            TYPE_LAPISAN,
            // BUKAN NOT_FOCUSABLE: tanpa fokus, papan ketik tidak pernah muncul
            // dan kotak yang tidak bisa diketik membatalkan seluruh gunanya.
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        )
        p.gravity = Gravity.TOP or Gravity.START
        p.x = 0
        p.y = 0
        // Dipatok di ATAS, bukan di bawah: papan ketik naik dari bawah, dan
        // jendela yang duduk di sana akan tertimpa atau terdorong keluar layar.
        p.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE

        wm.addView(isi, p)
        panel = isi
        pPanel = p
        ketik?.requestFocus()
    }

    private fun kecilkan() {
        simpanNaskah()
        lepas(panel)
        panel = null
        ketik = null
        bulatan?.visibility = View.VISIBLE
    }

    private fun tinggiPanel(): Int {
        val pecahan = pref.getFloat(PREF_TINGGI, TINGGI_BAWAAN)
        return (resources.displayMetrics.heightPixels * pecahan).toInt()
    }

    private fun susunPanel(): View {
        val d = resources.displayMetrics
        val akar = LinearLayout(konteks).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundResource(R.drawable.panel_alas)
            isFocusableInTouchMode = true
        }

        akar.addView(susunKepala(), LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, (38 * d.density).toInt()
        ))

        val e = EditText(konteks).apply {
            setText(pref.getString(PREF_NASKAH, "") ?: "")
            setSelection(text.length)
            hint = getString(R.string.tulis_hint)
            gravity = Gravity.TOP or Gravity.START
            textSize = 16f
            setTextColor(0xFF33322E.toInt())
            setHintTextColor(0xFF9A9A93.toInt())
            setBackgroundColor(0x00000000)
            val t = (14 * d.density).toInt()
            setPadding(t, t, t, t)
            // Naskahnya disimpan tiap ketukan, bukan waktu ditutup: yang dilawan
            // di sini bukan tombol silang, tapi sistem yang membunuh prosesnya
            // diam-diam waktu memori sempit - dan kalimat yang hilang begitu
            // tidak pernah kamu curigai sampai kamu membukanya lagi.
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    pref.edit().putString(PREF_NASKAH, s?.toString() ?: "").apply()
                }
            })
        }
        ketik = e
        akar.addView(e, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))

        akar.addView(susunDok(), LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        // Tombol Kembali HP mengecilkan, tidak menutup: jendela yang lenyap
        // waktu tombol Kembali ditekan membuang tulisan yang sedang diketik.
        akar.setOnKeyListener { _, kode, ev ->
            if (kode == KeyEvent.KEYCODE_BACK && ev.action == KeyEvent.ACTION_UP) {
                kecilkan(); true
            } else false
        }
        return akar
    }

    private fun susunKepala(): View {
        val d = resources.displayMetrics
        val kepala = LinearLayout(konteks).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.kepala_alas)
        }
        kepala.addView(
            TextView(konteks).apply {
                text = getString(R.string.tarik_untuk_ukur)
                textSize = 12f
                setTextColor(0xFF6B6B66.toInt())
                setPadding((14 * d.density).toInt(), 0, 0, 0)
            },
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )
        // Menyeret kepalanya mengubah tinggi jendelanya. Ukuran yang benar cuma
        // diketahui waktu dipakai - papan ketik dan aplikasi yang dilihat di
        // sebelahnya berbeda tiap kali - jadi angka apa pun yang dipatok akan
        // salah di pemakaian yang tidak ditebak.
        kepala.setOnTouchListener(SeretUkur())
        kepala.addView(tombolIkon(R.string.tbl_kecil) { kecilkan() })
        kepala.addView(tombolIkon(R.string.tbl_tutup) {
            pref.edit().putBoolean(PREF_NYALA, false).apply()
            stopSelf()
        })
        return kepala
    }

    /**
     * Baris tombolnya dibaca dari KANAN - jempol kanan bertumpu di sudut kanan
     * bawah - jadi yang paling sering ditekan duduk paling kanan. Di sini itu
     * Salin: yang ditulis di kotak ini hampir selalu berakhir ditempelkan ke
     * jendela obrolan sebelah. "Bersihkan" duduk paling jauh, karena dia
     * satu-satunya yang tidak bisa dibatalkan.
     */
    private fun susunDok(): View {
        val d = resources.displayMetrics
        val dok = LinearLayout(konteks).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val t = (8 * d.density).toInt()
            setPadding(t, t, t, t)
        }
        dok.addView(tombolTeks(R.string.tbl_bersihkan) {
            ketik?.setText("")
            pref.edit().putString(PREF_NASKAH, "").apply()
        })
        dok.addView(View(konteks), LinearLayout.LayoutParams(0, 1, 1f))
        dok.addView(tombolTeks(R.string.tbl_kirim) { kirim() })
        dok.addView(tombolTeks(R.string.tbl_salin) { salin() })
        return dok
    }

    private inner class SeretUkur : View.OnTouchListener {
        private var t0 = 0
        private var jariY = 0f

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            val p = pPanel ?: return false
            val layar = resources.displayMetrics.heightPixels
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    t0 = p.height; jariY = e.rawY; return true
                }
                MotionEvent.ACTION_MOVE -> {
                    p.height = (t0 + (e.rawY - jariY)).toInt()
                        .coerceIn((layar * TINGGI_MIN).toInt(), (layar * TINGGI_MAKS).toInt())
                    panel?.let { wm.updateViewLayout(it, p) }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    pref.edit().putFloat(PREF_TINGGI, p.height.toFloat() / layar).apply()
                    return true
                }
            }
            return false
        }
    }

    private fun tombolIkon(teks: Int, kerja: () -> Unit): TextView {
        val d = resources.displayMetrics
        return TextView(konteks).apply {
            text = getString(teks)
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(0xFF33322E.toInt())
            // 44dp sasaran sentuh, aturan yang sama dengan aplikasi webnya.
            val sisi = (44 * d.density).toInt()
            layoutParams = LinearLayout.LayoutParams(sisi, sisi)
            setOnClickListener { kerja() }
        }
    }

    private fun tombolTeks(teks: Int, kerja: () -> Unit): TextView {
        val d = resources.displayMetrics
        return TextView(konteks).apply {
            text = getString(teks)
            textSize = 15f
            gravity = Gravity.CENTER
            setTextColor(0xFF33322E.toInt())
            setBackgroundResource(R.drawable.tombol_alas)
            val x = (16 * d.density).toInt()
            val y = (11 * d.density).toInt()
            setPadding(x, y, x, y)
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            lp.leftMargin = (6 * d.density).toInt()
            layoutParams = lp
            setOnClickListener { kerja() }
        }
    }

    /* ---------- perbuatan ---------- */

    private fun naskah(): String = ketik?.text?.toString() ?: ""

    private fun simpanNaskah() {
        val e = ketik ?: return
        pref.edit().putString(PREF_NASKAH, e.text.toString()).apply()
    }

    private fun salin() {
        val teks = naskah()
        if (teks.isBlank()) return
        val papan = getSystemService(ClipboardManager::class.java)
        papan.setPrimaryClip(ClipData.newPlainText(getString(R.string.nama_app), teks))
        Toast.makeText(this, getString(R.string.kabar_salin), Toast.LENGTH_SHORT).show()
    }

    /**
     * Kirim memakai tombol Bagikan Android, dan itu disengaja: aplikasi webnya
     * sudah punya penerima "Bagikan" yang teruji (share_target di manifest-nya),
     * jadi yang ditulis di sini mendarat di timbunan yang SAMA. Dua jalur masuk
     * yang menghasilkan dua tumpukan adalah cara tercepat membuat satu timbunan
     * jadi dua yang tidak pernah bertemu.
     */
    private fun kirim() {
        val teks = naskah()
        if (teks.isBlank()) return
        val i = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, teks)
        }
        val pilih = Intent.createChooser(i, getString(R.string.tbl_kirim))
        pilih.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        kecilkan()
        startActivity(pilih)
    }

    /* ---------- kabar ---------- */

    private fun mulaiLatarDepan() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val saluran = NotificationChannel(
                SALURAN, getString(R.string.nama_app),
                // RENDAH: kabar ini cuma syarat sistem supaya bulatannya tidak
                // dibunuh, bukan sesuatu yang perlu berbunyi.
                NotificationManager.IMPORTANCE_LOW
            )
            nm.createNotificationChannel(saluran)
        }
        val matikan = PendingIntent.getService(
            this, 1,
            Intent(this, LayananBulatan::class.java).setAction(AKSI_BERHENTI),
            PendingIntent.FLAG_IMMUTABLE
        )
        val kabar = Notification.Builder(this, SALURAN)
            .setContentTitle(getString(R.string.kabar_judul))
            .setContentText(getString(R.string.kabar_isi))
            .setSmallIcon(R.drawable.ikon_bulatan)
            .setOngoing(true)
            .addAction(
                Notification.Action.Builder(
                    null as Icon?, getString(R.string.tbl_matikan), matikan
                ).build()
            )
            .build()
        startForeground(1, kabar)
    }

    private fun lepas(v: View?) {
        if (v == null) return
        try {
            wm.removeView(v)
        } catch (_: IllegalArgumentException) {
            // Sudah lepas; tidak ada yang perlu dikerjakan.
        }
    }

    companion object {
        const val SALURAN = "bulatan"
        const val AKSI_BERHENTI = "berhenti"
        const val AKSI_BUKA = "buka"

        val TYPE_LAPISAN = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY

        /** Dipakai LayarMulai, ubin, dan penerima nyala - satu pintu saja. */
        fun nyalakan(ctx: Context, langsungBuka: Boolean = false) {
            if (!Settings.canDrawOverlays(ctx)) return
            ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
                .edit().putBoolean(PREF_NYALA, true).apply()
            val i = Intent(ctx, LayananBulatan::class.java)
            if (langsungBuka) i.action = AKSI_BUKA
            ctx.startForegroundService(i)
        }
    }
}
