import { act, render } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { StoreProvider } from '../store'
import { useStore } from '../store-context'
import type { StoreValue } from '../store-types'

const STORAGE_KEY = 'notes-lite-state-v1'

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
    throw new Error('Store failed to initialise')
  }

  return ref
}

const getStore = (storeRef: { current?: StoreValue }) => {
  if (!storeRef.current) {
    throw new Error('Store value unavailable')
  }
  return storeRef.current
}

const loginAs = async (storeRef: { current?: StoreValue }, name = 'Pat') => {
  await act(async () => {
    getStore(storeRef).login(name)
  })
  expect(getStore(storeRef).currentUser).toBe(name)
}

const createNoteViaStore = async (storeRef: { current?: StoreValue }) => {
  let id: string | undefined
  await act(async () => {
    id = getStore(storeRef).createNote()
  })
  const store = getStore(storeRef)
  expect(store.unpinnedNotes.some((note) => note.id === id)).toBe(true)
  return id!
}

describe('store logic', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('createNote seeds defaults and prepends to unpinned order', async () => {
    vi.useFakeTimers()
    const firstTimestamp = new Date('2024-01-01T00:00:00.000Z')
    vi.setSystemTime(firstTimestamp)
    const storeRef = renderStore()
    await loginAs(storeRef)

    const firstId = await createNoteViaStore(storeRef)
    const firstStore = getStore(storeRef)
    expect(firstStore.unpinnedNotes).toHaveLength(1)
    expect(firstStore.unpinnedNotes[0]).toMatchObject({
      id: firstId,
      title: '',
      body: '',
      color: firstStore.palette[0],
      pinned: false,
      archived: false,
      createdAt: firstTimestamp.toISOString(),
      updatedAt: firstTimestamp.toISOString(),
    })

    const secondTimestamp = new Date('2024-01-01T00:05:00.000Z')
    vi.setSystemTime(secondTimestamp)
    const secondId = await createNoteViaStore(storeRef)
    const ids = getStore(storeRef).unpinnedNotes.map((note) => note.id)
    expect(ids[0]).toBe(secondId)
    expect(ids).toContain(firstId)
  })

  it('updateNote merges fields and refreshes updatedAt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-02-01T10:00:00.000Z'))
    const storeRef = renderStore()
    await loginAs(storeRef)
    const id = await createNoteViaStore(storeRef)

    const created = getStore(storeRef).unpinnedNotes[0]
    expect(created.updatedAt).toBe(new Date('2024-02-01T10:00:00.000Z').toISOString())

    const later = new Date('2024-02-01T11:15:00.000Z')
    vi.setSystemTime(later)
    await act(async () => {
      getStore(storeRef).updateNote(id, { title: 'Updated', body: 'Body' })
    })

    const updated = getStore(storeRef).unpinnedNotes[0]
    expect(updated).toMatchObject({
      id,
      title: 'Updated',
      body: 'Body',
      updatedAt: later.toISOString(),
      createdAt: created.createdAt,
    })
  })

  it('togglePinned moves IDs between pinned/unpinned and ignores archived notes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-12T08:00:00.000Z'))
    const storeRef = renderStore()
    await loginAs(storeRef)
    const id = await createNoteViaStore(storeRef)

    await act(async () => {
      getStore(storeRef).togglePinned(id)
    })

    const storeAfterPin = getStore(storeRef)
    expect(storeAfterPin.pinnedNotes.some((note) => note.id === id)).toBe(true)
    expect(storeAfterPin.unpinnedNotes.some((note) => note.id === id)).toBe(false)

    vi.setSystemTime(new Date('2024-03-12T08:10:00.000Z'))
    await act(async () => {
      getStore(storeRef).togglePinned(id)
    })

    const storeAfterUnpin = getStore(storeRef)
    expect(storeAfterUnpin.pinnedNotes.some((note) => note.id === id)).toBe(false)
    expect(storeAfterUnpin.unpinnedNotes.some((note) => note.id === id)).toBe(true)

    await act(async () => {
      getStore(storeRef).toggleArchived(id)
    })

    const archivedStore = getStore(storeRef)
    expect(archivedStore.archivedNotes.some((note) => note.id === id)).toBe(true)

    await act(async () => {
      getStore(storeRef).togglePinned(id)
    })

    const archivedNote = getStore(storeRef).archivedNotes.find((note) => note.id === id)
    expect(archivedNote?.pinned).toBe(false)
  })

  it('toggleArchived clears pin state and restores unpinned order when unarchiving', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-04-01T09:00:00.000Z'))
    const storeRef = renderStore()
    await loginAs(storeRef)
    const firstId = await createNoteViaStore(storeRef)
    const secondId = await createNoteViaStore(storeRef)

    await act(async () => {
      getStore(storeRef).togglePinned(firstId)
    })
    expect(getStore(storeRef).pinnedNotes.map((note) => note.id)).toContain(firstId)

    await act(async () => {
      getStore(storeRef).toggleArchived(firstId)
    })

    const afterArchive = getStore(storeRef)
    const archivedNote = afterArchive.archivedNotes.find((note) => note.id === firstId)
    expect(archivedNote?.archived).toBe(true)
    expect(archivedNote?.pinned).toBe(false)
    expect(afterArchive.pinnedNotes.some((note) => note.id === firstId)).toBe(false)
    expect(afterArchive.unpinnedNotes.some((note) => note.id === firstId)).toBe(false)

    await act(async () => {
      getStore(storeRef).toggleArchived(firstId)
    })

    const afterUnarchive = getStore(storeRef)
    const unpinnedIds = afterUnarchive.unpinnedNotes.map((note) => note.id)
    expect(unpinnedIds[0]).toBe(firstId)
    expect(unpinnedIds).toContain(secondId)
  })

  it('deleteForever removes notes from all orders', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-05-01T12:00:00.000Z'))
    const storeRef = renderStore()
    await loginAs(storeRef)
    const id = await createNoteViaStore(storeRef)

    await act(async () => {
      getStore(storeRef).togglePinned(id)
      getStore(storeRef).togglePinned(id)
      getStore(storeRef).toggleArchived(id)
    })

    expect(getStore(storeRef).archivedNotes.some((note) => note.id === id)).toBe(true)

    await act(async () => {
      getStore(storeRef).deleteForever(id)
    })

    const afterDelete = getStore(storeRef)
    expect(afterDelete.pinnedNotes.some((note) => note.id === id)).toBe(false)
    expect(afterDelete.unpinnedNotes.some((note) => note.id === id)).toBe(false)
    expect(afterDelete.archivedNotes.some((note) => note.id === id)).toBe(false)
  })

  it('setTheme remaps palette colors and only updates timestamps for changed colors', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T14:00:00.000Z'))
    const storeRef = renderStore()
    await loginAs(storeRef)
    const firstId = await createNoteViaStore(storeRef)
    const secondId = await createNoteViaStore(storeRef)

    await act(async () => {
      getStore(storeRef).updateNote(secondId, { color: getStore(storeRef).palette[2] })
      getStore(storeRef).updateNote(firstId, { color: '#123456' })
    })

    const lightPalette = [...getStore(storeRef).palette]
    const creationTimes = getStore(storeRef).unpinnedNotes.reduce<Record<string, string>>((acc, note) => {
      acc[note.id] = note.updatedAt
      return acc
    }, {})

    const themeChangeTime = new Date('2024-06-15T15:30:00.000Z')
    vi.setSystemTime(themeChangeTime)
    await act(async () => {
      getStore(storeRef).setTheme('dark')
    })

    const updatedStore = getStore(storeRef)
    expect(updatedStore.theme).toBe('dark')
    expect(updatedStore.palette).not.toEqual(lightPalette)

    const noteA = updatedStore.unpinnedNotes.find((note) => note.id === firstId)
    const noteB = updatedStore.unpinnedNotes.find((note) => note.id === secondId)
    expect(noteB?.color).not.toBe(lightPalette[2])
    expect(noteB?.updatedAt).toBe(themeChangeTime.toISOString())
    expect(noteA?.color).toBe('#123456')
    expect(noteA?.updatedAt).toBe(creationTimes[firstId])
  })

  it('admin user login seeds demo notes once and sign out clears last user', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-07-01T08:00:00.000Z'))
    const storeRef = renderStore()
    await loginAs(storeRef, 'admin user')

    const store = getStore(storeRef)
    expect(store.pinnedNotes.length).toBeGreaterThan(0)
    expect(store.archivedNotes.length).toBeGreaterThan(0)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.lastUser).toBe('admin user')

    const seededIds = new Set(store.pinnedNotes.concat(store.unpinnedNotes).concat(store.archivedNotes).map((note) => note.id))

    await act(async () => {
      getStore(storeRef).signOut()
    })

    expect(getStore(storeRef).currentUser).toBeUndefined()
    const storedAfterSignOut = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(storedAfterSignOut.lastUser).toBeUndefined()

    await loginAs(storeRef, 'admin user')
    const currentIds = new Set(
      getStore(storeRef)
        .pinnedNotes.concat(getStore(storeRef).unpinnedNotes, getStore(storeRef).archivedNotes)
        .map((note) => note.id),
    )
    expect(currentIds).toEqual(seededIds)
  })

  it('reorderNotes ignores unknown IDs and preserves existing notes only', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-08-20T13:45:00.000Z'))
    const storeRef = renderStore()
    await loginAs(storeRef)
    const firstId = await createNoteViaStore(storeRef)
    const secondId = await createNoteViaStore(storeRef)
    const thirdId = await createNoteViaStore(storeRef)

    await act(async () => {
      getStore(storeRef).reorderNotes('unpinned', ['missing', secondId, thirdId, firstId])
    })

    const ids = getStore(storeRef).unpinnedNotes.map((note) => note.id)
    expect(ids).toEqual([secondId, thirdId, firstId])
  })
})
