import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { resolveConfig, type OSBField, type OSBTheme } from './types'

export type OSBCardConfig = {
  variant: 'elevated' | 'outlined' | 'plain'
  theme: OSBTheme
}

export const OSB_CARD_DEFAULTS: OSBCardConfig = {
  variant: 'elevated',
  theme: 'light',
}

export const OSB_CARD_FIELDS: OSBField[] = [
  {
    key: 'variant',
    label: 'Card style',
    kind: 'select',
    options: [
      { value: 'elevated', label: 'Raised' },
      { value: 'outlined', label: 'Outline' },
      { value: 'plain', label: 'Plain' },
    ],
  },
  { key: 'theme', label: 'Appearance', kind: 'theme' },
]

const SHELL_CLASSES: Record<OSBCardConfig['variant'], Record<OSBTheme, string>> = {
  elevated: {
    light: 'bg-white shadow-lg ring-1 ring-slate-900/5',
    dark: 'bg-slate-900 shadow-lg ring-1 ring-white/10',
  },
  outlined: {
    light: 'bg-white ring-1 ring-slate-300',
    dark: 'bg-slate-900 ring-1 ring-slate-700',
  },
  plain: {
    light: 'bg-transparent',
    dark: 'bg-transparent',
  },
}

export interface OSBCardProps {
  config?: Partial<OSBCardConfig>
  children?: ReactNode
}

// A card is an empty canvas with chrome: background, radius, ring, shadow.
// It renders NO intrinsic content — every visible thing inside is a real
// child node owned by the document, never a ghost prop.
export default function OSBCard({ config, children }: OSBCardProps) {
  const c = resolveConfig(OSB_CARD_DEFAULTS, config)
  return (
    <article className={cn('h-full w-full overflow-hidden rounded-xl', SHELL_CLASSES[c.variant][c.theme])}>
      {children && (
        <div data-testid="osb-card-children" className="flex h-full w-full flex-col gap-2 p-4">
          {children}
        </div>
      )}
    </article>
  )
}
