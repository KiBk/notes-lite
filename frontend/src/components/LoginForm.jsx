import { useState } from 'react';

function LoginForm({ onLogin, loading, theme = 'light', onToggleTheme }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name to continue.');
      return;
    }
    try {
      setError('');
      await onLogin(trimmed);
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card__header">
          <h1>Notes Lite</h1>
          {onToggleTheme ? (
            <button
              type="button"
              className="ghost-button theme-toggle"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀︎' : '☾'}
            </button>
          ) : null}
        </div>
        <p className="auth-subtitle">Sign in with your name to see your notes.</p>
        <label htmlFor="name" className="auth-label">
          Name
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading}
            autoFocus
            placeholder="e.g. Alex"
          />
        </label>
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        <button type="submit" disabled={loading} className="primary-button">
          {loading ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

export default LoginForm;
