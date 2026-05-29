/*
 * MemoryWikiApp — single Application class. Hilt's @HiltAndroidApp
 * generates the component tree at boot. We also use this hook to
 * register process-wide singletons that don't fit Hilt (e.g. the
 * markwon instance, which holds a per-process plugin chain).
 */

package wiki.memory.memorywiki

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class MemoryWikiApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Place for future global init: crash reporting, image cache
        // disk size, etc. Kept empty so we don't pay startup tax
        // until we actually need it.
    }
}
