import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders the provided initial', () => {
    const { getByText } = render(<Avatar initial="현" />)
    expect(getByText('현')).toBeInTheDocument()
  })

  it('uses the flat color variable by default', () => {
    const { getByText } = render(<Avatar initial="A" color="mint" />)
    const el = getByText('A')
    expect(el.style.background).toContain('var(--avatar-mint)')
  })

  it('uses a gradient fill when gradient is set', () => {
    const { getByText } = render(<Avatar initial="B" color="purple" gradient />)
    const el = getByText('B')
    expect(el.style.background).toContain('linear-gradient')
  })

  it('scales font size with the size prop', () => {
    const { getByText } = render(<Avatar initial="C" size={100} />)
    const el = getByText('C')
    expect(el.style.width).toBe('100px')
    expect(el.style.fontSize).toBe('42px')
  })
})
