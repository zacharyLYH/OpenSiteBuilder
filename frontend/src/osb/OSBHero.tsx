import { cn } from '../lib/utils'
import { OSB_ALIGN_CLASSES, resolveConfig, themed, type OSBAlign, type OSBField, type OSBTheme } from './types'
import OSBButton from './OSBButton'

export type OSBHeroConfig = {
  eyebrow: string
  title: string
  body: string
  primaryLabel: string
  secondaryLabel: string
  imageSrc: string
  imageAlt: string
  layout: 'split' | 'stacked'
  align: OSBAlign
  theme: OSBTheme
}

export const OSB_HERO_DEFAULTS: OSBHeroConfig = {
  eyebrow: 'Eyebrow',
  title: 'Hero title',
  body: 'Hero body copy that explains the offer in one or two sentences.',
  primaryLabel: 'Get started',
  secondaryLabel: 'Learn more',
  imageSrc: '',
  imageAlt: '',
  layout: 'split',
  align: 'left',
  theme: 'light',
}

export function resolveHeroConfig(provided?: Partial<OSBHeroConfig>): OSBHeroConfig {
  return resolveConfig(OSB_HERO_DEFAULTS, provided)
}

export const OSB_HERO_FIELDS: OSBField[] = [
  { key: 'eyebrow', label: 'Small tagline above the title', kind: 'text' },
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'body', label: 'Text', kind: 'longtext' },
  { key: 'primaryLabel', label: 'Main button text', kind: 'text' },
  { key: 'secondaryLabel', label: 'Second button text', hint: 'Empty hides it.', kind: 'text' },
  { key: 'imageSrc', label: 'Image web address', hint: 'Empty shows a placeholder block.', kind: 'text' },
  { key: 'imageAlt', label: 'Image description', hint: 'Read aloud for visitors who cannot see the image.', kind: 'text' },
  {
    key: 'layout',
    label: 'Layout',
    kind: 'select',
    options: [
      { value: 'split', label: 'Side by side' },
      { value: 'stacked', label: 'Stacked' },
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

const EYEBROW_CLASSES: Record<OSBTheme, string> = {
  light: 'text-slate-500',
  dark: 'text-slate-400',
}

const IMAGE_ASPECT = 'aspect-[16/9] w-full rounded-xl object-cover'

const TITLE_TONE: Record<OSBTheme, string> = {
  light: 'text-slate-900',
  dark: 'text-slate-50',
}

const BODY_TONE: Record<OSBTheme, string> = {
  light: 'text-slate-700',
  dark: 'text-slate-300',
}

function HeroImage({ c }: { c: OSBHeroConfig }) {
  if (c.imageSrc !== '') {
    return <img src={c.imageSrc} alt={c.imageAlt} className={IMAGE_ASPECT} />
  }
  return (
    <div
      role="img"
      aria-label="Image placeholder"
      data-testid="osb-image-fallback"
      className={cn(IMAGE_ASPECT, 'bg-gradient-to-br from-slate-300 to-slate-500')}
    />
  )
}

export interface OSBHeroProps {
  config?: Partial<OSBHeroConfig>
}

export default function OSBHero({ config }: OSBHeroProps) {
  const raw = resolveHeroConfig(config)
  const c: OSBHeroConfig =
    raw.title === '' && raw.body === '' ? { ...raw, title: 'Hero title' } : raw
  const split = c.layout === 'split'

  return (
    <section className="h-full w-full">
      <div className={cn(split && 'sm:grid sm:grid-cols-2 sm:items-center sm:gap-8')}>
        <div className={cn('flex flex-col gap-4 py-6', OSB_ALIGN_CLASSES[c.align])}>
          {c.eyebrow !== '' && (
            <p className={cn('text-xs font-semibold uppercase tracking-widest', themed(c.theme, EYEBROW_CLASSES))}>
              {c.eyebrow}
            </p>
          )}
          {c.title !== '' && (
            <h1 className={cn('w-full break-words text-3xl font-bold tracking-tight', OSB_ALIGN_CLASSES[c.align], TITLE_TONE[c.theme])}>
              {c.title}
            </h1>
          )}
          {c.body !== '' && (
            <p className={cn('w-full break-words text-base leading-relaxed', OSB_ALIGN_CLASSES[c.align], BODY_TONE[c.theme])}>
              {c.body}
            </p>
          )}
          {(c.primaryLabel !== '' || c.secondaryLabel !== '') && (
            <div className={cn('flex flex-wrap gap-2', c.align === 'center' && 'justify-center')}>
              {c.primaryLabel !== '' && (
                <OSBButton config={{ label: c.primaryLabel, variant: 'primary', theme: c.theme }} />
              )}
              {c.secondaryLabel !== '' && (
                <OSBButton config={{ label: c.secondaryLabel, variant: 'outline', theme: c.theme }} />
              )}
            </div>
          )}
        </div>
        <div className={cn(!split && 'mt-2')}>
          <HeroImage c={c} />
        </div>
      </div>
    </section>
  )
}
