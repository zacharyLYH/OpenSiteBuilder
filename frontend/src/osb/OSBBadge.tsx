import { cva } from 'class-variance-authority'
import { cn } from '../lib/utils'
import { useOSBTheme } from './OSBTheme'
import { OSB_V_ALIGN_CLASSES, resolveConfig, V_ALIGN_OPTIONS, type OSBField, type OSBTheme, type OSBVAlign } from './types'

/**
 * Transplanted from shadcn/ui `badge.tsx` (MIT). The `cva` mechanism, the
 * pill base (inline-flex, rounded-full, px-2.5 py-0.5, text-xs, font-medium,
 * a real 1px border) and the variant names are shadcn's. Deliberate
 * adaptations for OpenSiteBuilder, each marked ADAPT below.
 *
 * ADAPT-1 (tokens): shadcn's `bg-primary` / `text-primary-foreground` /
 *   `border` come from ambient CSS vars OSB does not ship. They map to the
 *   slate scale through the GLOBAL theme (useOSBTheme) — one complete class
 *   string per variant per theme, never an interpolated class (PRD §6.6).
 * ADAPT-2 (anchor): every other OSB atom fills its grid box, but a badge is a
 *   pill — stretching it to a cell's height would read as a button. The badge
 *   keeps its natural height and is ANCHORED in the box instead (top/middle/
 *   bottom), which is what makes a 1-square badge usable (see
 *   specs/nesting-rules.md §2).
 */

export type OSBBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export type OSBBadgeConfig = {
  /** Pill copy. */
  text: string
  /** shadcn's badge emphasis axis. */
  variant: OSBBadgeVariant
  /** Where the pill sits in its box (ADAPT-2). */
  align: OSBVAlign
}

export const OSB_BADGE_DEFAULTS: OSBBadgeConfig = {
  text: 'Badge',
  variant: 'default',
  align: 'middle',
}

// The one option list behind the "Style" drawer field and the render; values
// are shadcn's vocabulary, labels are the plain-language names users see.
export const OSB_BADGE_VARIANTS: { value: OSBBadgeVariant; label: string }[] = [
  { value: 'default', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'destructive', label: 'Danger' },
  { value: 'outline', label: 'Outline' },
]

export const OSB_BADGE_FIELDS: OSBField[] = [
  { key: 'text', label: 'Badge text', kind: 'text', required: true },
  { key: 'variant', label: 'Style', kind: 'select', options: OSB_BADGE_VARIANTS },
  {
    key: 'align',
    label: 'Position',
    hint: 'A badge keeps its own height — this is where it sits in its box.',
    kind: 'select',
    options: V_ALIGN_OPTIONS,
  },
]

// shadcn's pill, minus the ambient tokens. `w-fit` (not `w-full`): the pill is
// the component, so it must never stretch to the box's width either.
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
)

/** shadcn's badge emphasis, in OSB's explicit slate palette (ADAPT-1). */
const BADGE_VARIANT_CLASSES: Record<OSBBadgeVariant, Record<OSBTheme, string>> = {
  default: {
    light: 'border-transparent bg-slate-900 text-slate-50',
    dark: 'border-transparent bg-slate-50 text-slate-900',
  },
  secondary: {
    light: 'border-transparent bg-slate-100 text-slate-900',
    dark: 'border-transparent bg-slate-800 text-slate-50',
  },
  destructive: {
    light: 'border-transparent bg-red-600 text-slate-50',
    dark: 'border-transparent bg-red-600 text-slate-50',
  },
  outline: {
    light: 'border-slate-200 text-slate-900',
    dark: 'border-slate-700 text-slate-50',
  },
}

export interface OSBBadgeProps {
  config?: Partial<OSBBadgeConfig>
  children?: React.ReactNode
}

export default function OSBBadge({ config }: OSBBadgeProps) {
  const c = resolveConfig(OSB_BADGE_DEFAULTS, config)
  const theme = useOSBTheme()
  return (
    // ADAPT-2: the box is the drop target, the pill is the component.
    <div className={cn('flex h-full w-full overflow-hidden', OSB_V_ALIGN_CLASSES[c.align])}>
      <span className={cn(badgeVariants(), BADGE_VARIANT_CLASSES[c.variant][theme])}>
        {c.text === '' ? 'Badge' : c.text}
      </span>
    </div>
  )
}
