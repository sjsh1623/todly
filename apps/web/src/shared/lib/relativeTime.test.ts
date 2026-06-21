import { describe, it, expect } from 'vitest'
import { relativeTime } from './relativeTime'

describe('relativeTime', () => {
  const now = new Date('2026-06-20T12:00:00')

  it('returns 방금 for under a minute', () => {
    expect(relativeTime('2026-06-20T11:59:30', now)).toBe('방금')
  })

  it('returns N분 전 for minutes', () => {
    expect(relativeTime('2026-06-20T11:48:00', now)).toBe('12분 전')
  })

  it('returns N시간 전 for same-day hours', () => {
    expect(relativeTime('2026-06-20T07:00:00', now)).toBe('5시간 전')
  })

  it('returns 어제 · HH:mm for yesterday', () => {
    expect(relativeTime('2026-06-19T18:40:00', now)).toBe('어제 · 18:40')
  })

  it('returns 월 일 for older dates', () => {
    expect(relativeTime('2026-06-03T09:00:00', now)).toBe('6월 3일')
  })

  it('returns empty string for an invalid date', () => {
    expect(relativeTime('garbage', now)).toBe('')
  })
})
