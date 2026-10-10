import { publishFiles } from '../api'
import { generatePage } from './codegen'
import { validateSite } from '../site/validate'
import type { CanvasDoc } from './doc'

export interface PushResult {
  ok: boolean
  commit?: string
  url?: string
  error?: string
}

/** Canvas doc as a valid site.json (single page v1). */
export function siteJson(doc: CanvasDoc, slug: string): string {
  return JSON.stringify({
    version: '0.1',
    site: { name: slug, theme: 'light' },
    pages: [
      {
        id: 'home',
        path: '/',
        title: 'Home',
        nodes: doc.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config ?? {} })),
      },
    ],
  })
}

/** Push = generated React + site.json through the publish API. */
export async function pushDoc(doc: CanvasDoc, slug: string): Promise<PushResult> {
  const site = siteJson(doc, slug)
  const v = validateSite(JSON.parse(site) as unknown)
  if (!v.ok) return { ok: false, error: v.errors.join('; ') }
  const { status, body } = await publishFiles(
    [
      { path: 'src/App.jsx', content: generatePage(doc) },
      { path: 'site.json', content: site },
    ],
    'canvas publish',
  )
  if (status !== 200) return { ok: false, error: body?.error || `push failed: ${status}` }
  return { ok: true, commit: body.commit as string, url: body.url as string }
}
