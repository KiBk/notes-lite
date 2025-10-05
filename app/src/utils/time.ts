export const formatRelativeTime = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Updated'
  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'Updated just now'
  if (diff < hour) {
    const mins = Math.floor(diff / minute)
    return `Updated ${mins}m ago`
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `Updated ${hours}h ago`
  }
  const days = Math.floor(diff / day)
  if (days < 7) return `Updated ${days}d ago`
  return `Updated ${date.toLocaleDateString()}`
}
