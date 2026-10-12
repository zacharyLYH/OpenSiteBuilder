/** Light + dark are the only themes. Explicit per render, never ambient. */
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
 * container = empty chrome + free-form atom children. */
export type OSBKind = 'atom' | 'container'

/** Shared text alignment knob. */
export type OSBAlign = 'left' | 'center'

/** The one option list behind every "Alignment" drawer field. */
export const ALIGN_OPTIONS: { value: OSBAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
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

/** One drawer field. kind picks the control; labels are plain-language. */
export type OSBField =
  | { key: string; label: string; hint?: string; kind: 'text' | 'longtext' | 'theme' | 'boolean' }
  | { key: string; label: string; hint?: string; kind: 'select'; options: { value: string; label: string }[] }

export const OSB_ALIGN_CLASSES: Record<OSBAlign, string> = {
  left: 'text-left',
  center: 'text-center',
}
