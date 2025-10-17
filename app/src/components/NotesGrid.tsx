import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import NoteCard from './NoteCard'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Note } from '../types'
import type { NoteBucket } from '../store-types'

interface NotesGridProps {
  title?: string
  notes: Note[]
  bucket: NoteBucket
  onReorder: (bucket: NoteBucket, ids: string[]) => void
  onOpen: (note: Note) => void
  onTogglePin?: (note: Note) => void
  enableDrag?: boolean
  emptyLabel?: string
  showPin?: boolean
}

const SortableNote = ({
  note,
  onOpen,
  onTogglePin,
  showPin,
}: {
  note: Note
  onOpen: (note: Note) => void
  onTogglePin?: (note: Note) => void
  showPin?: boolean
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: note.id })
  const [rowSpan, setRowSpan] = useState(1)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const { role, tabIndex, ...otherAttributes } = attributes as typeof attributes & {
    role?: string
    tabIndex?: number
  }
  const accessibilityAttributes = {
    ...otherAttributes,
    role: role === 'button' ? 'group' : role,
    tabIndex: tabIndex !== undefined ? -1 : tabIndex,
  }

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const container = node.parentElement as HTMLElement | null
    if (!container) return
    const styles = getComputedStyle(container)
    const baseRow = parseFloat(styles.getPropertyValue('--grid-row')) || 12
    const gap = parseFloat(styles.rowGap || styles.gap || '0') || 0
    const getCard = () => node.firstElementChild as HTMLElement | null
    const measure = () => {
      const card = getCard()
      const measuredHeight = card?.getBoundingClientRect().height ?? node.getBoundingClientRect().height
      const totalHeight = measuredHeight + gap
      const span = Math.max(1, Math.ceil(totalHeight / (baseRow + gap)))
      setRowSpan(span)
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const target = getCard() ?? node
      const observer = new ResizeObserver(measure)
      observer.observe(target)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
    }
  }, [note.body, note.color, note.title, note.updatedAt])

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridRowEnd: `span ${rowSpan}`,
  }

  return (
    <div
      ref={(element) => {
        setNodeRef(element)
        nodeRef.current = element
      }}
      style={style}
      {...accessibilityAttributes}
      {...listeners}
    >
      <NoteCard note={note} onOpen={onOpen} onTogglePin={onTogglePin} showPin={showPin} />
    </div>
  )
}

const NotesGrid = ({
  title,
  notes,
  bucket,
  onReorder,
  onOpen,
  onTogglePin,
  enableDrag = true,
  emptyLabel,
  showPin = true,
}: NotesGridProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = notes.findIndex((note) => note.id === active.id)
    const newIndex = notes.findIndex((note) => note.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const currentOrder = notes.map((note) => note.id)
    const nextOrder = arrayMove(currentOrder, oldIndex, newIndex)
    onReorder(bucket, nextOrder)
  }

  return (
    <section className="notes-section">
      {title && <header className="section-title">{title}</header>}
      {notes.length === 0 && emptyLabel ? (
        <p className="empty-copy">{emptyLabel}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={enableDrag ? handleDragEnd : undefined}
        >
          <SortableContext items={notes.map((note) => note.id)} strategy={rectSortingStrategy}>
            <div className="notes-grid">
              {notes.map((note) => (
                <SortableNote
                  key={note.id}
                  note={note}
                  onOpen={onOpen}
                  onTogglePin={onTogglePin}
                  showPin={showPin}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

export default NotesGrid
