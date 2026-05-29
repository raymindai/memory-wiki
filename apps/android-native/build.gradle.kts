// Root build script for Memory.Wiki Android.
// Plugins are NOT applied at the root — each module opts in via
// the version catalog. This keeps build classpath isolated and
// the configuration cache happy.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.compose.compiler) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
}
