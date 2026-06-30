import { Capacitor } from '@capacitor/core'
import { SignInWithApple, type SignInWithAppleResponse } from '@capacitor-community/apple-sign-in'

/** Web Apple sign-in needs a registered Services ID; native ignores it. */
const SERVICES_ID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined

/**
 * Runs Sign in with Apple and returns the identity token (a JWT) to hand to the
 * backend `/auth/oauth/apple`.
 *
 *  - Native iOS (Capacitor): ASAuthorization sheet. The token's `aud` is the
 *    app bundle id `today.mohe.todly`, which the backend APPLE_CLIENT_ID must
 *    match.
 *  - Web: the plugin's Apple JS flow, which needs a Services ID
 *    (VITE_APPLE_CLIENT_ID) + registered redirect URI.
 */
export async function getAppleIdToken(): Promise<string> {
  if (!Capacitor.isNativePlatform() && !SERVICES_ID) {
    throw new AppleSignInError('WEB_APPLE_UNCONFIGURED')
  }
  const result: SignInWithAppleResponse = await SignInWithApple.authorize({
    // Ignored on native; used as the Services ID on web.
    clientId: SERVICES_ID ?? 'today.mohe.todly',
    redirectURI: typeof window !== 'undefined' ? `${window.location.origin}/todly/login` : '',
    scopes: 'name email',
  })
  const idToken = result.response?.identityToken
  if (!idToken) throw new AppleSignInError('NO_IDENTITY_TOKEN')
  return idToken
}

export class AppleSignInError extends Error {
  constructor(public code: string) {
    super(code)
    this.name = 'AppleSignInError'
  }
}

/** True when the user simply dismissed the Apple sheet (not a real failure). */
export function isAppleCancel(e: unknown): boolean {
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '').toLowerCase()
  const code = String((e as { code?: string | number } | null)?.code ?? '')
  // ASAuthorizationError.canceled == 1001; web popup-closed strings vary.
  return code === '1001' || msg.includes('cancel') || msg.includes('popup') || msg.includes('1001')
}
