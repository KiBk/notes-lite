import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../store'
import { useStore } from '../store-context'
import type { StoreValue } from '../store-types'
import type { Note, UserStore } from '../types'
vi.mock('../api/client', async () => {
  const module = await import('../../tests/helpers/apiMockInstance')
  return {
    apiClient: module.mockApi.apiClient,
    ApiError: class ApiError extends Error {},
  }
})

const { mockApi } = await import('../../tests/helpers/apiMockInstance')

const renderStore = () => {
  const ref: { current?: StoreValue } = {}

  const Consumer = () => {
    ref.current = useStore()
    return null
  }

  render(
    <StoreProvider>
      <Consumer />
    </StoreProvider>,
  )

  if (!ref.current) {
    throw new Error('Store value unavailable')
  }

  return ref
}

const getStore = (storeRef: { current?: StoreValue }) => {
  if (!storeRef.current) {
    throw new Error('Store value unavailable')
  }
  return storeRef.current
}

const buildNote = (overrides: Partial<Note>): Note => ({
  id: overrides.id ?? 'note-1',
  title: overrides.title ?? '',
  body: overrides.body ?? '',
  color: overrides.color ?? '#fde2e4',
  pinned: overrides.pinned ?? false,
  archived: overrides.archived ?? false,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
})

const seedUser = (user: string, store: UserStore) => {
  mockApi.seed(user, store)
}

describe('StoreProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    mockApi.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hydrates from API on login', async () => {
    const note = buildNote({ id: 'seed-note', title: 'Seed' })
    seedUser('Pat', {
      notes: { 'seed-note': note },
      pinnedOrder: [],
      unpinnedOrder: ['seed-note'],
      archivedOrder: [],
    })

    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).login('Pat')
    })

    await waitFor(() => {
      expect(getStore(storeRef).currentUser).toBe('Pat')
      expect(getStore(storeRef).unpinnedNotes[0]?.id).toBe('seed-note')
    })
  })

  it('creates notes via API and merges server response', async () => {
    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).login('Taylor')
    })

    await waitFor(() => expect(getStore(storeRef).currentUser).toBe('Taylor'))

    let createdId: string | undefined
    await act(async () => {
      createdId = await getStore(storeRef).createNote()
    })

    expect(createdId).toBeDefined()
    const store = getStore(storeRef)
    expect(store.unpinnedNotes.some((note) => note.id === createdId)).toBe(true)
  })

  it('surfaces error state when a mutation fails', async () => {
    const originalCreate = mockApi.apiClient.createNote
    mockApi.apiClient.createNote = () => Promise.reject(new Error('boom'))

    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).login('Jordan')
    })
    await waitFor(() => expect(getStore(storeRef).currentUser).toBe('Jordan'))

    await act(async () => {
      await getStore(storeRef).createNote()
    })

    expect(getStore(storeRef).errorMessage).toBeDefined()
    expect(getStore(storeRef).retry).toBeTypeOf('function')

    mockApi.apiClient.createNote = originalCreate
  })
})
