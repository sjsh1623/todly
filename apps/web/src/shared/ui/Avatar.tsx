type AvatarColor = 'blue' | 'mint' | 'orange' | 'purple'

const colorMap: Record<AvatarColor, string> = {
  blue: 'var(--avatar-blue)',
  mint: 'var(--avatar-mint)',
  orange: 'var(--avatar-orange)',
  purple: 'var(--avatar-purple)',
}

const gradientMap: Record<AvatarColor, string> = {
  blue: 'linear-gradient(140deg,#5FE3F0,#2E86E6)',
  mint: 'linear-gradient(140deg,#7FF0E0,#2BC4B0)',
  orange: 'linear-gradient(140deg,#FFC58C,#FF9D52)',
  purple: 'linear-gradient(140deg,#9C8DF0,#6B5BD0)',
}

type AvatarProps = {
  initial: string
  color?: AvatarColor
  size?: number
  /** Use the brand gradient fill instead of a flat color. */
  gradient?: boolean
}

export function Avatar({ initial, color = 'blue', size = 40, gradient = false }: AvatarProps) {
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold select-none"
      style={{
        width: size,
        height: size,
        background: gradient ? gradientMap[color] : colorMap[color],
        fontSize: size * 0.42,
        boxShadow: gradient ? '0 10px 24px rgba(19,102,206,.26)' : undefined,
      }}
    >
      {initial}
    </div>
  )
}
