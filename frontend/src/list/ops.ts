// V2 list doc ops: order only, no coordinates.
//
// A page is a tree. Order in each children array IS the layout. Moving means
// changing index or parent, never x/y math. All ops are pure (new doc out,
// old doc untouched) so undo is just keeping the last doc around.
import { canContain, isAtomType, isOverlayType, type OSBNodeType } from '../osb/registry'
import type { SiteManifest, SiteNode } from '../site/types'

export type Reason = 'unknown-parent' | 'holds-nothing' | 'wrong-kind' | 'too-deep' | 'bad-index' | 'missing-node'

export type Result = { ok: true; doc: SiteManifest } | { ok: false; reason: Reason }

// Max nesting: page > section > columns > card > atom.
const MAX_DEPTH = 3

function depthOf(nodes: SiteNode[], parentId: string | null): number {
  if (parentId === null) return 0
  for (const n of nodes) {
    if (n.id === parentId) return 1
    const kids = n.children ?? []
    if (kids.length > 0) {
      const d = depthOf(kids, parentId)
      if (d > 0) return d + 1
    }
  }
  return -1
}

function find(nodes: SiteNode[], id: string): SiteNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = find(n.children ?? [], id)
    if (hit) return hit
  }
  return null
}

// Can parent hold child? Root holds anything except overlays. Atoms hold
// nothing. Anything else asks the registry, never a hardcoded type name.
export function canHold(nodes: SiteNode[], parentId: string | null, type: OSBNodeType): Reason | null {
  if (isOverlayType(type)) return 'wrong-kind'
  if (parentId === null) return null
  const parent = find(nodes, parentId)
  if (!parent) return 'unknown-parent'
  if (isAtomType(parent.type)) return 'holds-nothing'
  if (!canContain(parent.type, type)) return 'wrong-kind'
  const d = depthOf(nodes, parentId)
  if (d < 0 || d + 1 > MAX_DEPTH) return 'too-deep'
  return null
}

function replace(nodes: SiteNode[], id: string, fn: (n: SiteNode) => SiteNode | null): SiteNode[] {
  const out: SiteNode[] = []
  for (const n of nodes) {
    if (n.id === id) {
      const next = fn(n)
      if (next) out.push(next)
    } else {
      out.push({ ...n, children: replace(n.children ?? [], id, fn) })
    }
  }
  return out
}

function pageNodes(doc: SiteManifest): SiteNode[] {
  return doc.pages[0]?.nodes ?? []
}

function withNodes(doc: SiteManifest, nodes: SiteNode[]): SiteManifest {
  return { ...doc, pages: doc.pages.map((p, i) => (i === 0 ? { ...p, nodes } : p)) }
}

export function insertNode(doc: SiteManifest, parentId: string | null, index: number, node: SiteNode): Result {
  const nodes = pageNodes(doc)
  const blocked = canHold(nodes, parentId, node.type)
  if (blocked) return { ok: false, reason: blocked }
  if (parentId === null) {
    const next = [...nodes]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node)
    return { ok: true, doc: withNodes(doc, next) }
  }
  const next = replace(nodes, parentId, (p) => {
    const kids = [...(p.children ?? [])]
    kids.splice(Math.max(0, Math.min(index, kids.length)), 0, node)
    return { ...p, children: kids }
  })
  return { ok: true, doc: withNodes(doc, next) }
}

export function removeNode(doc: SiteManifest, id: string): Result {
  const nodes = pageNodes(doc)
  if (!find(nodes, id)) return { ok: false, reason: 'missing-node' }
  return { ok: true, doc: withNodes(doc, replace(nodes, id, () => null)) }
}

export function moveNode(doc: SiteManifest, id: string, parentId: string | null, index: number): Result {
  const nodes = pageNodes(doc)
  const node = find(nodes, id)
  if (!node) return { ok: false, reason: 'missing-node' }
  const without = replace(nodes, id, () => null)
  const blocked = canHold(without, parentId, node.type)
  if (blocked) return { ok: false, reason: blocked }
  return insertNode(withNodes(doc, without), parentId, index, node)
}

export function updateConfig(doc: SiteManifest, id: string, patch: Record<string, unknown>): Result {
  const nodes = pageNodes(doc)
  if (!find(nodes, id)) return { ok: false, reason: 'missing-node' }
  return { ok: true, doc: withNodes(doc, replace(nodes, id, (n) => ({ ...n, config: { ...n.config, ...patch } }))) }
}
