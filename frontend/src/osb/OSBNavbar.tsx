import { cn } from '../lib/utils'
import { resolveConfig, type OSBField, type OSBTheme } from './types'
import OSBButton from './OSBButton'

export type OSBNavbarConfig = {
  brand: string
  link1Label: string
  link2Label: string
  link3Label: string
  ctaLabel: string
  layout: 'spread' | 'centered'
  surface: 'plain' | 'outlined' | 'filled'
  theme: OSBTheme
}

export const OSB_NAVBAR_DEFAULTS: OSBNavbarConfig = {
  brand: 'Brand',
  link1Label: 'Home',
  link2Label: 'Features',
  link3Label: 'Pricing',
  ctaLabel: 'Sign up',
  layout: 'spread',
  surface: 'outlined',
  theme: 'light',
}

export const OSB_NAVBAR_FIELDS: OSBField[] = [
  { key: 'brand', label: 'Site name', kind: 'text' },
  { key: 'link1Label', label: 'First link', hint: 'Empty hides it.', kind: 'text' },
  { key: 'link2Label', label: 'Second link', hint: 'Empty hides it.', kind: 'text' },
  { key: 'link3Label', label: 'Third link', hint: 'Empty hides it.', kind: 'text' },
  { key: 'ctaLabel', label: 'Button text', hint: 'Empty hides the button.', kind: 'text' },
  {
    key: 'layout',
    label: 'Layout',
    kind: 'select',
    options: [
      { value: 'spread', label: 'Name left, links right' },
      { value: 'centered', label: 'Everything centered' },
    ],
  },
  {
    key: 'surface',
    label: 'Bar style',
    kind: 'select',
    options: [
      { value: 'plain', label: 'Plain' },
      { value: 'outlined', label: 'Outline' },
      { value: 'filled', label: 'Filled' },
    ],
  },
  { key: 'theme', label: 'Appearance', kind: 'theme' },
]

// Complete static classes only — never interpolate (PRD §6.6).
const SURFACE_CLASSES: Record<OSBNavbarConfig['surface'], Record<OSBTheme, string>> = {
  plain: { light: 'bg-transparent', dark: 'bg-transparent' },
  outlined: {
    light: 'border-b border-slate-200 bg-white',
    dark: 'border-b border-slate-800 bg-slate-900',
  },
  filled: { light: 'bg-slate-900', dark: 'bg-slate-800' },
}

const BRAND_TONE: Record<OSBNavbarConfig['surface'], Record<OSBTheme, string>> = {
  plain: { light: 'text-slate-900', dark: 'text-slate-50' },
  outlined: { light: 'text-slate-900', dark: 'text-slate-50' },
  // A filled bar is dark in both themes, so its text stays light.
  filled: { light: 'text-slate-50', dark: 'text-slate-50' },
}

const LINK_TONE: Record<OSBNavbarConfig['surface'], Record<OSBTheme, string>> = {
  plain: { light: 'text-slate-600 hover:text-slate-900', dark: 'text-slate-300 hover:text-slate-50' },
  outlined: { light: 'text-slate-600 hover:text-slate-900', dark: 'text-slate-300 hover:text-slate-50' },
  filled: { light: 'text-slate-300 hover:text-slate-50', dark: 'text-slate-300 hover:text-slate-50' },
}

/** Visible link labels, in order; empty slots are omitted. */
function navLinks(c: OSBNavbarConfig): string[] {
  return [c.link1Label, c.link2Label, c.link3Label].filter((l) => l !== '')
}

export interface OSBNavbarProps {
  config?: Partial<OSBNavbarConfig>
}

export default function OSBNavbar({ config }: OSBNavbarProps) {
  const raw = resolveConfig(OSB_NAVBAR_DEFAULTS, config)
  const links = navLinks(raw)
  // A fully empty bar still renders a named shell, like Card and Hero.
  const c: OSBNavbarConfig =
    raw.brand === '' && links.length === 0 && raw.ctaLabel === '' ? { ...raw, brand: 'Brand' } : raw
  const centered = c.layout === 'centered'

  return (
    <header data-testid="osb-navbar" className={cn('w-full', SURFACE_CLASSES[c.surface][c.theme])}>
      <nav
        aria-label="Site"
        className={cn(
          'flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3',
          centered ? 'justify-center' : 'justify-between',
        )}
      >
        <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-2', centered && 'justify-center')}>
          {c.brand !== '' && (
            <span className={cn('break-words text-base font-semibold', BRAND_TONE[c.surface][c.theme])}>
              {c.brand}
            </span>
          )}
          {links.length > 0 && (
            <ul className={cn('flex flex-wrap items-center gap-x-5 gap-y-1', centered && 'justify-center')}>
              {links.map((label, i) => (
                <li key={i}>
                  <a href="#" className={cn('break-words text-sm', LINK_TONE[c.surface][c.theme])}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {c.ctaLabel !== '' && (
          <OSBButton
            config={{
              label: c.ctaLabel,
              variant: 'primary',
              size: 'sm',
              // The filled bar is dark, so flip the button to stay legible on it.
              theme: c.surface === 'filled' ? 'dark' : c.theme,
            }}
          />
        )}
      </nav>
    </header>
  )
}
