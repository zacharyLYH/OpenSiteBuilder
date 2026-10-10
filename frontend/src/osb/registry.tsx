import type { ComponentType, ReactNode } from 'react'
import OSBButton, { OSB_BUTTON_DEFAULTS, type OSBButtonConfig } from './OSBButton'
import OSBCard, { OSB_CARD_DEFAULTS, type OSBCardConfig } from './OSBCard'
import OSBHero, { OSB_HERO_DEFAULTS, type OSBHeroConfig } from './OSBHero'

export type OSBCategory = 'Essentials' | 'Content' | 'Patterns'

export interface OSBEntry {
  /** Human-readable name shown in the insert menu. */
  name: string
  /** Catalog category (PRD §4.3). */
  category: OSBCategory
  defaults: Record<string, unknown>
  render: (config: unknown) => ReactNode
}

function defineEntry<C extends Record<string, unknown>>(
  name: string,
  category: OSBCategory,
  defaults: C,
  Component: ComponentType<{ config?: Partial<C> }>,
): OSBEntry {
  return {
    name,
    category,
    defaults,
    render: (config) => <Component config={config as Partial<C>} />,
  }
}

/**
 * THE single record of node types. Each type name ('card', …) is written
 * exactly once, as a key here. OSBNodeType, OSB_NODE_TYPES, defaults, and
 * rendering are all derived below — never re-declared.
 */
export const OSB_REGISTRY = {
  card: defineEntry('Card', 'Content', OSB_CARD_DEFAULTS, OSBCard),
  hero: defineEntry('Hero', 'Patterns', OSB_HERO_DEFAULTS, OSBHero),
  button: defineEntry('Button', 'Essentials', OSB_BUTTON_DEFAULTS, OSBButton),
}

export type OSBNodeType = keyof typeof OSB_REGISTRY

export const OSB_NODE_TYPES: OSBNodeType[] = Object.keys(OSB_REGISTRY) as OSBNodeType[]

export type { OSBButtonConfig, OSBCardConfig, OSBHeroConfig }
export { OSBButton, OSBCard, OSBHero }
