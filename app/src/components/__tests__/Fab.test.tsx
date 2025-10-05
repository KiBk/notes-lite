import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Fab from '../Fab'

describe('Fab', () => {
  it('fires onClick when pressed', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Fab onClick={handleClick} />)

    await user.click(screen.getByRole('button', { name: 'Create note' }))
    expect(handleClick).toHaveBeenCalled()
  })
})
