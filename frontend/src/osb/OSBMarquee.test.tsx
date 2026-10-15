import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OSBMarquee, {
  OSB_MARQUEE_DEFAULTS,
  OSB_MARQUEE_DIRECTIONS,
  OSB_MARQUEE_FIELDS,
  OSB_MARQUEE_ROWS,
  OSB_MARQUEE_SPEEDS,
  marqueeRowDirections,
} from './OSBMarquee'
import { OSBThemeProvider } from './OSBTheme'
import { OSB_REGISTRY, OSB_PALETTE_TYPES } from './registry'
import type { OSBCardItem } from './types'

const CARDS: OSBCardItem[] = [
  { title: 'One', body: 'First card' },
  { title: 'Two', body: 'Second card' },
]

const rows = (): HTMLElement[] => screen.getAllByTestId('osb-marquee-row')

/** The two tracks of a row: the real one, then its aria-hidden twin. */
const tracks = (row: HTMLElement): HTMLElement[] => Array.from(row.children) as HTMLElement[]

describe('OSBMarquee (a band of cards)', () => {
  it('renders a shadcn Card per collection row, twice per track for the loop', () => {
    const { container } = render(<OSBMarquee config={{ items: CARDS }} />)
    expect(rows()).toHaveLength(1)
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(4)
    expect(screen.getAllByText('First card')).toHaveLength(2)
  })

  it('the second copy is decoration only, so a reader hears each card once', () => {
    render(<OSBMarquee config={{ items: CARDS }} />)
    const [real, twin] = tracks(rows()[0])
    expect(real.getAttribute('aria-hidden')).toBeNull()
    expect(twin.getAttribute('aria-hidden')).toBe('true')
  })

  it('rows stack the band: 1 to 3, each carrying every card', () => {
    for (const count of ['1', '2', '3'] as const) {
      const { unmount } = render(<OSBMarquee config={{ items: CARDS, rows: count }} />)
      expect(rows()).toHaveLength(Number(count))
      unmount()
    }
  })

  it('zig-zag alternates the rows; off runs them all one way', () => {
    const zig = render(<OSBMarquee config={{ items: CARDS, rows: '3', alternate: true }} />)
    expect(zig.container.querySelectorAll('.animate-marquee-reverse').length).toBeGreaterThan(0)
    zig.unmount()
    const flat = render(<OSBMarquee config={{ items: CARDS, rows: '3', alternate: false }} />)
    // No row travels backwards when the band is not zig-zagged.
    expect(flat.container.querySelectorAll('.animate-marquee-reverse')).toHaveLength(0)
  })

  it('direction reverses the travel class, and speed sets the duration', () => {
    const { unmount } = render(<OSBMarquee config={{ items: CARDS, direction: 'right', speed: 'fast' }} />)
    expect(rows()[0].getAttribute('data-direction')).toBe('right')
    expect(tracks(rows()[0])[0].className).toContain('animate-marquee-reverse')
    expect(rows()[0].style.getPropertyValue('--duration')).toBe('20s')
    unmount()
    render(<OSBMarquee config={{ items: CARDS, direction: 'left', speed: 'slow' }} />)
    const forward = tracks(rows()[0])[0].className
    expect(forward).toContain('animate-marquee')
    expect(forward).not.toContain('animate-marquee-reverse')
    expect(rows()[0].style.getPropertyValue('--duration')).toBe('55s')
  })

  it('the gap the keyframes slide by is the gap the track renders', () => {
    render(<OSBMarquee config={{ items: CARDS }} />)
    const track = tracks(rows()[0])[0]
    expect(rows()[0].style.getPropertyValue('--gap')).toBe('1rem')
    expect(track.className).toContain('gap-4')
  })

  it('shows an empty state instead of an empty strip', () => {
    render(<OSBMarquee config={{ items: [] }} />)
    expect(screen.getByTestId('osb-marquee-empty').textContent).toContain('Add cards')
    expect(screen.queryAllByTestId('osb-marquee-row')).toHaveLength(0)
  })

  it('reads the global dark theme for its card shells', () => {
    const { container } = render(
      <OSBThemeProvider theme="dark">
        <OSBMarquee config={{ items: CARDS }} />
      </OSBThemeProvider>,
    )
    expect(container.querySelector('[data-slot="card"]')?.className).toContain('bg-slate-900')
  })
})

describe('marqueeRowDirections: the one row-direction rule', () => {
  it('zig-zags from the first row, and never invents a third direction', () => {
    expect(marqueeRowDirections(3, 'left', true)).toEqual(['left', 'right', 'left'])
    expect(marqueeRowDirections(3, 'right', true)).toEqual(['right', 'left', 'right'])
    expect(marqueeRowDirections(2, 'left', false)).toEqual(['left', 'left'])
  })
})

describe('OSBMarquee registry shape', () => {
  it('defaults to one leftward zig-zag row at medium speed', () => {
    expect(OSB_MARQUEE_DEFAULTS).toMatchObject({ rows: '1', direction: 'left', alternate: true, speed: 'medium' })
    expect(OSB_MARQUEE_DEFAULTS.items.length).toBeGreaterThan(1)
  })

  it('derives every select field from its ONE option list', () => {
    const options = (key: string) => {
      const field = OSB_MARQUEE_FIELDS.find((f) => f.key === key)
      if (!field || field.kind !== 'select') throw new Error(`expected a select field for ${key}`)
      return field.options
    }
    expect(options('rows')).toEqual(OSB_MARQUEE_ROWS)
    expect(options('direction')).toEqual(OSB_MARQUEE_DIRECTIONS)
    expect(options('speed')).toEqual(OSB_MARQUEE_SPEEDS)
  })

  it('declares its card rows for the ONE items editor', () => {
    const field = OSB_MARQUEE_FIELDS.find((f) => f.key === 'items')
    if (!field || field.kind !== 'items') throw new Error('expected an items field')
    expect(field.itemFields.map((f) => f.key)).toEqual(['title', 'body'])
    expect(field.subItems).toBeUndefined()
  })

  it('is a palette atom with a wide, short default footprint', () => {
    expect(OSB_REGISTRY.marquee.kind).toBe('atom')
    expect(OSB_PALETTE_TYPES).toContain('marquee')
    expect(OSB_REGISTRY.marquee.grid).toMatchObject({ cols: 12, rows: 4, minCols: 6 })
  })
})
