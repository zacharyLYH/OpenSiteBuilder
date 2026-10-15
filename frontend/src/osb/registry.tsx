import type { ComponentType, ReactNode } from 'react'
import OSBBadge, { OSB_BADGE_DEFAULTS, OSB_BADGE_FIELDS, type OSBBadgeConfig } from './OSBBadge'
import OSBButton, { OSB_BUTTON_DEFAULTS, OSB_BUTTON_FIELDS, type OSBButtonConfig } from './OSBButton'
import OSBCard, { OSB_CARD_DEFAULTS, OSB_CARD_FIELDS, cardContentPad, type OSBCardConfig } from './OSBCard'
import OSBCarousel, { carouselItems, OSB_CAROUSEL_DEFAULTS, OSB_CAROUSEL_FIELDS, type OSBCarouselConfig } from './OSBCarousel'
import OSBMarquee, { OSB_MARQUEE_DEFAULTS, OSB_MARQUEE_FIELDS, type OSBMarqueeConfig } from './OSBMarquee'
import OSBImage, { OSB_IMAGE_DEFAULTS, OSB_IMAGE_FIELDS, type OSBImageConfig } from './OSBImage'
import OSBDrawer, { OSB_DRAWER_DEFAULTS, OSB_DRAWER_FIELDS, type OSBDrawerConfig } from './OSBDrawer'
import OSBDropdown, { OSB_DROPDOWN_DEFAULTS, OSB_DROPDOWN_FIELDS, type OSBDropdownConfig } from './OSBDropdown'
import OSBModal, { OSB_MODAL_DEFAULTS, OSB_MODAL_FIELDS, type OSBModalConfig } from './OSBModal'
import OSBText, { OSB_TEXT_DEFAULTS, OSB_TEXT_FIELDS, type OSBTextConfig } from './OSBText'
import OSBVideo, { OSB_VIDEO_DEFAULTS, OSB_VIDEO_FIELDS, type OSBVideoConfig } from './OSBVideo'
import { clampSlots } from './slots'
import type { OSBField, OSBGridSize, OSBKind, OSBSlot } from './types'

/** shadcn portal an overlay shell opens in. Declared per overlay kind so the
 * shared overlay chrome never switches on type names. */
export type OSBChrome = 'dialog' | 'sheet'

export interface OSBEntry {
  /** Human-readable name shown in the palette. Lowercased, it is the noun
   * every overlay label, testid, and message derives from. */
  name: string
  /** Atom = visible leaf, container = empty chrome + atom children. */
  kind: OSBKind
  /** Dashed empty-state hint shown on the canvas for empty containers. */
  emptyHint?: string
  /** This type opens overlays from a click (buttons). The trigger rule —
   * runtime openers, validation, the canvas attach slot — reads this, never
   * a hardcoded type name. */
  trigger?: boolean
  /** Overlay kinds only: which portal the live shell opens in. */
  chrome?: OSBChrome
  /** Containers only: the inset class the canvas wraps the child layer in,
   * so the editor shows the container's own padding. Absent = flush. */
  contentPad?: (config: unknown) => string
  /** SLOTTED CONTAINERS only (the carousel): how many slides this container's
   * child space is divided into, from its own config. The canvas bands, the
   * stored `slot` on each child, the doc gate and the published track all read
   * this ONE number, so a new slotted kind needs no engine changes. Absent =
   * the children are simply one band. */
  slots?: (config: unknown) => number
  defaults: Record<string, unknown>
  fields: OSBField[]
  /** Footprint in cells. cols/rows = drop size = rendered size. */
  grid: OSBGridSize
  /** Render one node. `onClick` is only meaningful for trigger atoms (buttons);
   * every other component ignores it. The engine passes it so a published
   * button can open its overlay. `slots` is only meaningful for slotted
   * containers (the carousel) and replaces the flat child list there — no
   * per-type branching in the runtime. */
  render: (config: unknown, children?: ReactNode, onClick?: () => void, slots?: OSBSlot[]) => ReactNode
}

/** Lowercase registry name: the noun behind labels, testids, and messages. */
export function overlayNoun(type: string): string {
  return type in OSB_REGISTRY ? OSB_REGISTRY[type as OSBNodeType].name.toLowerCase() : 'overlay'
}

function defineEntry<C extends Record<string, unknown>>(
  name: string,
  defaults: C,
  fields: OSBField[],
  grid: OSBGridSize,
  Component: ComponentType<{ config?: Partial<C>; children?: ReactNode; onClick?: () => void; slots?: OSBSlot[] }>,
  opts?: {
    kind?: OSBKind
    emptyHint?: string
    trigger?: boolean
    chrome?: OSBChrome
    contentPad?: (config: unknown) => string
    slots?: (config: unknown) => number
  },
): OSBEntry {
  return {
    name,
    kind: opts?.kind ?? 'atom',
    emptyHint: opts?.emptyHint,
    trigger: opts?.trigger,
    chrome: opts?.chrome,
    contentPad: opts?.contentPad,
    slots: opts?.slots,
    defaults,
    fields,
    grid,
    render: (config, children, onClick, slots) => (
      <Component config={config as Partial<C>} children={children} onClick={onClick} slots={slots} />
    ),
  }
}

/**
 * THE single record of node types. Each type name ('card', …) is written
 * exactly once, as a key here; types, defaults, fields, grid sizes, kinds and
 * rendering are all derived below. Key order is the palette order.
 *
 * Atoms (text, button, image, video, dropdown) are the only visible leaves —
 * collection-backed atoms like the dropdown keep their items in config, never
 * as canvas nodes. Card and carousel are the containers. Overlays are shells
 * whose content lives in `overlays[]`, never on the grid — they enter from a
 * trigger drawer, not the palette. Named compositions are patterns in
 * ./patterns, not types here.
 */
export const OSB_REGISTRY = {
  card: defineEntry(
    'Card',
    OSB_CARD_DEFAULTS,
    OSB_CARD_FIELDS,
    { minCols: 4, minRows: 3, maxCols: 32, maxRows: 32, cols: 6, rows: 5 },
    OSBCard,
    { kind: 'container', emptyHint: 'Drag text, buttons or images here', contentPad: cardContentPad },
  ),
  badge: defineEntry(
    'Badge',
    OSB_BADGE_DEFAULTS,
    OSB_BADGE_FIELDS,
    // A badge is a pill, not a panel: its default is two cells wide, and the
    // Position setting anchors the pill inside that box. One cell clips
    // longer words on the initial drop.
    { minCols: 1, minRows: 1, maxCols: 32, maxRows: 4, cols: 2, rows: 1 },
    OSBBadge,
  ),
  text: defineEntry(
    'Text',
    OSB_TEXT_DEFAULTS,
    OSB_TEXT_FIELDS,
    // Text starts tiny (one cell) and is dragged out; a big default is
    // awkward to place on a full page.
    { minCols: 1, minRows: 1, maxCols: 32, maxRows: 12, cols: 1, rows: 1 },
    OSBText,
  ),
  button: defineEntry(
    'Button',
    OSB_BUTTON_DEFAULTS,
    OSB_BUTTON_FIELDS,
    { minCols: 2, minRows: 1, maxCols: 32, maxRows: 4, cols: 3, rows: 1 },
    OSBButton,
    { trigger: true },
  ),
  image: defineEntry(
    'Image',
    OSB_IMAGE_DEFAULTS,
    OSB_IMAGE_FIELDS,
    { minCols: 2, minRows: 2, maxCols: 32, maxRows: 24, cols: 6, rows: 4 },
    OSBImage,
  ),
  modal: defineEntry(
    'Popup',
    OSB_MODAL_DEFAULTS,
    OSB_MODAL_FIELDS,
    { minCols: 6, minRows: 4, maxCols: 24, maxRows: 24, cols: 12, rows: 10 },
    OSBModal,
    { kind: 'overlay', chrome: 'dialog', emptyHint: 'Drag text, buttons or images here' },
  ),
  drawer: defineEntry(
    'Drawer',
    OSB_DRAWER_DEFAULTS,
    OSB_DRAWER_FIELDS,
    { minCols: 6, minRows: 4, maxCols: 24, maxRows: 24, cols: 10, rows: 10 },
    OSBDrawer,
    { kind: 'overlay', chrome: 'sheet', emptyHint: 'Drag text, buttons or images here' },
  ),
  dropdown: defineEntry(
    'Dropdown',
    OSB_DROPDOWN_DEFAULTS,
    OSB_DROPDOWN_FIELDS,
    // A menu trigger, not a panel: the trigger fills its box, so a dropdown
    // defaults to button size. The old 6x4 default dropped a dark slab.
    { minCols: 2, minRows: 1, maxCols: 32, maxRows: 4, cols: 3, rows: 1 },
    OSBDropdown,
  ),
  video: defineEntry(
    'Video',
    OSB_VIDEO_DEFAULTS,
    OSB_VIDEO_FIELDS,
    { minCols: 2, minRows: 2, maxCols: 32, maxRows: 24, cols: 6, rows: 4 },
    OSBVideo,
  ),
  // A SLOTTED container: its child space is divided into slides (the `slots`
  // hook below), so several atoms can live in one slide and the drawer can add
  // slides. Cards and overlays can never nest inside — the canContain gate
  // below owns that, never this entry.
  carousel: defineEntry(
    'Carousel',
    OSB_CAROUSEL_DEFAULTS,
    OSB_CAROUSEL_FIELDS,
    // A wide band, not a slab: a carousel reads as a row of slides. The floor
    // is a slide per column, so six slides still fit side by side.
    { minCols: 6, minRows: 3, maxCols: 32, maxRows: 24, cols: 12, rows: 7 },
    OSBCarousel,
    {
      kind: 'container',
      emptyHint: 'Drag images, videos or text here',
      slots: (config) => clampSlots(carouselItems(config)),
    },
  ),
  marquee: defineEntry(
    'Marquee',
    OSB_MARQUEE_DEFAULTS,
    OSB_MARQUEE_FIELDS,
    { minCols: 6, minRows: 2, maxCols: 32, maxRows: 12, cols: 12, rows: 4 },
    OSBMarquee,
  ),
}

export type OSBNodeType = keyof typeof OSB_REGISTRY

export const OSB_NODE_TYPES: OSBNodeType[] = Object.keys(OSB_REGISTRY) as OSBNodeType[]

// Palette order: plain atoms only. Cards and carousels always enter via
// their pattern (a shell pre-filled with connected atoms); an empty shell is
// what remains after its children are deleted, never a starting point.
export const OSB_PALETTE_TYPES: OSBNodeType[] = ['text', 'badge', 'button', 'image', 'video', 'dropdown', 'marquee']

export function isAtomType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].kind === 'atom'
}

export function isContainerType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].kind === 'container'
}

/** How many slides a container partitions its children into: 1 for every plain
 * container, the configured count for a slotted one (the carousel). */
export function slotCountOf(type: string, config: unknown): number {
  const slots = type in OSB_REGISTRY ? OSB_REGISTRY[type as OSBNodeType].slots : undefined
  return slots ? clampSlots(slots(config)) : 1
}

/** True when a container divides its child space into slides (the carousel). */
export function isSlottedType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].slots !== undefined
}

/**
 * The one structural membership rule. Containers hold atoms; overlays hold
 * atoms. Collection-backed components (dropdowns, marquees) are atoms and
 * hold nothing. Nothing else nests anywhere. Default deny: unknown types
 * reject.
 */
export function canContain(parentType: string, childType: string): boolean {
  if (isOverlayType(parentType)) return isAtomType(childType)
  if (isContainerType(parentType)) return isAtomType(childType)
  return false
}

/** Every kind the registry marks `overlay` — never a hardcoded key list. */
export function isOverlayType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].kind === 'overlay'
}

/** Every type that opens overlays from a click — never a hardcoded name. */
export function isTriggerType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].trigger === true
}

export type {
  OSBBadgeConfig,
  OSBButtonConfig,
  OSBCardConfig,
  OSBCarouselConfig,
  OSBDrawerConfig,
  OSBDropdownConfig,
  OSBImageConfig,
  OSBMarqueeConfig,
  OSBModalConfig,
  OSBTextConfig,
  OSBVideoConfig,
}
export { OSBBadge, OSBButton, OSBCard, OSBCarousel, OSBDrawer, OSBDropdown, OSBImage, OSBMarquee, OSBModal, OSBText, OSBVideo }
