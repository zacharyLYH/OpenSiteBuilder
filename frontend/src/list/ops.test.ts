import { describe, expect, it } from 'vitest'
import type { SiteManifest } from '../site/types'
import { canHold, findNode, insertNode, moveNode, parentOf, removeNode, updateConfig } from './ops'

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

  it('moves across parents and edits config', () => {    let d = doc()
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

describe('placement rejections (what a bad drop voices)', () => {
  it('refuses a parent moving inside its own child', () => {
    let d = doc()
    d = (insertNode(d, null, 0, { id: 'c', type: 'card' }) as { ok: true; doc: SiteManifest }).doc
    d = (insertNode(d, 'c', 0, { id: 't', type: 'text' }) as { ok: true; doc: SiteManifest }).doc
    expect(moveNode(d, 'c', 't', 0)).toMatchObject({ ok: false, reason: 'cycle' })
  })

  it('refuses atoms holding anything and overlays docking anywhere', () => {
    let d = doc()
    d = (insertNode(d, null, 0, { id: 't', type: 'text' }) as { ok: true; doc: SiteManifest }).doc
    expect(insertNode(d, 't', 0, { id: 'b', type: 'button' })).toMatchObject({ ok: false, reason: 'holds-nothing' })
    expect(insertNode(d, null, 0, { id: 'm', type: 'modal' })).toMatchObject({ ok: false, reason: 'wrong-kind' })
    d = (insertNode(d, null, 1, { id: 'c', type: 'card' }) as { ok: true; doc: SiteManifest }).doc
    expect(insertNode(d, 'c', 0, { id: 'w', type: 'drawer' })).toMatchObject({ ok: false, reason: 'wrong-kind' })
  })

  it('finds nodes and parents for the canvas', () => {
    let d = doc()
    d = (insertNode(d, null, 0, { id: 'c', type: 'card' }) as { ok: true; doc: SiteManifest }).doc
    d = (insertNode(d, 'c', 0, { id: 't', type: 'text' }) as { ok: true; doc: SiteManifest }).doc
    expect(findNode(d, 't')?.type).toBe('text')
    expect(findNode(d, 'ghost')).toBeNull()
    expect(parentOf(d, 'c')).toBeNull()
    expect(parentOf(d, 't')).toBe('c')
    expect(parentOf(d, 'ghost')).toBeNull()
  })
})
