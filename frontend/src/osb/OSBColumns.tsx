// Columns adapter: side-by-side cards, one config knob (split).
//
// Pure CSS flex. Desktop = row with fraction widths. Phone (<768px) =
// vertical stack, split ignored. Kids just fill their slot — parent decides.
//
// The runtime twin: OSBNodeView passes bare cards, one slot each. (The canvas
// owns its own row in NodeView with gaps — it never calls this.)
import type { ReactNode } from 'react'
import { Children } from 'react'
import { cn } from '../lib/utils'
import { resolveConfig, type OSBField } from './types'

export type OSBColumnsSplit = '50-50' | '70-30' | '30-70' | 'triple' | 'quad'

export type OSBColumnsConfig = {
  split: OSBColumnsSplit
}

export const OSB_COLUMNS_DEFAULTS: OSBColumnsConfig = {
  split: '50-50',
}

export const OSB_COLUMNS_SPLITS: { value: OSBColumnsSplit; label: string }[] = [
  { value: '50-50', label: '50 / 50' },
  { value: '70-30', label: '70 / 30' },
  { value: '30-70', label: '30 / 70' },
  { value: 'triple', label: 'Triple' },
  { value: 'quad', label: 'Quad' },
]

export const OSB_COLUMNS_FIELDS: OSBField[] = [
  { key: 'split', label: 'Split', kind: 'select', options: OSB_COLUMNS_SPLITS },
]

// Fraction widths per slot. Triple = equal thirds, quad = equal quarters.
// Static strings only.
const SPLIT_FR: Record<OSBColumnsSplit, string[]> = {
  '50-50': ['1fr', '1fr'],
  '70-30': ['2fr', '1fr'],
  '30-70': ['1fr', '2fr'],
  triple: ['1fr', '1fr', '1fr'],
  quad: ['1fr', '1fr', '1fr', '1fr'],
}

// Card count each split wants. Picking a split fills empties up to this —
// never deletes. Extra cards keep rendering (widths cycle 1:1).
export const SPLIT_COUNT: Record<OSBColumnsSplit, number> = {
  '50-50': 2,
  '70-30': 2,
  '30-70': 2,
  triple: 3,
  quad: 4,
}

// Numeric grow per slot: React flexGrow takes numbers, not '2fr'.
const SPLIT_GROW: Record<OSBColumnsSplit, number[]> = {
  '50-50': [1, 1],
  '70-30': [2, 1],
  '30-70': [1, 2],
  triple: [1, 1, 1],
  quad: [1, 1, 1, 1],
}

export function columnsFractions(config: unknown): string[] {
  const c = resolveConfig(OSB_COLUMNS_DEFAULTS, config as Partial<OSBColumnsConfig> | undefined)
  return SPLIT_FR[c.split] ?? SPLIT_FR['50-50']
}

export function columnsGrow(config: unknown): number[] {
  const c = resolveConfig(OSB_COLUMNS_DEFAULTS, config as Partial<OSBColumnsConfig> | undefined)
  return SPLIT_GROW[c.split] ?? SPLIT_GROW['50-50']
}

export interface OSBColumnsProps {
  config?: Partial<OSBColumnsConfig>
  children?: ReactNode
}

export default function OSBColumns({ config, children }: OSBColumnsProps) {
  const grow = columnsGrow(config)
  const kids = Children.toArray(children).filter((c) => typeof c !== 'string' || c.trim() !== '')
  return (
    <div data-testid="osb-columns" className="flex flex-col gap-4 md:flex-row">
      {kids.length === 0 ? (
        <p className="text-xs text-slate-400">Add cards side by side</p>
      ) : (
        kids.map((k, i) => (
          <div key={i} data-testid="osb-column-slot" className={cn('min-w-0 flex-1')} style={{ flexGrow: grow[i] ?? 1, flexBasis: 0 }}>
            {k}
          </div>
        ))
      )}
    </div>
  )
}
