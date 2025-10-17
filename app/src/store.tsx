import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StoreContext } from './store-context'
import { apiClient, ApiError } from './api/client'
import type { NoteBucket, StoreValue } from './store-types'
import type {
  Note,
  NoteOrderPayload,
  NoteUpdatePayload,
  PersistedState,
  ThemeMode,
  UserStore,
} from './types'

const STORAGE_KEY = 'notes-lite-state-v1'

const LIGHT_PASTELS = [
  '#fde2e4',
  '#fff1d0',
  '#e9f5db',
  '#d7e3fc',
  '#f1dfe7',
  '#ffe5d9',
  '#e7e5ff',
]

const DARK_PASTELS = [
  '#5b3a3f',
  '#5a513f',
  '#314a46',
  '#313a55',
  '#4f3a4d',
  '#4a4940',
  '#36475a',
]

const normalizeHex = (hex: string) => hex.trim().toLowerCase()

const paletteForTheme = (mode: ThemeMode) => (mode === 'dark' ? DARK_PASTELS : LIGHT_PASTELS)

type NoteColorUpdate = { id: string; color: string }

const remapUserStoreColors = (
  store: UserStore,
  fromTheme: ThemeMode,
  toTheme: ThemeMode,
): { store: UserStore; updates: NoteColorUpdate[] } => {
  if (fromTheme === toTheme) {
    return { store, updates: [] }
  }

  const sourcePalette = paletteForTheme(fromTheme)
  const targetPalette = paletteForTheme(toTheme)
  const lookup = new Map(sourcePalette.map((color, index) => [normalizeHex(color), index]))

  const nextNotes: Record<string, Note> = { ...store.notes }
  const updates: NoteColorUpdate[] = []

  Object.entries(store.notes).forEach(([id, note]) => {
    const paletteIndex = lookup.get(normalizeHex(note.color))
    if (paletteIndex === undefined) {
      return
    }
    const nextColor = targetPalette[paletteIndex]
    if (!nextColor || nextColor === note.color) {
      return
    }
    nextNotes[id] = { ...note, color: nextColor }
    updates.push({ id, color: nextColor })
  })

  if (updates.length === 0) {
    return { store, updates }
  }

  return {
    store: {
      ...store,
      notes: nextNotes,
    },
    updates,
  }
}

const emptyUserStore: UserStore = {
  notes: {},
  pinnedOrder: [],
  unpinnedOrder: [],
  archivedOrder: [],
}

const getCrypto = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto
  }
  return undefined
}

const generateId = () => {
  const cryptoObj = getCrypto()
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID()
  }
  if (cryptoObj?.getRandomValues) {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const cloneUser = (store: UserStore | undefined): UserStore => {
  if (!store) {
    return {
      notes: {},
      pinnedOrder: [],
      unpinnedOrder: [],
      archivedOrder: [],
    }
  }
  const notes: Record<string, Note> = {}
  Object.entries(store.notes).forEach(([id, note]) => {
    notes[id] = { ...note }
  })
  return {
    notes,
    pinnedOrder: [...store.pinnedOrder],
    unpinnedOrder: [...store.unpinnedOrder],
    archivedOrder: [...store.archivedOrder],
  }
}

const getSystemTheme = (): ThemeMode => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

const loadPersistedState = (): PersistedState => {
  if (typeof window === 'undefined') {
    return { theme: 'light' }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { theme: getSystemTheme() }
    }
    const parsed = JSON.parse(raw) as PersistedState
    return {
      theme: parsed.theme ?? getSystemTheme(),
      lastUser: parsed.lastUser,
    }
  } catch (error) {
    console.warn('Failed to load persisted state', error)
    return { theme: getSystemTheme() }
  }
}

const persistState = (state: PersistedState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Failed to persist settings', error)
  }
}

const toErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

const buildUpdatePayload = (changes: Partial<Omit<Note, 'id'>>): NoteUpdatePayload => {
  const payload: NoteUpdatePayload = {}
  const assign = <K extends keyof NoteUpdatePayload>(key: K, value: NoteUpdatePayload[K]) => {
    ;(payload as Record<string, unknown>)[key] = value
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'title')) {
    assign('title', changes.title ?? '')
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'body')) {
    assign('body', changes.body ?? '')
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'color')) {
    if (changes.color) {
      assign('color', changes.color)
    } else {
      assign('color', LIGHT_PASTELS[0])
    }
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'pinned')) {
    assign('pinned', Boolean(changes.pinned))
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'archived')) {
    assign('archived', Boolean(changes.archived))
  }
  return payload
}

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [persisted, setPersisted] = useState<PersistedState>(() => loadPersistedState())
  const [currentUser, setCurrentUser] = useState<string>()
  const [userStore, setUserStore] = useState<UserStore>(emptyUserStore)
  const storeRef = useRef<UserStore>(userStore)
  const pendingCreates = useRef<Map<string, string>>(new Map())
  const [phase, setPhase] = useState<'signedOut' | 'loading' | 'ready'>('signedOut')
  const [savingCount, setSavingCount] = useState(0)
  const [errorState, setErrorState] = useState<{ message: string; retry?: () => void } | null>(null)

  useEffect(() => {
    storeRef.current = userStore
  }, [userStore])

  const theme = persisted.theme ?? getSystemTheme()
  const palette = theme === 'dark' ? DARK_PASTELS : LIGHT_PASTELS

  useEffect(() => {
    persistState(persisted)
  }, [persisted])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.setProperty('color-scheme', theme)
  }, [theme])

  const clearError = useCallback(() => {
    setErrorState(null)
  }, [])

  const runMutation = useCallback(
    async (options: {
      run: () => Promise<UserStore>
      optimistic?: (store: UserStore) => UserStore
      retry: () => void | Promise<void>
    }): Promise<UserStore | undefined> => {
      if (!currentUser) {
        return undefined
      }
      const snapshot = cloneUser(storeRef.current)
      let applied = false
      if (options.optimistic) {
        const optimisticStore = options.optimistic(cloneUser(snapshot))
        setUserStore(optimisticStore)
        applied = true
      }
      setSavingCount((count) => count + 1)
      setErrorState(null)
      try {
        const remoteStore = await options.run()
        setUserStore(remoteStore)
        return remoteStore
      } catch (error) {
        if (applied) {
          setUserStore(snapshot)
        }
        const message = toErrorMessage(error)
        setErrorState({ message, retry: options.retry })
        throw error
      } finally {
        setSavingCount((count) => Math.max(0, count - 1))
      }
    },
    [currentUser],
  )

  const login = useCallback(
    (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setErrorState(null)
      setPhase('loading')
      setCurrentUser(trimmed)

      const attempt = async () => {
        try {
          const store = await apiClient.getStore(trimmed)
          setUserStore(store)
          setPhase('ready')
          setPersisted((prev) => ({ ...prev, lastUser: trimmed }))
        } catch (error) {
          setPhase('signedOut')
          setCurrentUser(undefined)
          const message = toErrorMessage(error)
          setErrorState({ message, retry: () => login(trimmed) })
        }
      }

      void attempt()
    },
    [],
  )

  const signOut = useCallback(() => {
    setCurrentUser(undefined)
    setUserStore(emptyUserStore)
    setPhase('signedOut')
    setSavingCount(0)
    setErrorState(null)
  }, [])

  const createNote = useCallback(async () => {
    if (!currentUser) return undefined
    const userId = currentUser
    const tempId = generateId()
    const now = new Date().toISOString()
    const optimisticNote: Note = {
      id: tempId,
      title: '',
      body: '',
      color: palette[0],
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    const previous = cloneUser(storeRef.current)
    try {
      const remoteStore = await runMutation({
        run: () => apiClient.createNote(userId, { color: optimisticNote.color }),
        optimistic: (store) => {
          store.notes[tempId] = optimisticNote
          store.unpinnedOrder = [tempId, ...store.unpinnedOrder.filter((nid) => nid !== tempId)]
          return store
        },
        retry: () => {
          void createNote()
        },
      })
      if (!remoteStore) {
        return tempId
      }
      const existingIds = new Set(Object.keys(previous.notes))
      const newId = Object.keys(remoteStore.notes).find((id) => !existingIds.has(id))
      if (newId && newId !== tempId) {
        pendingCreates.current.set(tempId, newId)
      }
      return newId ?? tempId
    } catch (error) {
      console.warn('Failed to create note', error)
      pendingCreates.current.delete(tempId)
      return undefined
    }
  }, [currentUser, palette, runMutation])

  const updateNote = useCallback(
    (id: string, changes: Partial<Omit<Note, 'id'>>) => {
      if (!currentUser) return
      const userId = currentUser
      const payload = buildUpdatePayload(changes)
      if (Object.keys(payload).length === 0) {
        return
      }
      const now = new Date().toISOString()
      void runMutation({
        run: () => apiClient.updateNote(userId, id, payload as NoteUpdatePayload),
        optimistic: (store) => {
          const existing = store.notes[id]
          if (!existing) return store
          const optimisticNote: Note = {
            ...existing,
            ...changes,
            updatedAt: changes.updatedAt ?? now,
          }
          store.notes[id] = optimisticNote
          return store
        },
        retry: () => {
          updateNote(id, changes)
        },
      }).catch(() => {
        // handled via error state
      })
    },
    [currentUser, runMutation],
  )

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      const previousTheme = theme
      if (previousTheme === mode) {
        return
      }

      let updates: NoteColorUpdate[] = []
      if (currentUser) {
        const { store: recoloredStore, updates: recolored } = remapUserStoreColors(
          cloneUser(storeRef.current),
          previousTheme,
          mode,
        )
        if (recolored.length > 0) {
          setUserStore(recoloredStore)
          updates = recolored
        }
      }

      setPersisted((prev) => ({ ...prev, theme: mode }))

      if (updates.length > 0) {
        updates.forEach(({ id, color }) => {
          updateNote(id, { color })
        })
      }
    },
    [currentUser, theme, updateNote],
  )

  const togglePinned = useCallback(
    (id: string) => {
      if (!currentUser) return
      const userId = currentUser
      const existing = storeRef.current.notes[id]
      if (!existing || existing.archived) return
      const nextPinned = !existing.pinned
      const now = new Date().toISOString()
      void runMutation({
        run: () => apiClient.updateNote(userId, id, { pinned: nextPinned }),
        optimistic: (store) => {
          const note = store.notes[id]
          if (!note) return store
          const updated: Note = {
            ...note,
            pinned: nextPinned,
            archived: false,
            updatedAt: now,
          }
          store.notes[id] = updated
          store.pinnedOrder = store.pinnedOrder.filter((nid) => nid !== id)
          store.unpinnedOrder = store.unpinnedOrder.filter((nid) => nid !== id)
          if (nextPinned) {
            store.pinnedOrder = [id, ...store.pinnedOrder]
          } else {
            store.unpinnedOrder = [id, ...store.unpinnedOrder]
          }
          return store
        },
        retry: () => {
          togglePinned(id)
        },
      }).catch(() => undefined)
    },
    [currentUser, runMutation],
  )

  const toggleArchived = useCallback(
    (id: string) => {
      if (!currentUser) return
      const userId = currentUser
      const existing = storeRef.current.notes[id]
      if (!existing) return
      const nextArchived = !existing.archived
      const now = new Date().toISOString()
      const nextPinned = nextArchived ? false : existing.pinned
      void runMutation({
        run: () => apiClient.updateNote(userId, id, { archived: nextArchived, pinned: nextPinned }),
        optimistic: (store) => {
          const note = store.notes[id]
          if (!note) return store
          const updated: Note = {
            ...note,
            archived: nextArchived,
            pinned: nextPinned,
            updatedAt: now,
          }
          store.notes[id] = updated
          store.pinnedOrder = store.pinnedOrder.filter((nid) => nid !== id)
          store.unpinnedOrder = store.unpinnedOrder.filter((nid) => nid !== id)
          store.archivedOrder = store.archivedOrder.filter((nid) => nid !== id)
          if (nextArchived) {
            store.archivedOrder = [id, ...store.archivedOrder]
          } else if (nextPinned) {
            store.pinnedOrder = [id, ...store.pinnedOrder]
          } else {
            store.unpinnedOrder = [id, ...store.unpinnedOrder]
          }
          return store
        },
        retry: () => {
          toggleArchived(id)
        },
      }).catch(() => undefined)
    },
    [currentUser, runMutation],
  )

  const deleteForever = useCallback(
    (id: string) => {
      if (!currentUser) return
      const userId = currentUser
      void runMutation({
        run: () => apiClient.deleteNote(userId, id),
        optimistic: (store) => {
          if (!store.notes[id]) return store
          delete store.notes[id]
          store.pinnedOrder = store.pinnedOrder.filter((nid) => nid !== id)
          store.unpinnedOrder = store.unpinnedOrder.filter((nid) => nid !== id)
          store.archivedOrder = store.archivedOrder.filter((nid) => nid !== id)
          return store
        },
        retry: () => {
          deleteForever(id)
        },
      }).catch(() => undefined)
    },
    [currentUser, runMutation],
  )

  const reorderNotes = useCallback(
    (bucket: NoteBucket, newOrder: string[]) => {
      if (!currentUser) return
      const userId = currentUser
      const payload: NoteOrderPayload = { order: newOrder }
      void runMutation({
        run: () => apiClient.reorderBucket(userId, bucket, payload),
        optimistic: (store) => {
          const valid = newOrder.filter((nid) => store.notes[nid])
          const current =
            bucket === 'pinned'
              ? store.pinnedOrder
              : bucket === 'unpinned'
                ? store.unpinnedOrder
                : store.archivedOrder
          const missing = current.filter((nid) => !valid.includes(nid))
          const merged = [...valid, ...missing]
          if (bucket === 'pinned') {
            store.pinnedOrder = merged
          } else if (bucket === 'unpinned') {
            store.unpinnedOrder = merged
          } else {
            store.archivedOrder = merged
          }
          return store
        },
        retry: () => {
          reorderNotes(bucket, newOrder)
        },
      }).catch(() => undefined)
    },
    [currentUser, runMutation],
  )

  const userStoreValue = currentUser ? userStore : emptyUserStore

  const { pinnedNotes, unpinnedNotes, archivedNotes } = useMemo(() => {
    const deriveNotes = (ids: string[]) => ids.map((id) => userStoreValue.notes[id]).filter(Boolean)
    return {
      pinnedNotes: deriveNotes(userStoreValue.pinnedOrder),
      unpinnedNotes: deriveNotes(userStoreValue.unpinnedOrder),
      archivedNotes: deriveNotes(userStoreValue.archivedOrder),
    }
  }, [userStoreValue])

  const resolveTempId = useCallback(
    (id: string) => {
      const resolved = pendingCreates.current.get(id)
      if (resolved && resolved !== id) {
        pendingCreates.current.delete(id)
        return resolved
      }
      if (resolved === id) {
        pendingCreates.current.delete(id)
      }
      return resolved
    },
    [],
  )

  const value = useMemo<StoreValue>(
    () => ({
      theme,
      palette,
      currentUser,
      rememberedUser: persisted.lastUser,
      pinnedNotes,
      unpinnedNotes,
      archivedNotes,
      isLoading: phase === 'loading',
      isSaving: savingCount > 0,
      errorMessage: errorState?.message,
      retry: errorState?.retry,
      clearError,
      resolveTempId,
      login,
      signOut,
      setTheme,
      createNote,
      updateNote,
      togglePinned,
      toggleArchived,
      deleteForever,
      reorderNotes,
    }),
    [
      theme,
      palette,
      currentUser,
      persisted.lastUser,
      pinnedNotes,
      unpinnedNotes,
      archivedNotes,
      phase,
      savingCount,
      errorState,
      clearError,
      resolveTempId,
      login,
      signOut,
      setTheme,
      createNote,
      updateNote,
      togglePinned,
      toggleArchived,
      deleteForever,
      reorderNotes,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
