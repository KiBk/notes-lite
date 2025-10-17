import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { webcrypto } from 'node:crypto'

type Runtime = typeof globalThis & {
  matchMedia?: (query: string) => MediaQueryList
  ResizeObserver?: typeof ResizeObserver
  crypto?: Crypto
}

const runtime = globalThis as Runtime

if (!runtime.matchMedia) {
  runtime.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('dark') ? false : true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

if (!runtime.ResizeObserver) {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  runtime.ResizeObserver = ResizeObserver as unknown as typeof ResizeObserver
}

if (!runtime.crypto) {
  runtime.crypto = webcrypto as unknown as Crypto
}
