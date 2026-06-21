import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar, PushHeader, StatusBar } from '../shared/ui'
import type { Language } from '../shared/i18n/i18n'
import { useAuthStore, useLogout } from '../features/auth'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import { useUpdateMe } from '../features/settings'
import {
  THEME_META,
  THEME_NAMES,
  applyTheme,
  normalizeTheme,
  type ThemeName,
} from '../features/settings/theme'

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ width: 46, height: 27, borderRadius: 14, background: on ? 'var(--color-primary-strong)' : '#DDE3EC', flex: 'none' }}
    >
      <span
        className="absolute"
        style={{
          top: 3,
          left: on ? 22 : 3,
          width: 21,
          height: 21,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 5px rgba(0,0,0,.18)',
          transition: 'left .15s ease',
        }}
      />
    </button>
  )
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBD8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const updateMe = useUpdateMe()
  const logout = useLogout()

  // Switch language instantly, then persist to the user so it survives reloads.
  const selectLanguage = (next: Language) => {
    if (i18n.language === next) return
    void i18n.changeLanguage(next)
    updateMe.mutate({ language: next })
  }

  const theme = normalizeTheme(user?.theme)
  const darkMode = Boolean(user?.darkMode)

  // Optimistically recolor the app instantly, then persist via PATCH /me.
  const selectTheme = (next: ThemeName) => {
    if (next === theme) return
    applyTheme(next, darkMode)
    updateMe.mutate({ theme: next })
  }

  const toggleDark = () => {
    const next = !darkMode
    applyTheme(theme, next)
    updateMe.mutate({ darkMode: next })
  }

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader title={t('settings.title')} onBack={() => navigate(-1)} />

      <div style={{ padding: '8px 22px 40px' }}>
        {/* Profile row → account/edit */}
        <button
          type="button"
          onClick={() => navigate('/settings/account')}
          className="w-full flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ background: 'var(--color-card)', borderRadius: 20, padding: '14px 16px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', gap: 13, marginBottom: 22 }}
        >
          {user && (
            <Avatar initial={user.nickname.charAt(0) || '?'} color={PROFILE_COLOR_TO_AVATAR[user.profileColor]} size={48} gradient />
          )}
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: 'var(--color-text)' }}>{user?.nickname ?? t('settings.profileFallback')}</span>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)' }}>@{user?.username} · {t('settings.editProfile')}</span>
          </span>
          <Chevron />
        </button>

        {/* 테마 색상 */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 4px' }}>{t('settings.themeColor')}</div>
        <div style={{ background: 'var(--color-card)', borderRadius: 22, padding: '20px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', marginBottom: 22 }}>
          <div role="radiogroup" aria-label={t('settings.themeColor')} className="flex justify-between">
            {THEME_NAMES.map((name) => {
              const meta = THEME_META[name]
              const label = t(`theme.${name}`)
              const selected = name === theme
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={label}
                  onClick={() => selectTheme(name)}
                  className="flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
                  style={{ gap: 9, padding: 2 }}
                >
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: '50%',
                      background: meta.swatch,
                      boxShadow: selected ? `0 0 0 3px var(--color-card),0 0 0 5px ${meta.swatch}` : undefined,
                    }}
                  >
                    {selected && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 6.5" />
                      </svg>
                    )}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: selected ? 800 : 600, color: selected ? 'var(--color-text)' : 'var(--color-text-subtle)' }}>{label}</span>
                </button>
              )
            })}
          </div>

          {/* Live preview using the active primary */}
          <div className="flex" style={{ gap: 9, marginTop: 20, paddingTop: 18, borderTop: '1px solid #F0F3F8' }}>
            <div className="flex items-center justify-center" style={{ flex: 1, height: 42, borderRadius: 14, background: 'var(--color-primary-strong)', color: '#fff', fontSize: 13, fontWeight: 800 }}>{t('settings.preview')}</div>
            <div className="flex items-center" style={{ height: 42, padding: '0 16px', borderRadius: 14, background: 'var(--color-primary-tint)', color: 'var(--color-primary-strong)', fontSize: 13, fontWeight: 800 }}>{t('settings.badge')}</div>
            <div className="flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--color-primary-tint)' }} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-strong)" strokeWidth={2.2} strokeLinecap="round">
                <path d="M12 6v12M6 12h12" />
              </svg>
            </div>
          </div>
        </div>

        {/* 환경설정 */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 4px' }}>{t('settings.preferences')}</div>
        <div style={{ background: 'var(--color-card)', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', marginBottom: 22 }}>
          <div className="flex items-center justify-between" style={{ padding: '15px 0', borderBottom: '1px solid #F0F3F8' }}>
            <span className="flex items-center" style={{ gap: 12 }}>
              <span className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: '#EEF2F7' }} aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#14233A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{t('settings.darkMode')}</span>
            </span>
            <Toggle on={darkMode} onClick={toggleDark} label={t('settings.darkMode')} />
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings/notifications')}
            className="w-full flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ padding: '15px 0' }}
          >
            <span className="flex items-center" style={{ gap: 12 }}>
              <span className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF1E6' }} aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E07B2E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
                  <path d="M10 19a2 2 0 0 0 4 0" />
                </svg>
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{t('settings.notifications')}</span>
            </span>
            <Chevron />
          </button>
        </div>

        {/* 계정 group */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 4px' }}>{t('settings.account')}</div>
        <div style={{ background: 'var(--color-card)', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', marginBottom: 22 }}>
          <button
            type="button"
            onClick={() => navigate('/settings/account')}
            className="w-full flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ padding: '15px 0', borderBottom: '1px solid #F0F3F8' }}
          >
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{t('settings.account')}</span>
            <Chevron />
          </button>
          <div className="flex items-center justify-between" style={{ padding: '15px 0', borderBottom: '1px solid #F0F3F8' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{t('settings.language')}</span>
            <span role="radiogroup" aria-label={t('settings.language')} className="flex items-center" style={{ gap: 4, background: '#EEF2F7', borderRadius: 12, padding: 3 }}>
              {(['ko', 'en'] as const).map((lng) => {
                const active = i18n.language === lng
                return (
                  <button
                    key={lng}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => selectLanguage(lng)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 9,
                      fontSize: 12.5,
                      fontWeight: 800,
                      background: active ? 'var(--color-card)' : 'transparent',
                      color: active ? 'var(--color-primary-strong)' : 'var(--color-text-subtle)',
                      boxShadow: active ? '0 2px 6px rgba(17,40,86,.1)' : undefined,
                    }}
                  >
                    {t(lng === 'ko' ? 'settings.languageKo' : 'settings.languageEn')}
                  </button>
                )
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings/help')}
            className="w-full flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ padding: '15px 0' }}
          >
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{t('settings.help')}</span>
            <Chevron />
          </button>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          className="w-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          style={{ height: 52, borderRadius: 16, background: 'var(--color-card)', boxShadow: '0 5px 16px rgba(17,40,86,.05)', color: '#FF6B6B', fontSize: 14.5, fontWeight: 800 }}
        >
          {logout.isPending ? t('settings.loggingOut') : t('settings.logout')}
        </button>
      </div>
    </div>
  )
}
