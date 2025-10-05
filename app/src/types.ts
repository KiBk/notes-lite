export type ThemeMode = 'light' | 'dark'

export interface Note {
  id: string
  title: string
  body: string
  color: string
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface UserStore {
  notes: Record<string, Note>
  pinnedOrder: string[]
  unpinnedOrder: string[]
  archivedOrder: string[]
}

export interface PersistedState {
  users: Record<string, UserStore>
  lastUser?: string
  theme?: ThemeMode
}
