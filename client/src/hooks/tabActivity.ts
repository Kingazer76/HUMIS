import { createContext, useContext } from 'react'

/**
 * True when this tab's page is the one on screen. Hidden (but kept-alive)
 * tabs pause their polling so switching does not keep refetching.
 */
export const TabActiveContext = createContext(true)

export function useTabActive(): boolean {
  return useContext(TabActiveContext)
}
