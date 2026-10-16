// V2 list doc ops: order only, no coordinates.
//
// A page is a tree. Order in each children array IS the layout. Moving means
// changing index or parent, never x/y math. All ops are pure (new doc out,
// old doc untouched) so undo is just keeping the last doc around.
import { canContain, isAtomType, isOverlayType, type OSBNodeType } from '../osb/registry'
import type { SiteManifest, SiteNode } from '../site/types'

export type Reason = 'unknown-parent' | 'holds-nothing' | 'wrong-kind' | 'too-deep' | 'bad-index' | 'missing-node' | 'cycle'

export type Result = { ok: true; doc: SiteManifest } | { ok: false; reason: Reason }

// Max nesting: section > columns > card > atom (root parents count depth 1).
const MAX_DEPTH = 4

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

/** Find any node in the page tree. Null = missing. */
export function findNode(doc: SiteManifest, id: string): SiteNode | null {
  for (const p of doc.pages) {
    const hit = find(p.nodes, id)
    if (hit) return hit
  }
  return null
}

/** Parent id of a node. Null = root level (or missing — check siblings). */
export function parentOf(doc: SiteManifest, id: string): string | null {
  const walk = (nodes: SiteNode[], parentId: string | null): string | null | undefined => {
    for (const n of nodes) {
      if (n.id === id) return parentId
      const hit = walk(n.children ?? [], n.id)
      if (hit !== undefined) return hit
    }
    return undefined
  }
  for (const p of doc.pages) {
    const hit = walk(p.nodes, null)
    if (hit !== undefined) return hit
  }
  return null
}

// Can parent hold child? Root holds anything except overlays. Atoms hold
// nothing. Columns holds cards only. Anything else asks the registry, never
// a hardcoded type name.
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
  const blocked = checkMove(doc, id, parentId)
  if (blocked) return { ok: false, reason: blocked }
  const nodes = pageNodes(doc)
  const node = find(nodes, id)
  if (!node) return { ok: false, reason: 'missing-node' }
  const without = replace(nodes, id, () => null)
  return insertNode(withNodes(doc, without), parentId, index, node)
}

/**
 * Would the move be accepted? The exact verdict moveNode enforces, without
 * applying anything — hover feedback reads this so the halo never lies.
 */
export function checkMove(doc: SiteManifest, id: string, parentId: string | null): Reason | null {
  const nodes = pageNodes(doc)
  const node = find(nodes, id)
  if (!node) return 'missing-node'
  // A node can never land on itself or inside its own subtree — that would
  // orphan itself. Checked on the current tree so the reason names the real
  // mistake instead of a downstream missing parent.
  if (parentId === id || (parentId !== null && find(node.children ?? [], parentId))) return 'cycle'
  const without = replace(nodes, id, () => null)
  return canHold(without, parentId, node.type)
}

export function updateConfig(doc: SiteManifest, id: string, patch: Record<string, unknown>): Result {
  const nodes = pageNodes(doc)
  if (!find(nodes, id)) return { ok: false, reason: 'missing-node' }
  return { ok: true, doc: withNodes(doc, replace(nodes, id, (n) => ({ ...n, config: { ...n.config, ...patch } }))) }
}
