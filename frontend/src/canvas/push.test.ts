import { describe, it, expect, vi, afterEach } from 'vitest'
import { pushDoc, siteJson } from './push'
import { tagFor } from './codegen'
import { validateSite } from '../site/validate'
import { OSB_NODE_TYPES } from '../osb/registry'
import type { CanvasDoc } from './doc'

const DOC: CanvasDoc = {
  version: 1,
  nodes: [
    { id: 'h', type: 'hero', config: { title: 'Hi' }, x: 4, y: 0, cols: 16, rows: 6 },
    { id: 'b', type: 'button', config: { label: 'Go' }, x: 4, y: 7, cols: 4, rows: 1 },
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
    const payload = JSON.parse(opts.body as string) as {
      files: { path: string; content: string }[]
      message: string
    }
    expect(payload.message).toBe('canvas publish')
    const app = payload.files.find((f) => f.path === 'src/App.jsx')!.content
    expect(payload.files.map((f) => f.path).sort()).toEqual([
      'site.json',
      'src/App.jsx',
      'src/lib/utils.ts',
      'src/osb/OSBButton.tsx',
      'src/osb/OSBCard.tsx',
      'src/osb/OSBHero.tsx',
      'src/osb/types.ts',
    ])
    // Every registered node type must import a component that actually ships.
    const shipped = new Map(payload.files.map((f) => [f.path, f.content]))
    for (const type of OSB_NODE_TYPES) {
      const tag = tagFor(type)
      expect(app).toContain(`from './osb/${tag}'`)
      expect(shipped.get(`src/osb/${tag}.tsx`)).toBeTruthy()
    }
    expect(app).toContain('<OSBHero')
    expect(app.indexOf('<OSBHero')).toBeLessThan(app.indexOf('<OSBButton'))
    const site = payload.files.find((f) => f.path === 'site.json')!.content
    expect(validateSite(JSON.parse(site))).toEqual({ ok: true, errors: [] })
    expect(siteJson(DOC, 'my-shop')).toBe(site)
  })

  it('surfaces backend failures without throwing', async () => {
    stubFetch(401, { error: 'login required' })
    const r = await pushDoc(DOC, 'my-shop')
    expect(r).toEqual({ ok: false, error: 'login required' })
  })
})
