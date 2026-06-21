import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../shared/ui'
import { useGroups } from '../groups'
import { useCreateRoutine } from './hooks'
import { serializeWeekdays, WEEKDAY_KEYS } from './recurrence'
import type { RecurFreq } from './types'

type Props = {
  onClose: () => void
  /** Preselect a group (e.g. when launched from a group screen). */
  presetGroupId?: string
}

/** A bottom-sheet to create a routine: title + group + time + recurrence. */
export default function RoutineCreateSheet({ onClose, presetGroupId }: Props) {
  const { t } = useTranslation()
  const { data: groups } = useGroups()
  const createRoutine = useCreateRoutine()

  const [title, setTitle] = useState('')
  const [groupId, setGroupId] = useState(presetGroupId ?? '')
  const [time, setTime] = useState('06:30')
  const [freq, setFreq] = useState<RecurFreq>('daily')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4])

  const toggleDay = (i: number) =>
    setDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]))

  // Esc closes the sheet (WCAG 2.1.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canSubmit = title.trim().length > 0 && !createRoutine.isPending

  const submit = () => {
    if (!canSubmit) return
    createRoutine.mutate(
      {
        groupId: groupId || undefined,
        title: title.trim(),
        recurFreq: freq,
        recurRule: freq === 'weekly' ? serializeWeekdays(days) : undefined,
        timeOfDay: time || undefined,
      },
      { onSuccess: onClose },
    )
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '10px 15px',
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 700,
    background: active ? '#1366CE' : '#F4F7FB',
    color: active ? '#fff' : '#7C8AA0',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(20,35,58,.4)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('routineCreate.title')}
    >
      <div
        className="w-full"
        style={{ maxWidth: 420, background: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: '20px 22px 28px', maxHeight: '88vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E0E6EF', margin: '0 auto 18px' }} aria-hidden="true" />
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', marginBottom: 18 }}>{t('routineCreate.title')}</h2>

        {/* Title */}
        <input
          autoFocus
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('routineCreate.titlePlaceholder')}
          aria-label={t('routineCreate.titleLabel')}
          className="w-full outline-none placeholder:text-[#C2CBD8]"
          style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text)', borderBottom: '2px solid #EDF1F7', paddingBottom: 12, marginBottom: 20 }}
        />

        {/* Group (optional) */}
        {(groups ?? []).length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', marginBottom: 10 }}>{t('routineCreate.groupLabel')}</div>
            <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 20 }} role="radiogroup" aria-label={t('routineCreate.groupAria')}>
              <button type="button" role="radio" aria-checked={groupId === ''} onClick={() => setGroupId('')} style={chip(groupId === '')}>
                {t('routineCreate.personal')}
              </button>
              {(groups ?? []).map((g) => (
                <button key={g.id} type="button" role="radio" aria-checked={groupId === g.id} onClick={() => setGroupId(g.id)} style={chip(groupId === g.id)}>
                  {g.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Time */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', marginBottom: 10 }}>{t('routineCreate.timeLabel')}</div>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label={t('routineCreate.timeLabel')}
          className="outline-none"
          style={{ background: '#F4F7FB', border: '1.5px solid #E6ECF4', borderRadius: 13, padding: '11px 14px', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 20 }}
        />

        {/* Frequency */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', marginBottom: 10 }}>{t('routineCreate.repeatLabel')}</div>
        <div className="flex" style={{ gap: 8, marginBottom: freq === 'weekly' ? 14 : 24 }} role="radiogroup" aria-label={t('routineCreate.repeatAria')}>
          {([
            ['daily', t('routineCreate.freqDaily')],
            ['weekly', t('routineCreate.freqWeekly')],
            ['monthly', t('routineCreate.freqMonthly')],
          ] as [RecurFreq, string][]).map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={freq === value} onClick={() => setFreq(value)} style={chip(freq === value)}>
              {label}
            </button>
          ))}
        </div>

        {freq === 'weekly' && (
          <div className="flex" style={{ gap: 6, marginBottom: 24 }}>
            {WEEKDAY_KEYS.map((key, i) => {
              const label = t(key)
              const on = days.includes(i)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  aria-label={t('routineCreate.weekday', { day: label })}
                  onClick={() => toggleDay(i)}
                  className="flex items-center justify-center focus:outline-none"
                  style={{ width: 32, height: 32, borderRadius: 10, fontSize: 12, fontWeight: 800, background: on ? '#1366CE' : '#EDF1F7', color: on ? '#fff' : '#AEB9CC' }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {createRoutine.isError && (
          <p role="alert" style={{ marginBottom: 14, fontSize: 13, fontWeight: 600, color: 'var(--color-due)' }}>
            {t('routineCreate.error')}
          </p>
        )}

        <Button onClick={submit} disabled={!canSubmit}>
          {createRoutine.isPending ? t('routineCreate.submitting') : t('routineCreate.submit')}
        </Button>
      </div>
    </div>
  )
}
