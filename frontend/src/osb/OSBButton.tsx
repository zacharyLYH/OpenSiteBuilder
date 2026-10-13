import { cva } from 'class-variance-authority'
import { cn } from '../lib/utils'
import { useOSBTheme } from './OSBTheme'
import { ALIGN_OPTIONS, resolveConfig, type OSBAlign, type OSBField } from './types'

export type OSBButtonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
export type OSBButtonSize = 'sm' | 'default' | 'lg'

export type OSBButtonConfig = {
  label: string
  variant: OSBButtonVariant
  size: OSBButtonSize
  align: OSBAlign
  /** Destination URL. Empty = plain button (unless an overlay is attached). */
  href: string
  /** Open the destination in a new tab. Ignored when href is empty. */
  openInNewTab: boolean
  /** Attached overlay id (any kind). Empty = none. Wins over the link. */
  targetId: string
}

export const OSB_BUTTON_DEFAULTS: OSBButtonConfig = {
  label: 'Button',
  variant: 'default',
  size: 'default',
  align: 'left',
  href: '',
  openInNewTab: false,
  targetId: '',
}

// The one option list behind the "Style" drawer field and the render. Values
// are shadcn's vocabulary; labels are the plain-language names users see.
export const OSB_BUTTON_VARIANTS: { value: OSBButtonVariant; label: string }[] = [
  { value: 'default', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'destructive', label: 'Danger' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'link', label: 'Link' },
]

// The one option list behind the "Size" drawer field and the render.
export const OSB_BUTTON_SIZES: { value: OSBButtonSize; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'default', label: 'Medium' },
  { value: 'lg', label: 'Large' },
]

export const OSB_BUTTON_FIELDS: OSBField[] = [
  { key: 'label', label: 'Button text', kind: 'text', required: true },
  { key: 'href', label: 'Link', hint: 'Where this button goes. Leave empty for no link.', kind: 'text' },
  { key: 'openInNewTab', label: 'Open in a new tab', kind: 'boolean', visibleWhen: { key: 'href' } },
  { key: 'variant', label: 'Style', kind: 'select', options: OSB_BUTTON_VARIANTS },
  { key: 'size', label: 'Size', kind: 'select', options: OSB_BUTTON_SIZES },
  { key: 'align', label: 'Alignment', kind: 'select', options: ALIGN_OPTIONS },
]

// shadcn/ui buttonVariants (MIT), copied to complete static classes. Size
// changes only the font scale and horizontal padding: the button fills its
// grid box (box is the component), so height comes from the footprint.
// Never interpolate — cva selects whole class strings (PRD §6.6).
const buttonVariants = cva(
  'inline-flex h-full w-full max-w-full items-center justify-center whitespace-normal break-words rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-slate-50 hover:bg-slate-900/90',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-100/80',
        destructive: 'bg-red-600 text-slate-50 hover:bg-red-600/90',
        outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100',
        ghost: 'text-slate-900 hover:bg-slate-100',
        link: 'text-slate-900 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'px-3 text-xs',
        default: 'px-4 text-sm',
        lg: 'px-6 text-base',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

// Dark is a GLOBAL theme shadcn has no static token for here: overlay one
// complete class string per variant and let tailwind-merge resolve conflicts
// — the same way shadcn consumers customize through className.
const DARK_VARIANT_CLASSES: Record<OSBButtonVariant, string> = {
  default: 'bg-slate-50 text-slate-900 hover:bg-slate-200',
  secondary: 'bg-slate-800 text-slate-50 hover:bg-slate-700',
  destructive: 'bg-red-600 text-slate-50 hover:bg-red-500',
  outline: 'border-slate-600 bg-transparent text-slate-50 hover:bg-slate-800',
  ghost: 'text-slate-50 hover:bg-slate-800',
  link: 'text-slate-50',
}

// Docs saved before the shadcn vocabulary used the old names; normalize on
// read so nothing stored ever renders an unstyled button.
const VARIANT_ALIASES: Record<string, OSBButtonVariant> = { primary: 'default' }
const SIZE_ALIASES: Record<string, OSBButtonSize> = { md: 'default' }

const normalizeVariant = (v: unknown): OSBButtonVariant =>
  typeof v === 'string' ? (VARIANT_ALIASES[v] ?? (v as OSBButtonVariant)) : 'default'

const normalizeSize = (v: unknown): OSBButtonSize =>
  typeof v === 'string' ? (SIZE_ALIASES[v] ?? (v as OSBButtonSize)) : 'default'

const ALIGN_JUSTIFY: Record<OSBAlign, string> = {
  left: 'justify-start',
  center: 'justify-center',
}

export interface OSBButtonProps {
  config?: Partial<OSBButtonConfig>
  onClick?: () => void
  children?: React.ReactNode
}

/**
 * THE trigger rule: a button opens at most one overlay by id, from a click —
 * never from a link. An attached overlay wins over `href`. Overlay children
 * never carry one (validated at edit time). Legacy modalId/drawerId read the
 * same way so old docs keep working.
 */
export function buttonOverlayTarget(
  config: Record<string, unknown> | undefined,
  overlayIds: Set<string>,
): string | null {
  const cfg = config as { targetId?: unknown; modalId?: unknown; drawerId?: unknown } | undefined
  for (const key of ['targetId', 'modalId', 'drawerId'] as const) {
    const v = cfg?.[key]
    if (typeof v === 'string' && v.length > 0 && overlayIds.has(v)) return v
  }
  return null
}

/**
 * Allow http(s), mailto, tel, anchor, root-relative and relative URLs.
 * Block javascript:/data:/vbscript: so pasted text can't become script.
 */
export function sanitizeHref(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const href = raw.trim()
  if (href.length === 0) return ''
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(href)) return href
  // Bare domains ("example.com") and relative paths ("about") get https.
  if (/^[^:\s]+\.[^:\s]+(\/\S*)?$/.test(href) && !/^[a-z][a-z0-9+.-]*:/i.test(href)) return `https://${href}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return ''
  return href
}

export default function OSBButton({ config, onClick }: OSBButtonProps) {
  const c = resolveConfig(OSB_BUTTON_DEFAULTS, config)
  const variant = normalizeVariant(c.variant)
  const size = normalizeSize(c.size)
  const theme = useOSBTheme()
  const href = sanitizeHref(c.href)
  const label = c.label.length === 0 ? 'Button' : c.label
  const cls = cn(buttonVariants({ variant, size }), theme === 'dark' && DARK_VARIANT_CLASSES[variant])
  // Linked buttons are real anchors (keyboard + right-click + SEO work);
  // unlinked ones stay <button> so Enter/Space still activate them.
  const inner =
    href.length > 0 ? (
      <a
        href={href}
        target={c.openInNewTab ? '_blank' : undefined}
        rel={c.openInNewTab ? 'noopener noreferrer' : undefined}
        onClick={onClick}
        className={cls}
      >
        {label}
      </a>
    ) : (
      <button type="button" onClick={onClick} className={cls}>
        {label}
      </button>
    )
  return <div className={cn('flex h-full w-full', ALIGN_JUSTIFY[c.align])}>{inner}</div>
}
