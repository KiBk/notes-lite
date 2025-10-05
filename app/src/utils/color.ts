const hexToRgb = (hex: string) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const R = channel(r)
  const G = channel(g)
  const B = channel(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export const getInkForBackground = (hex: string): string => {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#1f1f1f'
  const lum = luminance(rgb)
  return lum > 0.6 ? '#2c2c2c' : '#fafafa'
}

export const hexToRgba = (hex: string, alpha = 1): string => {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`
  const bounded = Math.min(Math.max(alpha, 0), 1)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${bounded})`
}
