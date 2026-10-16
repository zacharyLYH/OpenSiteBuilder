import { publishFiles, strField } from '../api'
import { validateSite } from '../site/validate'
import { SITE_SCHEMA_VERSION, type SiteNode } from '../site/types'
import { childrenOf, overlaysOf, themeOf, type CanvasDoc, type PlacedNode } from './doc'
// File assembly lives in the neutral list module now (shared, no grid dep).
// Re-exported so existing tests keep importing from here.
import { APP_JSX, RUNTIME_FILES, publishedPackageJson, publishedPackageLock } from '../list/files'

export { APP_JSX, RUNTIME_FILES, publishedPackageJson, publishedPackageLock }

/** Cycle breaker for a corrupt doc; the nesting gate already caps real depth. */
const MAX_NEST_DEPTH = 3

export type PushResult = { ok: true; commit: string; url: string } | { ok: false; error: string }

/** A placed node as a manifest node — never coordinates (flow layout). */
const siteNode = (n: PlacedNode): SiteNode => ({ id: n.id, type: n.type, config: n.config })

/** An overlay child keeps its cell footprint (percent boxes in the shell). */
const siteModalKid = (k: PlacedNode): SiteNode => ({ ...siteNode(k), x: k.x, y: k.y, cols: k.cols, rows: k.rows })

/**
 * Canvas doc as a site object (single page v1, children nested).
 *
 * The published page is FLOW-based, not absolute: the grid is an editor guide,
 * not published layout (PRD §5.3/§5.4/§5.5). So nodes ship in flow order
 * (top→bottom, left→right) — `childrenOf(..., true)` — never as coordinates.
 * Overlay children are the exception: a popup is a fixed-footprint mini-canvas,
 * so its kids keep x/y/cols/rows and render as percent boxes.
 */
export function siteObject(doc: CanvasDoc, slug: string): unknown {
  const kidsOf = (id: string, ordered: boolean, depth = 0): SiteNode[] => {
    if (depth > MAX_NEST_DEPTH) return []
    const kids = childrenOf(doc.nodes, id, ordered).filter((k) => k.id !== id)
    return kids.map((n) => {
      const grandkids = kidsOf(n.id, true, depth + 1)
      return { ...siteNode(n), ...(grandkids.length > 0 ? { children: grandkids } : {}) }
    })
  }
  const overlays: SiteNode[] = overlaysOf(doc).map((m) => ({
    id: m.id,
    type: m.overlayType,
    config: m.config,
    cols: m.cols,
    rows: m.rows,
    ...(m.children.length > 0 ? { children: m.children.map(siteModalKid) } : {}),
  }))
  // SEO/social metadata: doc settings when set, else the site name. Undefined
  // description/ogImage drop out of the JSON.
  const meta = { title: doc.meta?.title || slug, description: doc.meta?.description, ogImage: doc.meta?.ogImage }
  return {
    version: SITE_SCHEMA_VERSION,
    site: { name: slug, theme: themeOf(doc), meta },
    pages: [
      {
        id: 'home',
        path: '/',
        title: 'Home',
        nodes: doc.nodes
          .filter((n) => n.parentId === null)
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((n) => {
            const children = kidsOf(n.id, true)
            return { ...siteNode(n), ...(children.length > 0 ? { children } : {}) }
          }),
        ...(overlays.length > 0 ? { overlays } : {}),
      },
    ],
  }
}

export function siteJson(doc: CanvasDoc, slug: string): string {
  return JSON.stringify(siteObject(doc, slug))
}

/** Push = site.json manifest + the static skeleton + the OSB runtime through
 * the publish API. Only `site.json` changes between publishes of the same
 * site; the runtime re-syncs the builder-owned folder. */
export async function pushDoc(doc: CanvasDoc, slug: string): Promise<PushResult> {
  const obj = siteObject(doc, slug)
  const v = validateSite(obj)
  if (!v.ok) return { ok: false, error: v.errors.join('; ') }
  const { status, body } = await publishFiles(
    [
      { path: 'site.json', content: JSON.stringify(obj) },
      { path: 'src/App.jsx', content: APP_JSX },
      ...RUNTIME_FILES,
    ],
    'canvas publish',
  )
  if (status !== 200) return { ok: false, error: strField(body, 'error') ?? `push failed: ${status}` }
  const commit = strField(body, 'commit')
  const url = strField(body, 'url')
  if (!commit || !url) return { ok: false, error: 'malformed push response' }
  return { ok: true, commit, url }
}
