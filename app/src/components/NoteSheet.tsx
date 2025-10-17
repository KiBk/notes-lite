import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const titleDraftRef = useRef(title)
  const bodyDraftRef = useRef(body)
  const pendingSave = useRef<ReturnType<typeof window.setTimeout>>()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const paletteNode = useRef<HTMLDivElement | null>(null)
  useAutoResizeTextarea(bodyRef, body)

  const lastPersisted = useRef<{ note: Note; updater: NoteSheetProps['onUpdate'] }>({
    note,
    updater: onUpdate,
  })

  useEffect(() => {
    titleDraftRef.current = title
  }, [title])

  useEffect(() => {
    bodyDraftRef.current = body
  }, [body])

  const flush = useCallback(
    (baseline?: Note, overrideUpdater?: NoteSheetProps['onUpdate']) => {
      if (pendingSave.current) {
        window.clearTimeout(pendingSave.current)
        pendingSave.current = undefined
      }
      const reference = baseline ?? lastPersisted.current.note
      const updater = overrideUpdater ?? lastPersisted.current.updater
      if (!reference || !updater) {
        return
      }
      const draftTitle = titleDraftRef.current
      const draftBody = bodyDraftRef.current
      const changes: Partial<Omit<Note, 'id'>> = {}
      if (draftTitle !== reference.title) {
        changes.title = draftTitle
      }
      if (draftBody !== reference.body) {
        changes.body = draftBody
      }
      if (Object.keys(changes).length > 0) {
        updater(changes)
      }
    },
    [],
  )

  useEffect(() => {
    const previous = lastPersisted.current
    if (previous.note.id !== note.id) {
      flush(previous.note, previous.updater)
      setTitle(note.title)
      titleDraftRef.current = note.title
      setBody(note.body)
      bodyDraftRef.current = note.body
    } else {
      if (note.title !== previous.note.title) {
        setTitle(note.title)
        titleDraftRef.current = note.title
      }
      if (note.body !== previous.note.body) {
        setBody(note.body)
        bodyDraftRef.current = note.body
      }
    }
    lastPersisted.current = { note, updater: onUpdate }
  }, [flush, note, onUpdate])

  useEffect(() => {
    if (pendingSave.current) {
      window.clearTimeout(pendingSave.current)
    }
    const reference = lastPersisted.current.note
    const hasPending = reference.title !== title || reference.body !== body
    if (!hasPending) {
      return
    }
    const timer = window.setTimeout(() => {
      pendingSave.current = undefined
      flush()
    }, 1000)
    pendingSave.current = timer
    return () => {
      window.clearTimeout(timer)
      if (pendingSave.current === timer) {
        pendingSave.current = undefined
      }
    }
  }, [body, flush, title])

  useEffect(() => {
    return () => {
      if (pendingSave.current) {
        window.clearTimeout(pendingSave.current)
        pendingSave.current = undefined
      }
      flush()
    }
  }, [flush])

  useEffect(() => {
    setShowPalette(false)
  }, [note])

  useEffect(() => {
    if (showPalette && paletteNode.current) {
      paletteNode.current.focus()
    }
  }, [showPalette])

  const handleClose = useCallback(() => {
    flush()
    onClose()
  }, [flush, onClose])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleClose])

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose()
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
            value={title}
            placeholder="Title"
            autoFocus
            onChange={(event) => {
              const { value } = event.target
              titleDraftRef.current = value
              setTitle(value)
            }}
            onBlur={() => flush()}
          />
        </header>
        <section className="sheet-body">
          <textarea
            ref={bodyRef}
            value={body}
            placeholder="Write something memorable…"
            onChange={(event) => {
              const { value } = event.target
              bodyDraftRef.current = value
              setBody(value)
            }}
            onBlur={() => flush()}
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
