// V2 store: the manifest in state, autosaved per project. Editing never
// touches the server — only push does. Ops return reasons; the store applies
// ok results and reports rejections for the UI to voice.
//
// STAGED: no component mounts this yet (only tests). Wiring lands with the
// plain canvas slice: canvas uses useListDoc instead of useCanvasDoc.
import { useEffect, useRef, useState } from 'react'
import { useDebouncedEffect } from '../canvas/useDebouncedEffect'
import type { SiteManifest, SiteNode } from '../site/types'
import { insertNode, moveNode, removeNode, updateConfig, type Reason } from './ops'

const PERSIST_MS = 500

export const listKey = (projectName: string): string => `osb.list.${projectName}`

export function emptyManifest(name: string): SiteManifest {
  return {
    version: '0.1',
    site: { name, theme: 'light' },
    pages: [{ id: 'home', path: '/', title: 'Home', nodes: [] }],
  }
}

export function loadManifest(key: string, fallbackName: string): SiteManifest {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return emptyManifest(fallbackName)
    const doc = JSON.parse(raw) as SiteManifest
    if (!Array.isArray(doc?.pages) || doc.pages.length === 0) return emptyManifest(fallbackName)
    return doc
  } catch {
    return emptyManifest(fallbackName)
  }
}

export function useListDoc(projectName: string | null) {
  const key = projectName ? listKey(projectName) : ''
  const [doc, setDoc] = useState<SiteManifest>(() => (key ? loadManifest(key, projectName ?? '') : emptyManifest('')))
  const docRef = useRef(doc)
  useEffect(() => {
    docRef.current = doc
  }, [doc])
  useDebouncedEffect(() => {
    if (key) localStorage.setItem(key, JSON.stringify(doc))
  }, [doc, key], PERSIST_MS)

  // Apply an op; returns the rejection reason (null = applied) for the UI.
  const apply = (fn: (d: SiteManifest) => { ok: true; doc: SiteManifest } | { ok: false; reason: Reason }): Reason | null => {
    const r = fn(docRef.current)
    if (!r.ok) return r.reason
    setDoc(r.doc)
    return null
  }

  return {
    doc,
    docRef,
    insert: (parentId: string | null, index: number, node: SiteNode) => apply((d) => insertNode(d, parentId, index, node)),
    move: (id: string, parentId: string | null, index: number) => apply((d) => moveNode(d, id, parentId, index)),
    remove: (id: string) => apply((d) => removeNode(d, id)),
    configure: (id: string, patch: Record<string, unknown>) => apply((d) => updateConfig(d, id, patch)),
    setDoc,
  }
}
