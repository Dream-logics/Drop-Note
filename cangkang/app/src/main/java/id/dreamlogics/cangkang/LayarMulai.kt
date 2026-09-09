/* ===== LayarMulai — satu layar, sekali seumur pemasangan ===== */

package id.dreamlogics.cangkang

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Layar ini BUKAN aplikasinya - dia cuma sakelar. Aplikasinya tinggal di
 * bulatan melayang; kalau layar ini sampai menumbuhkan fitur sendiri, jadi dua
 * tempat yang mengerjakan hal yang sama, dan yang di sini selalu yang lebih
 * miskin.
 */
class LayarMulai : AppCompatActivity() {

    private lateinit var kabar: TextView

    override fun onCreate(simpanan: Bundle?) {
        super.onCreate(simpanan)
        val d = resources.displayMetrics
        val tepi = (20 * d.density).toInt()

        val akar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(tepi, tepi, tepi, tepi)
            setBackgroundColor(0xFFF5F5F3.toInt())
        }

        akar.addView(TextView(this).apply {
            text = getString(R.string.nama_app)
            textSize = 24f
            setTextColor(0xFF33322E.toInt())
        })

        akar.addView(TextView(this).apply {
            text = getString(R.string.mulai_alasan)
            textSize = 15f
            setTextColor(0xFF6B6B66.toInt())
            setPadding(0, (12 * d.density).toInt(), 0, (20 * d.density).toInt())
        })

        akar.addView(Button(this).apply {
            text = getString(R.string.tbl_nyalakan)
            setOnClickListener { nyalakan() }
        })

        akar.addView(Button(this).apply {
            text = getString(R.string.tbl_matikan)
            setOnClickListener {
                getSharedPreferences(PREF, Context.MODE_PRIVATE)
                    .edit().putBoolean(PREF_NYALA, false).apply()
                stopService(Intent(this@LayarMulai, LayananBulatan::class.java))
                perbarui()
            }
        })

        kabar = TextView(this).apply {
            textSize = 13f
            gravity = Gravity.START
            setTextColor(0xFF6B6B66.toInt())
            setPadding(0, (18 * d.density).toInt(), 0, 0)
        }
        akar.addView(kabar)

        setContentView(akar)
    }

    override fun onResume() {
        super.onResume()
        // Kembali dari layar izin sistem masuk lewat sini, bukan lewat hasil
        // permintaan: izin overlay diberikan di Setelan, dan Setelan tidak
        // pernah mengembalikan jawaban ke aplikasi yang memanggilnya.
        if (Settings.canDrawOverlays(this) &&
            getSharedPreferences(PREF, Context.MODE_PRIVATE).getBoolean(PREF_NYALA, false)
        ) {
            LayananBulatan.nyalakan(this)
        }
        perbarui()
    }

    private fun nyalakan() {
        if (!Settings.canDrawOverlays(this)) {
            getSharedPreferences(PREF, Context.MODE_PRIVATE)
                .edit().putBoolean(PREF_NYALA, true).apply()
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
            )
            return
        }
        mintaIzinRingan()
        LayananBulatan.nyalakan(this)
        perbarui()
    }

    /**
     * Kabar dan kamera diminta di sini, bukan waktu dibutuhkan: dialog izin
     * cuma bisa muncul dari sebuah layar, dan bulatannya berjalan di layanan
     * yang tidak punya satu pun. Yang diminta belakangan tidak akan pernah
     * sempat ditanyakan.
     */
    private fun mintaIzinRingan() {
        val kurang = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) kurang += Manifest.permission.POST_NOTIFICATIONS

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) kurang += Manifest.permission.CAMERA

        if (kurang.isNotEmpty()) ActivityCompat.requestPermissions(this, kurang.toTypedArray(), 7)
    }

    private fun perbarui() {
        val nyala = getSharedPreferences(PREF, Context.MODE_PRIVATE)
            .getBoolean(PREF_NYALA, false)
        kabar.text = when {
            !Settings.canDrawOverlays(this) -> getString(R.string.kabar_izin)
            nyala -> getString(R.string.kabar_nyala)
            else -> getString(R.string.kabar_mati)
        }
    }
}
