import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Heatmap, HEATMAP_LEVEL_COLORS } from './Heatmap'
import type { HeatmapDay } from './Heatmap'

/** Pull the rgb background of the last (most-recent) cell. */
function lastCellColor(container: HTMLElement): string {
  const grid = container.querySelector('[role="img"]') as HTMLElement
  const cells = grid.children
  const last = cells[cells.length - 1] as HTMLElement
  return last.style.background || last.style.backgroundColor
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

describe('Heatmap level bucketing', () => {
  const render1 = (day: HeatmapDay) =>
    render(<Heatmap weeks={1} days={[day]} />)

  it('count 0 -> level 0 (empty color)', () => {
    const { container } = render1({ count: 0 })
    expect(lastCellColor(container)).toBe(hexToRgb(HEATMAP_LEVEL_COLORS[0]))
  })

  it('count 1 -> level 1', () => {
    const { container } = render1({ count: 1 })
    expect(lastCellColor(container)).toBe(hexToRgb(HEATMAP_LEVEL_COLORS[1]))
  })

  it('count 3 -> level 2', () => {
    const { container } = render1({ count: 3 })
    expect(lastCellColor(container)).toBe(hexToRgb(HEATMAP_LEVEL_COLORS[2]))
  })

  it('count 6 -> level 3', () => {
    const { container } = render1({ count: 6 })
    expect(lastCellColor(container)).toBe(hexToRgb(HEATMAP_LEVEL_COLORS[3]))
  })

  it('count 99 -> level 4 (max)', () => {
    const { container } = render1({ count: 99 })
    expect(lastCellColor(container)).toBe(hexToRgb(HEATMAP_LEVEL_COLORS[4]))
  })

  it('explicit level wins over count and is clamped', () => {
    const { container } = render1({ level: 9, count: 0 })
    expect(lastCellColor(container)).toBe(hexToRgb(HEATMAP_LEVEL_COLORS[4]))
  })

  it('done flag maps to level 3', () => {
    const { container } = render1({ done: true })
    expect(lastCellColor(container)).toBe(hexToRgb(HEATMAP_LEVEL_COLORS[3]))
  })

  it('exposes an accessible label', () => {
    const { getByRole } = render(<Heatmap weeks={4} days={[]} />)
    expect(getByRole('img')).toHaveAttribute('aria-label', '최근 4주 동안의 활동')
  })
})
