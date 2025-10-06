import type {
  Note,
  NoteCreatePayload,
  NoteOrderPayload,
  NoteUpdatePayload,
  UserStore,
} from '../../src/types'

const cloneStore = (store: UserStore): UserStore => JSON.parse(JSON.stringify(store)) as UserStore

const emptyStore = (): UserStore => ({
  notes: {},
  pinnedOrder: [],
  unpinnedOrder: [],
  archivedOrder: [],
})

const pickBucket = (note: Note, store: UserStore) => {
  if (note.archived) return store.archivedOrder
  if (note.pinned) return store.pinnedOrder
  return store.unpinnedOrder
}

export const createMockApi = () => {
  const stores = new Map<string, UserStore>()
  let counter = 0

  const ensureStore = (userId: string) => {
    if (!stores.has(userId)) {
      stores.set(userId, emptyStore())
    }
    return stores.get(userId) as UserStore
  }

  const getStore = async (userId: string) => cloneStore(ensureStore(userId))

  const createNote = async (userId: string, payload: NoteCreatePayload = {}) => {
    const store = ensureStore(userId)
    const id = `note-${++counter}`
    const now = new Date().toISOString()
    const note: Note = {
      id,
      title: payload.title ?? '',
      body: payload.body ?? '',
      color: payload.color ?? '#fde2e4',
      pinned: payload.pinned ?? false,
      archived: payload.archived ?? false,
      createdAt: now,
      updatedAt: now,
    }
    store.notes[id] = note
    const bucket = pickBucket(note, store)
    bucket.unshift(id)
    return cloneStore(store)
  }

  const updateNote = async (userId: string, noteId: string, payload: NoteUpdatePayload) => {
    const store = ensureStore(userId)
    const existing = store.notes[noteId]
    if (!existing) {
      throw new Error('Note not found')
    }

    const next: Note = {
      ...existing,
      ...payload,
      pinned: payload.pinned ?? existing.pinned,
      archived: payload.archived ?? existing.archived,
      updatedAt: new Date().toISOString(),
    }
    store.notes[noteId] = next

    if (existing.pinned !== next.pinned || existing.archived !== next.archived) {
      store.pinnedOrder = store.pinnedOrder.filter((id) => id !== noteId)
      store.unpinnedOrder = store.unpinnedOrder.filter((id) => id !== noteId)
      store.archivedOrder = store.archivedOrder.filter((id) => id !== noteId)
      const bucket = pickBucket(next, store)
      bucket.unshift(noteId)
    }

    return cloneStore(store)
  }

  const deleteNote = async (userId: string, noteId: string) => {
    const store = ensureStore(userId)
    delete store.notes[noteId]
    store.pinnedOrder = store.pinnedOrder.filter((id) => id !== noteId)
    store.unpinnedOrder = store.unpinnedOrder.filter((id) => id !== noteId)
    store.archivedOrder = store.archivedOrder.filter((id) => id !== noteId)
    return cloneStore(store)
  }

  const reorderBucket = async (userId: string, bucket: string, payload: NoteOrderPayload) => {
    const store = ensureStore(userId)
    const source =
      bucket === 'pinned' ? store.pinnedOrder : bucket === 'unpinned' ? store.unpinnedOrder : store.archivedOrder
    const valid = (payload.order ?? []).filter((id) => store.notes[id])
    const missing = source.filter((id) => !valid.includes(id))
    const merged = [...valid, ...missing]
    if (bucket === 'pinned') {
      store.pinnedOrder = merged
    } else if (bucket === 'unpinned') {
      store.unpinnedOrder = merged
    } else {
      store.archivedOrder = merged
    }
    return cloneStore(store)
  }

  const seed = (userId: string, store: UserStore) => {
    stores.set(userId, cloneStore(store))
  }

  const reset = () => {
    stores.clear()
    counter = 0
  }

  return {
    apiClient: {
      getStore,
      createNote,
      updateNote,
      deleteNote,
      reorderBucket,
    },
    seed,
    reset,
  }
}
