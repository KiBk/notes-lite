interface ErrorBannerProps {
  message: string
  onDismiss: () => void
  onRetry?: () => void | Promise<void>
  busy?: boolean
}

const ErrorBanner = ({ message, onDismiss, onRetry, busy = false }: ErrorBannerProps) => {
  const handleRetry = () => {
    if (!onRetry) return
    try {
      const result = onRetry()
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>)
      }
    } catch (error) {
      console.warn('Retry handler threw an error', error)
    }
  }

  return (
    <div className="error-banner" role="alert">
      <span className="error-message">{message}</span>
      <div className="error-actions">
        {onRetry && (
          <button type="button" onClick={handleRetry} className="error-action" disabled={busy}>
            Retry
          </button>
        )}
        <button type="button" onClick={onDismiss} className="error-action secondary">
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default ErrorBanner
