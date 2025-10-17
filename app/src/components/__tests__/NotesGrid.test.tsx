import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import NotesGrid from '../NotesGrid'
import { createTestNote, renderWithStore } from '../../../tests/utils/test-utils'

const dragEndRef: { handler?: (event: DragEndEvent) => void } = {}

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: ({ children, onDragEnd, ...rest }: ComponentProps<typeof actual.DndContext>) => {
      dragEndRef.handler = onDragEnd as ((event: DragEndEvent) => void) | undefined
      return (
        <actual.DndContext onDragEnd={onDragEnd} {...rest}>
          {children}
        </actual.DndContext>
      )
    },
  }
})

describe('NotesGrid', () => {
  beforeEach(() => {
    dragEndRef.handler = undefined
  })

  it('renders empty state label when no notes', () => {
    renderWithStore(
      <NotesGrid
        title="Notes"
        notes={[]}
        bucket="unpinned"
        onReorder={vi.fn()}
        onOpen={vi.fn()}
        enableDrag
        emptyLabel="No notes yet"
      />,
    )

    expect(screen.getByText('No notes yet')).toBeVisible()
  })

  it('invokes onReorder with rearranged IDs on drag end', () => {
    const notes = [
      createTestNote({ id: 'a', title: 'Alpha' }),
      createTestNote({ id: 'b', title: 'Bravo' }),
      createTestNote({ id: 'c', title: 'Charlie' }),
    ]
    const handleReorder = vi.fn()

    renderWithStore(
      <NotesGrid
        notes={notes}
        bucket="pinned"
        onReorder={handleReorder}
        onOpen={vi.fn()}
      />,
    )

    dragEndRef.handler?.({
      active: { id: 'a' },
      over: { id: 'c' },
    } as DragEndEvent)

    expect(handleReorder).toHaveBeenCalledWith('pinned', ['b', 'c', 'a'])
  })

  it('does not reorder when drag is disabled', async () => {
    const user = userEvent.setup()
    const notes = [createTestNote({ id: 'a', title: 'Alpha' })]
    const handleReorder = vi.fn()

    renderWithStore(
      <NotesGrid
        notes={notes}
        bucket="unpinned"
        onReorder={handleReorder}
        onOpen={vi.fn()}
        enableDrag={false}
      />,
    )

    expect(dragEndRef.handler).toBeUndefined()

    const noteHeading = screen.getByText('Alpha')
    await user.click(noteHeading)
    expect(handleReorder).not.toHaveBeenCalled()
  })
})
