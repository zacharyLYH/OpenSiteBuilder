import { cn } from '../lib/utils'
import { useOSBTheme } from './OSBTheme'
import { ALIGN_OPTIONS, OSB_ALIGN_CLASSES, resolveConfig, type OSBAlign, type OSBField, type OSBTheme } from './types'

export type OSBTextHeading = 'none' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
export type OSBTextFont = 'sans' | 'serif' | 'mono'
export type OSBTextTone = 'default' | 'muted' | 'primary' | 'gradient'

export type OSBTextConfig = {
  text: string
  /** Semantic tag + type scale. `none` renders a paragraph. */
  heading: OSBTextHeading
  /** Force bold on top of the heading's own weight. Off = inherit. */
  bold: boolean
  italic: boolean
  font: OSBTextFont
  tone: OSBTextTone
  align: OSBAlign
}

export const OSB_TEXT_DEFAULTS: OSBTextConfig = {
  text: 'Text',
  heading: 'none',
  bold: false,
  italic: false,
  font: 'sans',
  tone: 'default',
  align: 'left',
}

/** The one option list behind the "Heading" drawer field and the render. */
export const OSB_TEXT_HEADINGS: { value: OSBTextHeading; label: string }[] = [
  { value: 'none', label: 'Normal text' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Heading 6' },
]

/** The one option list behind the "Font" drawer field and the render. */
export const OSB_TEXT_FONTS: { value: OSBTextFont; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
]

/** The one option list behind the "Colour" drawer field and the render. */
export const OSB_TEXT_TONES: { value: OSBTextTone; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'muted', label: 'Muted' },
  { value: 'primary', label: 'Primary' },
  { value: 'gradient', label: 'Gradient' },
]

export const OSB_TEXT_FIELDS: OSBField[] = [
  { key: 'text', label: 'Text', kind: 'longtext' },
  { key: 'heading', label: 'Text style', kind: 'select', options: OSB_TEXT_HEADINGS },
  { key: 'bold', label: 'Bold', kind: 'boolean' },
  { key: 'italic', label: 'Italic', kind: 'boolean' },
  { key: 'font', label: 'Font', kind: 'select', options: OSB_TEXT_FONTS },
  { key: 'tone', label: 'Colour', kind: 'select', options: OSB_TEXT_TONES },
  { key: 'align', label: 'Alignment', kind: 'select', options: ALIGN_OPTIONS },
]

// shadcn/ui typography scale (MIT) — the exact size/weight/tracking values,
// merged onto our base line-height. `none` is the body paragraph.
const HEADING_CLASSES: Record<OSBTextHeading, string> = {
  none: 'text-base leading-relaxed',
  h1: 'text-4xl font-extrabold tracking-tight leading-tight',
  h2: 'text-3xl font-semibold tracking-tight leading-tight',
  h3: 'text-2xl font-semibold tracking-tight leading-snug',
  h4: 'text-xl font-semibold tracking-tight leading-snug',
  h5: 'text-lg font-semibold tracking-tight leading-snug',
  h6: 'text-base font-semibold tracking-tight leading-snug',
}

const FONT_CLASSES: Record<OSBTextFont, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
}

// Complete static classes only — never interpolate (PRD §6.6). Gradient is
// shadcn's bg-clip-text recipe; the other tones are the app's slate scale.
// Light/dark pairs live here; the theme itself comes from the global provider.
const TONE_CLASSES: Record<OSBTextTone, Record<OSBTheme, string>> = {
  default: { light: 'text-slate-900', dark: 'text-slate-50' },
  muted: { light: 'text-slate-500', dark: 'text-slate-400' },
  primary: { light: 'text-indigo-600', dark: 'text-indigo-400' },
  gradient: {
    light: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent',
    dark: 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent',
  },
}

export interface OSBTextProps {
  config?: Partial<OSBTextConfig>
  children?: React.ReactNode
}

export default function OSBText({ config }: OSBTextProps) {
  const c = resolveConfig(OSB_TEXT_DEFAULTS, config)
  const theme = useOSBTheme()
  const Tag = c.heading === 'none' ? 'p' : c.heading
  return (
    <div className={cn('h-full w-full overflow-hidden', OSB_ALIGN_CLASSES[c.align])}>
      <Tag
        className={cn(
          // inline-block so a gradient's background spans the text itself,
          // not the full container width (short text would otherwise only
          // ever show the gradient's first colour).
          'inline-block max-w-full break-words',
          HEADING_CLASSES[c.heading],
          c.bold && 'font-bold',
          c.italic && 'italic',
          FONT_CLASSES[c.font],
          TONE_CLASSES[c.tone][theme],
          OSB_ALIGN_CLASSES[c.align],
        )}
      >
        {c.text === '' ? 'Text' : c.text}
      </Tag>
    </div>
  )
}
