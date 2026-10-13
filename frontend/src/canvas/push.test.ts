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
    // Runtime ships every OSB* component (incl. the shadcn bases the node
    // components import) plus shared sources. The expected manifest derives
    // from the import graph rooted at App + the node components — a new
    // component or base needs no edits here, and a missing file fails.
    const shipped = new Map(payload.files.map((f) => [f.path, f.content]))
    const resolveImport = (importer: string, spec: string): string | null => {
      // Bare packages (react) and anything outside osb/lib ship nothing.
      const base = spec.startsWith('./osb/')
        ? `src/${spec.slice(2)}`
        : importer.startsWith('src/osb/') && spec.startsWith('./')
          ? `src/osb/${spec.slice(2)}`
          : importer.startsWith('src/osb/') && spec.startsWith('../lib/')
            ? `src/${spec.slice(3)}`
            : null
      if (!base) return null
      if (shipped.has(`${base}.tsx`)) return `${base}.tsx`
      if (shipped.has(`${base}.ts`)) return `${base}.ts`
      throw new Error(`unresolved import ${spec} from ${importer}`)
    }
    const expected = new Set([
      'site.json',
      'src/App.jsx',
      'src/osb/types.ts',
      'src/osb/OSBTheme.tsx',
      ...OSB_NODE_TYPES.map((t) => `src/osb/${tagFor(t)}.tsx`),
    ])
    const crawl = (path: string): void => {
      const content = shipped.get(path)
      if (!content) throw new Error(`missing file ${path}`)
      for (const m of content.matchAll(/from '([^']+)'/g)) {
        const resolved = resolveImport(path, m[1])
        if (resolved && !expected.has(resolved)) {
          expected.add(resolved)
          crawl(resolved)
        }
      }
    }
    crawl('src/App.jsx')
    for (const type of OSB_NODE_TYPES) crawl(`src/osb/${tagFor(type)}.tsx`)
    expect(payload.files.map((f) => f.path).sort()).toEqual([...expected].sort())
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
