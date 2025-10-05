import type { FocusEvent } from 'react'

interface ColorPaletteProps {
  colors: string[]
  selected: string
  onSelect: (hex: string) => void
  onClose: () => void
  paletteRef?: (node: HTMLDivElement | null) => void
}

const ColorPalette = ({ colors, selected, onSelect, onClose, paletteRef }: ColorPaletteProps) => {
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as HTMLElement | null
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return
    }
    onClose()
  }

  return (
    <div
      className="color-palette"
      role="list"
      tabIndex={0}
      ref={paletteRef}
      onMouseLeave={onClose}
      onBlur={handleBlur}
    >
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="listitem"
          className={color === selected ? 'swatch active' : 'swatch'}
          style={{ backgroundColor: color }}
          onClick={() => onSelect(color)}
        >
          {color === selected ? '●' : '○'}
        </button>
      ))}
    </div>
  )
}

export default ColorPalette
