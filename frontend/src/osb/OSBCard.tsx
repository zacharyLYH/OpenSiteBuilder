import { cn } from '../lib/utils'
import { OSB_ALIGN_CLASSES, resolveConfig, themed, type OSBAlign, type OSBTheme } from './types'
import OSBButton from './OSBButton'

export type OSBCardConfig = {
  imageSrc: string
  imageAlt: string
  imagePosition: 'top' | 'side'
  title: string
  body: string
  actionLabel: string
  variant: 'elevated' | 'outlined' | 'plain'
  align: OSBAlign
  theme: OSBTheme
}

export const OSB_CARD_DEFAULTS: OSBCardConfig = {
  imageSrc: '',
  imageAlt: '',
  imagePosition: 'top',
  title: 'Card title',
  body: 'Card body copy.',
  actionLabel: 'Learn more',
  variant: 'elevated',
  align: 'left',
  theme: 'light',
}

export function resolveCardConfig(provided?: Partial<OSBCardConfig>): OSBCardConfig {
  return resolveConfig(OSB_CARD_DEFAULTS, provided)
}

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

const IMAGE_ASPECT = 'aspect-[16/9] w-full object-cover'

const TITLE_TONE: Record<OSBTheme, string> = {
  light: 'text-slate-900',
  dark: 'text-slate-50',
}

const BODY_TONE: Record<OSBTheme, string> = {
  light: 'text-slate-700',
  dark: 'text-slate-300',
}

function CardImage({ c }: { c: OSBCardConfig }) {
  if (c.imageSrc !== '') {
    return <img src={c.imageSrc} alt={c.imageAlt} className={cn(IMAGE_ASPECT, 'rounded-t-xl')} />
  }
  return (
    <div
      role="img"
      aria-label="Image placeholder"
      data-testid="osb-image-fallback"
      className={cn(IMAGE_ASPECT, 'rounded-t-xl bg-gradient-to-br from-slate-300 to-slate-400')}
    />
  )
}

export interface OSBCardProps {
  config?: Partial<OSBCardConfig>
}

export default function OSBCard({ config }: OSBCardProps) {
  const raw = resolveCardConfig(config)
  // Empty slots are omitted; a fully empty card still renders a title shell.
  const c: OSBCardConfig =
    raw.title === '' && raw.body === '' && raw.actionLabel === ''
      ? { ...raw, title: 'Card title' }
      : raw
  const side = c.imagePosition === 'side'

  return (
    <article className={cn('w-full overflow-hidden rounded-xl', themed(c.theme, SHELL_CLASSES[c.variant]))}>
      <div className={cn(side && 'sm:grid sm:grid-cols-2')}>
        <CardImage c={c} />
        <div className={cn('flex flex-col gap-3 p-6', OSB_ALIGN_CLASSES[c.align])}>
          {c.title !== '' && (
            <h3 className={cn('w-full break-words text-xl font-semibold', OSB_ALIGN_CLASSES[c.align], TITLE_TONE[c.theme])}>
              {c.title}
            </h3>
          )}
          {c.body !== '' && (
            <p className={cn('w-full break-words text-base leading-relaxed', OSB_ALIGN_CLASSES[c.align], BODY_TONE[c.theme])}>
              {c.body}
            </p>
          )}
          {c.actionLabel !== '' && (
            <div>
              <OSBButton
                config={{ label: c.actionLabel, variant: 'primary', size: 'sm', align: c.align, theme: c.theme }}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
