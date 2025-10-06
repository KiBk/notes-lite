import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NoteSheet from '../NoteSheet'
import { createTestNote } from '../../../tests/utils/test-utils'

describe('NoteSheet', () => {
  const palette = ['#fde2e4', '#fff1d0', '#e9f5db']

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces typing before triggering onUpdate', async () => {
    vi.useFakeTimers()
    const handleUpdate = vi.fn()
    render(
      <NoteSheet
        note={createTestNote()}
        palette={palette}
        onClose={() => {}}
        onUpdate={handleUpdate}
        onTogglePin={() => {}}
        onToggleArchive={() => {}}
        onDelete={() => {}}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Hello' } })
    expect(handleUpdate).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(handleUpdate).toHaveBeenCalledWith({ title: 'Hello' })
  })

  it('closes when clicking the overlay outside the sheet', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    render(
      <NoteSheet
        note={createTestNote()}
        palette={palette}
        onClose={handleClose}
        onUpdate={() => {}}
        onTogglePin={() => {}}
        onToggleArchive={() => {}}
        onDelete={() => {}}
      />,
    )

    const overlay = document.querySelector('.note-sheet-overlay') as HTMLElement
    await user.click(overlay)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('closes when pressing Escape', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    render(
      <NoteSheet
        note={createTestNote()}
        palette={palette}
        onClose={handleClose}
        onUpdate={() => {}}
        onTogglePin={() => {}}
        onToggleArchive={() => {}}
        onDelete={() => {}}
      />,
    )

    await user.keyboard('{Escape}')
    expect(handleClose).toHaveBeenCalled()
  })

  it('toggles the color palette and calls onUpdate when selecting a color', async () => {
    const user = userEvent.setup()
    const handleUpdate = vi.fn()
    const note = createTestNote({ color: palette[0] })
    render(
      <NoteSheet
        note={note}
        palette={palette}
        onClose={() => {}}
        onUpdate={handleUpdate}
        onTogglePin={() => {}}
        onToggleArchive={() => {}}
        onDelete={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: '○ Colour' }))
    expect(screen.getByRole('list')).toBeInTheDocument()

    await user.click(screen.getAllByRole('listitem')[1])
    expect(handleUpdate).toHaveBeenCalledWith({ color: palette[1] })
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('only shows delete chip when the note is archived', () => {
    const { rerender } = render(
      <NoteSheet
        note={createTestNote({ archived: false })}
        palette={palette}
        onClose={() => {}}
        onUpdate={() => {}}
        onTogglePin={() => {}}
        onToggleArchive={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: '○ Delete forever' })).toBeNull()

    rerender(
      <NoteSheet
        note={createTestNote({ archived: true })}
        palette={palette}
        onClose={() => {}}
        onUpdate={() => {}}
        onTogglePin={() => {}}
        onToggleArchive={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: '○ Delete forever' })).toBeVisible()
  })
})
