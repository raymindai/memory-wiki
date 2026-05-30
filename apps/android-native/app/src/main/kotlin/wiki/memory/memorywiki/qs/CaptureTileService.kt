/*
 * CaptureTileService — surfaces a "Capture" tile in the system
 * Quick Settings panel (notification shade). Tap fires the same
 * memorywiki://capture deep link as the launcher long-press
 * shortcut and the widget primary button, so the user lands in
 * the Capture screen ready to write.
 *
 * Active tile — visually permanent + always primary-coloured.
 * No state to sync, so onStartListening just stamps the label.
 *
 * Android 14+ requires PendingIntent + collapse so the platform
 * can enforce trampoline rules. Older releases use the
 * deprecated Intent overload (still supported on API 33).
 */

package wiki.memory.memorywiki.qs

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class CaptureTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            state = Tile.STATE_ACTIVE
            label = "Capture"
            contentDescription = "New Memory.Wiki capture"
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("memorywiki://capture"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pi = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            startActivityAndCollapse(pi)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
