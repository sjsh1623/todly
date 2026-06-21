import { describe, it, expect } from 'vitest'
import { elapsedSeconds, formatElapsed, formatElapsedSince, formatStopwatch } from './elapsed'

describe('elapsedSeconds', () => {
  const start = '2026-06-20T10:00:00.000Z'
  const startMs = new Date(start).getTime()

  it('computes whole seconds since start', () => {
    expect(elapsedSeconds(start, 0, startMs + 90_000)).toBe(90)
  })

  it('subtracts paused seconds', () => {
    expect(elapsedSeconds(start, 30, startMs + 90_000)).toBe(60)
  })

  it('clamps negatives to 0 (clock skew)', () => {
    expect(elapsedSeconds(start, 0, startMs - 5_000)).toBe(0)
  })

  it('returns 0 for an invalid date', () => {
    expect(elapsedSeconds('not-a-date')).toBe(0)
  })
})

describe('formatElapsed', () => {
  it('formats sub-minute as 방금 전', () => {
    expect(formatElapsed(0)).toBe('방금 전')
    expect(formatElapsed(59)).toBe('방금 전')
  })
  it('formats minutes', () => {
    expect(formatElapsed(60)).toBe('1분')
    expect(formatElapsed(59 * 60)).toBe('59분')
  })
  it('formats hours and minutes', () => {
    expect(formatElapsed(3600)).toBe('1시간')
    expect(formatElapsed(3600 + 25 * 60)).toBe('1시간 25분')
  })
})

describe('formatElapsedSince', () => {
  it('uses the 시작 suffix', () => {
    expect(formatElapsedSince(30)).toBe('방금 시작')
    expect(formatElapsedSince(120)).toBe('2분 전 시작')
  })
})

describe('formatStopwatch', () => {
  it('formats mm:ss under an hour', () => {
    expect(formatStopwatch(65)).toBe('01:05')
  })
  it('formats h:mm:ss over an hour', () => {
    expect(formatStopwatch(3661)).toBe('1:01:01')
  })
})
