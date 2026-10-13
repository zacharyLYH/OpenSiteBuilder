// The published site document (site.json) is the canvas doc flattened into
// nested OSB nodes — the shape our own publisher writes and our own validator
// reads. Node types live in the OSB registry (single record); this file only
// re-exports them so the doc layer never re-declares type names.
import type { OSBNodeType } from '../osb/registry'

export type { OSBNodeType }

export interface SiteNode {
  id: string
  type: OSBNodeType
  /** Partial per-component config; missing keys fall back to component defaults. */
  config?: Record<string, unknown>
  /** Nested children (containers only, max depth 1). */
  children?: SiteNode[]
  /** Popup-shell footprint + child footprints in cells (modals only). */
  cols?: number
  rows?: number
  x?: number
  y?: number
}

export const SITE_SCHEMA_VERSION = '0.1' as const
