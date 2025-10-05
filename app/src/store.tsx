import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { StoreContext } from './store-context'
import type { NoteBucket, StoreValue } from './store-types'
import type { Note, PersistedState, ThemeMode, UserStore } from './types'

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
  return {
    notes: { ...store.notes },
    pinnedOrder: [...store.pinnedOrder],
    unpinnedOrder: [...store.unpinnedOrder],
    archivedOrder: [...store.archivedOrder],
  }
}

const isStoreEmpty = (store: UserStore | undefined) => {
  if (!store) return true
  if (store.pinnedOrder.length > 0 || store.unpinnedOrder.length > 0 || store.archivedOrder.length > 0) {
    return false
  }
  return Object.keys(store.notes).length === 0
}

const buildAdminSeedStore = (palette: string[]): UserStore => {
  const now = new Date().toISOString()
  const seedNotes: Note[] = [
    {
      id: 'admin-note-team-sync',
      title: 'Team sync notes',
      body: '- Confirm sprint goals\n- Demo the inbox zero clean-up\n- Surface any blockers before retro',
      color: palette[2 % palette.length],
      pinned: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'admin-note-product-polish',
      title: 'Product polish checklist',
      body: '• Sweep app for copy nits\n• QA drag and drop in safari\n• Prep screenshots for release post',
      color: palette[0],
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'admin-note-archive',
      title: 'Archived: Launch recap',
      body: '✅ Handoff to support\n✅ Close out launch tracker\n⏳ Collect feedback survey responses',
      color: palette[3 % palette.length],
      pinned: false,
      archived: true,
      createdAt: now,
      updatedAt: now,
    },
  ]

  const notes: Record<string, Note> = {}
  const pinnedOrder: string[] = []
  const unpinnedOrder: string[] = []
  const archivedOrder: string[] = []

  seedNotes.forEach((note) => {
    notes[note.id] = note
    if (note.archived) {
      archivedOrder.push(note.id)
    } else if (note.pinned) {
      pinnedOrder.push(note.id)
    } else {
      unpinnedOrder.push(note.id)
    }
  })

  return {
    notes,
    pinnedOrder,
    unpinnedOrder,
    archivedOrder,
  }
}

const createSeedStore = (name: string, theme: ThemeMode): UserStore => {
  if (name.trim().toLowerCase() === 'admin user') {
    const palette = theme === 'dark' ? DARK_PASTELS : LIGHT_PASTELS
    return buildAdminSeedStore(palette)
  }
  return cloneUser(undefined)
}

const getSystemTheme = (): ThemeMode => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

const loadInitialState = (): PersistedState => {
  if (typeof window === 'undefined') {
    return { users: {}, theme: 'light' }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { users: {}, theme: getSystemTheme() }
    }
    const parsed = JSON.parse(raw) as PersistedState
    const users = { ...(parsed.users ?? {}) }
    const adminKey = Object.keys(users).find((key) => key.trim().toLowerCase() === 'admin user')
    const resolvedTheme = parsed.theme ?? getSystemTheme()
    if (adminKey && isStoreEmpty(users[adminKey])) {
      const palette = resolvedTheme === 'dark' ? DARK_PASTELS : LIGHT_PASTELS
      users[adminKey] = buildAdminSeedStore(palette)
    }
    return {
      users,
      lastUser: parsed.lastUser,
      theme: resolvedTheme,
    }
  } catch (err) {
    console.warn('Failed to load notes state', err)
    return { users: {}, theme: getSystemTheme() }
  }
}

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PersistedState>(() => loadInitialState())

  const theme = state.theme ?? getSystemTheme()
  const palette = theme === 'dark' ? DARK_PASTELS : LIGHT_PASTELS
  const currentUser = state.lastUser

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      console.warn('Failed to persist notes state', err)
    }
  }, [state])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.setProperty('color-scheme', theme)
  }, [theme])

  const ensureUser = (name: string, prev: PersistedState) => {
    const users = { ...prev.users }
    const existing = users[name]
    const shouldSeedAdmin = name.trim().toLowerCase() === 'admin user'
    const currentTheme = prev.theme ?? getSystemTheme()
    const store = !existing
      ? createSeedStore(name, currentTheme)
      : shouldSeedAdmin && isStoreEmpty(existing)
        ? buildAdminSeedStore(currentTheme === 'dark' ? DARK_PASTELS : LIGHT_PASTELS)
        : cloneUser(existing)
    users[name] = store
    return { users, store }
  }

  const login = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState((prev) => {
      const { users } = ensureUser(trimmed, prev)
      return {
        ...prev,
        users,
        lastUser: trimmed,
      }
    })
  }, [])

  const signOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lastUser: undefined,
    }))
  }, [])

  const setTheme = useCallback((mode: ThemeMode) => {
    setState((prev) => {
      const currentTheme = prev.theme ?? getSystemTheme()
      if (currentTheme === mode) {
        return prev
      }
      const fromPalette = currentTheme === 'dark' ? DARK_PASTELS : LIGHT_PASTELS
      const toPalette = mode === 'dark' ? DARK_PASTELS : LIGHT_PASTELS
      const now = new Date().toISOString()
      const mapColor = (color: string) => {
        const idx = fromPalette.findIndex((hex) => hex.toLowerCase() === color.toLowerCase())
        return idx === -1 ? color : toPalette[idx] ?? color
      }
      const users = Object.entries(prev.users).reduce<Record<string, UserStore>>((acc, [name, store]) => {
        const nextNotes: Record<string, Note> = {}
        let changed = false
        Object.entries(store.notes).forEach(([id, note]) => {
          const nextColor = mapColor(note.color)
          if (nextColor === note.color) {
            nextNotes[id] = note
            return
          }
          changed = true
          nextNotes[id] = {
            ...note,
            color: nextColor,
            updatedAt: now,
          }
        })
        acc[name] = changed
          ? {
              notes: nextNotes,
              pinnedOrder: [...store.pinnedOrder],
              unpinnedOrder: [...store.unpinnedOrder],
              archivedOrder: [...store.archivedOrder],
            }
          : store
        return acc
      }, {})

      return {
        ...prev,
        theme: mode,
        users,
      }
    })
  }, [])

  const mutateUser = useCallback(
    (updater: (store: UserStore) => UserStore | void) => {
      if (!currentUser) return
      setState((prev) => {
        const existing = prev.users[currentUser]
        const cloned = cloneUser(existing)
        const result = updater(cloned)
        const nextUsers = { ...prev.users, [currentUser]: result ?? cloned }
        return {
          ...prev,
          users: nextUsers,
        }
      })
    },
    [currentUser],
  )

  const createNote = useCallback(() => {
    if (!currentUser) return undefined
    const id = generateId()
    const now = new Date().toISOString()
    mutateUser((store) => {
      const note: Note = {
        id,
        title: '',
        body: '',
        color: palette[0],
        pinned: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      }
      store.notes[id] = note
      store.unpinnedOrder = [id, ...store.unpinnedOrder.filter((nid) => nid !== id)]
      return store
    })
    return id
  }, [currentUser, mutateUser, palette])

  const updateNote = useCallback(
    (id: string, changes: Partial<Omit<Note, 'id'>>) => {
      mutateUser((store) => {
        const existing = store.notes[id]
        if (!existing) return store
        const updated: Note = {
          ...existing,
          ...changes,
          updatedAt: changes.updatedAt ?? new Date().toISOString(),
        }
        store.notes[id] = updated
        return store
      })
    },
    [mutateUser],
  )

  const togglePinned = useCallback(
    (id: string) => {
      mutateUser((store) => {
        const note = store.notes[id]
        if (!note || note.archived) return store
        const nextPinned = !note.pinned
        note.pinned = nextPinned
        note.updatedAt = new Date().toISOString()
        store.pinnedOrder = store.pinnedOrder.filter((nid) => nid !== id)
        store.unpinnedOrder = store.unpinnedOrder.filter((nid) => nid !== id)
        if (nextPinned) {
          store.pinnedOrder = [id, ...store.pinnedOrder]
        } else {
          store.unpinnedOrder = [id, ...store.unpinnedOrder]
        }
        return store
      })
    },
    [mutateUser],
  )

  const toggleArchived = useCallback(
    (id: string) => {
      mutateUser((store) => {
        const note = store.notes[id]
        if (!note) return store
        const nextArchived = !note.archived
        note.archived = nextArchived
        note.updatedAt = new Date().toISOString()
        if (nextArchived) {
          note.pinned = false
          store.pinnedOrder = store.pinnedOrder.filter((nid) => nid !== id)
          store.unpinnedOrder = store.unpinnedOrder.filter((nid) => nid !== id)
          store.archivedOrder = [id, ...store.archivedOrder.filter((nid) => nid !== id)]
        } else {
          store.archivedOrder = store.archivedOrder.filter((nid) => nid !== id)
          store.unpinnedOrder = [id, ...store.unpinnedOrder.filter((nid) => nid !== id)]
        }
        return store
      })
    },
    [mutateUser],
  )

  const deleteForever = useCallback(
    (id: string) => {
      mutateUser((store) => {
        if (!store.notes[id]) return store
        delete store.notes[id]
        store.pinnedOrder = store.pinnedOrder.filter((nid) => nid !== id)
        store.unpinnedOrder = store.unpinnedOrder.filter((nid) => nid !== id)
        store.archivedOrder = store.archivedOrder.filter((nid) => nid !== id)
        return store
      })
    },
    [mutateUser],
  )

  const reorderNotes = useCallback(
    (bucket: NoteBucket, newOrder: string[]) => {
      mutateUser((store) => {
        const sanitised = newOrder.filter((nid) => store.notes[nid])
        if (bucket === 'pinned') {
          store.pinnedOrder = sanitised
        } else if (bucket === 'unpinned') {
          store.unpinnedOrder = sanitised
        } else {
          store.archivedOrder = sanitised
        }
        return store
      })
    },
    [mutateUser],
  )

  const userStore = currentUser ? state.users[currentUser] ?? emptyUserStore : emptyUserStore

  const { pinnedNotes, unpinnedNotes, archivedNotes } = useMemo(() => {
    const deriveNotes = (ids: string[]) => ids.map((id) => userStore.notes[id]).filter(Boolean)
    return {
      pinnedNotes: deriveNotes(userStore.pinnedOrder),
      unpinnedNotes: deriveNotes(userStore.unpinnedOrder),
      archivedNotes: deriveNotes(userStore.archivedOrder),
    }
  }, [userStore])

  const value = useMemo<StoreValue>(
    () => ({
      theme,
      palette,
      currentUser,
      pinnedNotes,
      unpinnedNotes,
      archivedNotes,
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
      pinnedNotes,
      unpinnedNotes,
      archivedNotes,
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
