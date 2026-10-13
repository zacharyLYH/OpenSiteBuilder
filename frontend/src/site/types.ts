// The published site document (site.json) is the canvas doc flattened into
// nested OSB nodes — the shape our own publisher writes and our own validator
// reads. Node types live in the OSB registry (single record); this file only
// re-exports them so the doc layer never re-declares type names.
import type { OSBNodeType } from '../osb/registry'
import type { OSBTheme } from '../osb/types'

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

/** One page in the manifest. V2 renders the first page; multi-page routes are
 * future work (the shape already carries `path`). */
export interface SitePage {
  id: string
  path: string
  title: string
  nodes: SiteNode[]
  /** Overlay shells (popups, drawers) opened by this page's triggers. */
  overlays?: SiteNode[]
}

/** Global SEO/social metadata for the site (browser title, description, and
 * social share image). Carried in the manifest; the pre-render step injects
 * it into `<head>` at build time (docs/codegen-v2.md, SEO & SSG). All fields
 * optional — the engine ignores them today and a future Site Settings modal
 * fills them in. */
export interface SiteMeta {
  title?: string
  description?: string
  ogImage?: string
}

/** THE manifest (site.json): pure data, no code. OSBRuntime renders it by
 * looping the node tree through the registry — nothing is code-generated. */
export interface SiteManifest {
  version: string
  site: { name: string; theme: OSBTheme; meta?: SiteMeta }
  pages: SitePage[]
}

export const SITE_SCHEMA_VERSION = '0.1' as const
