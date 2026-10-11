import type { OSBNodeType } from './registry'

/** One atom placed inside a pattern container (parent-relative cells). */
export interface PatternChild {
  type: OSBNodeType
  config: Record<string, unknown>
  x: number
  y: number
  cols: number
  rows: number
}

/**
 * A palette recommendation, not a node type: a factory that inserts a
 * container pre-filled with ordinary atoms. After insert, everything is
 * regular nodes — movable, resizable, removable like anything else.
 */
export interface OSBPattern {
  name: string
  containerCols: number
  containerRows: number
  containerConfig: Record<string, unknown>
  children: PatternChild[]
}

export const OSB_PATTERNS: Record<string, OSBPattern> = {
  'card-content': {
    name: 'Card',
    containerCols: 12,
    containerRows: 10,
    containerConfig: {},
    // Edge-connected by construction: title touches body (y=3), body
    // touches button (y=6). No overlaps, fully inside the 12x10 shell.
    children: [
      { type: 'text', config: { text: 'Card title' }, x: 1, y: 1, cols: 8, rows: 2 },
      { type: 'text', config: { text: 'Card body copy.' }, x: 1, y: 3, cols: 8, rows: 3 },
      { type: 'button', config: { label: 'Learn more' }, x: 1, y: 6, cols: 4, rows: 1 },
    ],
  },
}

export const OSB_PATTERN_IDS = Object.keys(OSB_PATTERNS)
