import { describe, expect, it } from 'vitest'
import { getInkForBackground, hexToRgba } from './color'

describe('color utilities', () => {
  it('chooses a dark ink for light backgrounds and light ink for dark backgrounds', () => {
    expect(getInkForBackground('#ffffff')).toBe('#2c2c2c')
    expect(getInkForBackground('#111111')).toBe('#fafafa')
  })

  it('falls back to default ink when color parsing fails', () => {
    expect(getInkForBackground('nope')).toBe('#1f1f1f')
  })

  it('converts hex to rgba and clamps alpha into range', () => {
    expect(hexToRgba('#336699', 0.5)).toBe('rgba(51, 102, 153, 0.5)')
    expect(hexToRgba('#336699', 5)).toBe('rgba(51, 102, 153, 1)')
    expect(hexToRgba('#336699', -2)).toBe('rgba(51, 102, 153, 0)')
    expect(hexToRgba('oops', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })
})
