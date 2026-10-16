// V2 push: the manifest IS the site. No translation, no sorting, no
// stripping — editor order is publish order. Validate, then ship site.json
// + the skeleton + the runtime through the publish API.
//
// STAGED: no UI calls this yet (only tests). Wiring lands with the plain
// canvas slice: push button calls pushManifest instead of pushDoc.
import { publishFiles, strField } from '../api'
import { validateSite } from '../site/validate'
import type { SiteManifest } from '../site/types'
import { APP_JSX, RUNTIME_FILES } from './files'

export type PushResult = { ok: true; commit: string; url: string } | { ok: false; error: string }

export async function pushManifest(manifest: SiteManifest): Promise<PushResult> {
  const v = validateSite(manifest)
  if (!v.ok) return { ok: false, error: v.errors.join('; ') }
  const { status, body } = await publishFiles(
    [{ path: 'site.json', content: JSON.stringify(manifest) }, { path: 'src/App.jsx', content: APP_JSX }, ...RUNTIME_FILES],
    'list publish',
  )
  if (status !== 200) return { ok: false, error: strField(body, 'error') ?? `push failed: ${status}` }
  const commit = strField(body, 'commit')
  const url = strField(body, 'url')
  if (!commit || !url) return { ok: false, error: 'malformed push response' }
  return { ok: true, commit, url }
}
