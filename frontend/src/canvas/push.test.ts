import { describe, it, expect, vi, afterEach } from 'vitest'
import { publishedPackageJson, publishedPackageLock, pushDoc, siteJson, siteObject } from './push'
import { validateSite } from '../site/validate'
import type { CanvasDoc } from './doc'
import frontendPkg from '../../package.json'
import frontendLockSrc from '../../package-lock.json?raw'

const DOC: CanvasDoc = {
  version: 1,
  nodes: [
    { id: 'c', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
    { id: 'b', type: 'button', config: { label: 'Go' }, parentId: 'c', x: 1, y: 1, cols: 4, rows: 1 },
    { id: 't', type: 'text', config: { text: 'Hi' }, parentId: null, x: 12, y: 0, cols: 8, rows: 2 },
  ],
}

// Exactly the glob push ships: every builder source, minus co-located tests.
const OSB_SOURCES = import.meta.glob('../osb/OSB*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const SHIPPED_OSB = Object.keys(OSB_SOURCES)
  .filter((p) => !p.includes('.test.'))
  .map((p) => 'src/' + p.replace('../', ''))

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

describe('published build environment (single source: frontend/package.json)', () => {
  it('keeps shell identity with vite-only scripts and frontend deps verbatim', () => {
    const pkg = JSON.parse(publishedPackageJson()) as {
      name: string
      scripts: Record<string, string>
      dependencies: unknown
      devDependencies: unknown
    }
    expect(pkg.name).toBe('osb-site')
    // No tsc/vitest/playwright scripts: the shell has no tsconfig or tests.
    expect(pkg.scripts).toEqual({ dev: 'vite', build: 'vite build', preview: 'vite preview' })
    expect(pkg.dependencies).toEqual(frontendPkg.dependencies)
    expect(pkg.devDependencies).toEqual(frontendPkg.devDependencies)
  })

  it('ships the frontend lockfile verbatim so `npm ci` stays in sync', () => {
    expect(publishedPackageLock()).toBe(frontendLockSrc)
    expect(publishedPackageLock()).toContain('lockfileVersion')
  })
})

describe('pushDoc (codegen v2: manifest + runtime, no generated JSX)', () => {
  it('posts site.json + the static skeleton + the runtime to the push API', async () => {
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

    // The manifest is the payload; it validates and matches siteJson exactly.
    const site = fileContent(payload.files, 'site.json')
    expect(validateSite(JSON.parse(site))).toEqual({ ok: true, errors: [] })
    expect(siteJson(DOC, 'my-shop')).toBe(site)

    // App.jsx is the static skeleton: it imports the manifest + the engine.
    // No per-node JSX is generated anymore (that is the whole point of v2).
    const app = fileContent(payload.files, 'src/App.jsx')
    expect(app).toContain(`import site from '../site.json'`)
    expect(app).toContain(`import { OSBRuntime } from './osb/OSBRuntime'`)
    expect(app).toContain('<OSBRuntime manifest={site} />')
    expect(app).not.toContain('<OSBCard')

    // The engine, the registry, and every shared module they import ship too.
    for (const path of [
      'src/osb/OSBRuntime.tsx',
      'src/osb/registry.tsx',
      'src/osb/types.ts',
      'src/site/types.ts',
      'src/lib/utils.ts',
    ]) {
      expect(fileContent(payload.files, path).length).toBeGreaterThan(0)
    }
    // Every builder component ships byte-for-byte (folder-sync, not codegen).
    for (const path of SHIPPED_OSB) {
      const source = OSB_SOURCES['../' + path.replace('src/', '')]
      expect(fileContent(payload.files, path)).toBe(source)
    }

    // The build environment ships too, so a component that adds a dependency
    // still installs in a repo created earlier (package.json + lock together).
    // Both derive from the frontend's own manifest — no manual template sync.
    const publishedPkg = JSON.parse(fileContent(payload.files, 'package.json')) as {
      name: string
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(publishedPkg.name).toBe('osb-site')
    expect(publishedPkg.scripts).toEqual({ dev: 'vite', build: 'vite build', preview: 'vite preview' })
    expect(publishedPkg.dependencies).toEqual(frontendPkg.dependencies)
    expect(publishedPkg.devDependencies).toEqual(frontendPkg.devDependencies)
    expect(fileContent(payload.files, 'package-lock.json')).toBe(frontendLockSrc)

    // Exactly the expected set — no strays, nothing missing.
    const expected = [
      'site.json',
      'src/App.jsx',
      'src/osb/OSBRuntime.tsx',
      'src/osb/registry.tsx',
      'src/osb/types.ts',
      'src/site/types.ts',
      'src/lib/utils.ts',
      'package.json',
      'package-lock.json',
      ...SHIPPED_OSB,
    ]
    expect(payload.files.map((f) => f.path).sort()).toEqual([...new Set(expected)].sort())
  })

  it('ships page nodes in flow order (top→bottom, left→right), not array order', () => {
    // The doc array is deliberately out of visual order; the manifest must be
    // sorted by grid position so published flow matches the canvas (PRD §5.3).
    const doc: CanvasDoc = {
      version: 1,
      nodes: [
        { id: 'bottom', type: 'text', config: {}, parentId: null, x: 0, y: 10, cols: 4, rows: 2 },
        { id: 'right', type: 'text', config: {}, parentId: null, x: 12, y: 0, cols: 4, rows: 2 },
        { id: 'left', type: 'text', config: {}, parentId: null, x: 0, y: 0, cols: 4, rows: 2 },
      ],
    }
    const obj = siteObject(doc, 'flow') as { pages: { nodes: { id: string }[] }[] }
    expect(obj.pages[0].nodes.map((n) => n.id)).toEqual(['left', 'right', 'bottom'])
  })

  it('reads site.meta from the document, defaulting the title to the slug', () => {
    const base: CanvasDoc = { version: 1, nodes: [] }
    expect((siteObject(base, 'my-shop') as { site: { meta: { title: string } } }).site.meta.title).toBe('my-shop')
    const withMeta: CanvasDoc = { ...base, meta: { title: 'My Shop', description: 'Nice things', ogImage: '/og.png' } }
    expect((siteObject(withMeta, 'my-shop') as { site: { meta: unknown } }).site.meta).toEqual({
      title: 'My Shop',
      description: 'Nice things',
      ogImage: '/og.png',
    })
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
