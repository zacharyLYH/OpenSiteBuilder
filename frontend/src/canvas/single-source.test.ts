import { describe, it, expect, vi, afterEach } from 'vitest'
import { pushDoc } from './push'
import { OSB_NODE_TYPES } from '../osb/registry'
import type { CanvasDoc } from './doc'

/**
 * The single-source proof (codegen v2).
 *
 * There are two consumers of a user component:
 *   1. the visual builder — CanvasStage/ConfigDrawer/mount render
 *      `OSB_REGISTRY[type].render(...)`, and the registry imports `./OSB*`;
 *   2. the published site — `OSBRuntime` looks the same registry up by type,
 *      and pushDoc ships those exact files as raw text (no codegen).
 *
 * "One source of truth" is true only if both point at the SAME file. These
 * tests read the real modules `?raw` and compare them to what push actually
 * transmits, so a hand-copied/duplicated component cannot slip through.
 */

/** Registry key -> component file ('card' -> 'OSBCard'), the naming the
 * registry keys and the shipped osb/ folder both use. */
const tagFor = (type: string): string => `OSB${type[0].toUpperCase()}${type.slice(1)}`

const raw = (glob: Record<string, string>, key: string): string => {
  const v = glob[key]
  if (typeof v !== 'string') throw new Error(`missing raw source for ${key}`)
  return v
}

// Exactly the glob push.ts uses, resolved the same way.
const OSB_SOURCES = import.meta.glob('../osb/OSB*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const FIXED = import.meta.glob(
  ['../osb/types.ts', '../lib/utils.ts', '../osb/registry.tsx', '../site/types.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ status, json: async () => body })))
}
afterEach(() => vi.unstubAllGlobals())

async function shippedFiles(): Promise<Map<string, string>> {
  stubFetch(200, { commit: 'sha', url: 'https://x.github.io/y/' })
  const doc: CanvasDoc = { version: 1, nodes: [] }
  const r = await pushDoc(doc, 'proof')
  if (!r.ok) throw new Error('push failed')
  const body = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
  const payload = JSON.parse(body) as { files: { path: string; content: string }[] }
  return new Map(payload.files.map((f) => [f.path, f.content]))
}

describe('single source of truth: visual builder == engine/publish', () => {
  it('(1) push ships the builder component files byte-for-byte (no re-implementation)', async () => {
    const shipped = await shippedFiles()
    const checked: string[] = []
    for (const [globKey, source] of Object.entries(OSB_SOURCES)) {
      if (globKey.includes('.test.')) continue
      const path = 'src/' + globKey.replace('../', '')
      expect(source.length).toBeGreaterThan(0)
      expect(shipped.get(path), `publish must ship the real ${globKey}`).toBe(source)
      checked.push(path)
    }
    // Shared modules travel the same way.
    expect(shipped.get('src/osb/types.ts')).toBe(raw(FIXED, '../osb/types.ts'))
    expect(shipped.get('src/lib/utils.ts')).toBe(raw(FIXED, '../lib/utils.ts'))
    expect(shipped.get('src/osb/registry.tsx')).toBe(raw(FIXED, '../osb/registry.tsx'))
    expect(shipped.get('src/site/types.ts')).toBe(raw(FIXED, '../site/types.ts'))
    // Proof surface for the reader: which files are the one copy.
    expect(checked).toContain('src/osb/OSBRuntime.tsx')
    expect(checked).toContain('src/osb/OSBCard.tsx')
    expect(checked).toContain('src/osb/OSBText.tsx')
    expect(checked).toContain('src/osb/OSBButton.tsx')
  })

  it('(2) the engine renders every node type through the one registry', async () => {
    const registrySource = raw(FIXED, '../osb/registry.tsx')
    const shipped = await shippedFiles()
    // The published App imports the engine, and the engine reads the registry.
    expect(shipped.get('src/App.jsx')).toContain(`from './osb/OSBRuntime'`)
    expect(shipped.get('src/osb/OSBRuntime.tsx')).toContain(`from './registry'`)
    for (const type of OSB_NODE_TYPES) {
      const tag = tagFor(type)
      // The builder registry imports the one copy...
      expect(registrySource).toContain(`from './${tag}'`)
      // ...and publish ships exactly that module (same source push reads).
      expect(shipped.get(`src/osb/${tag}.tsx`)).toBe(OSB_SOURCES[`../osb/${tag}.tsx`])
    }
  })

  it('(3) no duplicate component implementation exists in the repo', () => {
    // Exactly one source file defines each component tag; if a second copy
    // were added (e.g. a publish-only variant) this list would grow.
    const files = Object.keys(OSB_SOURCES).filter((k) => !k.includes('.test.'))
    for (const type of OSB_NODE_TYPES) {
      const tag = tagFor(type)
      const matches = files.filter((f) => f.endsWith(`/${tag}.tsx`))
      expect(matches, `expected exactly one ${tag}.tsx`).toEqual([`../osb/${tag}.tsx`])
    }
  })
})
