import type { CSSProperties, JSX, MouseEvent, SyntheticEvent } from 'react'
import type { Note } from '../types'
import { getInkForBackground } from '../utils/color'
import { formatRelativeTime } from '../utils/time'

interface NoteCardProps {
  note: Note
  onOpen: (note: Note) => void
  onTogglePin?: (note: Note) => void
  showPin?: boolean
  highlightQuery?: string
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const highlightText = (text: string, query: string) => {
  if (!query) {
    return text
  }

  const regex = new RegExp(escapeRegExp(query), 'gi')
  const fragments: Array<string | JSX.Element> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const index = match.index
    if (index > lastIndex) {
      fragments.push(text.slice(lastIndex, index))
    }
    const matchedText = match[0]
    fragments.push(<mark key={`match-${index}`}>{matchedText}</mark>)
    lastIndex = index + matchedText.length
  }

  if (lastIndex < text.length) {
    fragments.push(text.slice(lastIndex))
  }

  return fragments.length > 0 ? fragments : text
}

const NoteCard = ({ note, onOpen, onTogglePin, showPin = true, highlightQuery }: NoteCardProps) => {
  const ink = getInkForBackground(note.color)
  const computeApproxLines = (content: string) => {
    if (!content) return 0
    const normalized = content.replace(/\r\n/g, '\n')
    return normalized.split('\n').reduce((count, segment) => {
      const length = segment.trim().length
      if (length === 0) {
        return count + 1
      }
      return count + Math.max(1, Math.ceil(length / 50))
    }, 0)
  }

  const approxLines = computeApproxLines(note.body)
  const lineClamp = Math.min(20, Math.max(5, approxLines <= 5 ? approxLines || 5 : approxLines + 2))
  const trimmedQuery = highlightQuery?.trim() ?? ''
  const shouldHighlight = trimmedQuery.length > 0
  const hasBody = note.body.trim().length > 0
  const displayBody = hasBody ? note.body : 'Add some thoughts…'
  const bodyContent = shouldHighlight && hasBody ? highlightText(displayBody, trimmedQuery) : displayBody
  const hasTitle = note.title.trim().length > 0
  const titleContent = shouldHighlight && hasTitle ? highlightText(note.title, trimmedQuery) : (note.title || 'Untitled')

  const haltEvent = (event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if ('stopImmediatePropagation' in event.nativeEvent) {
      ;(event.nativeEvent as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
    }
  }

  const handlePin = (event: MouseEvent) => {
    haltEvent(event)
    onTogglePin?.(note)
  }

  const swallowPointer = (event: SyntheticEvent) => {
    haltEvent(event)
  }

  return (
    <article
      className="note-card"
      style={{
        '--card-color': note.color,
        '--card-ink': ink,
        '--card-line-clamp': lineClamp,
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
          onMouseDown={swallowPointer}
          onPointerDown={swallowPointer}
          onTouchStart={swallowPointer}
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        >
          {note.pinned ? '●' : '○'}
        </button>
      )}
      <h3 className="note-title">{titleContent}</h3>
      <p className="note-body">{bodyContent}</p>
      <footer className="note-footer">
        <span>{formatRelativeTime(note.updatedAt)}</span>
      </footer>
    </article>
  )
}

export default NoteCard
