import type { Note, ThemeMode } from './types'

export type NoteBucket = 'pinned' | 'unpinned' | 'archived'

export interface StoreValue {
  theme: ThemeMode
  palette: string[]
  currentUser?: string
  rememberedUser?: string
  pinnedNotes: Note[]
  unpinnedNotes: Note[]
  archivedNotes: Note[]
  isLoading: boolean
  isSaving: boolean
  errorMessage?: string
  retry?: () => void | Promise<void>
  clearError: () => void
  resolveTempId: (id: string) => string | undefined
  login: (name: string) => void
  signOut: () => void
  setTheme: (mode: ThemeMode) => void
  createNote: () => Promise<string | undefined>
  updateNote: (id: string, changes: Partial<Omit<Note, 'id'>>) => void
  togglePinned: (id: string) => void
  toggleArchived: (id: string) => void
  deleteForever: (id: string) => void
  reorderNotes: (bucket: NoteBucket, newOrder: string[]) => void
}
