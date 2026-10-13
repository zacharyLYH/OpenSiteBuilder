import { publishFiles, strField } from '../api'
import { validateSite } from '../site/validate'
import { SITE_SCHEMA_VERSION, type SiteNode } from '../site/types'
import { childrenOf, overlaysOf, themeOf, type CanvasDoc, type PlacedNode } from './doc'
import osbTypesSrc from '../osb/types.ts?raw'
import registrySrc from '../osb/registry.tsx?raw'
import siteTypesSrc from '../site/types.ts?raw'
import cnSrc from '../lib/utils.ts?raw'
// The published shell's build environment. Shipped on every publish so a
// component that adds a dependency keeps working in a repo created earlier
// (docs/codegen-v2.md, "Dependency Merging"). `npm ci` needs package.json and
// its lock together, so the two always travel as a pair.
import templatePkgSrc from '../../../template/package.json?raw'
import templateLockSrc from '../../../template/package-lock.json?raw'

export type PushResult = { ok: true; commit: string; url: string } | { ok: false; error: string }

// Every OSB* source, read as text at build time: the components, the engine
// (OSBRuntime), the theme provider, and the shadcn bases they import. A new
// node type ships automatically — no per-type publishing code.
const OSB_SOURCES = import.meta.glob('../osb/OSB*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Runtime files every published page needs (hydration). The distribution rule
 * is the glob above — every `OSB*` source — minus co-located tests; non-OSB
 * helpers (README.md, mount.tsx, patterns.ts) never match and never ship. The
 * static App.jsx imports the engine under ./osb/* and the manifest, so the FE
 * osb/ sources stay the single source of truth — folder-sync, not codegen.
 */
const RUNTIME_FILES = [
  ...Object.entries(OSB_SOURCES)
    // Test co-locates with components (OSBButton.test.tsx): never publish it.
    .filter(([p]) => !p.includes('.test.'))
    .map(([p, content]) => ({
      path: 'src/' + p.replace('../', ''),
      content,
    })),
  { path: 'src/osb/registry.tsx', content: registrySrc },
  { path: 'src/osb/types.ts', content: osbTypesSrc },
  { path: 'src/site/types.ts', content: siteTypesSrc },
  { path: 'src/lib/utils.ts', content: cnSrc },
  // Build environment (dependencies) — see the import note above.
  { path: 'package.json', content: templatePkgSrc },
  { path: 'package-lock.json', content: templateLockSrc },
]

/**
 * THE skeleton: the one static entry point every published site gets. It
 * imports the manifest and hands it to the engine — no generated JSX, no
 * markup that can break. Overwritten on every publish (the src/osb/ folder is
 * builder-owned; see docs/codegen-v2.md).
 */
const APP_JSX = `import site from '../site.json'
import { OSBRuntime } from './osb/OSBRuntime'

export default function App() {
  return <OSBRuntime manifest={site} />
}
`

/** Cycle breaker for a corrupt doc; the nesting gate already caps real depth. */
const MAX_NEST_DEPTH = 3

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
