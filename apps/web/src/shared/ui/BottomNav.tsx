import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Tab = {
  to: string
  /** i18n key under `nav.*`. */
  labelKey: string
  icon: React.ReactNode
  end?: boolean
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 24,
  height: 24,
}

const tabs: Tab[] = [
  {
    to: '/',
    labelKey: 'nav.home',
    end: true,
    icon: (
      <svg {...iconProps}>
        <path d="M3.5 11.5 12 4l8.5 7.5" />
        <path d="M5.6 10v9.4h12.8V10" />
      </svg>
    ),
  },
  {
    to: '/groups',
    labelKey: 'nav.groups',
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="4" width="6.4" height="6.4" rx="2" />
        <rect x="13.6" y="4" width="6.4" height="6.4" rx="2" />
        <rect x="4" y="13.6" width="6.4" height="6.4" rx="2" />
        <rect x="13.6" y="13.6" width="6.4" height="6.4" rx="2" />
      </svg>
    ),
  },
  {
    to: '/activity',
    labelKey: 'nav.activity',
    icon: (
      <svg {...iconProps}>
        <path d="M3 12h3.4l2.2-6 3.6 12 2.2-6H21" />
      </svg>
    ),
  },
  {
    to: '/routine',
    labelKey: 'nav.routine',
    icon: (
      <svg {...iconProps}>
        <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
        <path d="M17.4 3.7v3.4h-3.4" />
      </svg>
    ),
  },
  {
    to: '/profile',
    labelKey: 'nav.profile',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="8.4" r="3.4" />
        <path d="M5.5 19.6c0-3.5 2.9-5.6 6.5-5.6s6.5 2.1 6.5 5.6" />
      </svg>
    ),
  },
]

export function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('nav.primary')}
      className="absolute bottom-0 left-0 right-0 h-[92px] flex items-start justify-around px-2 pt-2 border-t"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        borderColor: 'rgba(17,40,86,0.06)',
      }}
    >
      {tabs.map((tab) => {
        const label = t(tab.labelKey)
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            aria-label={label}
            className="flex flex-1 flex-col items-center gap-1 pt-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={({ isActive }) => ({ color: isActive ? '#1366CE' : '#AEB9CC' })}
          >
            {({ isActive }) => (
              <>
                <span aria-hidden="true" aria-current={isActive ? 'page' : undefined}>
                  {tab.icon}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700 }} aria-current={isActive ? 'page' : undefined}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
