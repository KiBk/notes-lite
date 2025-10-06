import ThemeToggle from './ThemeToggle'
import type { ThemeMode } from '../types'

interface TopBarProps {
  user: string
  theme: ThemeMode
  onToggleTheme: () => void
  search: string
  onSearch: (value: string) => void
  onSignOut: () => void
  isSaving?: boolean
}

const TopBar = ({ user, theme, onToggleTheme, search, onSearch, onSignOut, isSaving = false }: TopBarProps) => {
  return (
    <header className="top-bar">
      <div className="brand">Notes Lite</div>
      <div className="search-wrap">
        <input
          type="search"
          placeholder="Search notes"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <div className="top-bar-actions">
        {isSaving && (
          <span className="saving-indicator" role="status">
            Saving…
          </span>
        )}
        <ThemeToggle mode={theme} onToggle={onToggleTheme} variant="compact" />
        <div className="user-chip" title={`Signed in as ${user}`}>
          <span className="user-name">{user}</span>
          <button type="button" onClick={onSignOut} className="sign-out">
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopBar
