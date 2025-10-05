import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { Note } from '../types'
import ColorPalette from './ColorPalette'
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea'
import { getInkForBackground } from '../utils/color'

interface NoteSheetProps {
  note: Note
  palette: string[]
  onClose: () => void
  onUpdate: (changes: Partial<Omit<Note, 'id'>>) => void
  onTogglePin: () => void
  onToggleArchive: () => void
  onDelete: () => void
}

const NoteSheet = ({
  note,
  palette,
  onClose,
  onUpdate,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: NoteSheetProps) => {
  const [showPalette, setShowPalette] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const paletteNode = useRef<HTMLDivElement | null>(null)
  useAutoResizeTextarea(bodyRef, note.body)

  useEffect(() => {
    setShowPalette(false)
  }, [note.id])

  useEffect(() => {
    if (showPalette && paletteNode.current) {
      paletteNode.current.focus()
    }
  }, [showPalette])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const ink = getInkForBackground(note.color)

  return (
    <div className="note-sheet-overlay" onClick={handleOverlayClick}>
      <div
        className="note-sheet"
        style={{
          '--sheet-color': note.color,
          '--sheet-ink': ink,
        } as CSSProperties}
      >
        <header className="sheet-header">
          <input
            className="sheet-title"
            value={note.title}
            placeholder="Title"
            autoFocus
            onChange={(event) => onUpdate({ title: event.target.value })}
          />
        </header>
        <section className="sheet-body">
          <textarea
            ref={bodyRef}
            value={note.body}
            placeholder="Write something memorable…"
            onChange={(event) => onUpdate({ body: event.target.value })}
          />
        </section>
        <footer className="sheet-footer">
          <div className="chip-row">
            <div className="chip-group">
              <button
                type="button"
                className="chip"
                onClick={() => setShowPalette((prev) => !prev)}
              >
                ○ Colour
              </button>
              {showPalette && (
                <ColorPalette
                  colors={palette}
                  selected={note.color}
                  onSelect={(color) => {
                    onUpdate({ color })
                    setShowPalette(false)
                  }}
                  onClose={() => setShowPalette(false)}
                  paletteRef={(node) => {
                    paletteNode.current = node
                    if (node) {
                      node.focus()
                    }
                  }}
                />
              )}
            </div>
            <button type="button" className="chip" onClick={onTogglePin}>
              {note.pinned ? '● Unpin' : '○ Pin'}
            </button>
            <button type="button" className="chip" onClick={onToggleArchive}>
              {note.archived ? '● Unarchive' : '○ Archive'}
            </button>
            {note.archived && (
              <button type="button" className="chip danger" onClick={onDelete}>
                ○ Delete forever
              </button>
            )}
          </div>
          <span className="sheet-meta">
            Created {new Date(note.createdAt).toLocaleString()}
          </span>
        </footer>
      </div>
    </div>
  )
}

export default NoteSheet
