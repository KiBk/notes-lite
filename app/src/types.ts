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

export interface NotePayload {
  title?: string
  body?: string
  color?: string
  pinned?: boolean
  archived?: boolean
}

export type NoteCreatePayload = NotePayload

export type NoteUpdatePayload = NotePayload

export interface NoteOrderPayload {
  order: string[]
}

export interface ApiErrorPayload {
  message: string
  details?: unknown
}

export interface UserStore {
  notes: Record<string, Note>
  pinnedOrder: string[]
  unpinnedOrder: string[]
  archivedOrder: string[]
}

export interface PersistedState {
  lastUser?: string
  theme?: ThemeMode
}
