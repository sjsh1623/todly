import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Button, PushHeader, StatusBar, TextField } from '../shared/ui'
import { getGroupErrorMessage, useCreateGroup } from '../features/groups'
import type { GroupType } from '../features/groups'
import i18n from '../shared/i18n/i18n'

const COLORS = ['#1366CE', '#0FB5A0', '#6B5BD0', '#FF7A6B', '#FF9D52'] as const

const TYPES: { value: GroupType; labelKey: string }[] = [
  { value: 'group', labelKey: 'groupCreate.typeGroup' },
  { value: 'couple', labelKey: 'groupCreate.typeCouple' },
  { value: 'travel', labelKey: 'groupCreate.typeTravel' },
  { value: 'list', labelKey: 'groupCreate.typeList' },
]

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, i18n.t('groupCreate.nameRequired'))
    .max(60, i18n.t('groupCreate.nameMax')),
  type: z.enum(['group', 'couple', 'travel', 'list']),
  color: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

export default function GroupCreate() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const createGroup = useCreateGroup()

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'group', color: COLORS[0] },
  })

  const nameLength = watch('name').length

  const onSubmit = handleSubmit((values) => {
    createGroup.mutate(
      { name: values.name.trim(), type: values.type, color: values.color },
      {
        // Pass the created code via location state so detail can surface invite UX.
        onSuccess: (group) => navigate(`/groups/${group.id}`, { state: { justCreated: true } }),
      },
    )
  })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader title={t('groupCreate.title')} onBack={() => navigate('/groups')} />

      <form onSubmit={onSubmit} className="flex-1 flex flex-col">
        <div style={{ padding: '14px 22px 24px' }}>
          {/* Group icon badge (decorative, matches SCR-17). */}
          <div className="flex justify-center" style={{ marginBottom: 26 }}>
            <div
              className="relative flex items-center justify-center"
              style={{ width: 78, height: 78, borderRadius: 26, background: '#EAF2FE' }}
              aria-hidden="true"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21V8l9-5 9 5v13" />
                <path d="M9 21v-6h6v6" />
              </svg>
            </div>
          </div>

          <TextField
            label={t('groupCreate.nameLabel')}
            placeholder={t('groupCreate.namePlaceholder')}
            autoFocus
            maxLength={60}
            error={errors.name?.message}
            labelAccessory={
              <span style={{ fontSize: 12, fontWeight: 700, color: '#AEB9CC' }}>{nameLength}/60</span>
            }
            className="mb-6"
            {...register('name')}
          />

          {/* Type chips */}
          <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 2px' }}>
            {t('groupCreate.typeLabel')}
          </div>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div role="radiogroup" aria-label={t('groupCreate.typeLabel')} className="flex flex-wrap" style={{ gap: 8, marginBottom: 24 }}>
                {TYPES.map((item) => {
                  const selected = field.value === item.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(item.value)}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      style={{
                        padding: '10px 18px',
                        borderRadius: 14,
                        fontSize: 13.5,
                        fontWeight: 800,
                        background: selected ? '#1366CE' : '#fff',
                        color: selected ? '#fff' : 'var(--color-text-muted)',
                        border: `1.5px solid ${selected ? '#1366CE' : '#E6ECF4'}`,
                      }}
                    >
                      {t(item.labelKey)}
                    </button>
                  )
                })}
              </div>
            )}
          />

          {/* Color picker */}
          <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 2px' }}>
            {t('groupCreate.colorLabel')}
          </div>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <div role="radiogroup" aria-label={t('groupCreate.colorLabel')} className="flex" style={{ gap: 12, marginBottom: 22 }}>
                {COLORS.map((c) => {
                  const selected = field.value === c
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={t('groupCreate.colorOption', { color: c })}
                      onClick={() => field.onChange(c)}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: c,
                        boxShadow: selected ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : undefined,
                      }}
                    />
                  )
                })}
              </div>
            )}
          />

          {/* After creating, the next screen surfaces both an invite link and a
              "친구 초대" action to pick friends directly. */}
          <div
            className="flex items-start"
            style={{ gap: 10, background: '#EAF2FE', borderRadius: 16, padding: 14 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1257C4', lineHeight: 1.5 }}>
              {t('groupCreate.inviteHint')}
            </p>
          </div>

          {createGroup.isError && (
            <p role="alert" style={{ marginTop: 16, fontSize: 13, fontWeight: 600, color: 'var(--color-due)' }}>
              {getGroupErrorMessage(createGroup.error)}
            </p>
          )}
        </div>

        <div style={{ marginTop: 'auto', padding: '14px 22px 26px' }}>
          <Button type="submit" disabled={createGroup.isPending} style={{ boxShadow: '0 10px 24px rgba(19,102,206,.26)' }}>
            {createGroup.isPending ? t('groupCreate.creating') : t('groupCreate.title')}
          </Button>
        </div>
      </form>
    </div>
  )
}
