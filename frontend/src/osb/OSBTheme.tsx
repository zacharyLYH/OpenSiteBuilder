import { createContext, useContext, useEffect, type ReactNode } from 'react'
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

/**
 * Drive `.dark` on <html> from the site theme. Fresh shadcn `dark:` variants
 * key off the class; Radix portals render outside any wrapper div, so only
 * the document root reaches everything. Context (above) still drives
 * adapters; this drives shadcn. Call wherever a theme is known: the editor
 * canvas and the published runtime.
 */
export function useSiteThemeClass(theme: OSBTheme): void {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
}
