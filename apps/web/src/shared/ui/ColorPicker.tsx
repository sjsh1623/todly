import { useTranslation } from 'react-i18next'
import type { ProfileColor } from '../../features/auth/types'

type Swatch = { value: ProfileColor; color: string }

const SWATCHES: Swatch[] = [
  { value: 'blue', color: '#2E86E6' },
  { value: 'green', color: '#2BC4B0' },
  { value: 'orange', color: '#FF9D52' },
  { value: 'purple', color: '#6B5BD0' },
]

type ColorPickerProps = {
  value: ProfileColor
  onChange: (value: ProfileColor) => void
}

/** Single-select profile color swatches. The selected swatch gets a ring. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t } = useTranslation()
  const LABELS: Record<ProfileColor, string> = {
    blue: t('colorPicker.blue'),
    green: t('colorPicker.green'),
    orange: t('colorPicker.orange'),
    purple: t('colorPicker.purple'),
  }
  return (
    <div role="radiogroup" aria-label={t('colorPicker.label')} className="flex" style={{ gap: 9 }}>
      {SWATCHES.map((s) => {
        const selected = s.value === value
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={LABELS[s.value]}
            onClick={() => onChange(s.value)}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: s.color,
              border: selected ? '2.5px solid #1366CE' : '2.5px solid transparent',
              boxShadow: selected ? '0 0 0 3px #fff inset' : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
