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

  it('rolls back optimistic updates when a create mutation fails and wires retry', async () => {
    const originalCreate = mockApi.apiClient.createNote
    const failingCreate = vi.fn(() => Promise.reject(new Error('boom')))
    mockApi.apiClient.createNote = failingCreate

    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).login('Jordan')
    })
    await waitFor(() => expect(getStore(storeRef).currentUser).toBe('Jordan'))

    await act(async () => {
      await getStore(storeRef).createNote()
    })

    expect(failingCreate).toHaveBeenCalledTimes(1)
    expect(getStore(storeRef).unpinnedNotes).toHaveLength(0)
    expect(getStore(storeRef).errorMessage).toBeDefined()
    expect(getStore(storeRef).retry).toBeTypeOf('function')

    await act(async () => {
      getStore(storeRef).retry?.()
    })

    await waitFor(() => {
      expect(failingCreate).toHaveBeenCalledTimes(2)
    })

    mockApi.apiClient.createNote = originalCreate
  })
})

describe('StoreProvider create flow bookkeeping', () => {
  beforeEach(() => {
    localStorage.clear()
    mockApi.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves temporary ids after successful create', async () => {
    const tempId = 'temp-note-id'
    const cryptoObj = globalThis.crypto
    if (!cryptoObj || typeof cryptoObj.randomUUID !== 'function') {
      throw new Error('crypto.randomUUID is required for this test')
    }
    const randomSpy = vi.spyOn(cryptoObj, 'randomUUID').mockReturnValue(tempId)

    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).login('Morgan')
    })
    await waitFor(() => expect(getStore(storeRef).currentUser).toBe('Morgan'))

    let serverId: string | undefined
    await act(async () => {
      serverId = await getStore(storeRef).createNote()
    })

    if (!serverId) {
      throw new Error('Expected server id from createNote')
    }

    expect(serverId).not.toBe(tempId)
    const store = getStore(storeRef)
    expect(store.unpinnedNotes.some((note) => note.id === serverId)).toBe(true)
    expect(store.unpinnedNotes.some((note) => note.id === tempId)).toBe(false)
    expect(store.resolveTempId(tempId)).toBe(serverId)
    expect(store.resolveTempId(tempId)).toBeUndefined()

    randomSpy.mockRestore()
  })

  it('cleans up pending temp ids when create fails', async () => {
    const originalCreate = mockApi.apiClient.createNote
    const tempId = 'temp-fail-id'
    const cryptoObj = globalThis.crypto
    if (!cryptoObj || typeof cryptoObj.randomUUID !== 'function') {
      throw new Error('crypto.randomUUID is required for this test')
    }
    const randomSpy = vi.spyOn(cryptoObj, 'randomUUID').mockReturnValue(tempId)
    mockApi.apiClient.createNote = vi.fn(() => Promise.reject(new Error('boom')))

    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).login('Sydney')
    })
    await waitFor(() => expect(getStore(storeRef).currentUser).toBe('Sydney'))

    await act(async () => {
      await getStore(storeRef).createNote()
    })

    const store = getStore(storeRef)
    expect(store.unpinnedNotes).toHaveLength(0)
    expect(store.resolveTempId(tempId)).toBeUndefined()

    mockApi.apiClient.createNote = originalCreate
    randomSpy.mockRestore()
  })
})

describe('StoreProvider theme persistence', () => {
  const storageKey = 'notes-lite-state-v1'

  beforeEach(() => {
    localStorage.clear()
    mockApi.reset()
  })

  it('falls back gracefully when persisted JSON is corrupt', () => {
    localStorage.setItem(storageKey, '{oops')
    const storeRef = renderStore()
    expect(getStore(storeRef).theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('hydrates remembered user and theme from storage', () => {
    localStorage.setItem(storageKey, JSON.stringify({ theme: 'dark', lastUser: 'Jamie' }))
    const storeRef = renderStore()
    expect(getStore(storeRef).theme).toBe('dark')
    expect(getStore(storeRef).rememberedUser).toBe('Jamie')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists theme changes and updates the DOM data attribute', async () => {
    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).setTheme('dark')
    })

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    const persisted = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    expect(persisted.theme).toBe('dark')
  })

  it('remembers the last user after a successful login', async () => {
    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).login('Dakota')
    })
    await waitFor(() => expect(getStore(storeRef).currentUser).toBe('Dakota'))

    const persisted = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    expect(persisted.lastUser).toBe('Dakota')
    expect(getStore(storeRef).rememberedUser).toBe('Dakota')
  })
})

describe('StoreProvider update payload shaping', () => {
  beforeEach(() => {
    localStorage.clear()
    mockApi.reset()
  })

  it('normalises blank fields before sending updates to the API', async () => {
    const note = buildNote({ id: 'abc', title: 'Original', body: 'Body' })
    seedUser('Riley', {
      notes: { abc: note },
      pinnedOrder: [],
      unpinnedOrder: ['abc'],
      archivedOrder: [],
    })

    const storeRef = renderStore()

    await act(async () => {
      getStore(storeRef).login('Riley')
    })
    await waitFor(() => expect(getStore(storeRef).currentUser).toBe('Riley'))

    const originalUpdate = mockApi.apiClient.updateNote
    let captured: any
    const updateSpy = vi.fn(async (userId: string, noteId: string, payload: any) => {
      captured = payload
      return originalUpdate(userId, noteId, payload)
    })
    mockApi.apiClient.updateNote = updateSpy

    await act(async () => {
      getStore(storeRef).updateNote('abc', {
        title: undefined,
        body: '',
        color: '',
        pinned: true,
        archived: false,
      })
    })

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1))
    expect(captured).toEqual({
      title: '',
      body: '',
      color: '#fde2e4',
      pinned: true,
      archived: false,
    })

    updateSpy.mockClear()
    await act(async () => {
      getStore(storeRef).updateNote('abc', {})
    })
    expect(updateSpy).not.toHaveBeenCalled()

    mockApi.apiClient.updateNote = originalUpdate
  })
})
