import { publishFiles, strField } from '../api'
import { generatePage } from './codegen'
import { validateSite } from '../site/validate'
import { SITE_SCHEMA_VERSION } from '../site/types'
import { childrenOf, overlaysOf, themeOf, type CanvasDoc } from './doc'
import osbTypesSrc from '../osb/types.ts?raw'
import cnSrc from '../lib/utils.ts?raw'

export type PushResult = { ok: true; commit: string; url: string } | { ok: false; error: string }

// Every OSB* component, read as text at build time, so a new node type ships
// automatically alongside the page that imports it.
const OSB_COMPONENTS = import.meta.glob('../osb/OSB*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Runtime files every published page needs. The generated App.jsx imports
 * these under ./osb/*, so the FE osb/ sources stay the single source of truth.
 */
const RUNTIME_FILES = [
  ...Object.entries(OSB_COMPONENTS)
    // Test co-locates with components (OSBButton.test.tsx): never publish it.
    .filter(([p]) => !p.includes('.test.'))
    .map(([p, content]) => ({
      path: 'src/' + p.replace('../', ''),
      content,
    })),
  { path: 'src/osb/types.ts', content: osbTypesSrc },
  { path: 'src/lib/utils.ts', content: cnSrc },
]

/** Canvas doc as a valid site.json (single page v1, children nested). */
const siteNode = ({ id, type, config }: { id: string; type: string; config: Record<string, unknown> }) => ({
  id,
  type,
  config: config ?? {},
})

const siteModalKid = (k: { id: string; type: string; config: Record<string, unknown>; x: number; y: number; cols: number; rows: number }) => ({
  ...siteNode(k),
  x: k.x,
  y: k.y,
  cols: k.cols,
  rows: k.rows,
})

/** Canvas doc as a site object (single page v1, children nested).
 * Containers keep doc order; kids nest one level (root > container > atom). */
export function siteObject(doc: CanvasDoc, slug: string): unknown {
  interface SiteJsonNode {
    id: string
    type: string
    config: Record<string, unknown>
    children?: SiteJsonNode[]
  }
  const kidsOf = (id: string, ordered: boolean, depth = 0): SiteJsonNode[] => {
    if (depth > 3) return []
    const kids = childrenOf(doc.nodes, id, ordered).filter((k) => k.id !== id)
    return kids.map((n) => {
      const grandkids = kidsOf(n.id, true, depth + 1)
      return { ...siteNode(n), ...(grandkids.length > 0 ? { children: grandkids } : {}) }
    })
  }
  const overlays = overlaysOf(doc).map((m) => ({
    id: m.id,
    type: m.overlayType,
    config: m.config ?? {},
    cols: m.cols,
    rows: m.rows,
    ...(m.children.length > 0 ? { children: m.children.map(siteModalKid) } : {}),
  }))
  return {
    version: SITE_SCHEMA_VERSION,
    site: { name: slug, theme: themeOf(doc) },
    pages: [
      {
        id: 'home',
        path: '/',
        title: 'Home',
        nodes: doc.nodes
          .filter((n) => n.parentId === null)
          .map((n) => {
            const children = kidsOf(n.id, false)
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

/** Push = generated React + site.json + the OSB runtime through the publish API. */
export async function pushDoc(doc: CanvasDoc, slug: string): Promise<PushResult> {
  const obj = siteObject(doc, slug)
  const v = validateSite(obj)
  if (!v.ok) return { ok: false, error: v.errors.join('; ') }
  const { status, body } = await publishFiles(
    [
      { path: 'src/App.jsx', content: generatePage(doc) },
      { path: 'site.json', content: JSON.stringify(obj) },
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
