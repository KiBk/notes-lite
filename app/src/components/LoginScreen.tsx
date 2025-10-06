import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import ThemeToggle from './ThemeToggle'
import ErrorBanner from './ErrorBanner'
import type { ThemeMode } from '../types'

interface LoginScreenProps {
  theme: ThemeMode
  onToggleTheme: () => void
  onLogin: (name: string) => void
  rememberedName?: string
  isLoading?: boolean
  errorMessage?: string
  onRetry?: () => void | Promise<void>
  onDismissError: () => void
}

const LoginScreen = ({
  theme,
  onToggleTheme,
  onLogin,
  rememberedName,
  isLoading = false,
  errorMessage,
  onRetry,
  onDismissError,
}: LoginScreenProps) => {
  const [name, setName] = useState(rememberedName ?? '')

  useEffect(() => {
    setName(rememberedName ?? '')
  }, [rememberedName])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onLogin(trimmed)
  }

  return (
    <div className="login-shell">
      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onRetry={onRetry}
          onDismiss={onDismissError}
          busy={isLoading}
        />
      )}
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
              disabled={isLoading}
            />
          </label>
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Enter Notes'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginScreen
