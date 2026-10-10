import { cn } from '../lib/utils'
import { OSB_ALIGN_CLASSES, resolveConfig, themed, type OSBAlign, type OSBField, type OSBTheme } from './types'

export type OSBButtonConfig = {
  label: string
  variant: 'primary' | 'secondary' | 'outline'
  size: 'sm' | 'md'
  align: OSBAlign
  theme: OSBTheme
  disabled: boolean
  fullWidth: boolean
}

export const OSB_BUTTON_DEFAULTS: OSBButtonConfig = {
  label: 'Button',
  variant: 'primary',
  size: 'md',
  align: 'left',
  theme: 'light',
  disabled: false,
  fullWidth: false,
}

export function resolveButtonConfig(provided?: Partial<OSBButtonConfig>): OSBButtonConfig {
  return resolveConfig(OSB_BUTTON_DEFAULTS, provided)
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
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
    ],
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

const SIZE_CLASSES: Record<OSBButtonConfig['size'], string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-5 text-sm',
}

export interface OSBButtonProps {
  config?: Partial<OSBButtonConfig>
  onClick?: () => void
}

export default function OSBButton({ config, onClick }: OSBButtonProps) {
  const c = resolveButtonConfig(config)
  return (
    <div className={cn('h-full w-full', OSB_ALIGN_CLASSES[c.align])}>
      <button
        type="button"
        disabled={c.disabled}
        onClick={onClick}
        className={cn(
          'inline-flex max-w-full items-center justify-center whitespace-normal break-words rounded-md font-medium transition-colors',
          'disabled:pointer-events-none disabled:opacity-50',
          themed(c.theme, VARIANT_CLASSES[c.variant]),
          SIZE_CLASSES[c.size],
          c.fullWidth && 'w-full',
        )}
      >
        {c.label.length === 0 ? 'Button' : c.label}
      </button>
    </div>
  )
}
