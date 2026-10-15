import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from './OSBCarouselBase'
import { overlayChildStyle } from './OSBOverlay'
import { useOSBTheme } from './OSBTheme'
import { clampSlots } from './slots'
import {
  ALIGN_OPTIONS,
  resolveConfig,
  SURFACE_OPTIONS,
  type OSBAlign,
  type OSBField,
  type OSBSlot,
  type OSBSurface,
  type OSBTheme,
} from './types'

/**
 * A carousel of SLIDES, shadcn's way: a track of items with prev/next arrows,
 * dots, keyboard and swipe — built on the vendored `OSBCarouselBase` (Embla).
 *
 * Each slide is a small container: drop as many atoms into it as you like, and
 * add or remove slides from the settings panel. That split lives in the
 * registry (`slots`) and in the doc layer (a child's `slot`), so this file only
 * paints what the engine hands it: one `OSBSlot` per slide, with each child's
 * cell box already slide-local. Edit and publish therefore compute the same
 * percent boxes — there is no second layout rule here.
 *
 * The controls render INSIDE the provider, where they read the embla api from
 * context: no callback plumbing, no mirrored state.
 */

export type OSBCarouselPerView = '1' | '2' | '3'
export type OSBCarouselOrientation = 'horizontal' | 'vertical'
export type OSBCarouselSpacing = 'none' | 'compact' | 'cozy'

export type OSBCarouselConfig = {
  /** The band's own surface. A carousel is a block on the page, so the
   *  default paints one — a transparent track reads as a hole, and the slides
   *  inside it have no ground to sit on. `plain` is the deliberate opt-out.
   *  Shared vocabulary with cards and popups (osb/types). */
  surface: OSBSurface
  /** How many slides the carousel holds. 1..SLOT_MAX. */
  items: number
  /** How many slides fit in the viewport at once. */
  perView: OSBCarouselPerView
  /** Which way the track travels. */
  orientation: OSBCarouselOrientation
  /** Slide alignment when the track is not full (embla `align`). */
  align: OSBAlign
  /** Gutter between slides. */
  spacing: OSBCarouselSpacing
  /** Wrap from the last slide back to the first. */
  loop: boolean
  /** Advance on a timer. */
  autoplay: boolean
  /** Seconds a slide stays up while autoplay runs. */
  autoplaySeconds: number
  /** Show the prev/next arrow buttons. */
  arrows: boolean
  /** Show the dot indicator. */
  dots: boolean
  /** Let a visitor swipe/drag the track. */
  drag: boolean
}

export const OSB_CAROUSEL_DEFAULTS: OSBCarouselConfig = {
  surface: 'elevated',
  items: 3,
  perView: '1',
  orientation: 'horizontal',
  align: 'left',
  spacing: 'compact',
  loop: false,
  autoplay: false,
  autoplaySeconds: 4,
  arrows: true,
  dots: true,
  drag: true,
}

/** The slide count a carousel config asks for — the ONE number behind the
 * canvas bands, the child `slot` values, and the published track. */
export function carouselItems(config: unknown): number {
  const c = resolveConfig(OSB_CAROUSEL_DEFAULTS, config as Partial<OSBCarouselConfig> | undefined)
  return clampSlots(c.items)
}

/** The one option list behind the "Slides in view" drawer field. */
export const OSB_CAROUSEL_PER_VIEW: { value: OSBCarouselPerView; label: string }[] = [
  { value: '1', label: 'One' },
  { value: '2', label: 'Two' },
  { value: '3', label: 'Three' },
]

/** How many slides the track shows at once, as a number (1..3). The editor
 * needs this to know which slide a pointer is over. */
export function carouselPerView(config: unknown): number {
  const c = resolveConfig(OSB_CAROUSEL_DEFAULTS, config as Partial<OSBCarouselConfig> | undefined)
  return Math.max(1, Math.min(3, Math.trunc(Number(c.perView)) || 1))
}

/** The one option list behind the "Scroll" drawer field. */
export const OSB_CAROUSEL_ORIENTATIONS: { value: OSBCarouselOrientation; label: string }[] = [
  { value: 'horizontal', label: 'Side to side' },
  { value: 'vertical', label: 'Up and down' },
]

/** The one option list behind the "Slide spacing" drawer field. */
export const OSB_CAROUSEL_SPACINGS: { value: OSBCarouselSpacing; label: string }[] = [
  { value: 'none', label: 'Tight' },
  { value: 'compact', label: 'Compact' },
  { value: 'cozy', label: 'Roomy' },
]

export const OSB_CAROUSEL_FIELDS: OSBField[] = [
  { key: 'surface', label: 'Background', kind: 'select', options: SURFACE_OPTIONS },
  {
    key: 'items',
    label: 'Slides',
    hint: 'Each slide holds its own atoms — drag them into a slide on the canvas.',
    kind: 'number',
    min: 1,
    max: 6,
  },
  { key: 'perView', label: 'Slides in view', kind: 'select', options: OSB_CAROUSEL_PER_VIEW },
  { key: 'orientation', label: 'Scroll', kind: 'select', options: OSB_CAROUSEL_ORIENTATIONS },
  { key: 'align', label: 'Alignment', kind: 'select', options: ALIGN_OPTIONS },
  { key: 'spacing', label: 'Slide spacing', kind: 'select', options: OSB_CAROUSEL_SPACINGS },
  { key: 'loop', label: 'Loop', hint: 'Wrap from the last slide back to the first.', kind: 'boolean' },
  { key: 'autoplay', label: 'Autoplay', hint: 'Advance a slide on a timer.', kind: 'boolean' },
  {
    key: 'autoplaySeconds',
    label: 'Seconds per slide',
    visibleWhen: { key: 'autoplay' },
    kind: 'number',
    min: 2,
    max: 10,
  },
  { key: 'drag', label: 'Swipe to scroll', hint: 'Off: only the arrows move the track.', kind: 'boolean' },
  { key: 'arrows', label: 'Arrow buttons', kind: 'boolean' },
  { key: 'dots', label: 'Dots', kind: 'boolean' },
]

/** embla alignment, from the ONE shared alignment vocabulary (osb/types). */
const EMBLA_ALIGN: Record<OSBAlign, 'start' | 'center'> = { left: 'start', center: 'center' }

/** The band's surface, one complete class string per option per theme
 * (PRD §6.6) — never an interpolated class. `elevated` is the tinted band a
 * carousel reads as; `plain` is transparent on purpose. */
const CAROUSEL_SURFACE: Record<OSBSurface, Record<OSBTheme, string>> = {
  elevated: {
    light: 'border-slate-200 bg-slate-100',
    dark: 'border-slate-700 bg-slate-800',
  },
  outlined: {
    light: 'border-slate-300 bg-white',
    dark: 'border-slate-700 bg-slate-900',
  },
  plain: {
    light: 'border-transparent bg-transparent',
    dark: 'border-transparent bg-transparent',
  },
}

/** Slides per view, as whole static classes (never interpolated). */
const PER_VIEW_CLASSES: Record<OSBCarouselPerView, string> = {
  '1': 'basis-full',
  '2': 'basis-1/2',
  '3': 'basis-1/3',
}

/** Slide gutter: the track's negative margin and the item's matching padding
 * (shadcn's `-ml-4` / `pl-4` rhythm, as one static pair per step). */
const SPACING_CLASSES: Record<OSBCarouselSpacing, { track: string; item: string }> = {
  none: { track: 'ml-0', item: 'pl-0' },
  compact: { track: '-ml-3', item: 'pl-3' },
  cozy: { track: '-ml-6', item: 'pl-6' },
}

const DOT_CLASSES: Record<OSBTheme, { on: string; off: string }> = {
  light: { on: 'bg-slate-900', off: 'bg-slate-300 hover:bg-slate-400' },
  dark: { on: 'bg-slate-50', off: 'bg-slate-600 hover:bg-slate-500' },
}

/** An empty slide is still a slide: it keeps its place on the track. */
const EMPTY_SLOT: OSBSlot = { cols: 1, rows: 1, kids: [] }

export interface OSBCarouselProps {
  config?: Partial<OSBCarouselConfig>
  /** Slotted container: one entry per slide, kids already slide-local.
   * Absent (a bare render) falls back to the configured slide count. */
  slots?: OSBSlot[]
  children?: ReactNode
  /** Renderer hooks, used by the EDITOR only: which slide is on screen, and a
   * callback when the user moves to another one. The canvas needs both — its
   * drop math and its landing ghost have to agree with what the user sees.
   * Left unset on the published site, where embla owns the index. */
  index?: number
  onSlideChange?: (index: number) => void
}

export default function OSBCarousel({ config, slots, index, onSlideChange }: OSBCarouselProps) {
  const c = resolveConfig(OSB_CAROUSEL_DEFAULTS, config)
  const theme = useOSBTheme()
  // The engine pads the slides to the configured count; doing it here too
  // means a bare render (drawer preview, screenshot harness) still shows the
  // slides the settings promise.
  const groups = slots ?? []
  const slides = Array.from({ length: Math.max(carouselItems(c), groups.length) }, (_, i) => groups[i] ?? EMPTY_SLOT)
  const vertical = c.orientation === 'vertical'
  const spacing = SPACING_CLASSES[c.spacing] ?? SPACING_CLASSES.compact

  return (
    <Carousel
      orientation={c.orientation}
      className={cn(
        'h-full w-full overflow-hidden border',
        (CAROUSEL_SURFACE[c.surface] ?? CAROUSEL_SURFACE.elevated)[theme],
      )}
      opts={{ align: EMBLA_ALIGN[c.align], loop: c.loop, watchDrag: c.drag }}
    >
      <CarouselContent className={cn('h-full', vertical ? '-mt-3 flex-col' : spacing.track)}>
        {slides.map((s, i) => (
          <CarouselItem key={i} className={cn(PER_VIEW_CLASSES[c.perView], vertical ? 'pt-3' : spacing.item)}>
            <div data-testid="osb-carousel-slide" className="relative h-full w-full">
              {s.kids.map((k) => (
                <div key={k.id} style={overlayChildStyle({ cols: s.cols, rows: s.rows }, k)} className="overflow-hidden">
                  {k.content}
                </div>
              ))}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {c.autoplay && slides.length > 0 && <CarouselAutoplay seconds={c.autoplaySeconds} />}
      {c.arrows && slides.length > 0 && (
        <>
          <CarouselPrevious />
          <CarouselNext />
        </>
      )}
      {c.dots && <CarouselDots />}
      {(index !== undefined || onSlideChange) && <CarouselSync index={index} onSlideChange={onSlideChange} />}
    </Carousel>
  )
}

/**
 * The editor's handle on the track: report which slide is showing, and follow
 * a slide chosen outside the component. Both are embla subscriptions, so the
 * component keeps owning its own state (see ADAPT-4 in OSBCarouselBase).
 */
function CarouselSync({ index, onSlideChange }: { index?: number; onSlideChange?: (index: number) => void }) {
  const { api, snap } = useCarousel()
  const reported = useRef<number | null>(null)
  useEffect(() => {
    if (reported.current === snap.index) return
    reported.current = snap.index
    onSlideChange?.(snap.index)
  }, [snap.index, onSlideChange])
  useEffect(() => {
    if (index === undefined || index < 0 || !api || api.selectedScrollSnap() === index) return
    api.scrollTo(index)
  }, [api, index])
  return null
}

/** Autoplay advances the embla api on a timer; it renders nothing itself. */
function CarouselAutoplay({ seconds }: { seconds: number }) {
  const { api } = useCarousel()
  const ms = Math.max(1, seconds) * 1000
  useEffect(() => {
    if (!api) return
    const timer = setInterval(() => api.scrollNext(), ms)
    return () => clearInterval(timer)
  }, [api, ms])
  return null
}

/** The dot indicator: one dot per snap, current one filled. */
function CarouselDots() {
  const { api, snap, orientation } = useCarousel()
  const theme = useOSBTheme()
  if (snap.count <= 1) return null
  const vertical = orientation === 'vertical'
  return (
    <div
      data-testid="osb-carousel-dots"
      className={cn(
        'absolute z-10 flex gap-1.5',
        vertical ? 'right-1.5 top-1/2 -translate-y-1/2 flex-col' : 'bottom-1.5 left-1/2 -translate-x-1/2',
      )}
    >
      {Array.from({ length: snap.count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i === snap.index}
          onClick={() => api?.scrollTo(i)}
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            i === snap.index ? DOT_CLASSES[theme].on : DOT_CLASSES[theme].off,
          )}
        />
      ))}
    </div>
  )
}
