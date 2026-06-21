import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-bg flex justify-center">
      <a href="#main-content" className="tdl-skip-link">
        {t('common.skipToContent')}
      </a>
      <div className="relative w-full max-w-[420px] min-h-screen bg-bg pb-[92px]">
        <main id="main-content">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
