import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { useOSBTheme } from './OSBTheme'
import { resolveConfig, type OSBField, type OSBTheme } from './types'

/**
 * Transplanted from shadcn/ui `card.tsx` (MIT). The decomposition
 * (Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent,
 * CardFooter), the `data-slot` markers, layout classes (flex-col gap-6 py-6,
 * px-6 slots, auto-rows-min header grid) and the border/shadow surface are
 * shadcn's verbatim. Deliberate adaptations for OpenSiteBuilder, each marked
 * ADAPT below — this is the ONE card copy the canvas renders and codegen
 * publishes (see OSB README: single source of truth).
 *
 * ADAPT-1 (tokens): shadcn's `bg-card` / `text-card-foreground` / `border`
 *   come from ambient CSS vars OSB does not ship. They map to the slate scale
 *   through the GLOBAL theme (useOSBTheme) — never an ambient `.dark` ancestor.
 * ADAPT-2 (settings): shadcn ships one surface; OSB exposes the axes users
 *   actually reach for — emphasis variant, corner radius, elevation, and inner
 *   padding — each a complete static class map. Defaults reproduce shadcn.
 * ADAPT-3 (container query): shadcn's `@container/card-header` needs the
 *   container-queries plugin, which the published template does not load, so
 *   the header grid is kept but the container-query variant is dropped.
 */

export type OSBCardVariant = 'elevated' | 'outlined' | 'plain'
export type OSBCardRadius = 'none' | 'soft' | 'rounded' | 'pill'
export type OSBCardShadow = 'none' | 'soft' | 'medium' | 'strong'
export type OSBCardPadding = 'compact' | 'cozy' | 'spacious'

export type OSBCardConfig = {
  variant: OSBCardVariant
  radius: OSBCardRadius
  shadow: OSBCardShadow
  padding: OSBCardPadding
}

export const OSB_CARD_DEFAULTS: OSBCardConfig = {
  variant: 'elevated',
  radius: 'rounded',
  shadow: 'soft',
  padding: 'cozy',
}

// One option list per user-facing knob; the render reads the same lists.
export const OSB_CARD_VARIANTS: { value: OSBCardVariant; label: string }[] = [
  { value: 'elevated', label: 'Raised' },
  { value: 'outlined', label: 'Outline' },
  { value: 'plain', label: 'Plain' },
]
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
export const OSB_CARD_PADDINGS: { value: OSBCardPadding; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'cozy', label: 'Cozy' },
  { value: 'spacious', label: 'Spacious' },
]

export const OSB_CARD_FIELDS: OSBField[] = [
  { key: 'variant', label: 'Card style', kind: 'select', options: OSB_CARD_VARIANTS },
  { key: 'radius', label: 'Corners', kind: 'select', options: OSB_CARD_RADII },
  { key: 'shadow', label: 'Depth', kind: 'select', options: OSB_CARD_SHADOWS },
  { key: 'padding', label: 'Inner spacing', kind: 'select', options: OSB_CARD_PADDINGS },
]

/** Background + border emphasis (ADAPT-1/2). Theme comes from the provider. */
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
    light: 'bg-transparent border-transparent',
    dark: 'bg-transparent border-transparent',
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
const CARD_PADDING: Record<OSBCardPadding, string> = {
  compact: 'gap-3 px-3',
  cozy: 'gap-6 px-6',
  spacious: 'gap-8 px-8',
}

/** OSB-only axes layered onto the shadcn slots (ADAPT-2). */
export interface OSBCardSlots {
  variant?: OSBCardVariant
  radius?: OSBCardRadius
  shadow?: OSBCardShadow
}

function Card({
  variant = 'elevated',
  radius = 'rounded',
  shadow = 'soft',
  className,
  ...props
}: React.ComponentProps<'div'> & OSBCardSlots) {
  const theme = useOSBTheme()
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        'flex flex-col gap-6 border py-6',
        CARD_SURFACE[variant][theme],
        CARD_RADIUS[radius],
        CARD_SHADOW[shadow],
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('leading-none font-semibold', className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-sm text-slate-500', className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-action" className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)} {...props} />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center px-6 [.border-t]:pt-6', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter }

export interface OSBCardProps {
  config?: Partial<OSBCardConfig>
  children?: ReactNode
}

// A card is an empty canvas with chrome. The shell IS shadcn's Card (ADAPT-2
// for the settings; theme is global); every visible thing inside is a real
// child node owned by the document, never a ghost prop. Flow children (mount +
// published codegen) land in shadcn's CardContent slot, padded by the card's
// own spacing setting; on the canvas the container overlays its
// absolutely-positioned children on top of the shell.
export default function OSBCard({ config, children }: OSBCardProps) {
  const c = resolveConfig(OSB_CARD_DEFAULTS, config)
  return (
    <Card
      variant={c.variant}
      radius={c.radius}
      shadow={c.shadow}
      data-padding={c.padding}
      className="h-full w-full overflow-hidden"
    >
      {children && (
        <CardContent data-testid="osb-card-children" className={cn('flex flex-col', CARD_PADDING[c.padding])}>
          {children}
        </CardContent>
      )}
    </Card>
  )
}
