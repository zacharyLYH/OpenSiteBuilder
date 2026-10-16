import { describe, expect, it, vi, afterEach } from 'vitest'
import { pushManifest } from './push'
import { emptyManifest } from './store'

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ status, json: async () => body })))
}
afterEach(() => vi.unstubAllGlobals())

describe('pushManifest', () => {
  it('refuses an invalid manifest without touching the network', async () => {
    stubFetch(200, { commit: 'x', url: 'https://x.github.io/y/' })
    const bad = { ...emptyManifest('x'), pages: [] }
    const r = await pushManifest(bad)
    expect(r.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ships site.json + skeleton + runtime in one publish call', async () => {
    stubFetch(200, { commit: 'abc123', url: 'https://x.github.io/y/' })
    const manifest = emptyManifest('mysite')
    const r = await pushManifest(manifest)
    expect(r).toEqual({ ok: true, commit: 'abc123', url: 'https://x.github.io/y/' })
    const [, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(opts.body as string) as { files: { path: string; content: string }[] }
    const paths = payload.files.map((f) => f.path)
    expect(paths).toContain('site.json')
    expect(paths).toContain('src/App.jsx')
    expect(paths).toContain('src/osb/OSBButton.tsx')
    expect(JSON.parse(payload.files.find((f) => f.path === 'site.json')!.content)).toMatchObject({
      site: { name: 'mysite' },
    })
  })

  it('voices publish failures with words', async () => {
    stubFetch(500, { error: 'conflict' })
    const r = await pushManifest(emptyManifest('s'))
    expect(r).toEqual({ ok: false, error: 'conflict' })
  })
})
