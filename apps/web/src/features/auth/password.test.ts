import { describe, it, expect } from 'vitest'
import { getPasswordStrength } from './password'

describe('getPasswordStrength', () => {
  it('rates short passwords as weak', () => {
    expect(getPasswordStrength('').level).toBe('weak')
    expect(getPasswordStrength('abc').level).toBe('weak')
    expect(getPasswordStrength('1234567').level).toBe('weak')
  })

  it('rates an 8+ char password with 2 classes as medium', () => {
    expect(getPasswordStrength('abcd1234').level).toBe('medium')
    expect(getPasswordStrength('Abcdefgh').level).toBe('medium')
  })

  it('rates a long password with 3+ classes as strong', () => {
    expect(getPasswordStrength('Abcd1234!x').level).toBe('strong')
    expect(getPasswordStrength('Sup3rSecret!').level).toBe('strong')
  })

  it('does not reach strong without enough length even with many classes', () => {
    // 9 chars, 4 classes -> still medium (needs >= 10)
    expect(getPasswordStrength('Ab1!cdef').level).not.toBe('strong')
  })

  it('returns a label and color for each level', () => {
    const info = getPasswordStrength('Abcd1234!x')
    expect(info.label).toBe('안전함')
    expect(info.color).toBeTruthy()
  })
})
