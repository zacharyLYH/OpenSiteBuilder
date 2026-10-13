import { createContext, useContext, type ReactNode } from 'react'
import type { OSBTheme } from './types'

/**
 * THE global light/dark switch. Theme is a property of the whole page, never
 * of an individual component: the canvas sets it from the document (header
 * control) and the published page sets it from `site.theme`. Components read
 * it here and pick from their own complete static class maps.
 *
 * A React context rather than an ambient `.dark` ancestor: Radix portals
 * (popup dialog, editor sheet) render outside the wrapper element, so an
 * ancestor class would silently miss portaled content. Context follows the
 * component tree through portals.
 */
const OSBThemeContext = createContext<OSBTheme>('light')

export interface OSBThemeProviderProps {
  theme?: OSBTheme
  children: ReactNode
}

export function OSBThemeProvider({ theme = 'light', children }: OSBThemeProviderProps) {
  return <OSBThemeContext.Provider value={theme}>{children}</OSBThemeContext.Provider>
}

/** The one way a component reads the global theme. Defaults to light. */
export function useOSBTheme(): OSBTheme {
  return useContext(OSBThemeContext)
}
