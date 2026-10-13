import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EMPTY_DOC,
  loadDoc,
  storageKey,
  themeOf,
  validateDoc,
  type CanvasDoc,
} from './doc'
import type { OSBTheme } from '../osb/types'
import { useDebouncedEffect } from './useDebouncedEffect'

/** Long enough to coalesce a drag into one write, short enough to feel safe. */
const PERSIST_DEBOUNCE_MS = 500

/**
 * The document and everything derived from it: loaded once from the project's
 * storage, kept in state, and mirrored into a ref so gesture handlers that
 * fire outside React's render (resize mouse-up) never read a stale doc.
 */
export function useCanvasDoc(projectName: string | null) {
  const key = projectName ? storageKey(projectName) : ''
  const [doc, setDoc] = useState<CanvasDoc>(() => (key ? loadDoc(key) : EMPTY_DOC))
  const docRef = useRef(doc)
  useEffect(() => {
    docRef.current = doc
  }, [doc])
  // Debounced persist, keyed by the project name from onboarding.
  useDebouncedEffect(() => {
    if (key) localStorage.setItem(key, JSON.stringify(doc))
  }, [doc, key], PERSIST_DEBOUNCE_MS)
  const roots = useMemo(() => doc.nodes.filter((n) => n.parentId === null), [doc])
  // File-level backstop: edit-time gates keep docs connected, but removals can
  // strand islands. Drives both the bar warning and the checks panel.
  const issues = useMemo(() => validateDoc(doc), [doc])
  // Remount key: a fresh grid after every gesture, so refused drags leave no
  // phantom behind. `resync` is the only way to bump it.
  const [epoch, setEpoch] = useState(0)
  return {
    doc,
    roots,
    issues,
    theme: themeOf(doc),
    epoch,
    docRef,
    setDoc,
    setTheme: (theme: OSBTheme) => setDoc((d) => ({ ...d, theme })),
    resync: () => setEpoch((e) => e + 1),
  }
}
