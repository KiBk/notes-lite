import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserStore } from '../types'

const emptyStore: UserStore = {
  notes: {},
  pinnedOrder: [],
  unpinnedOrder: [],
  archivedOrder: [],
}

describe('API client', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('uses configured base URL and trims trailing slashes', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/')

    const fetchMock = vi.fn(async () => new Response(JSON.stringify(emptyStore), { status: 200 }))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    try {
      const { createApiClient } = await import('./client')
      const client = createApiClient()
      await client.getStore('Pat')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.example.com/api/users/Pat/store')
      expect(infoSpy).toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('infers dev base URL when VITE_API_BASE_URL is unset', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', '')
    const locationSpy = vi
      .spyOn(window, 'location', 'get')
      .mockReturnValue({
        protocol: 'http:',
        hostname: 'localhost',
        port: '5173',
      } as unknown as Location)

    const fetchMock = vi.fn(async () => new Response(JSON.stringify(emptyStore), { status: 200 }))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const { createApiClient } = await import('./client')
      const client = createApiClient()
      await client.getStore('Jamie')
      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe('http://localhost:4000/api/users/Jamie/store')
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
      locationSpy.mockRestore()
    }
  })

  it('wraps error responses with ApiError carrying payload details', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', '')

    const errorBody = { message: 'Denied', details: { reason: 'invalid' } }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(errorBody), { status: 422 }))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch

    try {
      const { createApiClient, ApiError } = await import('./client')
      const client = createApiClient('https://example.dev')
      const error = await client.createNote('Taylor', {}).catch((err) => err as unknown)

      expect(error).toBeInstanceOf(ApiError)
      if (error instanceof ApiError) {
        expect(error.status).toBe(422)
        expect(error.message).toBe('Denied')
        expect(error.payload).toEqual(errorBody)
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
