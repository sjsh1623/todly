import { Capacitor } from '@capacitor/core'

/**
 * Native status-bar setup.
 *
 * Goal: the OS status bar overlays the web view so the page background paints
 * right up to the very top edge — no white strip in the notch / safe-area
 * region. Paired with `ios.contentInset: 'never'` in capacitor.config and the
 * CSS `env(safe-area-inset-top)` spacer (shared/ui/StatusBar) that keeps content
 * below the notch.
 *
 * No-op on the web (and silently tolerant of an older shell without the plugin).
 */
export async function initNativeStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Style.Light = dark icons/text, which suits our light app background.
    await StatusBar.setStyle({ style: Style.Light })
    if (Capacitor.getPlatform() === 'ios') {
      // Edge-to-edge: the web view extends under the status bar; the page bg
      // (auth gradient / app shell) paints the top instead of a white strip.
      await StatusBar.setOverlaysWebView({ overlay: true })
    } else {
      // Android: keep the status bar opaque and matched to the app shell.
      await StatusBar.setOverlaysWebView({ overlay: false })
      await StatusBar.setBackgroundColor({ color: '#EDF1F7' })
    }
  } catch {
    // Plugin unavailable on this shell — non-fatal.
  }
}
