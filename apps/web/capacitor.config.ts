import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor config — wraps the React web app into native iOS + Android shells.
 *
 * By default the native app loads the LIVE web app from the server
 * (`server.url`) rather than the bundled dist/, so web deploys reach the app
 * instantly without a native rebuild. The Capacitor bridge (push, status bar,
 * …) is still injected into the remote page, so native plugins keep working.
 * `webDir: 'dist'` is only the offline fallback bundle.
 *
 * Build flow:
 *   npm run build        # produces dist/ (the offline fallback bundle)
 *   npx cap sync         # writes config + plugins into ios/ + android/
 *   npx cap open ios     # Xcode  →  Product ▸ Archive / Run
 *   npx cap open android # Android Studio  →  Run / assembleRelease
 *
 * To ship the OFFLINE bundled build instead (no remote dependency), run the
 * sync with an empty override:  CAP_SERVER_URL= npx cap sync
 */
const serverUrl =
  process.env.CAP_SERVER_URL !== undefined ? process.env.CAP_SERVER_URL : 'https://mohe.today/todly'

const config: CapacitorConfig = {
  // Bundle id under the Mohe Apple Developer team (B7JXA8GGC8), matching the
  // today.mohe.* namespace used by the team's other apps.
  appId: 'today.mohe.todly',
  appName: 'todly',
  webDir: 'dist',
  backgroundColor: '#EDF1F7',
  // Load the deployed web app from the server (omit when CAP_SERVER_URL='' to
  // use the bundled dist/ for offline-first).
  ...(serverUrl ? { server: { url: serverUrl, cleartext: false } } : {}),
  ios: {
    // Edge-to-edge: the web view fills the whole screen (under the status bar /
    // home indicator) and the page paints into the safe areas — no white strip
    // at the top. The web UI reserves the notch via the CSS
    // env(safe-area-inset-top) spacer and the runtime StatusBar overlay
    // (see shared/native/statusBar). 'never' = don't auto-inset the web view.
    contentInset: 'never',
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
