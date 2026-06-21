import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor config — wraps the Vite PWA build (apps/web/dist) into native
 * iOS + Android shells. The same React app runs inside a WKWebView (iOS) /
 * Android System WebView, so 100% of the UI code is reused.
 *
 * Build flow:
 *   npm run build        # produces dist/
 *   npx cap sync         # copies dist/ into ios/ + android/ and updates plugins
 *   npx cap open ios     # Xcode  →  Product ▸ Archive / Run
 *   npx cap open android # Android Studio  →  Run / assembleRelease
 */
const config: CapacitorConfig = {
  // Bundle id under the Mohe Apple Developer team (B7JXA8GGC8), matching the
  // today.mohe.* namespace used by the team's other apps.
  appId: 'today.mohe.todly',
  appName: 'todly',
  webDir: 'dist',
  backgroundColor: '#EDF1F7',
  ios: {
    // Use the system content inset so the web UI's own safe-area handling owns
    // the notch/home-indicator spacing.
    contentInset: 'always',
  },
  android: {
    // Keep the WebView background matching the app shell to avoid white flashes.
    backgroundColor: '#EDF1F7',
  },
  plugins: {
    PushNotifications: {
      // Show heads-up banners + badge + sound when a push arrives in foreground.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
