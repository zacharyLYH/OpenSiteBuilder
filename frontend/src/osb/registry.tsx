import type { ComponentType, ReactNode } from 'react'
import OSBButton, { OSB_BUTTON_DEFAULTS, OSB_BUTTON_FIELDS, type OSBButtonConfig } from './OSBButton'
import OSBCard, { OSB_CARD_DEFAULTS, OSB_CARD_FIELDS, type OSBCardConfig } from './OSBCard'
import OSBImage, { OSB_IMAGE_DEFAULTS, OSB_IMAGE_FIELDS, type OSBImageConfig } from './OSBImage'
import OSBText, { OSB_TEXT_DEFAULTS, OSB_TEXT_FIELDS, type OSBTextConfig } from './OSBText'
import type { OSBField, OSBGridSize, OSBKind } from './types'

export interface OSBEntry {
  /** Human-readable name shown in the palette. */
  name: string
  /** Atom = visible leaf, container = empty chrome + atom children. */
  kind: OSBKind
  /** Dashed empty-state hint shown on the canvas for empty containers. */
  emptyHint?: string
  defaults: Record<string, unknown>
  fields: OSBField[]
  /** Footprint in cells. cols/rows = drop size = rendered size. */
  grid: OSBGridSize
  render: (config: unknown, children?: ReactNode) => ReactNode
}

function defineEntry<C extends Record<string, unknown>>(
  name: string,
  defaults: C,
  fields: OSBField[],
  grid: OSBGridSize,
  Component: ComponentType<{ config?: Partial<C>; children?: ReactNode }>,
  opts?: { kind?: OSBKind; emptyHint?: string },
): OSBEntry {
  return {
    name,
    kind: opts?.kind ?? 'atom',
    emptyHint: opts?.emptyHint,
    defaults,
    fields,
    grid,
    render: (config, children) => <Component config={config as Partial<C>} children={children} />,
  }
}

/**
 * THE single record of node types. Each type name ('card', …) is written
 * exactly once, as a key here; types, defaults, fields, grid sizes, kinds and
 * rendering are all derived below. Key order is the palette order.
 *
 * Atoms (text, button, image) are the only visible leaves. Card is the only
 * container. Named compositions are patterns in ./patterns, not types here.
 */
export const OSB_REGISTRY = {
  card: defineEntry(
    'Card',
    OSB_CARD_DEFAULTS,
    OSB_CARD_FIELDS,
    { minCols: 6, minRows: 4, maxCols: 32, maxRows: 32, cols: 12, rows: 10 },
    OSBCard,
    { kind: 'container', emptyHint: 'Drag text, buttons or images here' },
  ),
  text: defineEntry(
    'Text',
    OSB_TEXT_DEFAULTS,
    OSB_TEXT_FIELDS,
    { minCols: 2, minRows: 1, maxCols: 32, maxRows: 12, cols: 6, rows: 1 },
    OSBText,
  ),
  button: defineEntry(
    'Button',
    OSB_BUTTON_DEFAULTS,
    OSB_BUTTON_FIELDS,
    { minCols: 2, minRows: 1, maxCols: 32, maxRows: 4, cols: 4, rows: 1 },
    OSBButton,
  ),
  image: defineEntry(
    'Image',
    OSB_IMAGE_DEFAULTS,
    OSB_IMAGE_FIELDS,
    { minCols: 2, minRows: 2, maxCols: 32, maxRows: 24, cols: 8, rows: 6 },
    OSBImage,
  ),
}

export type OSBNodeType = keyof typeof OSB_REGISTRY

export const OSB_NODE_TYPES: OSBNodeType[] = Object.keys(OSB_REGISTRY) as OSBNodeType[]

// Palette order: plain atoms only. Cards always enter via the Card pattern
// (a shell pre-filled with connected atoms); an empty shell is what remains
// after its children are deleted, never a starting point.
export const OSB_PALETTE_TYPES: OSBNodeType[] = ['text', 'button', 'image']

export function isAtomType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].kind === 'atom'
}

export function isContainerType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].kind === 'container'
}

/**
 * The one structural membership rule. A container holds any atom; nothing
 * else nests anywhere. Default deny: unknown types reject.
 */
export function canContain(parentType: string, childType: string): boolean {
  return isContainerType(parentType) && isAtomType(childType)
}

export type { OSBButtonConfig, OSBCardConfig, OSBImageConfig, OSBTextConfig }
export { OSBButton, OSBCard, OSBImage, OSBText }
