/**
 * i18next init. Korean is the default + fallback; English is a full bundle.
 *
 * Keys are FLAT dotted strings, so keySeparator/nsSeparator are disabled — this
 * lets each component own a `<namespace>.<key>` space that merges cleanly.
 *
 * The active language is persisted on the user (settings.language) and mirrored
 * into the zustand auth store ('todly-auth'). On startup we read that store so a
 * reload keeps the user's chosen language; we also keep <html lang> in sync.
 *
 * Import this once at app startup (see main.tsx) before rendering.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ko } from './ko'
import { en } from './en'

export const SUPPORTED_LANGUAGES = ['ko', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

/** Reads the persisted language from the auth store, falling back to 'ko'. */
function storedLanguage(): Language {
  try {
    const raw = localStorage.getItem('todly-auth')
    const lng = raw ? JSON.parse(raw)?.state?.user?.language : null
    return SUPPORTED_LANGUAGES.includes(lng) ? lng : 'ko'
  } catch {
    return 'ko'
  }
}

void i18n.use(initReactI18next).init({
  resources: { ko, en },
  lng: storedLanguage(),
  fallbackLng: 'ko',
  defaultNS: 'translation',
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
})

// Keep the document language attribute in sync for a11y / browser features.
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
}

export default i18n
