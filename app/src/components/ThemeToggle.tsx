import type { ThemeMode } from '../types'

interface ThemeToggleProps {
  mode: ThemeMode
  onToggle: () => void
  variant?: 'compact' | 'default'
}

export const ThemeToggle = ({ mode, onToggle, variant = 'default' }: ThemeToggleProps) => {
  return (
    <button
      type="button"
      className={`theme-toggle ${variant}`}
      onClick={onToggle}
      aria-label="Toggle theme"
    >
      {mode === 'light' ? '☾' : '☀︎'}
    </button>
  )
}

export default ThemeToggle
