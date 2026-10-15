import type { ReactNode } from 'react'

/** Light + dark are the only themes. A GLOBAL property of the page (the
 * document / `site.theme`), provided once via OSBThemeProvider and read by
 * components with useOSBTheme — never a per-component config. */
export type OSBTheme = 'light' | 'dark'

/**
 * Config rule (applies to EVERY OSB component): declare a flat `XxxConfig`
 * interface + `XXX_DEFAULTS`, take `config?: Partial<XxxConfig>` and shallow-
 * merge it here. Missing keys => defaults. No inspector changes needed.
 */
export function resolveConfig<T extends object>(defaults: T, provided?: Partial<T>): T {
  const out = { ...defaults }
  for (const [k, v] of Object.entries(provided ?? {})) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return out
}

/** Nesting kind. Engine vocabulary: atom = visible leaf with no children,
 * container = empty chrome + free-form atom children, overlay = a popup
 * shell (modal content lives in `overlays[]`, never on the grid).
 * Collection-backed components (dropdown options, …) are atoms too: their
 * items are inspector-edited data, never canvas nodes (PRD §6.2/§10.5). */
export type OSBKind = 'atom' | 'container' | 'overlay'

/** One repeatable option row edited in the inspector — e.g. a dropdown
 * option. Collection-backed data, never a canvas node (PRD §6.2). A row with
 * `children` renders as a submenu; MENU_MAX_DEPTH stops the nesting there. */
export type OSBMenuItem = { label: string; link: string; children?: OSBMenuItem[] }

/** How deep collection rows may nest: a submenu of a submenu is not a menu. */
export const MENU_MAX_DEPTH = 2

/** Shared text alignment knob. */
export type OSBAlign = 'left' | 'center'

/** The one option list behind every "Alignment" drawer field. */
export const ALIGN_OPTIONS: { value: OSBAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
]

/**
 * Where a component sits VERTICALLY in its grid box. Atoms normally fill
 * their box ("the box is the component"), but a badge is a pill: it stays its
 * natural height and is anchored instead, so the badge can sit at the
 * top, middle, or bottom of that box.
 */
export type OSBVAlign = 'top' | 'middle' | 'bottom'

/** The one option list behind every "Position" drawer field. */
export const V_ALIGN_OPTIONS: { value: OSBVAlign; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
]

/** The one flex cross-axis map behind `OSBVAlign` (static classes only). */
export const OSB_V_ALIGN_CLASSES: Record<OSBVAlign, string> = {
  top: 'items-start',
  middle: 'items-center',
  bottom: 'items-end',
}

/**
 * One card of a collection-backed multi-card component (marquee cards).
 * Edited in the inspector as a row, never a canvas node — the
 * same rule dropdown options follow (PRD §6.2).
 */
export type OSBCardItem = { title: string; body: string }

/** Surface emphasis shared by every raised/chrome component (cards, popups).
 * Written once so the two surfaces never drift apart in value or wording. */
export type OSBSurface = 'elevated' | 'outlined' | 'plain'

/** The one option list behind every "surface style" drawer field. */
export const SURFACE_OPTIONS: { value: OSBSurface; label: string }[] = [
  { value: 'elevated', label: 'Raised' },
  { value: 'outlined', label: 'Outline' },
  { value: 'plain', label: 'Plain' },
]

/** Padding (dot squares) kept around children inside a container. */
export const CONTAINER_PAD = 1

/** Grid footprint in dot squares. cols/rows = drop size. */
export type OSBGridSize = {
  minCols: number
  minRows: number
  maxCols: number
  maxRows: number
  cols: number
  rows: number
}

/** One editable key on a collection row: the drawer label, and the input's
 * placeholder. Declared by the field that owns the collection, so the ONE
 * items editor renders menu rows and card rows alike. */
export type OSBFieldItemKey = { key: string; label: string; placeholder: string }

/** One drawer field. kind picks the control; labels are plain-language.
 * `required` marks must-fill fields with a red asterisk. `visibleWhen`
 * hides a field until another field in the same draft has a real value
 * (non-blank strings, true booleans) — e.g. "new tab" needs a link first. */
export type OSBField =
  | {
      key: string
      label: string
      hint?: string
      required?: boolean
      visibleWhen?: { key: string }
      kind: 'text' | 'longtext' | 'boolean'
    }
  | {
      key: string
      label: string
      hint?: string
      required?: boolean
      visibleWhen?: { key: string }
      kind: 'select'
      options: { value: string; label: string }[]
    }
  | {
      /** Repeatable rows, edited in the inspector (PRD §6.2).
       * Collection-backed components keep their items here, never on the grid.
       * `itemFields` says which keys each row edits — so a menu row (label +
       * link) and a card row (title + body) share ONE editor and one field
       * kind. Order is the on-screen control order. */
      key: string
      label: string
      hint?: string
      required?: boolean
      visibleWhen?: { key: string }
      kind: 'items'
      itemFields: OSBFieldItemKey[]
      /** Rows may hold one nested list (a menu submenu), capped at
       * MENU_MAX_DEPTH. Absent = a flat collection. */
      subItems?: boolean
    }
  | {
      /** A whole number the user steps: how many slides a carousel holds, how
       * many seconds autoplay waits. Clamped to min..max by its owner. */
      key: string
      label: string
      hint?: string
      required?: boolean
      visibleWhen?: { key: string }
      kind: 'number'
      min: number
      max: number
    }

/**
 * One child of a SLOTTED CONTAINER as the engine hands it to the component:
 * its rendered content plus its own cell box INSIDE its slide. The child's x/y
 * are slide-local — the same cells the canvas draws, so edit and publish land
 * on the same pixel.
 */
export interface OSBSlotKid {
  id: string
  x: number
  y: number
  cols: number
  rows: number
  content: ReactNode
}

/**
 * One slide of a slotted container: the cell grid its children are positioned
 * in, plus those children. A slotted container (the carousel) receives these
 * instead of a flat child list, so it renders a track instead of a stack.
 */
export interface OSBSlot {
  cols: number
  rows: number
  kids: OSBSlotKid[]
}

/** A field shows when its `visibleWhen` dependency holds a real value. */
export function isFieldVisible(field: OSBField, draft: Record<string, unknown>): boolean {
  const dep = field.visibleWhen?.key
  if (!dep) return true
  const v = draft[dep]
  return typeof v === 'string' ? v.trim().length > 0 : v === true
}

export const OSB_ALIGN_CLASSES: Record<OSBAlign, string> = {
  left: 'text-left',
  center: 'text-center',
}

/** The overlay id a trigger opens, from `config.targetId` — the ONE key.
 * Callers check it against the page's overlay ids; an unset/dangling target
 * returns null so a stale reference stays inert. */
export function overlayTargetOf(config: Record<string, unknown> | undefined): string | null {
  const t = (config as { targetId?: unknown } | undefined)?.targetId
  return typeof t === 'string' && t.length > 0 ? t : null
}

/** One padding vocabulary for containers: `none` is flush, the sizes read
 * Compact / Cozy / Spacious. Padding belongs to the container (it is the space
 * between its interior edge and the items inside), never to an atom. Margin is
 * deliberately NOT a knob — it would push the box off the grid and break the
 * coordinate system. */
export type OSBPad = 'none' | 'compact' | 'cozy' | 'spacious'

/** The one option list behind the card's "Inner spacing" field. */
export const OSB_PAD_OPTIONS: { value: OSBPad; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'compact', label: 'Compact' },
  { value: 'cozy', label: 'Cozy' },
  { value: 'spacious', label: 'Spacious' },
]
