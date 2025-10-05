import { useState } from 'react'
import type { FormEvent } from 'react'
import ThemeToggle from './ThemeToggle'
import type { ThemeMode } from '../types'

interface LoginScreenProps {
  theme: ThemeMode
  onToggleTheme: () => void
  onLogin: (name: string) => void
  rememberedName?: string
}

const LoginScreen = ({ theme, onToggleTheme, onLogin, rememberedName }: LoginScreenProps) => {
  const [name, setName] = useState(rememberedName ?? '')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onLogin(trimmed)
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <header className="login-header">
          <h1>Notes Lite</h1>
          <ThemeToggle mode={theme} onToggle={onToggleTheme} />
        </header>
        <p className="login-copy">Sign in with just your name to pick up where you left off.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              autoFocus
              placeholder="Pat"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit" className="login-button">
            Enter Notes
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginScreen
