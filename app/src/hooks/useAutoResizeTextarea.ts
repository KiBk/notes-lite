import type { RefObject } from 'react'
import { useEffect } from 'react'

export const useAutoResizeTextarea = (
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
) => {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}
