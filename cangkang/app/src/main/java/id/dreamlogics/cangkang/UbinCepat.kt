/* ===== UbinCepat — jalan kedua, dari bilah atas ===== */

package id.dreamlogics.cangkang

import android.provider.Settings
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Ubin Setelan Cepat langsung MEMBUKA jendelanya, bukan cuma memunculkan
 * bulatannya. Yang menarik bilah atas sedang ingin menulis sekarang; menyuruh
 * dia mengetuk sekali lagi berarti ubin ini cuma memindahkan satu ketukan, dan
 * ketukan yang dipindah bukan ketukan yang dihemat.
 */
class UbinCepat : TileService() {

    override fun onStartListening() {
        qsTile?.apply {
            state = if (Settings.canDrawOverlays(this@UbinCepat)) {
                Tile.STATE_INACTIVE
            } else {
                // Ubin yang mati menjelaskan sendiri kenapa: yang menekan ubin
                // diam tidak akan pernah menebak bahwa yang kurang izin overlay.
                Tile.STATE_UNAVAILABLE
            }
            updateTile()
        }
    }

    override fun onClick() {
        if (!Settings.canDrawOverlays(this)) return
        LayananBulatan.nyalakan(this, langsungBuka = true)
        // Bilahnya TIDAK ditutup paksa dari sini, dan itu bukan kelalaian:
        // sejak Android 14 satu-satunya cara menutupnya adalah membuka sebuah
        // layar, dan layar yang terbuka justru menutupi aplikasi yang sedang
        // dilihat - persis yang mau dihindari. Jadi jendelanya sudah terpasang
        // di belakang bilahnya, dan satu usapan menutup bilah itu.
    }
}
