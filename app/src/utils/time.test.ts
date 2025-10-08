import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatRelativeTime } from './time'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-08T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns generic message for invalid dates', () => {
    expect(formatRelativeTime('not-a-date')).toBe('Updated')
  })

  it('describes recency within the current minute', () => {
    expect(formatRelativeTime('2024-01-08T12:00:00Z')).toBe('Updated just now')
  })

  it('rounds down to full minutes within the hour', () => {
    expect(formatRelativeTime('2024-01-08T11:45:00Z')).toBe('Updated 15m ago')
  })

  it('reports hours for events earlier in the day', () => {
    expect(formatRelativeTime('2024-01-08T04:00:00Z')).toBe('Updated 8h ago')
  })

  it('uses day granularity for the last week', () => {
    expect(formatRelativeTime('2024-01-05T12:00:00Z')).toBe('Updated 3d ago')
  })

  it('falls back to locale date strings after seven days', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('1/1/2024')
    expect(formatRelativeTime('2023-12-10T12:00:00Z')).toBe('Updated 1/1/2024')
    spy.mockRestore()
  })
})
