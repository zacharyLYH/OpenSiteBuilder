import { describe, it, expect } from 'vitest'
import { OSB_CARD_DEFAULTS, OSB_CARD_INSET, cardContentPad } from './OSBCard'
import { OSB_PAD_OPTIONS } from './types'
import { OSB_NODE_TYPES, OSB_REGISTRY, isAtomType } from './registry'

describe('padding (one shared vocabulary, owned by containers)', () => {
  it('maps every pad option to a canvas inset class', () => {
    expect(Object.keys(OSB_CARD_INSET).sort()).toEqual(OSB_PAD_OPTIONS.map((o) => o.value).sort())
    expect(cardContentPad({ padding: 'compact' })).toBe('p-3')
    expect(cardContentPad({ padding: 'cozy' })).toBe('p-6')
    expect(cardContentPad({ padding: 'spacious' })).toBe('p-8')
    expect(cardContentPad({ padding: 'none' })).toBe('')
    // Missing reads as the default; an unknown value reads as flush, never throws.
    expect(cardContentPad(undefined)).toBe(OSB_CARD_INSET[OSB_CARD_DEFAULTS.padding])
    expect(cardContentPad({ padding: 'huge' })).toBe('')
  })

  it('atoms never offer padding — spacing belongs to the container', () => {
    const atoms = OSB_NODE_TYPES.filter(isAtomType)
    expect(atoms.length).toBeGreaterThan(0)
    for (const type of atoms) {
      expect(
        OSB_REGISTRY[type].fields.find((f) => f.key === 'padding'),
        `${type} must not offer Padding`,
      ).toBeUndefined()
      expect(OSB_REGISTRY[type].contentPad, `${type} must not inset its box`).toBeUndefined()
    }
  })

  it('the card exposes its inset through the registry (single source)', () => {
    expect(OSB_REGISTRY.card.contentPad).toBe(cardContentPad)
    const field = OSB_REGISTRY.card.fields.find((f) => f.key === 'padding')
    if (!field || field.kind !== 'select') throw new Error('expected a select padding field')
    expect(field.options).toEqual(OSB_PAD_OPTIONS)
  })
})
