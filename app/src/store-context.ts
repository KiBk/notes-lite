import { createContext, useContext } from 'react'
import type { StoreValue } from './store-types'

export const StoreContext = createContext<StoreValue | null>(null)

export const useStore = () => {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}
