import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Tabs from '../Tabs'

describe('Tabs', () => {
  it('marks active tab with aria-selected and emits changes', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Tabs active="notes" onChange={handleChange} />)

    const notesTab = screen.getByRole('tab', { name: 'Notes' })
    const archivedTab = screen.getByRole('tab', { name: 'Archived' })

    expect(notesTab).toHaveAttribute('aria-selected', 'true')
    expect(archivedTab).toHaveAttribute('aria-selected', 'false')

    await user.click(archivedTab)
    expect(handleChange).toHaveBeenCalledWith('archived')
  })
})
