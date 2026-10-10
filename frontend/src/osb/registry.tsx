import type { ComponentType, ReactNode } from 'react'
import OSBButton, { OSB_BUTTON_DEFAULTS, OSB_BUTTON_FIELDS, type OSBButtonConfig } from './OSBButton'
import OSBCard, { OSB_CARD_DEFAULTS, OSB_CARD_FIELDS, type OSBCardConfig } from './OSBCard'
import OSBHero, { OSB_HERO_DEFAULTS, OSB_HERO_FIELDS, type OSBHeroConfig } from './OSBHero'
import type { OSBField, OSBGridSize } from './types'

export interface OSBEntry {
  /** Human-readable name shown in the palette. */
  name: string
  defaults: Record<string, unknown>
  fields: OSBField[]
  /** Footprint in checkerboard cells. w/h = drop size. */
  grid: OSBGridSize
  render: (config: unknown) => ReactNode
}

function defineEntry<C extends Record<string, unknown>>(
  name: string,
  defaults: C,
  fields: OSBField[],
  grid: OSBGridSize,
  Component: ComponentType<{ config?: Partial<C> }>,
): OSBEntry {
  return {
    name,
    defaults,
    fields,
    grid,
    render: (config) => <Component config={config as Partial<C>} />,
  }
}

/**
 * THE single record of node types. Each type name ('card', …) is written
 * exactly once, as a key here. OSBNodeType, OSB_NODE_TYPES, defaults, fields,
 * grid sizes, and rendering are all derived below — never re-declared.
 */
export const OSB_REGISTRY = {
  card: defineEntry(
    'Card',
    OSB_CARD_DEFAULTS,
    OSB_CARD_FIELDS,
    { minCols: 6, minRows: 8, maxCols: 32, maxRows: 24, cols: 10, rows: 10 },
    OSBCard,
  ),
  hero: defineEntry(
    'Hero',
    OSB_HERO_DEFAULTS,
    OSB_HERO_FIELDS,
    { minCols: 10, minRows: 8, maxCols: 32, maxRows: 24, cols: 20, rows: 8 },
    OSBHero,
  ),
  button: defineEntry(
    'Button',
    OSB_BUTTON_DEFAULTS,
    OSB_BUTTON_FIELDS,
    { minCols: 4, minRows: 2, maxCols: 32, maxRows: 4, cols: 6, rows: 2 },
    OSBButton,
  ),
}

export type OSBNodeType = keyof typeof OSB_REGISTRY

export const OSB_NODE_TYPES: OSBNodeType[] = Object.keys(OSB_REGISTRY) as OSBNodeType[]

export type { OSBButtonConfig, OSBCardConfig, OSBHeroConfig }
export { OSBButton, OSBCard, OSBHero }
