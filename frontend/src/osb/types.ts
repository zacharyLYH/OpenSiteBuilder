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
      /** Repeatable rows of label + link, edited in the inspector (PRD §6.2).
       * Collection-backed components keep their items here, never on the grid. */
      key: string
      label: string
      hint?: string
      required?: boolean
      visibleWhen?: { key: string }
      kind: 'items'
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
