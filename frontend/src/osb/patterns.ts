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
  /** The container kind this pattern builds (card, carousel, …). */
  containerType: OSBNodeType
  containerCols: number
  containerRows: number
  containerConfig: Record<string, unknown>
  children: PatternChild[]
}

export const OSB_PATTERNS: Record<string, OSBPattern> = {
  'card-content': {
    name: 'Card',
    containerType: 'card',
    // Half-size default: big cards are awkward to place on a full page.
    // Children keep one cell of breathing room so the shell's floor matches
    // its size (containerFloor = child extent + CONTAINER_PAD).
    containerCols: 6,
    containerRows: 5,
    containerConfig: {},
    // Edge-connected by construction: title touches body (y=1), body touches
    // button (y=3). No overlaps, fully inside the 6x5 shell. Typography mirrors
    // shadcn Card: a heading title, muted body copy, then the action.
    children: [
      { type: 'text', config: { text: 'Card title', heading: 'h4' }, x: 0, y: 0, cols: 5, rows: 1 },
      { type: 'text', config: { text: 'Card body copy.', tone: 'muted' }, x: 0, y: 1, cols: 5, rows: 2 },
      { type: 'button', config: { label: 'Learn more' }, x: 0, y: 3, cols: 3, rows: 1 },
    ],
  },
  'carousel-slides': {
    name: 'Carousel',
    containerType: 'carousel',
    // A wide band with three starter slides. The slide count is the
    // container's own setting (`items`), and each slide is a small drop zone:
    // atoms dropped into a band belong to that slide. Adding, removing and
    // rearranging slides is all drawer work, never a new node type.
    containerCols: 12,
    containerRows: 7,
    containerConfig: { items: 3 },
    // One SMALL atom per slide, indented one cell into its four-cell band
    // (bands are an even split of the 12 columns). A starter slide is a
    // suggestion, not a filled panel: the atoms sit at the size their own
    // palette default scales to in a slide (see seatSpan), so most of each
    // slide stays free to drop the next thing onto.
    children: [
      { type: 'image', config: {}, x: 1, y: 1, cols: 2, rows: 2 },
      { type: 'text', config: { text: 'Swipe for more', heading: 'h4' }, x: 5, y: 1, cols: 2, rows: 1 },
      { type: 'badge', config: { text: 'New slide' }, x: 9, y: 1, cols: 2, rows: 1 },
    ],
  },
}

export const OSB_PATTERN_IDS = Object.keys(OSB_PATTERNS)
