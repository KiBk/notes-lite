import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import LoginScreen from '../LoginScreen'

describe('LoginScreen', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders remembered name into the input', () => {
    render(
      <LoginScreen
        theme="light"
        onToggleTheme={() => {}}
        onLogin={() => {}}
        onDismissError={() => {}}
        rememberedName="Pat"
      />,
    )

    expect(screen.getByPlaceholderText('Pat')).toHaveValue('Pat')
  })

  it('prevents submission when input is empty or whitespace', async () => {
    const user = userEvent.setup()
    const handleLogin = vi.fn()
    render(
      <LoginScreen
        theme="light"
        onToggleTheme={() => {}}
        onLogin={handleLogin}
        onDismissError={() => {}}
      />,
    )

    const submit = screen.getByRole('button', { name: 'Enter Notes' })
    await user.click(submit)
    expect(handleLogin).not.toHaveBeenCalled()

    await user.type(screen.getByPlaceholderText('Pat'), '   ')
    await user.click(submit)
    expect(handleLogin).not.toHaveBeenCalled()
  })

  it('trims name input and calls onLogin', async () => {
    const user = userEvent.setup()
    const handleLogin = vi.fn()
    render(
      <LoginScreen
        theme="dark"
        onToggleTheme={() => {}}
        onLogin={handleLogin}
        onDismissError={() => {}}
      />,
    )

    const input = screen.getByPlaceholderText('Pat')
    await user.clear(input)
    await user.type(input, '  Casey  ')
    await user.click(screen.getByRole('button', { name: 'Enter Notes' }))

    expect(handleLogin).toHaveBeenCalledWith('Casey')
  })

  it('disables input and submit button while loading', () => {
    render(
      <LoginScreen
        theme="light"
        onToggleTheme={() => {}}
        onLogin={() => {}}
        onDismissError={() => {}}
        isLoading
      />,
    )

    expect(screen.getByPlaceholderText('Pat')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  })

  it('renders error banner that wires retry and dismiss handlers', async () => {
    const user = userEvent.setup()
    const handleRetry = vi.fn()
    const handleDismiss = vi.fn()

    render(
      <LoginScreen
        theme="light"
        onToggleTheme={() => {}}
        onLogin={() => {}}
        errorMessage="Boom"
        onRetry={handleRetry}
        onDismissError={handleDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(handleRetry).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(handleDismiss).toHaveBeenCalledTimes(1)
  })
})
