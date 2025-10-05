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
      <LoginScreen theme="light" onToggleTheme={() => {}} onLogin={() => {}} rememberedName="Pat" />,
    )

    expect(screen.getByPlaceholderText('Pat')).toHaveValue('Pat')
  })

  it('prevents submission when input is empty or whitespace', async () => {
    const user = userEvent.setup()
    const handleLogin = vi.fn()
    render(<LoginScreen theme="light" onToggleTheme={() => {}} onLogin={handleLogin} />)

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
    render(<LoginScreen theme="dark" onToggleTheme={() => {}} onLogin={handleLogin} />)

    const input = screen.getByPlaceholderText('Pat')
    await user.clear(input)
    await user.type(input, '  Casey  ')
    await user.click(screen.getByRole('button', { name: 'Enter Notes' }))

    expect(handleLogin).toHaveBeenCalledWith('Casey')
  })
})
