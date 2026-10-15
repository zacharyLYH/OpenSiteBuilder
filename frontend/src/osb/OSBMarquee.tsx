import type { CSSProperties } from 'react'
import { cn } from '../lib/utils'
import { Card, CardDescription, CardHeader, CardTitle } from './OSBCard'
import { useOSBTheme } from './OSBTheme'
import { resolveConfig, type OSBCardItem, type OSBField, type OSBTheme } from './types'

/**
 * A scrolling band of CARDS. Its cards are collection
 * data (config, never canvas nodes — PRD §6.2), so the marquee stays an atom.
 * Each row repeats the same cards twice and slides one copy past the other, so
 * the seam never shows; rows can run the same way or zig-zag.
 *
 * The animation is pure CSS: `animate-marquee` + the two custom properties the
 * keyframes read — `--gap` (the track gutter, from the class) and `--duration`
 * (the speed, from the config). No JS timer, so nothing to leak and nothing to
 * reconcile on resize.
 */

export type OSBMarqueeRows = '1' | '2' | '3'
export type OSBMarqueeDirection = 'left' | 'right'
export type OSBMarqueeSpeed = 'slow' | 'medium' | 'fast'

export type OSBMarqueeConfig = {
  /** The cards the band carries. */
  items: OSBCardItem[]
  /** How many bands to stack. */
  rows: OSBMarqueeRows
  /** Which way the FIRST row travels. */
  direction: OSBMarqueeDirection
  /** Alternate the rows, so the band reads as a woven belt. */
  alternate: boolean
  /** Seconds per loop. */
  speed: OSBMarqueeSpeed
}

/** Pre-filled on drop: a band with no cards would look like an empty strip. */
const DEFAULT_CARDS: OSBCardItem[] = [
  { title: 'First card', body: 'Cards scroll past, then loop.' },
  { title: 'Second card', body: 'Edit them in the settings panel.' },
  { title: 'Third card', body: 'Add as many as the band should carry.' },
]

export const OSB_MARQUEE_DEFAULTS: OSBMarqueeConfig = {
  items: DEFAULT_CARDS,
  rows: '1',
  direction: 'left',
  alternate: true,
  speed: 'medium',
}

/** The one option list behind the "Rows" drawer field. */
export const OSB_MARQUEE_ROWS: { value: OSBMarqueeRows; label: string }[] = [
  { value: '1', label: 'One' },
  { value: '2', label: 'Two' },
  { value: '3', label: 'Three' },
]

/** The one option list behind the "Direction" drawer field. */
export const OSB_MARQUEE_DIRECTIONS: { value: OSBMarqueeDirection; label: string }[] = [
  { value: 'left', label: 'Right to left' },
  { value: 'right', label: 'Left to right' },
]

/** The one option list behind the "Speed" drawer field. */
export const OSB_MARQUEE_SPEEDS: { value: OSBMarqueeSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

export const OSB_MARQUEE_FIELDS: OSBField[] = [
  {
    key: 'items',
    label: 'Cards',
    hint: 'The cards the band carries. Every row shows all of them.',
    kind: 'items',
    itemFields: [
      { key: 'title', label: 'Card title', placeholder: 'Title' },
      { key: 'body', label: 'Card text', placeholder: 'Text' },
    ],
  },
  { key: 'rows', label: 'Rows', kind: 'select', options: OSB_MARQUEE_ROWS },
  {
    key: 'direction',
    label: 'Direction',
    hint: 'Which way the first row travels.',
    kind: 'select',
    options: OSB_MARQUEE_DIRECTIONS,
  },
  {
    key: 'alternate',
    label: 'Zig-zag rows',
    hint: 'Off: every row travels the same way.',
    kind: 'boolean',
  },
  { key: 'speed', label: 'Speed', kind: 'select', options: OSB_MARQUEE_SPEEDS },
]

/** Seconds per loop — a CSS custom property value, never a class name. */
const DURATION: Record<OSBMarqueeSpeed, string> = {
  slow: '55s',
  medium: '35s',
  fast: '20s',
}

/**
 * The one class per travel direction. Both are complete static animation
 * utilities, and `reverse` is part of the shorthand (tailwind.config.js) —
 * never a separate `animation-direction` longhand, which the shorthand would
 * reset depending on the order the two utilities land in the sheet.
 */
const ROW_ANIMATION: Record<OSBMarqueeDirection, string> = {
  left: 'animate-marquee',
  right: 'animate-marquee-reverse',
}

/** The empty state reads as a slot, not as a broken strip. */
const MARQUEE_EMPTY_CLASSES: Record<OSBTheme, string> = {
  light: 'border-slate-300 text-slate-500',
  dark: 'border-slate-700 text-slate-400',
}

/** Row directions: the same way, or zig-zagged from the first row's direction. */
export function marqueeRowDirections(
  rows: number,
  first: OSBMarqueeDirection,
  alternate: boolean,
): OSBMarqueeDirection[] {
  const other: OSBMarqueeDirection = first === 'left' ? 'right' : 'left'
  return Array.from({ length: rows }, (_, i) => (alternate && i % 2 === 1 ? other : first))
}

/** One row of config, read defensively: a hand-edited doc may be partial. */
function cardsOf(items: unknown): OSBCardItem[] {
  if (!Array.isArray(items)) return []
  return items.map((it) => {
    const row = (it ?? {}) as Partial<OSBCardItem>
    return { title: typeof row.title === 'string' ? row.title : '', body: typeof row.body === 'string' ? row.body : '' }
  })
}

const ROW_COUNT: Record<OSBMarqueeRows, number> = { '1': 1, '2': 2, '3': 3 }

export interface OSBMarqueeProps {
  config?: Partial<OSBMarqueeConfig>
  children?: React.ReactNode
}

export default function OSBMarquee({ config }: OSBMarqueeProps) {
  const c = resolveConfig(OSB_MARQUEE_DEFAULTS, config)
  const theme = useOSBTheme()
  const cards = cardsOf(c.items)

  if (cards.length === 0) {
    return (
      <div
        data-testid="osb-marquee-empty"
        className={cn(
          'flex h-full w-full items-center justify-center rounded-lg border border-dashed p-4 text-xs',
          MARQUEE_EMPTY_CLASSES[theme],
        )}
      >
        Add cards in the settings panel
      </div>
    )
  }

  const directions = marqueeRowDirections(ROW_COUNT[c.rows] ?? 1, c.direction, c.alternate)
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2 overflow-hidden">
      {directions.map((dir, i) => (
        <MarqueeRow key={i} cards={cards} direction={dir} speed={c.speed} />
      ))}
    </div>
  )
}

/** The gutter between cards, in the class AND the keyframes (`--gap`). */
const GAP = '1rem'

/**
 * One band. The track holds the same cards twice and slides one copy out of
 * view: `animate-marquee` moves `calc(-100% - gap)`, which lands the second
 * copy exactly where the first began, so the loop is seamless. A hovered band
 * pauses, so a visitor can actually read a card.
 */
function MarqueeRow({
  cards,
  direction,
  speed,
}: {
  cards: OSBCardItem[]
  direction: OSBMarqueeDirection
  speed: OSBMarqueeSpeed
}) {
  const style = { '--gap': GAP, '--duration': DURATION[speed] } as CSSProperties
  const track = cn('flex shrink-0 gap-4 group-hover:[animation-play-state:paused]', ROW_ANIMATION[direction])
  return (
    <div data-testid="osb-marquee-row" data-direction={direction} style={style} className="group flex gap-4 overflow-hidden">
      <div className={track}>
        {cards.map((c, i) => (
          <MarqueeCard key={i} card={c} />
        ))}
      </div>
      {/* The second copy is decoration: assistive tech hears the cards once. */}
      <div className={track} aria-hidden="true">
        {cards.map((c, i) => (
          <MarqueeCard key={i} card={c} />
        ))}
      </div>
    </div>
  )
}

/** One marquee card: the shared shadcn Card shell, compacted for a band. */
function MarqueeCard({ card }: { card: OSBCardItem }) {
  return (
    <Card className="w-48 shrink-0 gap-1 rounded-xl py-3">
      <CardHeader className="gap-1 px-4">
        <CardTitle className="text-sm">{card.title}</CardTitle>
        <CardDescription className="line-clamp-2 text-xs">{card.body}</CardDescription>
      </CardHeader>
    </Card>
  )
}
