import { Capacitor } from '@capacitor/core'
import { registerDeviceToken } from './api'

/**
 * Push registration for both transports:
 *   - Native (iOS/Android via Capacitor): APNs/FCM token from the
 *     PushNotifications plugin → registered with platform 'ios'/'android'.
 *   - Web (PWA): a VAPID PushManager subscription → registered as JSON with
 *     platform 'web'. Requires VITE_VAPID_PUBLIC_KEY to match the server's key.
 *
 * Everything is best-effort: push is auxiliary to in-app + realtime notices, so
 * a missing key / denied permission / unsupported browser is a silent no-op.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Whether this build *could* register web push (keys + browser support). */
export function webPushSupported(): boolean {
  return (
    !!VAPID_PUBLIC_KEY &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** True on a native Capacitor shell (always push-capable). */
export function isNativePush(): boolean {
  return Capacitor.isNativePlatform()
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

/** Native push: request permission (optionally), then register for a token. */
async function registerNative(promptIfNeeded: boolean): Promise<boolean> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let perm = await PushNotifications.checkPermissions()
  if (perm.receive !== 'granted') {
    if (!promptIfNeeded) return false
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') return false

  await PushNotifications.removeAllListeners()
  await PushNotifications.addListener('registration', (token) => {
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
    void registerDeviceToken({ token: token.value, platform })
  })
  await PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] native registration error', err)
  })
  // Tapping a notification opens the linked screen.
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url
    if (typeof url === 'string' && url) window.location.assign(url)
  })
  await PushNotifications.register()
  return true
}

/** Web push: ensure permission, then create/reuse a VAPID subscription. */
async function subscribeWeb(promptIfNeeded: boolean): Promise<boolean> {
  if (!webPushSupported()) return false
  let permission = Notification.permission
  if (permission === 'default') {
    if (!promptIfNeeded) return false
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string) as BufferSource,
    }))
  await registerDeviceToken({ token: JSON.stringify(sub), platform: 'web' })
  return true
}

/**
 * Explicit opt-in (may show the OS/browser permission prompt). Returns true
 * when a token was registered with the backend.
 */
export async function enablePush(): Promise<boolean> {
  try {
    return isNativePush() ? await registerNative(true) : await subscribeWeb(true)
  } catch (err) {
    console.warn('[push] enablePush failed', err)
    return false
  }
}

/**
 * Silent re-sync on app start: refreshes the stored token only when permission
 * was already granted. Never prompts.
 */
export async function syncPushIfGranted(): Promise<void> {
  try {
    if (isNativePush()) {
      await registerNative(false)
      return
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      await subscribeWeb(false)
    }
  } catch {
    // best-effort
  }
}
