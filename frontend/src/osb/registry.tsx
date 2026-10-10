import type { ComponentType, ReactNode } from 'react'
import OSBButton, { OSB_BUTTON_DEFAULTS, OSB_BUTTON_FIELDS, type OSBButtonConfig } from './OSBButton'
import OSBCard, { OSB_CARD_DEFAULTS, OSB_CARD_FIELDS, type OSBCardConfig } from './OSBCard'
import OSBFooter, { OSB_FOOTER_DEFAULTS, OSB_FOOTER_FIELDS, type OSBFooterConfig } from './OSBFooter'
import OSBHero, { OSB_HERO_DEFAULTS, OSB_HERO_FIELDS, type OSBHeroConfig } from './OSBHero'
import OSBNavbar, { OSB_NAVBAR_DEFAULTS, OSB_NAVBAR_FIELDS, type OSBNavbarConfig } from './OSBNavbar'
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
 * Key order is the palette order, so it reads like a page: top chrome first.
 */
export const OSB_REGISTRY = {
  navbar: defineEntry(
    'Navbar',
    OSB_NAVBAR_DEFAULTS,
    OSB_NAVBAR_FIELDS,
    { minCols: 8, minRows: 2, maxCols: 32, maxRows: 4, cols: 32, rows: 2 },
    OSBNavbar,
  ),
  hero: defineEntry(
    'Hero',
    OSB_HERO_DEFAULTS,
    OSB_HERO_FIELDS,
    { minCols: 10, minRows: 8, maxCols: 32, maxRows: 24, cols: 20, rows: 8 },
    OSBHero,
  ),
  card: defineEntry(
    'Card',
    OSB_CARD_DEFAULTS,
    OSB_CARD_FIELDS,
    { minCols: 6, minRows: 8, maxCols: 32, maxRows: 24, cols: 10, rows: 10 },
    OSBCard,
  ),
  button: defineEntry(
    'Button',
    OSB_BUTTON_DEFAULTS,
    OSB_BUTTON_FIELDS,
    { minCols: 4, minRows: 2, maxCols: 32, maxRows: 4, cols: 6, rows: 2 },
    OSBButton,
  ),
  footer: defineEntry(
    'Footer',
    OSB_FOOTER_DEFAULTS,
    OSB_FOOTER_FIELDS,
    { minCols: 8, minRows: 4, maxCols: 32, maxRows: 12, cols: 32, rows: 6 },
    OSBFooter,
  ),
}

export type OSBNodeType = keyof typeof OSB_REGISTRY

export const OSB_NODE_TYPES: OSBNodeType[] = Object.keys(OSB_REGISTRY) as OSBNodeType[]

export type { OSBButtonConfig, OSBCardConfig, OSBFooterConfig, OSBHeroConfig, OSBNavbarConfig }
export { OSBButton, OSBCard, OSBFooter, OSBHero, OSBNavbar }
