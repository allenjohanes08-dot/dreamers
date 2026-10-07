# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-keepattributes Signature
-dontwarn android.webkit.**
-keepclassmembers class * extends android.webkit.WebView {
    public *;
}
