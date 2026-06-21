import { api } from '../../shared/lib/api'

export type DevicePlatform = 'web' | 'ios' | 'android'

export type RegisterTokenInput = {
  /** A native FCM/APNs token, or the JSON-stringified web PushSubscription. */
  token: string
  platform: DevicePlatform
}

/** Registers (or refreshes) this device's push token with the backend. */
export async function registerDeviceToken(input: RegisterTokenInput): Promise<void> {
  await api.post('/me/push-subscription', input)
}
