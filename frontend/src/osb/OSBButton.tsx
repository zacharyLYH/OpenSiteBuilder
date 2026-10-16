// Button adapter: our config in, real shadcn Button out.
//
// shadcn/ui Button stays frozen (never edited here). This file only maps:
// our variant/size names -> shadcn props, plus the extras shadcn does not
// know (link wrap, alignment box, dark theme, lg size, danger/ghost/link
// looks as complete class strings). If shadcn cannot do it, we do not ship it.
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { useOSBTheme } from './OSBTheme'
import { ALIGN_OPTIONS, resolveConfig, type OSBAlign, type OSBField } from './types'

export type OSBButtonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
export type OSBButtonSize = 'sm' | 'default' | 'lg'

export type OSBButtonConfig = {
  label: string
  variant: OSBButtonVariant
  size: OSBButtonSize
  align: OSBAlign
  /** Fill the full width of the container. Off = hug the label (align applies). */
  fill: boolean
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
  fill: false,
  href: '',
  openInNewTab: false,
  targetId: '',
}

export const OSB_BUTTON_VARIANTS: { value: OSBButtonVariant; label: string }[] = [
  { value: 'default', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'destructive', label: 'Danger' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'link', label: 'Link' },
]

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
  { key: 'fill', label: 'Fill container width', kind: 'boolean' },
  { key: 'align', label: 'Alignment', kind: 'select', options: ALIGN_OPTIONS },
]

// shadcn variants we use directly; the rest ride as complete class strings
// on className (never interpolated, so Tailwind JIT keeps them).
const SHADCN_VARIANT = { default: 'default', secondary: 'secondary', outline: 'outline' } as const
const EXTRA_VARIANT_CLASSES: Partial<Record<OSBButtonVariant, string>> = {
  destructive: 'bg-red-600 text-slate-50 hover:bg-red-600/90',
  ghost: 'bg-transparent text-slate-900 hover:bg-slate-100 shadow-none',
  link: 'bg-transparent text-slate-900 underline-offset-4 hover:underline shadow-none',
}
const EXTRA_SIZE_CLASSES: Partial<Record<OSBButtonSize, string>> = {
  lg: 'h-11 px-6 text-base',
}
const DARK_VARIANT_CLASSES: Record<OSBButtonVariant, string> = {
  default: 'bg-slate-50 text-slate-900 hover:bg-slate-200',
  secondary: 'bg-slate-800 text-slate-50 hover:bg-slate-700',
  destructive: 'bg-red-600 text-slate-50 hover:bg-red-500',
  outline: 'border-slate-600 bg-transparent text-slate-50 hover:bg-slate-800',
  ghost: 'bg-transparent text-slate-50 hover:bg-slate-800 shadow-none',
  link: 'bg-transparent text-slate-50 shadow-none',
}
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
 * Allow http(s), mailto, tel, anchor, root-relative and relative URLs.
 * Block javascript:/data:/vbscript: so pasted text can't become script.
 */
export function sanitizeHref(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const href = raw.trim()
  if (href.length === 0) return ''
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(href)) return href
  if (/^[^:\s]+\.[^:\s]+(\/\S*)?$/.test(href) && !/^[a-z][a-z0-9+.-]*:/i.test(href)) return `https://${href}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return ''
  return href
}

export default function OSBButton({ config, onClick }: OSBButtonProps) {
  const c = resolveConfig(OSB_BUTTON_DEFAULTS, config)
  const theme = useOSBTheme()
  const href = sanitizeHref(c.href)
  const label = c.label.length === 0 ? 'Button' : c.label
  const variant = SHADCN_VARIANT[c.variant as keyof typeof SHADCN_VARIANT] ?? 'default'
  const size = c.size === 'sm' ? 'sm' : 'default'
  // Hug or fill: the one width decision buttons offer. Fill stretches edge to
  // edge; hug wraps the label and honors alignment.
  const cls = cn(
    'whitespace-normal break-words',
    c.fill ? 'h-full w-full' : 'h-auto w-auto',
    EXTRA_VARIANT_CLASSES[c.variant],
    EXTRA_SIZE_CLASSES[c.size],
    theme === 'dark' && DARK_VARIANT_CLASSES[c.variant],
  )
  const box = cn('flex w-full', c.fill ? 'h-full' : 'h-auto', ALIGN_JUSTIFY[c.align])
  // Links ride inside shadcn via asChild: one element, real anchor (SEO,
  // right-click, keyboard), button look. No nested interactives, ever.
  if (href.length > 0) {
    return (
      <div className={box}>
        <Button asChild variant={variant} size={size} className={cls}>
          <a href={href} target={c.openInNewTab ? '_blank' : undefined} rel={c.openInNewTab ? 'noopener noreferrer' : undefined} onClick={onClick}>
            {label}
          </a>
        </Button>
      </div>
    )
  }
  return (
    <div className={box}>
      <Button onClick={onClick} variant={variant} size={size} className={cls}>
        {label}
      </Button>
    </div>
  )
}
