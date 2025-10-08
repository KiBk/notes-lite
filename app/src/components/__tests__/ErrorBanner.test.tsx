import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ErrorBanner from '../ErrorBanner'

describe('ErrorBanner', () => {
  it('invokes retry callback and tolerates async handlers', async () => {
    const user = userEvent.setup()
    const handleRetry = vi.fn(() => Promise.resolve())
    const handleDismiss = vi.fn()

    render(<ErrorBanner message="Failed" onRetry={handleRetry} onDismiss={handleDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('disables retry when busy while keeping dismiss actionable', async () => {
    const user = userEvent.setup()
    const handleRetry = vi.fn()
    const handleDismiss = vi.fn()

    render(
      <ErrorBanner message="Busy" onRetry={handleRetry} onDismiss={handleDismiss} busy />,
    )

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    expect(retryButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(handleDismiss).toHaveBeenCalledTimes(1)
    expect(handleRetry).not.toHaveBeenCalled()
  })
})
