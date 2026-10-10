import { cn } from '../lib/utils'
import { OSB_ALIGN_CLASSES, resolveConfig, type OSBAlign, type OSBField, type OSBTheme } from './types'

export type OSBFooterConfig = {
  brand: string
  tagline: string
  link1Label: string
  link2Label: string
  link3Label: string
  copyright: string
  align: OSBAlign
  surface: 'plain' | 'outlined' | 'filled'
  theme: OSBTheme
}

export const OSB_FOOTER_DEFAULTS: OSBFooterConfig = {
  brand: 'Brand',
  tagline: 'A short line about the site.',
  link1Label: 'Home',
  link2Label: 'About',
  link3Label: 'Contact',
  copyright: '© Brand',
  align: 'left',
  surface: 'outlined',
  theme: 'light',
}

export const OSB_FOOTER_FIELDS: OSBField[] = [
  { key: 'brand', label: 'Site name', kind: 'text' },
  { key: 'tagline', label: 'Tagline', hint: 'Empty hides it.', kind: 'longtext' },
  { key: 'link1Label', label: 'First link', hint: 'Empty hides it.', kind: 'text' },
  { key: 'link2Label', label: 'Second link', hint: 'Empty hides it.', kind: 'text' },
  { key: 'link3Label', label: 'Third link', hint: 'Empty hides it.', kind: 'text' },
  { key: 'copyright', label: 'Small print', hint: 'Empty hides the line.', kind: 'text' },
  {
    key: 'align',
    label: 'Alignment',
    kind: 'select',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
    ],
  },
  {
    key: 'surface',
    label: 'Footer style',
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
const SURFACE_CLASSES: Record<OSBFooterConfig['surface'], Record<OSBTheme, string>> = {
  plain: { light: 'bg-transparent', dark: 'bg-transparent' },
  outlined: {
    light: 'border-t border-slate-200 bg-white',
    dark: 'border-t border-slate-800 bg-slate-900',
  },
  filled: { light: 'bg-slate-900', dark: 'bg-slate-800' },
}

const BRAND_TONE: Record<OSBFooterConfig['surface'], Record<OSBTheme, string>> = {
  plain: { light: 'text-slate-900', dark: 'text-slate-50' },
  outlined: { light: 'text-slate-900', dark: 'text-slate-50' },
  // A filled footer is dark in both themes, so its text stays light.
  filled: { light: 'text-slate-50', dark: 'text-slate-50' },
}

const LINK_TONE: Record<OSBFooterConfig['surface'], Record<OSBTheme, string>> = {
  plain: { light: 'text-slate-600 hover:text-slate-900', dark: 'text-slate-300 hover:text-slate-50' },
  outlined: { light: 'text-slate-600 hover:text-slate-900', dark: 'text-slate-300 hover:text-slate-50' },
  filled: { light: 'text-slate-300 hover:text-slate-50', dark: 'text-slate-300 hover:text-slate-50' },
}

const MUTED_TONE: Record<OSBFooterConfig['surface'], Record<OSBTheme, string>> = {
  plain: { light: 'text-slate-500', dark: 'text-slate-400' },
  outlined: { light: 'text-slate-500', dark: 'text-slate-400' },
  filled: { light: 'text-slate-400', dark: 'text-slate-400' },
}

const COPYRIGHT_DIVIDER: Record<OSBFooterConfig['surface'], Record<OSBTheme, string>> = {
  plain: { light: 'border-transparent', dark: 'border-transparent' },
  outlined: { light: 'border-slate-200', dark: 'border-slate-700' },
  filled: { light: 'border-slate-700', dark: 'border-slate-600' },
}

/** Visible link labels, in order; empty slots are omitted. */
function footerLinks(c: OSBFooterConfig): string[] {
  return [c.link1Label, c.link2Label, c.link3Label].filter((l) => l !== '')
}

export interface OSBFooterProps {
  config?: Partial<OSBFooterConfig>
}

export default function OSBFooter({ config }: OSBFooterProps) {
  const raw = resolveConfig(OSB_FOOTER_DEFAULTS, config)
  const links = footerLinks(raw)
  // A fully empty footer still renders a named shell, like Card and Hero.
  const c: OSBFooterConfig =
    raw.brand === '' && raw.tagline === '' && links.length === 0 && raw.copyright === ''
      ? { ...raw, brand: 'Brand' }
      : raw
  const centered = c.align === 'center'

  return (
    <footer
      data-testid="osb-footer"
      className={cn(
        'w-full px-6 py-8',
        SURFACE_CLASSES[c.surface][c.theme],
        OSB_ALIGN_CLASSES[c.align],
      )}
    >
      <div className={cn('flex flex-col gap-3', centered && 'items-center')}>
        {c.brand !== '' && (
          <p className={cn('break-words text-base font-semibold', BRAND_TONE[c.surface][c.theme])}>
            {c.brand}
          </p>
        )}
        {c.tagline !== '' && (
          <p className={cn('max-w-prose break-words text-sm leading-relaxed', MUTED_TONE[c.surface][c.theme])}>
            {c.tagline}
          </p>
        )}
        {links.length > 0 && (
          <ul className={cn('flex flex-wrap gap-x-5 gap-y-1', centered && 'justify-center')}>
            {links.map((label, i) => (
              <li key={i}>
                <a href="#" className={cn('break-words text-sm', LINK_TONE[c.surface][c.theme])}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        )}
        {c.copyright !== '' && (
          <p
            className={cn(
              'mt-1 w-full border-t pt-3 text-xs',
              COPYRIGHT_DIVIDER[c.surface][c.theme],
              MUTED_TONE[c.surface][c.theme],
            )}
          >
            {c.copyright}
          </p>
        )}
      </div>
    </footer>
  )
}
