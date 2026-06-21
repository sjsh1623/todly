import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, Heatmap, PushHeader } from '../shared/ui'
import { useRoutineConsistency, useStats } from '../features/stats'
import type { RoutineConsistency } from '../features/stats'
import { recurrenceLabel, formatTimeOfDay } from '../features/routines/recurrence'

/** "{recurrence} {time}" — e.g. "매일 6:30". */
function metaLine(r: RoutineConsistency): string {
  const rec = recurrenceLabel(r.recurFreq, r.recurRule)
  const time = formatTimeOfDay(r.timeOfDay)
  return time ? `${rec} ${time}` : rec
}

function RoutineRow({ r }: { r: RoutineConsistency }) {
  const { t } = useTranslation()
  return (
    <Card style={{ borderRadius: 20, padding: 16, marginBottom: 14 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 14 }}>
        <span
          className="flex items-center justify-center"
          style={{ width: 40, height: 40, borderRadius: 13, background: '#E2F8F4', flex: 'none' }}
          aria-hidden="true"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#159B89" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="truncate" style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>
            {r.title}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9AA7BC' }}>{metaLine(r)}</div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#159B89',
            background: '#E2F8F4',
            padding: '6px 11px',
            borderRadius: 11,
            flex: 'none',
          }}
        >
          {t('consistency.streakDays', { count: r.streak.current })}
        </div>
      </div>
      <Heatmap days={r.heatmap ?? []} weeks={14} radius={2.5} />
    </Card>
  )
}

export default function Consistency() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const stats = useStats()
  const routines = useRoutineConsistency()

  const yearly = stats.data?.yearlyCount ?? 0
  const best = stats.data?.bestStreak ?? 0

  return (
    <div>
      <PushHeader title={t('consistency.heading')} onBack={() => navigate(-1)} />
      <div style={{ padding: '8px 22px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#9AA7BC', marginBottom: 4 }}>
          {t('consistency.perRoutine')}
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.3px', marginBottom: 18 }}>
          {t('consistency.summary', { yearly, best })}
        </div>

        {routines.isLoading && (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9AA7BC' }}>{t('consistency.loading')}</div>
        )}
        {routines.data?.length === 0 && (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9AA7BC' }}>{t('consistency.empty')}</div>
        )}
        {routines.data?.map((r) => <RoutineRow key={r.id} r={r} />)}
      </div>
    </div>
  )
}
