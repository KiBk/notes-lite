import { useEffect, useRef, useState } from 'react';
import { NOTE_COLORS, DEFAULT_NOTE_COLOR } from '../constants/noteColors';

function NoteModal({
  open,
  note,
  mode = 'edit',
  onClose,
  onSave,
  onArchiveToggle,
  onDelete,
  onPinToggle,
  isProcessing,
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [color, setColor] = useState(note?.color || DEFAULT_NOTE_COLOR);
  const [error, setError] = useState('');
  const [showPalette, setShowPalette] = useState(false);
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const paletteRef = useRef(null);
  const toggleRef = useRef(null);

  const syncBodyHeight = () => {
    if (!bodyRef.current) return;
    const textarea = bodyRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    if (open) {
      setTitle(note?.title || '');
      setBody(note?.body || '');
      setError('');
      setColor(note?.color || DEFAULT_NOTE_COLOR);
      setShowPalette(false);
      const timeout = setTimeout(() => {
        titleRef.current?.focus();
        syncBodyHeight();
      }, 0);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [open, note]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    syncBodyHeight();
  }, [open, body]);

  useEffect(() => {
    if (!showPalette) return undefined;
    const handleClickAway = (event) => {
      if (
        paletteRef.current?.contains(event.target)
        || toggleRef.current?.contains(event.target)
      ) {
        return;
      }
      setShowPalette(false);
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [showPalette]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() && !body.trim()) {
      setError('Add a title or body before saving.');
      return;
    }
    try {
      setError('');
      await onSave({ ...note, title, body, color });
    } catch (err) {
      setError(err.message || 'Failed to save note.');
    }
  };

  const archiveLabel = note?.archived ? 'Unarchive' : 'Archive';
  const pinLabel = note?.pinned ? 'Unpin' : 'Pin';

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal modal--sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-modal-title"
        style={{ '--modal-note-color': color }}
      >
        <form onSubmit={handleSubmit} className="modal__form modal__form--sheet">
          <div className="modal__sheet-header">
            <input
              id="note-modal-title"
              ref={titleRef}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
              disabled={isProcessing}
              className="modal-input modal-input--title"
              aria-label="Note title"
            />
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close note">
              ×
            </button>
          </div>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              syncBodyHeight();
            }}
            placeholder="Capture your thoughts..."
            disabled={isProcessing}
            className="modal-input modal-input--body"
            aria-label="Note body"
            rows={1}
          />
          {error ? <p className="modal__error">{error}</p> : null}
          <footer className="modal__footer modal__footer--sheet">
            <div className="modal__actions">
              {mode === 'edit' ? (
                <div className="modal__secondary-actions">
                  <div className="color-popover">
                    <button
                      type="button"
                      className="chip-button modal__color-toggle"
                      ref={toggleRef}
                      onClick={() => setShowPalette((prev) => !prev)}
                      aria-expanded={showPalette}
                      disabled={isProcessing}
                    >
                      Colour
                    </button>
                    {showPalette ? (
                      <div className="modal__color-popover" role="group" aria-label="Select note colour" ref={paletteRef}>
                        {NOTE_COLORS.map((swatch) => {
                          const selected = color === swatch;
                          return (
                            <button
                              key={swatch}
                              type="button"
                              className={selected ? 'color-swatch color-swatch--selected' : 'color-swatch'}
                              style={{ backgroundColor: swatch }}
                              onClick={() => {
                                setColor(swatch);
                                setShowPalette(false);
                              }}
                              aria-label={`Set colour ${swatch}`}
                              aria-pressed={selected}
                              disabled={isProcessing}
                            >
                              {selected ? '✓' : ''}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="chip-button"
                    onClick={() => onPinToggle(note)}
                    disabled={isProcessing}
                  >
                    {pinLabel}
                  </button>
                  <button
                    type="button"
                    className="chip-button"
                    onClick={() => onArchiveToggle(note)}
                    disabled={isProcessing}
                  >
                    {archiveLabel}
                  </button>
                  {note?.archived ? (
                    <button
                      type="button"
                      className="chip-button chip-button--danger"
                      onClick={() => onDelete(note)}
                      disabled={isProcessing}
                    >
                      Delete forever
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="modal__primary">
              <button type="submit" className="primary-button" disabled={isProcessing}>
                {isProcessing ? 'Saving…' : 'Save'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default NoteModal;
