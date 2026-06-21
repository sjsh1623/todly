import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import i18n from '../shared/i18n/i18n'
import { Button, PushHeader, StatusBar } from '../shared/ui'
import { useGroups } from '../features/groups'
import {
  getTaskErrorMessage,
  useCreateTask,
  useGroupTasks,
} from '../features/tasks'
import type { TaskPriority } from '../features/tasks'
import { useCreateRoutine, serializeWeekdays } from '../features/routines'

const PRIORITIES: { value: TaskPriority; labelKey: string }[] = [
  { value: 'low', labelKey: 'taskCreate.priorityLow' },
  { value: 'medium', labelKey: 'taskCreate.priorityMedium' },
  { value: 'high', labelKey: 'taskCreate.priorityHigh' },
]

type DueMode = 'none' | 'today' | 'tomorrow' | 'date'

/** YYYY-MM-DD for the local day offset from today. */
function isoForOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, i18n.t('taskCreate.titleRequired'))
    .max(120, i18n.t('taskCreate.titleMax')),
  // Optional at the schema level: a routine can be created without a group. The
  // group requirement is enforced for the plain-task path inside onSubmit.
  groupId: z.string().optional(),
  sectionId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
})

type FormValues = z.infer<typeof schema>

const WEEKDAY_KEYS = [
  'taskCreate.weekdayMon',
  'taskCreate.weekdayTue',
  'taskCreate.weekdayWed',
  'taskCreate.weekdayThu',
  'taskCreate.weekdayFri',
  'taskCreate.weekdaySat',
  'taskCreate.weekdaySun',
]

export default function TaskCreate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetGroup = searchParams.get('group') ?? ''
  const presetSection = searchParams.get('section') ?? ''

  const { data: groups } = useGroups()
  const createTask = useCreateTask()
  const createRoutine = useCreateRoutine()

  const [dueMode, setDueMode] = useState<DueMode>('none')
  const [customDate, setCustomDate] = useState('')

  // Routine: when ON, submit creates a routine instead of a plain task.
  const [routineOn, setRoutineOn] = useState(false)
  const [routineDays, setRoutineDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [routineTime, setRoutineTime] = useState('06:30')

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      groupId: presetGroup,
      sectionId: presetSection || undefined,
      priority: 'medium',
    },
  })

  const selectedGroupId = watch('groupId')

  // Section chips come from the selected group's task tree.
  const { data: groupTasks } = useGroupTasks(selectedGroupId || undefined)
  const sections = useMemo(() => groupTasks?.sections ?? [], [groupTasks])

  // If the group changes away from the preset, drop a now-invalid section.
  useEffect(() => {
    const current = watch('sectionId')
    if (current && !sections.some((s) => s.id === current)) {
      setValue('sectionId', undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, sections])

  const dueDate = (): string | undefined => {
    if (dueMode === 'today') return isoForOffset(0)
    if (dueMode === 'tomorrow') return isoForOffset(1)
    if (dueMode === 'date') return customDate || undefined
    return undefined
  }

  const toggleRoutineDay = (i: number) =>
    setRoutineDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]))

  const onSubmit = handleSubmit((values) => {
    // Routine toggle ON → create a repeating routine (no plain task). Weekly when
    // a weekday subset is chosen, daily when all 7 are selected.
    if (routineOn) {
      const allDays = routineDays.length === 7
      createRoutine.mutate(
        {
          groupId: values.groupId || undefined,
          sectionId: values.sectionId || undefined,
          title: values.title.trim(),
          recurFreq: allDays ? 'daily' : 'weekly',
          recurRule: allDays ? undefined : serializeWeekdays(routineDays),
          timeOfDay: routineTime || undefined,
        },
        { onSuccess: () => navigate('/routine') },
      )
      return
    }

    // Routine OFF → plain task. A group is required here.
    if (!values.groupId) {
      setError('groupId', { type: 'manual', message: t('taskCreate.groupRequired') })
      return
    }
    createTask.mutate(
      {
        groupId: values.groupId,
        sectionId: values.sectionId || undefined,
        title: values.title.trim(),
        priority: values.priority,
        dueDate: dueDate(),
      },
      {
        onSuccess: (task) => navigate(`/groups/${task.groupId}`),
      },
    )
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    color: '#7C8AA0',
    margin: '0 0 11px 2px',
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fff' }}>
      <StatusBar />
      <PushHeader title={t('taskCreate.header')} onBack={() => navigate(-1)} />

      <form onSubmit={onSubmit} className="flex-1 flex flex-col">
        <div style={{ padding: '14px 22px 24px' }}>
          {/* Title */}
          <div style={{ borderBottom: '2px solid #EDF1F7', paddingBottom: 16, marginBottom: 24 }}>
            <input
              autoFocus
              maxLength={120}
              placeholder={t('taskCreate.titlePlaceholder')}
              aria-label={t('taskCreate.titleAria')}
              aria-invalid={errors.title ? true : undefined}
              className="w-full bg-transparent outline-none placeholder:text-[#C2CBD8]"
              style={{ fontSize: 23, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.4px' }}
              {...register('title')}
            />
            {errors.title && (
              <p role="alert" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}>
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Group chips */}
          <div style={labelStyle}>{t('taskCreate.group')}</div>
          <Controller
            control={control}
            name="groupId"
            render={({ field }) => (
              <div role="radiogroup" aria-label={t('taskCreate.group')} className="flex flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
                {(groups ?? []).map((g) => {
                  const selected = field.value === g.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(g.id)}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      style={{
                        padding: '10px 15px',
                        borderRadius: 14,
                        fontSize: 13,
                        fontWeight: 700,
                        background: selected ? '#1366CE' : '#F4F7FB',
                        color: selected ? '#fff' : '#7C8AA0',
                      }}
                    >
                      {g.name}
                    </button>
                  )
                })}
                {groups && groups.length === 0 && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)' }}>
                    {t('taskCreate.noGroups')}
                  </span>
                )}
              </div>
            )}
          />
          {errors.groupId && (
            <p role="alert" style={{ margin: '0 0 8px 2px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}>
              {errors.groupId.message}
            </p>
          )}
          <div style={{ height: 16 }} />

          {/* Section (list) chips */}
          {sections.length > 0 && (
            <>
              <div style={labelStyle}>{t('taskCreate.list')}</div>
              <Controller
                control={control}
                name="sectionId"
                render={({ field }) => (
                  <div role="radiogroup" aria-label={t('taskCreate.list')} className="flex flex-wrap" style={{ gap: 8, marginBottom: 24 }}>
                    {sections.map((s) => {
                      const selected = field.value === s.id
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => field.onChange(selected ? undefined : s.id)}
                          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          style={{
                            padding: '10px 15px',
                            borderRadius: 14,
                            fontSize: 13,
                            fontWeight: selected ? 800 : 700,
                            background: selected ? '#EAF2FE' : '#F4F7FB',
                            color: selected ? '#1366CE' : '#7C8AA0',
                          }}
                        >
                          {s.title}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            </>
          )}

          {/* Due date quick options */}
          <div className="flex items-center" style={{ gap: 7, margin: '0 0 11px 2px' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0' }}>{t('taskCreate.dueDate')}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#AEB9CC', background: '#F0F3F8', padding: '3px 8px', borderRadius: 8 }}>
              {t('taskCreate.optional')}
            </span>
          </div>
          <div role="radiogroup" aria-label={t('taskCreate.dueDate')} className="flex flex-wrap" style={{ gap: 7, marginBottom: dueMode === 'date' ? 12 : 24 }}>
            {([
              ['none', t('taskCreate.dueNone')],
              ['today', t('taskCreate.dueToday')],
              ['tomorrow', t('taskCreate.dueTomorrow')],
              ['date', t('taskCreate.dueDateOption')],
            ] as [DueMode, string][]).map(([mode, label]) => {
              const selected = dueMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDueMode(mode)}
                  className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{
                    gap: 5,
                    padding: '10px 14px',
                    borderRadius: 13,
                    fontSize: 12.5,
                    fontWeight: 700,
                    background: selected ? '#14233A' : '#F4F7FB',
                    color: selected ? '#fff' : '#7C8AA0',
                  }}
                >
                  {mode === 'date' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selected ? '#fff' : '#7C8AA0'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="16" rx="3" />
                      <path d="M3 9h18M8 3v4M16 3v4" />
                    </svg>
                  )}
                  {label}
                </button>
              )
            })}
          </div>
          {dueMode === 'date' && (
            <input
              type="date"
              aria-label={t('taskCreate.dueDateAria')}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full outline-none"
              style={{
                background: '#F4F7FB',
                border: '1.5px solid #E6ECF4',
                borderRadius: 13,
                padding: '12px 14px',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text)',
                marginBottom: 24,
              }}
            />
          )}

          {/* Priority segmented */}
          <div style={labelStyle}>{t('taskCreate.priority')}</div>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <div role="radiogroup" aria-label={t('taskCreate.priority')} className="flex" style={{ background: '#F4F7FB', borderRadius: 15, padding: 4, marginBottom: 24 }}>
                {PRIORITIES.map((p) => {
                  const selected = field.value === p.value
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(p.value)}
                      className="flex-1 text-center focus:outline-none"
                      style={{
                        padding: '10px 0',
                        fontSize: 13,
                        fontWeight: selected ? 800 : 700,
                        color: selected ? '#1366CE' : '#9AA7BC',
                        background: selected ? '#fff' : 'transparent',
                        borderRadius: 12,
                        boxShadow: selected ? '0 3px 10px rgba(20,50,90,.07)' : undefined,
                      }}
                    >
                      {t(p.labelKey)}
                    </button>
                  )
                })}
              </div>
            )}
          />

          {/* Routine block — UI only. PHASE 7 deferral note shown when on. */}
          <div style={{ background: '#F8FAFD', borderRadius: 18, padding: '6px 16px' }}>
            <div className="flex items-center justify-between" style={{ padding: '13px 0', borderBottom: routineOn ? '1px solid #EDF1F7' : 'none' }}>
              <div className="flex items-center" style={{ gap: 11 }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
                  <path d="M17.4 3.7v3.4h-3.4" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{t('taskCreate.repeatAsRoutine')}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={routineOn}
                aria-label={t('taskCreate.repeatAsRoutine')}
                onClick={() => setRoutineOn((v) => !v)}
                className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                style={{ width: 46, height: 27, borderRadius: 14, background: routineOn ? '#1366CE' : '#DDE3EC' }}
              >
                <span
                  className="absolute"
                  style={{
                    top: 3,
                    left: routineOn ? 22 : 3,
                    width: 21,
                    height: 21,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 2px 5px rgba(0,0,0,.18)',
                    transition: 'left .15s ease',
                  }}
                />
              </button>
            </div>

            {routineOn && (
              <>
                <div className="flex items-center justify-between" style={{ padding: '13px 0', borderBottom: '1px solid #EDF1F7' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{t('taskCreate.repeatDays')}</span>
                  <div className="flex" style={{ gap: 5 }}>
                    {WEEKDAY_KEYS.map((key, i) => {
                      const label = t(key)
                      const on = routineDays.includes(i)
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={on}
                          aria-label={t('taskCreate.weekdayAria', { day: label })}
                          onClick={() => toggleRoutineDay(i)}
                          className="flex items-center justify-center focus:outline-none"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 9,
                            fontSize: 11,
                            fontWeight: 800,
                            background: on ? '#1366CE' : '#EDF1F7',
                            color: on ? '#fff' : '#AEB9CC',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between" style={{ padding: '13px 0' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{t('taskCreate.time')}</span>
                  <input
                    type="time"
                    value={routineTime}
                    onChange={(e) => setRoutineTime(e.target.value)}
                    aria-label={t('taskCreate.routineTimeAria')}
                    className="outline-none"
                    style={{ background: '#fff', border: '1.5px solid #E6ECF4', borderRadius: 11, padding: '8px 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}
                  />
                </div>
              </>
            )}
          </div>

          {(createTask.isError || createRoutine.isError) && (
            <p role="alert" style={{ marginTop: 16, fontSize: 13, fontWeight: 600, color: 'var(--color-due)' }}>
              {getTaskErrorMessage(createTask.error ?? createRoutine.error)}
            </p>
          )}
        </div>

        <div style={{ marginTop: 'auto', padding: '14px 22px 26px', background: 'linear-gradient(180deg,rgba(255,255,255,0),#fff 30%)' }}>
          <Button type="submit" disabled={createTask.isPending || createRoutine.isPending} style={{ boxShadow: '0 10px 24px rgba(19,102,206,.26)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" style={{ marginRight: 8 }}>
              <path d="M12 6v12M6 12h12" />
            </svg>
            {createTask.isPending || createRoutine.isPending
              ? t('taskCreate.submitting')
              : routineOn
                ? t('taskCreate.submitRoutine')
                : t('taskCreate.submitTask')}
          </Button>
        </div>
      </form>
    </div>
  )
}
