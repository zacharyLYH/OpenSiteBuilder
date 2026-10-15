import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import OSBCarousel, {
  carouselItems,
  OSB_CAROUSEL_DEFAULTS,
  OSB_CAROUSEL_FIELDS,
  OSB_CAROUSEL_ORIENTATIONS,
  OSB_CAROUSEL_PER_VIEW,
  OSB_CAROUSEL_SPACINGS,
} from './OSBCarousel'
import { OSB_REGISTRY, OSB_PALETTE_TYPES, slotCountOf } from './registry'
import { OSB_PATTERNS } from './patterns'
import { ALIGN_OPTIONS, isFieldVisible, SURFACE_OPTIONS, type OSBSlot } from './types'

/**
 * jsdom implements no `matchMedia`, and Embla reads its breakpoint list through
 * it on every init — even with no breakpoints configured, because
 * `Array.prototype.map` validates the callback it is handed. Embla also
 * observes slides through `IntersectionObserver` and sizes through
 * `ResizeObserver`, which jsdom lacks. None exists in a real browser (where
 * the layout assertions live), so all three are shimmed here and the carousel
 * mounts exactly as it does for users.
 */
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.IntersectionObserver
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver
})

/** One slide as the engine hands it over: slide-local kids. */
const slide = (id: string, kids = 1): OSBSlot => ({
  cols: 4,
  rows: 6,
  kids: Array.from({ length: kids }, (_, i) => ({
    id: `${id}-${i}`,
    x: 0,
    y: i,
    cols: 4,
    rows: 1,
    content: <span>{id} kid {i + 1}</span>,
  })),
})

const slidesOf = (n: number): OSBSlot[] => Array.from({ length: n }, (_, i) => slide(`Slide ${i + 1}`))

/** Every slide, in DOM order (embla's own grouping contract). */
const slideEls = (): HTMLElement[] => screen.getAllByRole('group')

describe('OSBCarousel (slides are containers)', () => {
  it('renders one carousel item per slide, with every kid inside it', () => {
    render(<OSBCarousel slots={[slide('Slide 1', 2), slide('Slide 2'), slide('Slide 3')]} />)
    expect(slideEls()).toHaveLength(3)
    expect(slideEls()[0].querySelectorAll('[data-testid="osb-carousel-slide"]')).toHaveLength(1)
    expect(screen.getByText('Slide 1 kid 2')).toBeTruthy()
    expect(screen.getAllByText(/Slide 1 kid/)).toHaveLength(2)
  })

  // A bare render (drawer preview, screenshot harness) still shows the slides
  // the settings promise, so the panel and the site never disagree.
  it('falls back to the configured slide count when no slots are handed over', () => {
    render(<OSBCarousel config={{ items: 2 }} />)
    expect(slideEls()).toHaveLength(2)
  })

  it('the arrows toggle adds and removes both controls', () => {
    const on = render(<OSBCarousel slots={slidesOf(3)} />)
    expect(screen.getByLabelText('Previous slide')).toBeTruthy()
    expect(screen.getByLabelText('Next slide')).toBeTruthy()
    on.unmount()
    render(<OSBCarousel config={{ arrows: false }} slots={slidesOf(3)} />)
    expect(screen.queryByLabelText('Previous slide')).toBeNull()
    expect(screen.queryByLabelText('Next slide')).toBeNull()
  })

  // A carousel is a block on the page: the default band is painted, so the
  // slides inside it have ground to sit on. `plain` is the opt-out.
  it('paints its own surface by default, and can go transparent on request', () => {
    const { unmount } = render(<OSBCarousel slots={slidesOf(2)} />)
    const region = screen.getByRole('region')
    expect(region.className).toContain('bg-slate-100')
    expect(region.className).toContain('border-slate-200')
    unmount()
    render(<OSBCarousel config={{ surface: 'plain' }} slots={slidesOf(2)} />)
    expect(screen.getByRole('region').className).toContain('bg-transparent')
  })

  it('slides in view map to whole slide widths', () => {
    for (const [perView, expected] of [
      ['1', 'basis-full'],
      ['2', 'basis-1/2'],
      ['3', 'basis-1/3'],
    ] as const) {
      const { unmount } = render(<OSBCarousel config={{ perView }} slots={slidesOf(3)} />)
      expect(slideEls()[0].className).toContain(expected)
      unmount()
    }
  })

  it('slide spacing picks the static gutter pair, never an interpolated class', () => {
    const { unmount } = render(<OSBCarousel config={{ spacing: 'cozy' }} slots={slidesOf(2)} />)
    expect((slideEls()[0].parentElement as HTMLElement).className).toContain('-ml-6')
    expect(slideEls()[0].className).toContain('pl-6')
    unmount()
    render(<OSBCarousel config={{ spacing: 'none' }} slots={slidesOf(2)} />)
    expect(slideEls()[0].className).toContain('pl-0')
  })

  it('autoplay adds no markup — it only drives the api', () => {
    render(<OSBCarousel config={{ autoplay: true, autoplaySeconds: 3 }} slots={slidesOf(3)} />)
    expect(slideEls()).toHaveLength(3)
  })

  it('a malformed manifest still renders: unknown slides fall back, not throw', () => {
    render(<OSBCarousel config={{ items: 2 }} slots={[{ cols: 0, rows: 0, kids: [] }]} />)
    expect(slideEls()).toHaveLength(2)
  })
})

describe('OSBCarousel registry shape', () => {
  it('is a slotted container: its config decides how many slides it holds', () => {
    expect(OSB_REGISTRY.carousel.kind).toBe('container')
    expect(OSB_PALETTE_TYPES).not.toContain('carousel')
    expect(slotCountOf('carousel', { items: 4 })).toBe(4)
    expect(slotCountOf('carousel', {})).toBe(OSB_CAROUSEL_DEFAULTS.items)
    expect(slotCountOf('carousel', { items: 99 })).toBe(6)
    // A plain container is one band: nothing about a card changes.
    expect(slotCountOf('card', {})).toBe(1)
    expect(OSB_REGISTRY.card.slots).toBeUndefined()
  })

  it('carouselItems clamps junk to a real slide count', () => {
    expect(carouselItems({ items: 3 })).toBe(3)
    expect(carouselItems({ items: 0 })).toBe(1)
    expect(carouselItems({ items: 2.7 })).toBe(2)
    expect(carouselItems({ items: 'nope' })).toBe(1)
  })

  it('declares the slide count as a drawer field, not a canvas node', () => {
    const items = OSB_CAROUSEL_FIELDS.find((f) => f.key === 'items')
    expect(items).toMatchObject({ kind: 'number', min: 1, max: 6 })
    // Dots default on (they hide themselves when there is a single snap).
    expect(OSB_CAROUSEL_DEFAULTS.dots).toBe(true)
    // The autoplay timer only shows while autoplay is on.
    const seconds = OSB_CAROUSEL_FIELDS.find((f) => f.key === 'autoplaySeconds')
    expect(seconds && isFieldVisible(seconds, { autoplay: true })).toBe(true)
    expect(seconds && isFieldVisible(seconds, {})).toBe(false)
  })

  it('derives its fields from the shared lists (no second copy)', () => {
    const options = (key: string) => {
      const field = OSB_CAROUSEL_FIELDS.find((f) => f.key === key)
      if (!field || field.kind !== 'select') throw new Error(`expected a select field for ${key}`)
      return field.options
    }
    expect(options('perView')).toEqual(OSB_CAROUSEL_PER_VIEW)
    expect(options('surface')).toEqual(SURFACE_OPTIONS)
    expect(options('align')).toEqual(ALIGN_OPTIONS)
    expect(options('orientation')).toEqual(OSB_CAROUSEL_ORIENTATIONS)
    expect(options('spacing')).toEqual(OSB_CAROUSEL_SPACINGS)
  })

  it('enters via its pattern, pre-seated in real slides', () => {
    const pattern = OSB_PATTERNS['carousel-slides']
    expect(pattern.containerType).toBe('carousel')
    const items = (pattern.containerConfig as { items: number }).items
    const bandCols = Math.floor(pattern.containerCols / items)
    for (const child of pattern.children) {
      const slot = Math.floor((child.x + child.cols / 2) / bandCols)
      // Inside its own slide, indented off the band edge — and never the whole
      // band: a starter slide stays droppable.
      expect(child.x).toBeGreaterThanOrEqual(slot * bandCols)
      expect(child.x).toBeLessThan((slot + 1) * bandCols)
      expect(child.x + child.cols).toBeLessThanOrEqual((slot + 1) * bandCols)
      expect(child.cols).toBeLessThan(bandCols)
    }
  })
})
