import type { ComponentType, ReactNode } from 'react'
import OSBButton, { OSB_BUTTON_DEFAULTS, OSB_BUTTON_FIELDS, type OSBButtonConfig } from './OSBButton'
import OSBCard, { OSB_CARD_DEFAULTS, OSB_CARD_FIELDS, type OSBCardConfig } from './OSBCard'
import OSBImage, { OSB_IMAGE_DEFAULTS, OSB_IMAGE_FIELDS, type OSBImageConfig } from './OSBImage'
import OSBDrawer, { OSB_DRAWER_DEFAULTS, OSB_DRAWER_FIELDS, type OSBDrawerConfig } from './OSBDrawer'
import OSBDropdown, { OSB_DROPDOWN_DEFAULTS, OSB_DROPDOWN_FIELDS, type OSBDropdownConfig } from './OSBDropdown'
import OSBModal, { OSB_MODAL_DEFAULTS, OSB_MODAL_FIELDS, type OSBModalConfig } from './OSBModal'
import { OSBOverlayBody } from './OSBOverlay'
import OSBText, { OSB_TEXT_DEFAULTS, OSB_TEXT_FIELDS, type OSBTextConfig } from './OSBText'
import OSBVideo, { OSB_VIDEO_DEFAULTS, OSB_VIDEO_FIELDS, type OSBVideoConfig } from './OSBVideo'
import type { OSBField, OSBGridSize, OSBKind } from './types'

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
   * codegen openers, validation, the canvas attach slot — reads this, never
   * a hardcoded type name. */
  trigger?: boolean
  /** Overlay kinds only: which portal the live shell opens in. */
  chrome?: OSBChrome
  defaults: Record<string, unknown>
  fields: OSBField[]
  /** Footprint in cells. cols/rows = drop size = rendered size. */
  grid: OSBGridSize
  render: (config: unknown, children?: ReactNode) => ReactNode
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
  Component: ComponentType<{ config?: Partial<C>; children?: ReactNode }>,
  opts?: { kind?: OSBKind; emptyHint?: string; trigger?: boolean; chrome?: OSBChrome },
): OSBEntry {
  return {
    name,
    kind: opts?.kind ?? 'atom',
    emptyHint: opts?.emptyHint,
    trigger: opts?.trigger,
    chrome: opts?.chrome,
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
 * Atoms (text, button, image, video, dropdown) are the only visible leaves —
 * collection-backed atoms like the dropdown keep their items in config, never
 * as canvas nodes. Card is the only container. Overlays are shells whose
 * content lives in `overlays[]`, never on the grid — they enter from a trigger
 * drawer, not the palette. Named compositions are patterns in ./patterns, not
 * types here.
 */
export const OSB_REGISTRY = {
  card: defineEntry(
    'Card',
    OSB_CARD_DEFAULTS,
    OSB_CARD_FIELDS,
    { minCols: 4, minRows: 3, maxCols: 32, maxRows: 32, cols: 6, rows: 5 },
    OSBCard,
    { kind: 'container', emptyHint: 'Drag text, buttons or images here' },
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
}

export type OSBNodeType = keyof typeof OSB_REGISTRY

export const OSB_NODE_TYPES: OSBNodeType[] = Object.keys(OSB_REGISTRY) as OSBNodeType[]

// Palette order: plain atoms only. Cards always enter via the Card pattern
// (a shell pre-filled with connected atoms); an empty shell is what remains
// after its children are deleted, never a starting point.
export const OSB_PALETTE_TYPES: OSBNodeType[] = ['text', 'button', 'image', 'video', 'dropdown']

export function isAtomType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].kind === 'atom'
}

export function isContainerType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].kind === 'container'
}

/**
 * The one structural membership rule. Containers hold atoms; overlays hold
 * atoms. Collection-backed components (dropdowns, …) are atoms and hold
 * nothing. Nothing else nests anywhere. Default deny: unknown types reject.
 */
export function canContain(parentType: string, childType: string): boolean {
  if (isOverlayType(parentType)) return isAtomType(childType)
  if (isContainerType(parentType)) return isAtomType(childType)
  return false
}

/** Legacy alias: every overlay kind, not just popups. */
export function isModalType(t: string): boolean {
  return isOverlayType(t)
}

/** Every kind the registry marks `overlay` — never a hardcoded key list. */
export function isOverlayType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].kind === 'overlay'
}

/** Every type that opens overlays from a click — never a hardcoded name. */
export function isTriggerType(t: string): boolean {
  return t in OSB_REGISTRY && OSB_REGISTRY[t as OSBNodeType].trigger === true
}

/**
 * THE live overlay preview (editor Test, drawer Test, screenshot mount).
 * Chrome comes from the entry — a new overlay kind renders with zero edits
 * here. X, outside press, and Escape all close; absolute kids match the
 * editor grid exactly.
 */
export function OSBOverlayTestPreview({
  overlayType,
  config,
  cols,
  rows,
  kids,
  renderKid,
  open,
  onOpenChange,
}: {
  overlayType: string
  config?: Record<string, unknown>
  cols: number
  rows: number
  kids: { id: string; x: number; y: number; cols: number; rows: number }[]
  renderKid: (id: string) => ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}): ReactNode {
  const body = <OSBOverlayBody cols={cols} rows={rows} kids={kids} renderKid={renderKid} />
  if ((overlayType in OSB_REGISTRY ? OSB_REGISTRY[overlayType as OSBNodeType].chrome : undefined) === 'sheet') {
    return (
      <OSBDrawer
        config={config as Partial<OSBDrawerConfig>}
        cols={cols}
        rows={rows}
        open={open}
        onOpenChange={onOpenChange}
      >
        {body}
      </OSBDrawer>
    )
  }
  return (
    <OSBModal config={config as Partial<OSBModalConfig>} cols={cols} rows={rows} open={open} onOpenChange={onOpenChange}>
      {body}
    </OSBModal>
  )
}

export type { OSBButtonConfig, OSBCardConfig, OSBDrawerConfig, OSBDropdownConfig, OSBImageConfig, OSBModalConfig, OSBTextConfig, OSBVideoConfig }
export { OSBButton, OSBCard, OSBDrawer, OSBDropdown, OSBImage, OSBModal, OSBText, OSBVideo }
