/* ===== LayananBulatan — bulatan melayang + jendela yang dibukanya ===== */

package id.dreamlogics.cangkang

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.PixelFormat
import android.graphics.drawable.Icon
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.view.ContextThemeWrapper
import kotlin.math.abs

class LayananBulatan : Service() {

    private lateinit var wm: WindowManager
    private lateinit var pref: SharedPreferences
    private lateinit var konteks: Context

    private var bulatan: View? = null
    private var pBulatan: WindowManager.LayoutParams? = null

    private var panel: View? = null
    private var pPanel: WindowManager.LayoutParams? = null
    private var web: WebView? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        pref = getSharedPreferences(PREF, Context.MODE_PRIVATE)
        // WebView menolak konteks tanpa tema; layanan tidak punya satu pun.
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
        lepas(panel)
        lepas(bulatan)
        web?.destroy()
        web = null
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
        pBulatan = p
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

    /* ---------- jendela ---------- */

    private fun bukaPanel() {
        if (panel != null) return
        bulatan?.visibility = View.GONE

        val isi = susunPanel()

        val p = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            tinggiPanel(),
            TYPE_LAPISAN,
            // BUKAN NOT_FOCUSABLE: tanpa fokus, papan ketik tidak pernah muncul
            // dan jendela ini jadi jendela yang tidak bisa diketik - persis
            // satu-satunya hal yang diminta darinya.
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
        isi.requestFocus()
        muat()
    }

    private fun kecilkan() {
        lepas(panel)
        panel = null
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

        val kepala = LinearLayout(konteks).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.kepala_alas)
        }

        val judul = TextView(konteks).apply {
            // Namanya cuma dibaca dari strings.xml, tidak pernah ditulis di
            // dalam kode - aturan yang sama dengan bawaan.js di aplikasi web.
            text = getString(R.string.tarik_untuk_ukur)
            textSize = 12f
            setTextColor(0xFF6B6B66.toInt())
            setPadding((14 * d.density).toInt(), 0, 0, 0)
        }
        kepala.addView(
            judul,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )
        // Menyeret kepalanya mengubah tinggi jendelanya. Ukuran yang benar cuma
        // diketahui waktu dipakai - papan ketik yang berbeda dan aplikasi yang
        // dilihat di sebelahnya berbeda tiap kali - jadi angka apa pun yang
        // dipatok akan salah di pemakaian yang tidak ditebak.
        kepala.setOnTouchListener(SeretUkur())

        kepala.addView(tombol(R.string.tbl_kecil) { kecilkan() })
        kepala.addView(tombol(R.string.tbl_tutup) {
            pref.edit().putBoolean(PREF_NYALA, false).apply()
            stopSelf()
        })

        akar.addView(
            kepala,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (38 * d.density).toInt()
            )
        )

        val w = ambilWeb()
        akar.addView(
            w,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
            )
        )

        // Tombol Kembali HP mengecilkan, tidak menutup: jendela yang lenyap
        // waktu tombol Kembali ditekan membuang tulisan yang sedang diketik,
        // dan itu tidak bisa dibatalkan.
        akar.setOnKeyListener { _, kode, ev ->
            if (kode == KeyEvent.KEYCODE_BACK && ev.action == KeyEvent.ACTION_UP) {
                kecilkan(); true
            } else false
        }
        return akar
    }

    private inner class SeretUkur : View.OnTouchListener {
        private var t0 = 0
        private var jariY = 0f

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            val p = pPanel ?: return false
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    t0 = p.height; jariY = e.rawY; return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val layar = resources.displayMetrics.heightPixels
                    p.height = (t0 + (e.rawY - jariY)).toInt()
                        .coerceIn((layar * TINGGI_MIN).toInt(), (layar * TINGGI_MAKS).toInt())
                    panel?.let { wm.updateViewLayout(it, p) }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    val layar = resources.displayMetrics.heightPixels
                    pref.edit()
                        .putFloat(PREF_TINGGI, p.height.toFloat() / layar)
                        .apply()
                    return true
                }
            }
            return false
        }
    }

    private fun tombol(teks: Int, kerja: () -> Unit): TextView {
        val d = resources.displayMetrics
        return TextView(konteks).apply {
            text = getString(teks)
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(0xFF33322E.toInt())
            // 44px sasaran sentuh, aturan yang sama dengan aplikasi webnya.
            val sisi = (44 * d.density).toInt()
            layoutParams = LinearLayout.LayoutParams(sisi, sisi)
            setOnClickListener { kerja() }
        }
    }

    /* ---------- web ---------- */

    /**
     * WebView-nya HIDUP TERUS, bahkan waktu jendelanya dikecilkan. Yang dilepas
     * cuma pemasangannya di layar. Sebabnya satu: tulisan yang belum di-drop
     * tinggal di DOM, dan menghancurkan WebView-nya berarti kalimat setengah
     * jadi hilang tiap kali kamu menoleh ke aplikasi sebelah - persis kejadian
     * yang bikin cangkang ini dibuat.
     */
    private fun ambilWeb(): WebView {
        web?.let { lama ->
            (lama.parent as? android.view.ViewGroup)?.removeView(lama)
            return lama
        }
        val w = WebView(konteks)
        w.settings.apply {
            javaScriptEnabled = true
            // IndexedDB-nya seluruh aplikasi bergantung pada ini.
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = false
        }
        WebView.setWebContentsDebuggingEnabled(true)
        w.webViewClient = WebViewClient()
        w.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(req: PermissionRequest) {
                // Kamera di dalam WebView minta izinnya dua kali: sekali ke
                // Android (dilakukan LayarMulai) dan sekali ke halamannya.
                req.grant(req.resources)
            }
        }
        web = w
        return w
    }

    private fun muat() {
        val w = web ?: return
        if (w.url == null) w.loadUrl(ALAMAT)
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
