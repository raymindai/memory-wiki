# Memory.Wiki Android — ProGuard rules
# Keep model classes (Ktor + kotlinx.serialization reflection)
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class wiki.memory.memorywiki.data.model.**$$serializer { *; }
-keepclassmembers class wiki.memory.memorywiki.data.model.** {
    *** Companion;
}
-keepclasseswithmembers class wiki.memory.memorywiki.data.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Ktor
-dontwarn io.ktor.**
-keep class io.ktor.** { *; }

# Supabase
-keep class io.github.jan.supabase.** { *; }
-dontwarn io.github.jan.supabase.**

# Hilt
-keep,allowobfuscation,allowshrinking class dagger.hilt.** { *; }

# OkHttp / Okio
-dontwarn okhttp3.**
-dontwarn okio.**

# ML Kit
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Glance
-keep class androidx.glance.appwidget.** { *; }
