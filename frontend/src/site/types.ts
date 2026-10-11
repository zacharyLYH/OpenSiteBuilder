// Canonical site document (site.json), v0.1.
// Source of truth for editing + publishing (PRD §10). The editor never
// treats rendered DOM as authoritative; it edits this document.
// User sites persist this exact shape as `site.json` in their repo.
//
// Node types live in the OSB registry (single record); this file only
// re-exports them so the doc layer never re-declares type names.
import type { OSBTheme } from '../osb/types'
import type { OSBNodeType } from '../osb/registry'

export type { OSBTheme, OSBNodeType }

export interface SiteNode {
  id: string
  type: OSBNodeType
  /** Partial per-component config; missing keys fall back to component defaults. */
  config?: Record<string, unknown>
  /** Nested children (containers only, max depth 1). */
  children?: SiteNode[]
}

export interface SitePage {
  id: string
  path: string
  title: string
  nodes: SiteNode[]
}

export interface SiteDocument {
  version: '0.1'
  site: {
    name: string
    theme: OSBTheme
  }
  pages: SitePage[]
}

export const SITE_SCHEMA_VERSION = '0.1' as const
