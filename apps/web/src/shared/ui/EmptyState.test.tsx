import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title and subtitle', () => {
    render(<EmptyState title="아직 활동이 없어요" subtitle="시작해 보세요" />)
    expect(screen.getByText('아직 활동이 없어요')).toBeInTheDocument()
    expect(screen.getByText('시작해 보세요')).toBeInTheDocument()
  })

  it('omits the subtitle when not provided', () => {
    render(<EmptyState title="제목만" />)
    expect(screen.getByText('제목만')).toBeInTheDocument()
    expect(screen.queryByText('시작해 보세요')).not.toBeInTheDocument()
  })

  it('renders and wires up an action', async () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="비어있음"
        action={<button onClick={onClick}>그룹 만들기</button>}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '그룹 만들기' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
