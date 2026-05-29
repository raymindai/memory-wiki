/*
 * MainActivity — single Compose host. Owns the NavController, hands
 * deep-link intents to AppRouter, and runs the splash screen exit
 * animation. Keep this file thin; everything else lives in the
 * `ui` packages.
 */

package wiki.memory.memorywiki

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.ui.RootShell
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var router: AppRouter
    @Inject lateinit var auth: AuthManager

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        handleIntent(intent)

        setContent {
            RootShell()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        val data = intent.data ?: return
        // Special-case auth callback so it doesn't race the router
        // emit before the auth listener is attached.
        if (data.scheme == "memorywiki" && data.host == "auth-callback") {
            lifecycleScope.launch { auth.handleOAuthCallback(data) }
            return
        }
        if (data.scheme == "memorywiki" && data.host == "demo-signin") {
            lifecycleScope.launch { auth.signInDemo("demo@memory.wiki") }
            return
        }
        lifecycleScope.launch { router.handle(data) }
    }
}
