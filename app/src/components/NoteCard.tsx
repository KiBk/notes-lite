import type { CSSProperties, MouseEvent } from 'react'
import type { Note } from '../types'
import { getInkForBackground, hexToRgba } from '../utils/color'
import { formatRelativeTime } from '../utils/time'
import { useStore } from '../store-context'

interface NoteCardProps {
  note: Note
  onOpen: (note: Note) => void
  onTogglePin?: (note: Note) => void
  showPin?: boolean
}

const NoteCard = ({ note, onOpen, onTogglePin, showPin = true }: NoteCardProps) => {
  const { theme } = useStore()
  const ink = getInkForBackground(note.color)
  const fadeStart = hexToRgba(note.color, 0)
  const fadeEnd = hexToRgba(note.color, theme === 'dark' ? 0.88 : 0.72)

  const handlePin = (event: MouseEvent) => {
    event.stopPropagation()
    onTogglePin?.(note)
  }

  return (
    <article
      className="note-card"
      style={{
        '--card-color': note.color,
        '--card-ink': ink,
        '--card-fade-start': fadeStart,
        '--card-fade-end': fadeEnd,
      } as CSSProperties}
      onClick={() => onOpen(note)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onOpen(note)
        }
      }}
    >
      {showPin && (
        <button
          type="button"
          className={note.pinned ? 'pin-button active' : 'pin-button'}
          onClick={handlePin}
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        >
          {note.pinned ? '●' : '○'}
        </button>
      )}
      <h3 className="note-title">{note.title || 'Untitled'}</h3>
      <p className="note-body">{note.body || 'Add some thoughts…'}</p>
      <footer className="note-footer">
        <span>{formatRelativeTime(note.updatedAt)}</span>
      </footer>
    </article>
  )
}

export default NoteCard
