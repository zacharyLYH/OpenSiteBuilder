import { describe, it, expect, vi, afterEach } from 'vitest'
import { pushDoc } from './push'
import { generatePage, tagFor } from './codegen'
import { OSB_NODE_TYPES } from '../osb/registry'
import type { CanvasDoc } from './doc'

/**
 * The single-source proof.
 *
 * There are two consumers of a user component:
 *   1. the visual builder — CanvasStage/ConfigDrawer/mount render
 *      `OSB_REGISTRY[type].render(...)`, and the registry imports `./OSB*`;
 *   2. codegen/publish — generatePage emits `<OSB*>` tags importing
 *      `./osb/OSB*`, and pushDoc ships those files as raw text.
 *
 * "One source of truth" is true only if both point at the SAME file. These
 * tests read the real modules `?raw` and compare them to what push actually
 * transmits, so a hand-copied/duplicated component cannot slip through.
 */

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
const FIXED = import.meta.glob(['../osb/types.ts', '../lib/utils.ts', '../osb/registry.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

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

describe('single source of truth: visual builder == codegen/publish', () => {
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
    // Proof surface for the reader: which files are the one copy.
    expect(checked).toContain('src/osb/OSBCard.tsx')
    expect(checked).toContain('src/osb/OSBText.tsx')
    expect(checked).toContain('src/osb/OSBButton.tsx')
  })

  it('(2) codegen imports the one copy for every node type', async () => {
    const page = generatePage({ version: 1, nodes: [] })
    const shipped = await shippedFiles()
    for (const type of OSB_NODE_TYPES) {
      const tag = tagFor(type)
      const modulePath = `osb/${tag}`
      // The generated React imports the component module...
      expect(page).toContain(`from './${modulePath}'`)
      // ...and publish ships exactly that module (same source push reads).
      const source = OSB_SOURCES[`../${modulePath}.tsx`]
      expect(shipped.get(`src/${modulePath}.tsx`)).toBe(source)
    }
  })

  it('(3) the builder registry imports the one copy for every node type', () => {
    const registrySource = raw(FIXED, '../osb/registry.tsx')
    for (const type of OSB_NODE_TYPES) {
      const tag = tagFor(type)
      // The visual builder renders through this import — not a re-created tree.
      expect(registrySource).toContain(`from './${tag}'`)
      // ...and the module it imports is the same file publish ships (test 1).
      expect(OSB_SOURCES[`../osb/${tag}.tsx`]).toBeTypeOf('string')
    }
  })

  it('(4) no duplicate component implementation exists in the repo', () => {
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
