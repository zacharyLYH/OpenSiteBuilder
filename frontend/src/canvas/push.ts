import { publishFiles } from '../api'
import { generatePage } from './codegen'
import { validateSite } from '../site/validate'
import { SITE_SCHEMA_VERSION } from '../site/types'
import type { CanvasDoc } from './doc'
import osbTypesSrc from '../osb/types.ts?raw'
import cnSrc from '../lib/utils.ts?raw'

export interface PushResult {
  ok: boolean
  commit?: string
  url?: string
  error?: string
}

// Every OSB* component, read as text at build time, so a new node type ships
// automatically alongside the page that imports it.
const OSB_COMPONENTS = import.meta.glob('../osb/OSB*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Runtime files every published page needs. The generated App.jsx imports
 * these under ./osb/*, so they ride along on every push — the FE osb/ sources
 * stay the single source of truth (nothing duplicated into the template).
 */
const RUNTIME_FILES = [
  ...Object.entries(OSB_COMPONENTS).map(([p, content]) => ({
    path: 'src/' + p.replace('../', ''),
    content,
  })),
  { path: 'src/osb/types.ts', content: osbTypesSrc },
  { path: 'src/lib/utils.ts', content: cnSrc },
]

/** Canvas doc as a valid site.json (single page v1, children nested). */
export function siteJson(doc: CanvasDoc, slug: string): string {
  const roots = doc.nodes.filter((n) => n.parentId === null)
  return JSON.stringify({
    version: SITE_SCHEMA_VERSION,
    site: { name: slug, theme: 'light' },
    pages: [
      {
        id: 'home',
        path: '/',
        title: 'Home',
        nodes: roots.map((n) => ({
          id: n.id,
          type: n.type,
          config: n.config ?? {},
          ...(doc.nodes.some((k) => k.parentId === n.id)
            ? {
                children: doc.nodes
                  .filter((k) => k.parentId === n.id)
                  .map((k) => ({ id: k.id, type: k.type, config: k.config ?? {} })),
              }
            : {}),
        })),
      },
    ],
  })
}

/** Push = generated React + site.json + the OSB runtime through the publish API. */
export async function pushDoc(doc: CanvasDoc, slug: string): Promise<PushResult> {
  const site = siteJson(doc, slug)
  const v = validateSite(JSON.parse(site) as unknown)
  if (!v.ok) return { ok: false, error: v.errors.join('; ') }
  const { status, body } = await publishFiles(
    [
      { path: 'src/App.jsx', content: generatePage(doc) },
      { path: 'site.json', content: site },
      ...RUNTIME_FILES,
    ],
    'canvas publish',
  )
  if (status !== 200) return { ok: false, error: body?.error || `push failed: ${status}` }
  return { ok: true, commit: body.commit as string, url: body.url as string }
}
