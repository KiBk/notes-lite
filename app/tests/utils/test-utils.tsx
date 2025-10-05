import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { StoreContext } from '../../src/store-context'
import type { StoreValue } from '../../src/store-types'
import type { Note } from '../../src/types'

export const createTestNote = (overrides: Partial<Note> = {}): Note => {
  const timestamp = overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z').toISOString()
  return {
    id: 'note-id',
    title: 'Sample note',
    body: 'Body copy',
    color: '#fde2e4',
    pinned: false,
    archived: false,
    createdAt: timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    ...overrides,
  }
}

export const createMockStore = (overrides: Partial<StoreValue> = {}): StoreValue => ({
  theme: 'light',
  palette: ['#fde2e4', '#fff1d0', '#e9f5db'],
  currentUser: 'Pat',
  pinnedNotes: [],
  unpinnedNotes: [],
  archivedNotes: [],
  login: vi.fn(),
  signOut: vi.fn(),
  setTheme: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  togglePinned: vi.fn(),
  toggleArchived: vi.fn(),
  deleteForever: vi.fn(),
  reorderNotes: vi.fn(),
  ...overrides,
})

export const renderWithStore = (ui: ReactElement, storeOverrides: Partial<StoreValue> = {}) => {
  const store = createMockStore(storeOverrides)
  return {
    store,
    ...render(<StoreContext.Provider value={store}>{ui}</StoreContext.Provider>),
  }
}
