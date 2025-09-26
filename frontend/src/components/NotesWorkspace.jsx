import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createNote,
  deleteNote,
  fetchNotes,
  login,
  reorderNotes,
  updateNote,
} from '../api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useMasonryItem } from '../hooks/useMasonryItem';
import { DEFAULT_NOTE_COLOR } from '../constants/noteColors';
import LoginForm from './LoginForm';
import NoteCard from './NoteCard';
import NoteModal from './NoteModal';

const STORAGE_KEY = 'notes-lite:last-user';
const THEME_STORAGE_KEY = 'notes-lite:theme';

function MasonryCardContainer({ children, provided }) {
  const masonryRef = useMasonryItem();

  const assignRef = (node) => {
    masonryRef.current = node;
    if (provided && typeof provided.innerRef === 'function') {
      provided.innerRef(node);
    }
  };

  const draggableProps = provided?.draggableProps ?? {};
  const dragHandleProps = provided?.dragHandleProps ?? {};

  return (
    <div
      ref={assignRef}
      className="note-card-wrapper"
      {...draggableProps}
      {...dragHandleProps}
    >
      {children}
    </div>
  );
}

function NotesWorkspace({ user, onLogout, theme, onToggleTheme }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [notes, setNotes] = useState({ pinned: [], unpinned: [], archived: [] });
  const [activeTab, setActiveTab] = useState('notes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalState, setModalState] = useState({ open: false, mode: 'edit', note: null });
  const [isProcessing, setProcessing] = useState(false);

  const isSearching = debouncedSearch.trim().length > 0;

  const refreshNotes = useCallback(
    async ({ showSpinner = false } = {}) => {
      if (!user?.id) return;
      if (showSpinner) {
        setLoading(true);
      }
      try {
        const { notes: data } = await fetchNotes(user.id, debouncedSearch);
        setNotes(data);
        setError('');
      } catch (err) {
        setError(err.message || 'Could not load notes.');
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [user?.id, debouncedSearch]
  );

  useEffect(() => {
    refreshNotes({ showSpinner: true });
  }, [refreshNotes]);

  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
  }, [user]);

  const handleCreate = () => {
    setActiveTab('notes');
    setModalState({
      open: true,
      mode: 'create',
      note: {
        title: '',
        body: '',
        pinned: false,
        archived: false,
        color: DEFAULT_NOTE_COLOR,
      },
    });
  };

  const handleOpenNote = (note) => {
    setModalState({ open: true, mode: 'edit', note });
  };

  const handleCloseModal = () => {
    setModalState((prev) => ({ ...prev, open: false }));
  };

  const handleSaveNote = async (draft) => {
    setProcessing(true);
    try {
      if (modalState.mode === 'create') {
        await createNote(user.id, {
          title: draft.title.trim(),
          body: draft.body,
          color: draft.color,
        });
      } else if (draft.id) {
        await updateNote(user.id, draft.id, {
          title: draft.title.trim(),
          body: draft.body,
          color: draft.color,
        });
      }
      setModalState({ open: false, mode: 'edit', note: null });
      await refreshNotes();
    } catch (err) {
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleTogglePinned = async (note) => {
    try {
      const response = await updateNote(user.id, note.id, { pinned: !note.pinned });
      await refreshNotes();
      setModalState((prev) => {
        if (!prev.open || !prev.note || prev.note.id !== note.id) return prev;
        return { ...prev, note: response.note };
      });
    } catch (err) {
      setError(err.message || 'Could not update pin state.');
    }
  };

  const handleToggleArchive = async (note) => {
    try {
      const response = await updateNote(user.id, note.id, { archived: !note.archived });
      await refreshNotes();
      if (response.note.archived) {
        setModalState({ open: false, mode: 'edit', note: null });
        setActiveTab('archived');
      } else {
        setModalState((prev) => {
          if (!prev.open || !prev.note || prev.note.id !== note.id) return prev;
          return { ...prev, note: response.note };
        });
        setActiveTab('notes');
      }
    } catch (err) {
      setError(err.message || 'Could not update archive state.');
    }
  };

  const handleDelete = async (note) => {
    if (!window.confirm('Delete this note permanently?')) {
      return;
    }
    try {
      await deleteNote(user.id, note.id);
      await refreshNotes();
      setModalState({ open: false, mode: 'edit', note: null });
    } catch (err) {
      setError(err.message || 'Could not delete note.');
    }
  };

  const handleDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId
      && destination.index === source.index
    ) {
      return;
    }

    const noteId = Number(draggableId);

    if (Number.isNaN(noteId)) return;

    if (activeTab === 'notes' && !isSearching) {
      const pinned = [...notes.pinned];
      const unpinned = [...notes.unpinned];
      let moving;

      if (source.droppableId === 'pinned') {
        [moving] = pinned.splice(source.index, 1);
      } else {
        [moving] = unpinned.splice(source.index, 1);
      }

      if (!moving) return;

      if (destination.droppableId === 'pinned') {
        pinned.splice(destination.index, 0, moving);
      } else {
        unpinned.splice(destination.index, 0, moving);
      }

      setNotes((prev) => ({ ...prev, pinned, unpinned }));

      try {
        if (destination.droppableId !== source.droppableId) {
          await updateNote(user.id, noteId, { pinned: destination.droppableId === 'pinned' });
        }
        const response = await reorderNotes(user.id, {
          pinnedIds: pinned.map((note) => note.id),
          unpinnedIds: unpinned.map((note) => note.id),
          archivedIds: notes.archived.map((note) => note.id),
        });
        setNotes(response.notes);
      } catch (err) {
        setError(err.message || 'Could not reorder notes.');
        await refreshNotes();
      }
    }

    if (activeTab === 'archived' && !isSearching) {
      const archived = [...notes.archived];
      const [moving] = archived.splice(source.index, 1);
      if (!moving) return;
      archived.splice(destination.index, 0, moving);
      setNotes((prev) => ({ ...prev, archived }));
      try {
        const response = await reorderNotes(user.id, {
          pinnedIds: notes.pinned.map((note) => note.id),
          unpinnedIds: notes.unpinned.map((note) => note.id),
          archivedIds: archived.map((note) => note.id),
        });
        setNotes(response.notes);
      } catch (err) {
        setError(err.message || 'Could not reorder archived notes.');
        await refreshNotes();
      }
    }
  };

  const activeNotes = useMemo(
    () => [...notes.pinned, ...notes.unpinned],
    [notes.pinned, notes.unpinned]
  );

  const hasAnyNote = notes.pinned.length + notes.unpinned.length + notes.archived.length > 0;

  return (
    <div className="workspace">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="logo" aria-hidden>📝</span>
          <h1>Notes Lite</h1>
        </div>
        <div className="topbar__search">
          <input
            type="search"
            placeholder="Search notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search notes"
          />
        </div>
        <div className="topbar__session">
          {onToggleTheme ? (
            <button
              type="button"
              className="ghost-button theme-toggle"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀︎' : '☾'}
            </button>
          ) : null}
          <span className="topbar__user">{user.name}</span>
          <button type="button" className="ghost-button" onClick={onLogout}>
            Switch user
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'notes'}
          className={activeTab === 'notes' ? 'tab tab--active' : 'tab'}
          onClick={() => setActiveTab('notes')}
          type="button"
        >
          Notes
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'archived'}
          className={activeTab === 'archived' ? 'tab tab--active' : 'tab'}
          onClick={() => setActiveTab('archived')}
          type="button"
        >
          Archived
        </button>
      </nav>

      <main className="content">
        {error ? <div className="alert" role="alert">{error}</div> : null}
        {loading ? <div className="empty">Loading…</div> : null}

        {!loading && isSearching ? (
          <div className="search-results">
            <section>
              <h2>Active results</h2>
              {activeNotes.length ? (
                <div className="notes-grid">
                  {activeNotes.map((note) => (
                    <MasonryCardContainer key={note.id}>
                      <NoteCard
                        note={note}
                        onOpen={handleOpenNote}
                        onTogglePinned={handleTogglePinned}
                        isArchivedView={false}
                      />
                    </MasonryCardContainer>
                  ))}
                </div>
              ) : (
                <p className="empty">No active notes match your search.</p>
              )}
            </section>
            <section>
              <h2>Archived results</h2>
              {notes.archived.length ? (
                <div className="notes-grid">
                  {notes.archived.map((note) => (
                    <MasonryCardContainer key={note.id}>
                      <NoteCard
                        note={note}
                        onOpen={handleOpenNote}
                        onTogglePinned={handleTogglePinned}
                        isArchivedView
                      />
                    </MasonryCardContainer>
                  ))}
                </div>
              ) : (
                <p className="empty">No archived notes match your search.</p>
              )}
            </section>
          </div>
        ) : null}

        {!loading && !isSearching && activeTab === 'notes' ? (
          hasAnyNote ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              {notes.pinned.length ? (
                <section>
                  <h2>Pinned</h2>
                  <Droppable droppableId="pinned" direction="vertical">
                    {(provided) => (
                      <div
                        className="notes-grid"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {notes.pinned.map((note, index) => (
                          <Draggable
                            draggableId={note.id.toString()}
                            index={index}
                            key={note.id}
                          >
                            {(dragProvided) => (
                              <MasonryCardContainer provided={dragProvided}>
                                <NoteCard
                                  note={note}
                                  onOpen={handleOpenNote}
                                  onTogglePinned={handleTogglePinned}
                                  isPinnedSection
                                  isArchivedView={false}
                                />
                              </MasonryCardContainer>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </section>
              ) : null}

              <section>
                {notes.pinned.length ? <h2>Others</h2> : null}
                <Droppable droppableId="unpinned" direction="vertical">
                  {(provided) => (
                    <div
                      className="notes-grid"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {notes.unpinned.map((note, index) => (
                        <Draggable
                          draggableId={note.id.toString()}
                          index={index}
                          key={note.id}
                        >
                          {(dragProvided) => (
                            <MasonryCardContainer provided={dragProvided}>
                              <NoteCard
                                note={note}
                                onOpen={handleOpenNote}
                                onTogglePinned={handleTogglePinned}
                                isArchivedView={false}
                              />
                            </MasonryCardContainer>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </section>
            </DragDropContext>
          ) : (
            <div className="empty">You have no notes yet. Create your first one!</div>
          )
        ) : null}

        {!loading && !isSearching && activeTab === 'archived' ? (
          notes.archived.length ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="archived" direction="vertical">
                {(provided) => (
                  <div
                    className="notes-grid"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {notes.archived.map((note, index) => (
                      <Draggable
                        draggableId={note.id.toString()}
                        index={index}
                        key={note.id}
                      >
                        {(dragProvided) => (
                          <MasonryCardContainer provided={dragProvided}>
                            <NoteCard
                              note={note}
                              onOpen={handleOpenNote}
                              onTogglePinned={handleTogglePinned}
                              isArchivedView
                            />
                          </MasonryCardContainer>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <div className="empty">Archived notes will show up here.</div>
          )
        ) : null}
      </main>

      <button type="button" className="fab" onClick={handleCreate} aria-label="Create note">
        +
      </button>

      <NoteModal
        open={modalState.open}
        mode={modalState.mode}
        note={modalState.note}
        onClose={handleCloseModal}
        onSave={handleSaveNote}
        onArchiveToggle={handleToggleArchive}
        onDelete={handleDelete}
        onPinToggle={handleTogglePinned}
        isProcessing={isProcessing}
      />
    </div>
  );
}

function getInitialUser() {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (err) {
    return null;
  }
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function NotesAppContainer() {
  const [user, setUser] = useState(getInitialUser);
  const [authLoading, setAuthLoading] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return;
      }
      setTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const handleLogin = async (name) => {
    setAuthLoading(true);
    try {
      const result = await login(name);
      setUser(result.user);
    } catch (err) {
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setUser(null);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (!user) {
    return (
      <LoginForm
        onLogin={handleLogin}
        loading={authLoading}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <NotesWorkspace
      user={user}
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

export { NotesWorkspace };

export default NotesAppContainer;
