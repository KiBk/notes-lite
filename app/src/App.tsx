import { useEffect, useMemo, useState } from 'react'
import LoginScreen from './components/LoginScreen'
import TopBar from './components/TopBar'
import Tabs from './components/Tabs'
import NotesGrid from './components/NotesGrid'
import Fab from './components/Fab'
import NoteSheet from './components/NoteSheet'
import ErrorBanner from './components/ErrorBanner'
import './App.css'
import { useStore } from './store-context'
import type { Note } from './types'

const App = () => {
  const {
    currentUser,
    theme,
    palette,
    pinnedNotes,
    unpinnedNotes,
    archivedNotes,
    rememberedUser,
    isLoading,
    isSaving,
    errorMessage,
    retry,
    clearError,
    login,
    signOut,
    setTheme,
    createNote,
    updateNote,
    togglePinned,
    toggleArchived,
    deleteForever,
    reorderNotes,
    resolveTempId,
  } = useStore()

  const [activeTab, setActiveTab] = useState<'notes' | 'archived'>('notes')
  const [search, setSearch] = useState('')
  const [activeNoteId, setActiveNoteId] = useState<string>()

  useEffect(() => {
    if (!currentUser) {
      setActiveNoteId(undefined)
      setSearch('')
      setActiveTab('notes')
    }
  }, [currentUser])

  const noteLookup = useMemo(() => {
    const map = new Map<string, Note>()
    ;[...pinnedNotes, ...unpinnedNotes, ...archivedNotes].forEach((note) => {
      map.set(note.id, note)
    })
    return map
  }, [pinnedNotes, unpinnedNotes, archivedNotes])

  const activeNote = activeNoteId ? noteLookup.get(activeNoteId) : undefined

  useEffect(() => {
    if (activeNoteId && !activeNote) {
      const resolved = resolveTempId(activeNoteId)
      if (resolved) {
        setActiveNoteId(resolved)
        return
      }
      setActiveNoteId(undefined)
    }
  }, [activeNoteId, activeNote, resolveTempId])

  const handleCreateNote = () => {
    setActiveTab('notes')
    setSearch('')
    void (async () => {
      const id = await createNote()
      if (id) {
        setActiveNoteId(id)
      }
    })()
  }

  const trimmedSearch = search.trim()
  const query = trimmedSearch.toLowerCase()
  const isSearching = query.length > 0

  const matchesQuery = (note: Note) => {
    if (!isSearching) return true
    const haystack = `${note.title}\u0000${note.body}`.toLowerCase()
    return haystack.includes(query)
  }

  const filteredPinned = pinnedNotes.filter(matchesQuery)
  const filteredUnpinned = unpinnedNotes.filter(matchesQuery)
  const filteredArchived = archivedNotes.filter(matchesQuery)

  const showActive = !isSearching ? activeTab === 'notes' : filteredPinned.length > 0 || filteredUnpinned.length > 0
  const showArchived = !isSearching ? activeTab === 'archived' : filteredArchived.length > 0

  const handleOpenNote = (note: Note) => {
    setActiveNoteId(note.id)
  }

  const handleUpdateNote = (id: string, changes: Partial<Omit<Note, 'id'>>) => {
    updateNote(id, changes)
  }

  if (!currentUser) {
    return (
      <LoginScreen
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onLogin={login}
        rememberedName={rememberedUser}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onDismissError={clearError}
        onRetry={retry}
      />
    )
  }

  return (
    <div className="app-shell">
      <TopBar
        user={currentUser}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        search={search}
        onSearch={setSearch}
        onSignOut={signOut}
        isSaving={isSaving}
      />
      <main className="content">
        {errorMessage && (
          <ErrorBanner
            message={errorMessage}
            onRetry={retry}
            onDismiss={clearError}
            busy={isSaving}
          />
        )}
        <Tabs active={activeTab} onChange={setActiveTab} />
        {isSearching && (
          <p className="search-hint">
            Showing matches across notes and archive.
          </p>
        )}
        {showActive && (
          <div className="bucket">
            {filteredPinned.length > 0 && (
              <NotesGrid
                title={isSearching ? 'Pinned matches' : 'Pinned'}
                notes={filteredPinned}
                bucket="pinned"
                onReorder={reorderNotes}
                onOpen={handleOpenNote}
                onTogglePin={(note) => togglePinned(note.id)}
                enableDrag={!isSearching}
                highlightQuery={isSearching ? trimmedSearch : undefined}
              />
            )}
            <NotesGrid
              title={
                filteredPinned.length > 0
                  ? isSearching
                    ? 'Other matches'
                    : 'Others'
                  : isSearching
                    ? 'Matches'
                    : 'Notes'
              }
              notes={filteredUnpinned}
              bucket="unpinned"
              onReorder={reorderNotes}
              onOpen={handleOpenNote}
              onTogglePin={(note) => togglePinned(note.id)}
              enableDrag={!isSearching}
              highlightQuery={isSearching ? trimmedSearch : undefined}
              emptyLabel={
                !isSearching && filteredPinned.length === 0 && filteredUnpinned.length === 0
                  ? 'New notes land here. Create your first thought.'
                  : undefined
              }
            />
          </div>
        )}
        {showArchived && (
          <NotesGrid
            title={isSearching ? 'Archived matches' : 'Archived'}
            notes={filteredArchived}
            bucket="archived"
            onReorder={reorderNotes}
            onOpen={handleOpenNote}
            onTogglePin={(note) => togglePinned(note.id)}
            enableDrag={!isSearching}
            showPin={false}
            highlightQuery={isSearching ? trimmedSearch : undefined}
            emptyLabel={
              !isSearching && filteredArchived.length === 0
                ? 'Archived notes will rest here.'
                : undefined
            }
          />
        )}
        {isSearching &&
          filteredPinned.length === 0 &&
          filteredUnpinned.length === 0 &&
          filteredArchived.length === 0 && (
            <p className="empty-copy">No notes match that search.</p>
          )}
      </main>
      <Fab onClick={handleCreateNote} />
      {activeNote && (
        <NoteSheet
          note={activeNote}
          palette={palette}
          onClose={() => setActiveNoteId(undefined)}
          onUpdate={(changes) => handleUpdateNote(activeNote.id, changes)}
          onTogglePin={() => togglePinned(activeNote.id)}
          onToggleArchive={() => toggleArchived(activeNote.id)}
          onDelete={() => {
            deleteForever(activeNote.id)
            setActiveNoteId(undefined)
          }}
        />
      )}
    </div>
  )
}

export default App
