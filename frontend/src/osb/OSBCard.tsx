// Card adapter: our config in, real shadcn Card out.
//
// shadcn/ui Card stays frozen (never edited here). This file only maps our
// four knobs (style, corners, depth, inner spacing) to complete static class
// strings layered on shadcn's Card + CardContent via className. Defaults
// reproduce shadcn's look; tailwind-merge lets our knobs win cleanly.
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Card, CardContent } from '../components/ui/card'
import { useOSBTheme } from './OSBTheme'
import { OSB_PAD_OPTIONS, resolveConfig, SURFACE_OPTIONS, type OSBField, type OSBPad, type OSBSurface, type OSBTheme } from './types'

export type OSBCardVariant = OSBSurface
export type OSBCardRadius = 'none' | 'soft' | 'rounded' | 'pill'
export type OSBCardShadow = 'none' | 'soft' | 'medium' | 'strong'

export type OSBCardConfig = {
  variant: OSBCardVariant
  radius: OSBCardRadius
  shadow: OSBCardShadow
  /** Children spacing — the shared padding vocabulary (osb/types). */
  padding: OSBPad
}

export const OSB_CARD_DEFAULTS: OSBCardConfig = {
  variant: 'elevated',
  radius: 'rounded',
  shadow: 'soft',
  padding: 'cozy',
}

// One option list per user-facing knob; the render reads the same lists.
// Surface emphasis is shared with popups (osb/types), so wording never drifts.
export const OSB_CARD_VARIANTS: { value: OSBCardVariant; label: string }[] = SURFACE_OPTIONS
export const OSB_CARD_RADII: { value: OSBCardRadius; label: string }[] = [
  { value: 'none', label: 'Square' },
  { value: 'soft', label: 'Soft' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Extra round' },
]
export const OSB_CARD_SHADOWS: { value: OSBCardShadow; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
]
export const OSB_CARD_FIELDS: OSBField[] = [
  { key: 'variant', label: 'Card style', kind: 'select', options: OSB_CARD_VARIANTS },
  { key: 'radius', label: 'Corners', kind: 'select', options: OSB_CARD_RADII },
  { key: 'shadow', label: 'Depth', kind: 'select', options: OSB_CARD_SHADOWS },
  { key: 'padding', label: 'Inner spacing', kind: 'select', options: OSB_PAD_OPTIONS },
]

/** Background + border emphasis. Theme comes from the provider. */
const CARD_SURFACE: Record<OSBCardVariant, Record<OSBTheme, string>> = {
  elevated: {
    light: 'bg-white text-slate-900 border-slate-200',
    dark: 'bg-slate-900 text-slate-50 border-slate-800',
  },
  outlined: {
    light: 'bg-white text-slate-900 border-slate-300',
    dark: 'bg-slate-900 text-slate-50 border-slate-700',
  },
  plain: {
    light: 'bg-transparent border-transparent shadow-none',
    dark: 'bg-transparent border-transparent shadow-none',
  },
}

const CARD_RADIUS: Record<OSBCardRadius, string> = {
  none: 'rounded-none',
  soft: 'rounded-lg',
  rounded: 'rounded-xl',
  pill: 'rounded-3xl',
}

const CARD_SHADOW: Record<OSBCardShadow, string> = {
  none: 'shadow-none',
  soft: 'shadow-sm',
  medium: 'shadow-md',
  strong: 'shadow-lg',
}

/** Inner padding + gap for flow children (shadcn's CardContent rhythm). */
const CARD_PADDING: Record<OSBPad, string> = {
  none: 'gap-0 px-0',
  compact: 'gap-3 px-3',
  cozy: 'gap-6 px-6',
  spacious: 'gap-8 px-8',
}

/** Canvas-only inset for the same knob (all sides). */
export const OSB_CARD_INSET: Record<OSBPad, string> = {
  none: '',
  compact: 'p-3',
  cozy: 'p-6',
  spacious: 'p-8',
}

/** The inset class the canvas wraps a card's child layer in. */
export function cardContentPad(config: unknown): string {
  const c = resolveConfig(OSB_CARD_DEFAULTS, config as Partial<OSBCardConfig> | undefined)
  // An unrecognized value reads as flush (base styling), never a broken class.
  return OSB_CARD_INSET[c.padding] ?? ''
}

export interface OSBCardProps {
  config?: Partial<OSBCardConfig>
  children?: ReactNode
}

// A card is an empty shell with chrome. The shell IS shadcn's Card; every
// visible thing inside is a real child node owned by the document, never a
// ghost prop. Flow children land in shadcn's CardContent, padded by the
// card's own spacing setting.
export default function OSBCard({ config, children }: OSBCardProps) {
  const c = resolveConfig(OSB_CARD_DEFAULTS, config)
  const theme = useOSBTheme()
  return (
    <Card
      data-slot="card"
      className={cn('h-full w-full overflow-hidden', CARD_SURFACE[c.variant][theme], CARD_RADIUS[c.radius], CARD_SHADOW[c.shadow])}
    >
      {children && (
        <CardContent data-testid="osb-card-children" data-slot="card-content" className={cn('flex flex-col', CARD_PADDING[c.padding])}>
          {children}
        </CardContent>
      )}
    </Card>
  )
}
