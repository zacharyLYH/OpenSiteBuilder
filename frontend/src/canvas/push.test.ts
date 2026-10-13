import { describe, it, expect, vi, afterEach } from 'vitest'
import { pushDoc, siteJson } from './push'
import { tagFor } from './codegen'
import { validateSite } from '../site/validate'
import { OSB_NODE_TYPES } from '../osb/registry'
import type { CanvasDoc } from './doc'

const DOC: CanvasDoc = {
  version: 1,
  nodes: [
    { id: 'c', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
    { id: 'b', type: 'button', config: { label: 'Go' }, parentId: 'c', x: 1, y: 1, cols: 4, rows: 1 },
    { id: 't', type: 'text', config: { text: 'Hi' }, parentId: null, x: 12, y: 0, cols: 8, rows: 2 },
  ],
}

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ status, json: async () => body })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function fileContent(files: { path: string; content: string }[], path: string): string {
  const found = files.find((f) => f.path === path)
  if (!found) throw new Error(`missing file ${path}`)
  return found.content
}

describe('pushDoc (no screenshots — pure wiring)', () => {
  it('posts generated React + valid site.json to the push API', async () => {
    stubFetch(200, { commit: 'abc123', url: 'https://x.github.io/y/' })
    const r = await pushDoc(DOC, 'my-shop')
    expect(r).toEqual({ ok: true, commit: 'abc123', url: 'https://x.github.io/y/' })

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/publish')
    expect(opts.method).toBe('POST')
    if (typeof opts.body !== 'string') throw new Error('expected a JSON publish body')
    const payload = JSON.parse(opts.body) as {
      files: { path: string; content: string }[]
      message: string
    }
    expect(payload.message).toBe('canvas publish')
    const app = fileContent(payload.files, 'src/App.jsx')
    // Runtime ships every OSB* component (incl. the shadcn dialog/sheet
    // bases OSBModal/OSBDrawer import, plus the shared overlay geometry)
    // plus shared sources.
    const shipped = new Map(payload.files.map((f) => [f.path, f.content]))
    const expectedPaths = [
      'site.json',
      'src/App.jsx',
      'src/lib/utils.ts',
      'src/osb/OSBDialog.tsx',
      'src/osb/OSBOverlay.tsx',
      'src/osb/OSBSheet.tsx',
      'src/osb/OSBTheme.tsx',
      'src/osb/types.ts',
      ...OSB_NODE_TYPES.map((t) => `src/osb/${tagFor(t)}.tsx`),
    ].sort()
    expect(payload.files.map((f) => f.path).sort()).toEqual(expectedPaths)
    // Every registered node type must import a component that actually ships.
    for (const type of OSB_NODE_TYPES) {
      const tag = tagFor(type)
      expect(app).toContain(`from './osb/${tag}'`)
      expect(shipped.get(`src/osb/${tag}.tsx`)).toBeTruthy()
    }
    expect(app).toContain('<OSBCard')
    expect(app.indexOf('<OSBCard')).toBeLessThan(app.indexOf('<OSBText'))
    const site = fileContent(payload.files, 'site.json')
    expect(validateSite(JSON.parse(site))).toEqual({ ok: true, errors: [] })
    expect(siteJson(DOC, 'my-shop')).toBe(site)
  })

  it('publishes the global document theme into site.json (one theme, not per node)', () => {
    expect((JSON.parse(siteJson(DOC, 'x')) as { site: { theme: string } }).site.theme).toBe('light')
    const dark = { ...DOC, theme: 'dark' as const }
    expect((JSON.parse(siteJson(dark, 'x')) as { site: { theme: string } }).site.theme).toBe('dark')
  })

  it('surfaces backend failures without throwing', async () => {
    stubFetch(401, { error: 'login required' })
    const r = await pushDoc(DOC, 'my-shop')
    expect(r).toEqual({ ok: false, error: 'login required' })
  })
})
