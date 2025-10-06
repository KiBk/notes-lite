import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { StoreProvider } from '../store'
import type { Note, UserStore } from '../types'
vi.mock('../api/client', async () => {
  const module = await import('../../tests/helpers/apiMockInstance')
  return {
    apiClient: module.mockApi.apiClient,
    ApiError: class ApiError extends Error {},
  }
})

const { mockApi } = await import('../../tests/helpers/apiMockInstance')

const renderApp = () =>
  render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  )

const seedUserState = (user: string, store: UserStore) => {
  mockApi.seed(user, store)
}

describe('App integration', () => {
  beforeEach(() => {
    localStorage.clear()
    mockApi.reset()
  })

  it('renders top bar after signing in', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Pat'), 'Taylor')
    await user.click(screen.getByRole('button', { name: 'Enter Notes' }))

    await screen.findByRole('button', { name: 'Sign out' })
  })

  it('filters buckets based on search query across pinned, unpinned, and archived notes', async () => {
    const notes: Note[] = [
      {
        id: 'pinned-note',
        title: 'Alpha project',
        body: 'Pinned insight',
        color: '#fde2e4',
        pinned: true,
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'unpinned-note',
        title: 'Beta backlog',
        body: 'General plans',
        color: '#fff1d0',
        pinned: false,
        archived: false,
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
      {
        id: 'archived-note',
        title: 'Gamma archive',
        body: 'Archived summary',
        color: '#e9f5db',
        pinned: false,
        archived: true,
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z',
      },
    ]

    seedUserState('Casey', {
      notes: {
        'pinned-note': notes[0],
        'unpinned-note': notes[1],
        'archived-note': notes[2],
      },
      pinnedOrder: ['pinned-note'],
      unpinnedOrder: ['unpinned-note'],
      archivedOrder: ['archived-note'],
    })

    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Pat'), 'Casey')
    await user.click(screen.getByRole('button', { name: 'Enter Notes' }))

    await screen.findByText('Alpha project')

    const searchBox = screen.getByPlaceholderText('Search notes')
    await user.type(searchBox, 'alpha')

    await waitFor(() => {
      expect(screen.getByText('Alpha project')).toBeVisible()
      expect(screen.queryByText('Beta backlog')).toBeNull()
      expect(screen.queryByText('Gamma archive')).toBeNull()
    })

    await user.clear(searchBox)
    await user.type(searchBox, 'gamma')

    await waitFor(() => {
      expect(screen.getByText('Gamma archive')).toBeVisible()
      expect(screen.queryByText('Alpha project')).toBeNull()
    })
  })

  it('closes note sheet after deleting the active note', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Pat'), 'Jordan')
    await user.click(screen.getByRole('button', { name: 'Enter Notes' }))

    await user.click(screen.getByRole('button', { name: 'Create note' }))
    await screen.findByPlaceholderText('Title')

    await user.click(screen.getByRole('button', { name: '○ Archive' }))
    await screen.findByRole('button', { name: '○ Delete forever' })

    await user.click(screen.getByRole('button', { name: '○ Delete forever' }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Title')).toBeNull()
    })
  })

  it('shows empty message when search has no matches across tabs', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Pat'), 'Jamie')
    await user.click(screen.getByRole('button', { name: 'Enter Notes' }))

    const searchBox = await screen.findByPlaceholderText('Search notes')
    await user.type(searchBox, 'nope')

    await screen.findByText('No notes match that search.')
  })
})
