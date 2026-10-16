import { describe, expect, it } from 'vitest'
import type { SiteManifest } from '../site/types'
import { canHold, insertNode, moveNode, removeNode, updateConfig } from './ops'

const doc = (): SiteManifest => ({
  version: '0.1',
  site: { name: 'test', theme: 'light' },
  pages: [{ id: 'p', path: '/', title: 'home', nodes: [] }],
})

describe('list ops', () => {
  it('inserts atoms at root in order', () => {
    let d = doc()
    const first = insertNode(d, null, 0, { id: 'a', type: 'text' })
    if (!first.ok) throw new Error('insert a failed')
    d = first.doc
    const r = insertNode(d, null, 0, { id: 'b', type: 'button' })
    expect(r.ok && r.doc.pages[0].nodes.map((n) => n.id)).toEqual(['b', 'a'])
  })

  it('refuses atoms inside atoms and overlays anywhere', () => {
    let d = doc()
    d = (insertNode(d, null, 0, { id: 'a', type: 'text' }) as { ok: true; doc: SiteManifest }).doc
    expect(insertNode(d, 'a', 0, { id: 'b', type: 'button' })).toMatchObject({ ok: false, reason: 'holds-nothing' })
    expect(insertNode(d, null, 0, { id: 'm', type: 'modal' })).toMatchObject({ ok: false, reason: 'wrong-kind' })
    expect(canHold(d.pages[0].nodes, 'nope', 'text')).toBe('unknown-parent')
  })

  it('moves across parents and edits config', () => {
    let d = doc()
    d = (insertNode(d, null, 0, { id: 'c', type: 'card' }) as { ok: true; doc: SiteManifest }).doc
    d = (insertNode(d, null, 1, { id: 't', type: 'text' }) as { ok: true; doc: SiteManifest }).doc
    d = (moveNode(d, 't', 'c', 0) as { ok: true; doc: SiteManifest }).doc
    expect(d.pages[0].nodes.map((n) => n.id)).toEqual(['c'])
    expect(d.pages[0].nodes[0].children?.map((n) => n.id)).toEqual(['t'])
    d = (updateConfig(d, 't', { label: 'hi' }) as { ok: true; doc: SiteManifest }).doc
    expect(d.pages[0].nodes[0].children?.[0].config).toEqual({ label: 'hi' })
    d = (removeNode(d, 't') as { ok: true; doc: SiteManifest }).doc
    expect(d.pages[0].nodes[0].children ?? []).toEqual([])
    expect(removeNode(d, 'ghost')).toMatchObject({ ok: false, reason: 'missing-node' })
  })
})
