import { cn } from '../lib/utils'
import { ALIGN_OPTIONS, resolveConfig, type OSBAlign, type OSBField, type OSBTheme } from './types'

export type OSBButtonConfig = {
  label: string
  variant: 'primary' | 'secondary' | 'outline'
  size: 'sm' | 'md'
  align: OSBAlign
  theme: OSBTheme
}

export const OSB_BUTTON_DEFAULTS: OSBButtonConfig = {
  label: 'Button',
  variant: 'primary',
  size: 'md',
  align: 'left',
  theme: 'light',
}

export const OSB_BUTTON_FIELDS: OSBField[] = [
  { key: 'label', label: 'Button text', kind: 'text' },
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

export default function OSBButton({ config, onClick }: OSBButtonProps) {
  const c = resolveConfig(OSB_BUTTON_DEFAULTS, config)
  return (
    <div className={cn('flex h-full w-full', ALIGN_JUSTIFY[c.align])}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex h-full w-full max-w-full items-center justify-center whitespace-normal break-words rounded-md font-medium transition-colors',
          VARIANT_CLASSES[c.variant][c.theme],
          SIZE_CLASSES[c.size],
        )}
      >
        {c.label.length === 0 ? 'Button' : c.label}
      </button>
    </div>
  )
}
