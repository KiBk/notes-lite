import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NoteCard from '../NoteCard'
import { createTestNote, renderWithStore } from '../../../tests/utils/test-utils'

describe('NoteCard', () => {
  it('calls onOpen when clicking the article', async () => {
    const user = userEvent.setup()
    const handleOpen = vi.fn()
    const note = createTestNote({ title: 'Ideas' })
    renderWithStore(<NoteCard note={note} onOpen={handleOpen} />)

    const card = screen.getByText('Ideas').closest('article')
    if (!card) {
      throw new Error('Card not found')
    }
    await user.click(card)
    expect(handleOpen).toHaveBeenCalledWith(note)
  })

  it('invokes onOpen when pressing Enter on the card', async () => {
    const user = userEvent.setup()
    const handleOpen = vi.fn()
    const note = createTestNote({ title: 'Keyboard' })
    renderWithStore(<NoteCard note={note} onOpen={handleOpen} />)

    const card = screen.getByText('Keyboard').closest('article') as HTMLElement
    card.focus()
    await user.keyboard('{Enter}')
    expect(handleOpen).toHaveBeenCalledWith(note)
  })

  it('pin button toggles without firing onOpen', async () => {
    const user = userEvent.setup()
    const handleOpen = vi.fn()
    const handleTogglePin = vi.fn()
    const note = createTestNote({ title: 'Pinned', pinned: false })
    renderWithStore(<NoteCard note={note} onOpen={handleOpen} onTogglePin={handleTogglePin} />)

    await user.click(screen.getByRole('button', { name: 'Pin note' }))
    expect(handleTogglePin).toHaveBeenCalledWith(note)
    expect(handleOpen).not.toHaveBeenCalled()
  })

  it('sets CSS custom properties from note color', () => {
    const color = '#abcdef'
    const note = createTestNote({ id: 'color-note', color })
    const { container } = renderWithStore(<NoteCard note={note} onOpen={() => {}} />)
    const article = container.querySelector('.note-card') as HTMLElement

    expect(article.style.getPropertyValue('--card-color')).toBe(color)
    expect(article.style.getPropertyValue('--card-ink')).toBeTruthy()
  })
})
