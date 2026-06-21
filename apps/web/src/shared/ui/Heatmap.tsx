/**
 * A reusable GitHub-style contribution graph (잔디).
 *
 * Renders a grid of `weeks` columns × 7 rows (요일), filled column-major so each
 * column is a week. Cell color scales the brand blue by level 0–4:
 *   0 → #EDF1F7 (empty), 1 → #C8E0FA, 2 → #7DB4ED, 3 → #2E86E6, 4 → #1257C4.
 *
 * `days` is consumed newest-last; the last `weeks*7` entries are shown so the
 * most recent activity lands in the bottom-right. Each cell exposes a `title`
 * (and aria-label) for accessibility.
 */

export type HeatmapDay = {
  /** ISO date (YYYY-MM-DD), used for the per-cell title when present. */
  day?: string
  /** Raw completion count for the day (used by the default level mapping). */
  count?: number
  /** Pre-bucketed intensity 0–4. Wins over `count` when provided. */
  level?: number
  /** Boolean done flag (routine strips). Maps done→level 3, else level 0. */
  done?: boolean
}

export const HEATMAP_LEVEL_COLORS = ['#EDF1F7', '#C8E0FA', '#7DB4ED', '#2E86E6', '#1257C4'] as const

type HeatmapProps = {
  days: HeatmapDay[]
  /** Number of week columns to render (default 16). */
  weeks?: number
  /** Pixel size of a cell when not stretching to fill (default: fill width). */
  cellSize?: number
  /** Corner radius for each cell. */
  radius?: number
  /** Custom level resolver; defaults to level → count buckets → done flag. */
  getLevel?: (d: HeatmapDay) => number
  /** Show the 적음 → 많음 legend below the grid. */
  legend?: boolean
  className?: string
}

function defaultGetLevel(d: HeatmapDay): number {
  if (typeof d.level === 'number') return clampLevel(d.level)
  if (typeof d.count === 'number') {
    if (d.count <= 0) return 0
    if (d.count === 1) return 1
    if (d.count <= 3) return 2
    if (d.count <= 6) return 3
    return 4
  }
  if (typeof d.done === 'boolean') return d.done ? 3 : 0
  return 0
}

function clampLevel(n: number): number {
  if (n < 0) return 0
  if (n > 4) return 4
  return Math.round(n)
}

const LEVEL_LABEL = ['활동 없음', '활동 적음', '활동 보통', '활동 많음', '활동 매우 많음']

export function Heatmap({
  days,
  weeks = 16,
  cellSize,
  radius = 3,
  getLevel = defaultGetLevel,
  legend = false,
  className = '',
}: HeatmapProps) {
  const total = weeks * 7
  // Pad the front with empties so partial data still right-aligns to "today".
  const tail = days.slice(-total)
  const padded: (HeatmapDay | null)[] = [
    ...Array.from({ length: Math.max(0, total - tail.length) }, () => null),
    ...tail,
  ]

  const gridStyle: React.CSSProperties = cellSize
    ? {
        display: 'grid',
        gridTemplateColumns: `repeat(${weeks}, ${cellSize}px)`,
        gridTemplateRows: `repeat(7, ${cellSize}px)`,
        gridAutoFlow: 'column',
        gap: 3,
      }
    : {
        display: 'grid',
        gridTemplateColumns: `repeat(${weeks}, 1fr)`,
        gridTemplateRows: 'repeat(7, 1fr)',
        gridAutoFlow: 'column',
        gap: 3,
        width: '100%',
        aspectRatio: `${weeks} / 7`,
      }

  return (
    <div className={className}>
      <div role="img" aria-label={`최근 ${weeks}주 동안의 활동`} style={gridStyle}>
        {padded.map((d, i) => {
          const level = d ? getLevel(d) : 0
          const title = d?.day
            ? `${d.day} · ${LEVEL_LABEL[level]}`
            : LEVEL_LABEL[level]
          return (
            <div
              key={i}
              title={title}
              style={{ borderRadius: radius, background: HEATMAP_LEVEL_COLORS[level] }}
            />
          )
        })}
      </div>

      {legend && (
        <div
          className="flex items-center justify-end"
          style={{ gap: 5, marginTop: 14 }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: '#AEB9CC', marginRight: 2 }}>
            적음
          </span>
          {HEATMAP_LEVEL_COLORS.map((c) => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />
          ))}
          <span style={{ fontSize: 10, fontWeight: 600, color: '#AEB9CC', marginLeft: 2 }}>
            많음
          </span>
        </div>
      )}
    </div>
  )
}
