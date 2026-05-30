/*
 * RootShell — top-level Compose host. Owns the NavController, the
 * tab bar, and the theme provider. Wires AppRouter so deep-link
 * intents flip the visible tab + emit screen-local events
 * (focus search bar, paste clipboard into capture, open hub chat).
 */

package wiki.memory.memorywiki.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navigation
import dagger.hilt.android.lifecycle.HiltViewModel
import wiki.memory.memorywiki.AppRouter
import wiki.memory.memorywiki.AppTab
import wiki.memory.memorywiki.RouterEvent
import wiki.memory.memorywiki.auth.AuthManager
import wiki.memory.memorywiki.ui.auth.AuthScreen
import wiki.memory.memorywiki.ui.bundles.BundleDetailScreen
import wiki.memory.memorywiki.ui.bundles.BundlesScreen
import wiki.memory.memorywiki.ui.capture.CaptureScreen
import wiki.memory.memorywiki.ui.chat.ChatScreen
import wiki.memory.memorywiki.ui.chat.ChatScopeId
import wiki.memory.memorywiki.ui.document.DocumentDetailScreen
import wiki.memory.memorywiki.ui.markdowns.MarkdownsScreen
import wiki.memory.memorywiki.ui.settings.SettingsScreen
import wiki.memory.memorywiki.ui.shell.BottomFadeStrip
import wiki.memory.memorywiki.ui.shell.BrandTabBar
import wiki.memory.memorywiki.ui.start.StartScreen
import wiki.memory.memorywiki.ui.theme.AccentColorChoice
import wiki.memory.memorywiki.ui.theme.Brand
import wiki.memory.memorywiki.ui.theme.MemoryWikiTheme
import javax.inject.Inject

@HiltViewModel
class RootViewModel @Inject constructor(
    val router: AppRouter,
    val auth: AuthManager,
) : ViewModel()

@Composable
fun RootShell(vm: RootViewModel = hiltViewModel()) {
    val session by vm.auth.session.collectAsState()
    val loading by vm.auth.loading.collectAsState()
    val visitorAccent = AccentColorChoice.from(session?.accentColor)

    MemoryWikiTheme(userAccent = visitorAccent) {
        Surface(Modifier.fillMaxSize(), color = Brand.Background) {
            when {
                loading -> BootSplash()
                session == null -> AuthScreen()
                else -> SignedInShell(vm.router, vm.auth)
            }
        }
    }
}

@Composable
private fun BootSplash() {
    Box(Modifier.fillMaxSize().background(Brand.Background), contentAlignment = Alignment.Center) {
        // Replaced once the SplashScreen API hand-off completes; we
        // keep the bg-only state here so a slow auth refresh doesn't
        // flash the AuthScreen prematurely.
    }
}

@Composable
private fun SignedInShell(router: AppRouter, auth: AuthManager) {
    val navController = rememberNavController()
    val tab by router.selectedTab.collectAsState()
    val session by auth.session.collectAsState()

    LaunchedEffect(tab) {
        val target = tab.route
        val current = navController.currentDestination?.parent?.route ?: navController.currentDestination?.route
        if (current != target) {
            navController.navigate(target) {
                popUpTo(navController.graph.startDestinationId) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
    }
    LaunchedEffect(Unit) {
        router.events.collect { evt ->
            when (evt) {
                is RouterEvent.PushDocDetail -> navController.navigate("markdowns/doc/${evt.docId}")
                is RouterEvent.PushBundleDetail -> navController.navigate("bundles/${evt.bundleId}")
                else -> Unit
            }
        }
    }

    Box(Modifier.fillMaxSize()) {
        NavHost(
            navController = navController,
            startDestination = AppTab.Start.route,
            modifier = Modifier.fillMaxSize(),
        ) {
            composable(AppTab.Start.route) { StartScreen(navController) }
            navigation(startDestination = "markdowns/list", route = AppTab.Markdowns.route) {
                composable("markdowns/list") { MarkdownsScreen(navController) }
                composable("markdowns/doc/{id}") { backStack ->
                    DocumentDetailScreen(
                        navController = navController,
                        docId = backStack.arguments?.getString("id").orEmpty(),
                    )
                }
            }
            navigation(startDestination = "bundles/list", route = AppTab.Bundles.route) {
                composable("bundles/list") { BundlesScreen(navController) }
                composable("bundles/{id}") { backStack ->
                    BundleDetailScreen(
                        navController = navController,
                        bundleId = backStack.arguments?.getString("id").orEmpty(),
                    )
                }
                composable("bundles/doc/{id}") { backStack ->
                    DocumentDetailScreen(
                        navController = navController,
                        docId = backStack.arguments?.getString("id").orEmpty(),
                    )
                }
            }
            composable(AppTab.Capture.route) { CaptureScreen(navController) }
            composable(AppTab.Settings.route) { SettingsScreen(navController) }

            composable("chat/{kind}/{id}/{title}") { backStack ->
                val kind = backStack.arguments?.getString("kind").orEmpty()
                val id = backStack.arguments?.getString("id").orEmpty()
                val title = backStack.arguments?.getString("title").orEmpty()
                ChatScreen(
                    navController = navController,
                    scopeId = ChatScopeId(kind = kind, id = id, title = title),
                )
            }
        }

        // Bottom chrome: fade strip behind, floating tab bar above.
        BottomFadeStrip(Modifier.align(Alignment.BottomCenter))
        BrandTabBar(
            selected = tab,
            onSelect = { router.selectTab(it) },
            avatarUrl = session?.avatarUrl,
            onReselect = { selectedTab ->
                // iOS-equivalent: pop the visible stack root. Returns
                // true if anything popped (so the caller suppresses the
                // shake/warning haptic). Start / Capture / Settings
                // are single-screen flows — never pop, always shake.
                when (selectedTab) {
                    AppTab.Markdowns -> {
                        val popped = navController.popBackStack(
                            route = "markdowns/list",
                            inclusive = false,
                        )
                        popped
                    }
                    AppTab.Bundles -> {
                        val popped = navController.popBackStack(
                            route = "bundles/list",
                            inclusive = false,
                        )
                        popped
                    }
                    else -> false
                }
            },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .systemBarsPadding(),
        )
    }
}
