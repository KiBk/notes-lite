function NoteCard({ note, onOpen, onTogglePinned, isPinnedSection, isArchivedView }) {
  const backgroundColor = note.color || '#f8fafc';
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(note);
    }
  };

  const handlePinClick = (event) => {
    event.stopPropagation();
    onTogglePinned(note);
  };

  const pinLabel = note.pinned ? 'Unpin note' : 'Pin note';

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(note)}
      onKeyDown={handleKeyDown}
      className={`note-card ${note.pinned ? 'note-card--pinned' : ''}`}
      style={{ backgroundColor, '--note-card-color': backgroundColor }}
      aria-pressed="false"
    >
      <header className="note-card__header">
        <h3>{note.title || 'Untitled note'}</h3>
        {!isArchivedView ? (
          <button
            type="button"
            className={`note-pin ${note.pinned ? 'note-pin--active' : ''}`}
            onClick={handlePinClick}
            aria-label={pinLabel}
            title={pinLabel}
          >
            📌
          </button>
        ) : null}
      </header>
      {note.body ? (
        <p className="note-card__body" aria-label="Note body preview">
          {note.body}
        </p>
      ) : null}
      {isPinnedSection ? <span className="note-card__tag">Pinned</span> : null}
      {note.archived ? <span className="note-card__tag">Archived</span> : null}
    </article>
  );
}

export default NoteCard;
