import { cn } from '../lib/utils'
import { ALIGN_OPTIONS, resolveConfig, type OSBAlign, type OSBField, type OSBTheme } from './types'

export type OSBButtonConfig = {
  label: string
  variant: 'primary' | 'secondary' | 'outline'
  size: 'sm' | 'md'
  align: OSBAlign
  theme: OSBTheme
  /** Destination URL. Empty = plain button (future: modal trigger). */
  href: string
  /** Open the destination in a new tab. Ignored when href is empty. */
  openInNewTab: boolean
}

export const OSB_BUTTON_DEFAULTS: OSBButtonConfig = {
  label: 'Button',
  variant: 'primary',
  size: 'md',
  align: 'left',
  theme: 'light',
  href: '',
  openInNewTab: false,
}

export const OSB_BUTTON_FIELDS: OSBField[] = [
  { key: 'label', label: 'Button text', kind: 'text', required: true },
  { key: 'href', label: 'Link', hint: 'Where this button goes. Leave empty for no link.', kind: 'text' },
  { key: 'openInNewTab', label: 'Open in a new tab', kind: 'boolean', visibleWhen: { key: 'href' } },
  {
    key: 'variant',
    label: 'Style',
    kind: 'select',
    options: [
      { value: 'primary', label: 'Primary' },
      { value: 'secondary', label: 'Secondary' },
      { value: 'outline', label: 'Outline' },
    ],
  },
  {
    key: 'size',
    label: 'Size',
    kind: 'select',
    options: [
      { value: 'sm', label: 'Small' },
      { value: 'md', label: 'Medium' },
    ],
  },
  {
    key: 'align',
    label: 'Alignment',
    kind: 'select',
    options: ALIGN_OPTIONS,
  },
  { key: 'theme', label: 'Appearance', kind: 'theme' },
]

// Complete static classes only — never interpolate (PRD §6.6).
const VARIANT_CLASSES: Record<OSBButtonConfig['variant'], Record<OSBTheme, string>> = {
  primary: {
    light: 'bg-slate-900 text-slate-50 hover:bg-slate-700',
    dark: 'bg-slate-50 text-slate-900 hover:bg-slate-200',
  },
  secondary: {
    light: 'bg-slate-200 text-slate-900 hover:bg-slate-300',
    dark: 'bg-slate-800 text-slate-50 hover:bg-slate-700',
  },
  outline: {
    light: 'border border-slate-300 bg-transparent text-slate-900 hover:bg-slate-100',
    dark: 'border border-slate-600 bg-transparent text-slate-50 hover:bg-slate-800',
  },
}

// Font scale only: the button fills its grid box (box is the component),
// so height comes from the footprint, never from a fixed px class.
const SIZE_CLASSES: Record<OSBButtonConfig['size'], string> = {
  sm: 'px-3 text-xs',
  md: 'px-5 text-sm',
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
  // Bare domains ("example.com") and relative paths ("about") get https.
  if (/^[^:\s]+\.[^:\s]+(\/\S*)?$/.test(href) && !/^[a-z][a-z0-9+.-]*:/i.test(href)) return `https://${href}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return ''
  return href
}

export default function OSBButton({ config, onClick }: OSBButtonProps) {
  const c = resolveConfig(OSB_BUTTON_DEFAULTS, config)
  const href = sanitizeHref(c.href)
  const label = c.label.length === 0 ? 'Button' : c.label
  const cls = cn(
    'inline-flex h-full w-full max-w-full items-center justify-center whitespace-normal break-words rounded-md font-medium transition-colors',
    VARIANT_CLASSES[c.variant][c.theme],
    SIZE_CLASSES[c.size],
  )
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
