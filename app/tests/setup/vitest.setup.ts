import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { webcrypto } from 'node:crypto'

if (typeof window !== 'undefined') {
  if (!('matchMedia' in window)) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
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

  if (!('ResizeObserver' in window)) {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(window as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = ResizeObserver
  }
}

if (typeof globalThis !== 'undefined') {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = ResizeObserver
  }

  if (!('crypto' in globalThis)) {
    ;(globalThis as typeof globalThis & { crypto?: Crypto }).crypto = webcrypto as unknown as Crypto
  }
}
