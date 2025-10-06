import type {
  ApiErrorPayload,
  NoteCreatePayload,
  NoteOrderPayload,
  NoteUpdatePayload,
  UserStore,
} from '../types'

const normalizeBase = (value: string) => value.replace(/\/$/, '')

const inferDevBase = () => {
  if (typeof window === 'undefined') {
    return ''
  }
  const { protocol, hostname, port } = window.location
  if (port === '4173' || port === '5173') {
    return `${protocol}//${hostname}:4000`
  }
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`
}

const resolveBaseUrl = () => {
  if (typeof console !== 'undefined') {
    console.info('import.meta.env.VITE_API_BASE_URL', import.meta?.env?.VITE_API_BASE_URL)
  }
  const raw = import.meta?.env?.VITE_API_BASE_URL as string | undefined
  if (raw && raw.trim().length > 0) {
    return normalizeBase(raw.trim())
  }
  const inferred = inferDevBase()
  if (inferred) {
    if (typeof console !== 'undefined') {
      console.warn(
        'VITE_API_BASE_URL is not configured; defaulting API client to',
        inferred,
      )
    }
    return normalizeBase(inferred)
  }
  return ''
}

const defaultBaseUrl = resolveBaseUrl()

export interface ApiClient {
  getStore: (userId: string) => Promise<UserStore>
  createNote: (userId: string, payload?: NoteCreatePayload) => Promise<UserStore>
  updateNote: (userId: string, noteId: string, payload: NoteUpdatePayload) => Promise<UserStore>
  deleteNote: (userId: string, noteId: string) => Promise<UserStore>
  reorderBucket: (userId: string, bucket: string, payload: NoteOrderPayload) => Promise<UserStore>
}

export class ApiError extends Error {
  status: number
  payload?: ApiErrorPayload

  constructor(message: string, status: number, payload?: ApiErrorPayload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

const buildUrl = (baseUrl: string, path: string) => {
  if (!baseUrl) return path
  return `${baseUrl}${path}`
}

const parseJson = async (response: Response) => {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch (error) {
    console.warn('Failed to parse response JSON', error)
    return undefined
  }
}

const request = async <T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<T> => {
  const target = buildUrl(baseUrl, path)
  const response = await fetch(target, init)

  if (!response.ok) {
    const payload = (await parseJson(response)) as ApiErrorPayload | undefined
    const message = payload?.message ?? `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, payload)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = await parseJson(response)
  if (data === undefined) {
    throw new ApiError('Received empty response body', response.status)
  }
  return data as T
}

const jsonHeaders = { 'Content-Type': 'application/json' }

const encode = (value: string) => encodeURIComponent(value)

export const createApiClient = (baseUrl: string = defaultBaseUrl): ApiClient => ({
  getStore: (userId: string) =>
    request<UserStore>(baseUrl, `/api/users/${encode(userId)}/store`, {
      method: 'GET',
      headers: jsonHeaders,
    }),

  createNote: (userId: string, payload?: NoteCreatePayload) =>
    request<UserStore>(baseUrl, `/api/users/${encode(userId)}/notes`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload ?? {}),
    }),

  updateNote: (userId: string, noteId: string, payload: NoteUpdatePayload) =>
    request<UserStore>(baseUrl, `/api/users/${encode(userId)}/notes/${encode(noteId)}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload ?? {}),
    }),

  deleteNote: (userId: string, noteId: string) =>
    request<UserStore>(baseUrl, `/api/users/${encode(userId)}/notes/${encode(noteId)}`, {
      method: 'DELETE',
      headers: jsonHeaders,
    }),

  reorderBucket: (userId: string, bucket: string, payload: NoteOrderPayload) =>
    request<UserStore>(baseUrl, `/api/users/${encode(userId)}/orders/${encode(bucket)}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload ?? {}),
    }),
})

export const apiClient = createApiClient()
