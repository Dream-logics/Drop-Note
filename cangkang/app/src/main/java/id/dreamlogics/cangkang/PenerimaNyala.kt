/* ===== PenerimaNyala — bulatannya kembali sendiri sesudah HP restart ===== */

package id.dreamlogics.cangkang

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Tanpa berkas ini, tiap restart HP menuntut satu kunjungan ke layar depan
 * untuk menyalakan bulatannya lagi - dan kunjungan ke layar depan persis
 * ongkos yang dibuat cangkang ini untuk dihapus.
 */
class PenerimaNyala : BroadcastReceiver() {
    override fun onReceive(ctx: Context, i: Intent) {
        if (i.action != Intent.ACTION_BOOT_COMPLETED) return
        val nyala = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            .getBoolean(PREF_NYALA, false)
        if (nyala) LayananBulatan.nyalakan(ctx)
    }
}
