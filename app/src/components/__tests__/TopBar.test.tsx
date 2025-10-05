import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TopBar from '../TopBar'

describe('TopBar', () => {
  it('wires search, sign-out, and theme toggle handlers', async () => {
    const user = userEvent.setup()
    const handleSearch = vi.fn()
    const handleSignOut = vi.fn()
    const handleToggleTheme = vi.fn()

    render(
      <TopBar
        user="Pat"
        theme="light"
        onToggleTheme={handleToggleTheme}
        search=""
        onSearch={handleSearch}
        onSignOut={handleSignOut}
      />,
    )

    const searchField = screen.getByPlaceholderText('Search notes')
    fireEvent.change(searchField, { target: { value: 'ideas' } })
    expect(handleSearch).toHaveBeenCalledWith('ideas')

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(handleToggleTheme).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(handleSignOut).toHaveBeenCalled()
  })
})
