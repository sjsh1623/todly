/**
 * i18next init. Korean is the default and fallback language; English is wired
 * to fall back to ko until an `en` bundle is added.
 *
 * Import this once at app startup (see main.tsx) before rendering.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ko } from './ko'

void i18n.use(initReactI18next).init({
  resources: {
    ko,
  },
  lng: 'ko',
  fallbackLng: 'ko',
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
