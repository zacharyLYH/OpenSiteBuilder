/** Light + dark are the only themes. Explicit per render, never ambient. */
export type OSBTheme = 'light' | 'dark'

/**
 * Config resolution rule (applies to EVERY OSB component):
 * each component declares a flat `XxxConfig` interface + `XXX_DEFAULTS`.
 * The component takes `config?: Partial<XxxConfig>` and shallow-merges it
 * over defaults via `resolveConfig`. Missing keys => defaults.
 *
 * To add a new knob: add the key to the interface + DEFAULTS + use it in
 * the render. No editor/inspector changes needed.
 */
export function resolveConfig<T extends object>(
  defaults: T,
  provided?: Partial<T>,
): T {
  if (!provided) return { ...defaults }
  const out = { ...defaults }
  for (const k of Object.keys(provided) as (keyof T)[]) {
    if (provided[k] !== undefined) out[k] = provided[k] as T[keyof T]
  }
  return out
}

/** Shared text alignment knob. */
export type OSBAlign = 'left' | 'center'

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
  | { key: string; label: string; hint?: string; kind: 'text' | 'longtext' | 'theme' }
  | { key: string; label: string; hint?: string; kind: 'select'; options: { value: string; label: string }[] }

export const OSB_ALIGN_CLASSES: Record<OSBAlign, string> = {
  left: 'text-left',
  center: 'text-center',
}
