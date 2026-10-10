import type { OSBNodeType } from '../osb/registry'
import { getProjectSlug } from '../lib/project'
import { GRID_COLS } from './grid'

export interface PlacedNode {
  id: string
  type: OSBNodeType
  config: Record<string, unknown>
  x: number
  y: number
  cols: number
  rows: number
}

export interface CanvasDoc {
  version: 1
  nodes: PlacedNode[]
}

const EMPTY: CanvasDoc = { version: 1, nodes: [] }

/** Project name comes from the existing onboarding flow, not new UI. */
export function currentProjectName(): string {
  return getProjectSlug() || 'my-site'
}

export function storageKey(projectName: string): string {
  return `osb.project.${projectName}`
}

export function loadDoc(key: string): CanvasDoc {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { ...EMPTY, nodes: [] }
    const doc = JSON.parse(raw) as CanvasDoc
    if (doc.version !== 1 || !Array.isArray(doc.nodes)) return { ...EMPTY, nodes: [] }
    return doc
  } catch {
    return { ...EMPTY, nodes: [] }
  }
}

/** Rect overlap in dot squares; touching edges is fine. */
export function collides(
  a: { x: number; y: number; cols: number; rows: number },
  b: { x: number; y: number; cols: number; rows: number },
): boolean {
  return a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows
}

export interface CellRect {
  x: number
  y: number
  cols: number
  rows: number
}

/**
 * Placement gate: rejects off-corner/out-of-bounds rects and overlaps.
 * RGL snaps everything to dot squares by construction, so this is the rule
 * that says "no" — exercised by unit tests, enforced by onDrop.
 */
export function canPlace(nodes: PlacedNode[], rect: CellRect, cols = GRID_COLS): boolean {
  if (!Number.isInteger(rect.x + rect.y + rect.cols + rect.rows)) return false
  if (rect.x < 0 || rect.y < 0 || rect.cols < 1 || rect.rows < 1) return false
  if (rect.x + rect.cols > cols) return false
  return !nodes.some((n) => collides(rect, n))
}
