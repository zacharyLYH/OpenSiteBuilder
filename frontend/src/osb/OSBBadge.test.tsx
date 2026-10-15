import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OSBBadge, { OSB_BADGE_DEFAULTS, OSB_BADGE_FIELDS, OSB_BADGE_VARIANTS, type OSBBadgeConfig } from './OSBBadge'
import { OSBThemeProvider } from './OSBTheme'
import { OSB_REGISTRY, OSB_PALETTE_TYPES } from './registry'
import { V_ALIGN_OPTIONS } from './types'

/** The pill itself — the wrapped span inside the anchoring box. */
const pill = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector('span')
  if (!el) throw new Error('missing badge pill')
  return el as HTMLElement
}

const box = (container: HTMLElement): HTMLElement => {
  const el = container.firstElementChild
  if (!el) throw new Error('missing badge box')
  return el as HTMLElement
}

describe('OSBBadge (vendored from shadcn Badge)', () => {
  it('renders the configured text as a pill', () => {
    render(<OSBBadge config={{ text: 'New' }} />)
    expect(screen.getByText('New')).toBeTruthy()
  })

  it('falls back to its own name when the text is blank', () => {
    render(<OSBBadge config={{ text: '' }} />)
    expect(screen.getByText('Badge')).toBeTruthy()
  })

  it('variant picks the emphasis, light theme', () => {
    const { container } = render(<OSBBadge config={{ variant: 'outline' }} />)
    expect(pill(container).className).toContain('border-slate-200')
    expect(pill(container).className).not.toContain('bg-slate-900')
  })

  it('reads the GLOBAL dark theme without touching the variant', () => {
    const { container } = render(
      <OSBThemeProvider theme="dark">
        <OSBBadge config={{}} />
      </OSBThemeProvider>,
    )
    expect(pill(container).className).toContain('bg-slate-50')
  })

  // ADAPT-2: the badge is the one atom that does not stretch to its box's
  // height — it is anchored instead, which is what makes a 1-square badge
  // usable (specs/nesting-rules.md §2).
  it('anchors the pill in its box instead of stretching it', () => {
    const top = render(<OSBBadge config={{ align: 'top' }} />)
    expect(box(top.container).className).toContain('items-start')
    top.unmount()
    const middle = render(<OSBBadge config={{ align: 'middle' }} />)
    expect(box(middle.container).className).toContain('items-center')
    middle.unmount()
    const bottom = render(<OSBBadge config={{ align: 'bottom' }} />)
    expect(box(bottom.container).className).toContain('items-end')
    // The box is the drop target, so it stays full-size; the pill never does.
    expect(box(bottom.container).className).toContain('w-full')
    expect(pill(bottom.container).className).toContain('w-fit')
  })
})

describe('OSBBadge registry shape (single source with the render)', () => {
  it('defaults to a middle-anchored primary pill', () => {
    expect(OSB_BADGE_DEFAULTS).toEqual({ text: 'Badge', variant: 'default', align: 'middle' })
  })

  it('derives its style field from the ONE variant list', () => {
    const field = OSB_BADGE_FIELDS.find((f) => f.key === 'variant')
    if (!field || field.kind !== 'select') throw new Error('expected a select field for variant')
    expect(field.options).toEqual(OSB_BADGE_VARIANTS)
  })

  it('offers the shared vertical anchor vocabulary', () => {
    const field = OSB_BADGE_FIELDS.find((f) => f.key === 'align')
    if (!field || field.kind !== 'select') throw new Error('expected a select field for align')
    expect(field.options).toEqual(V_ALIGN_OPTIONS)
    const grid = OSB_REGISTRY.badge.grid
    expect(grid).toMatchObject({ cols: 2, rows: 1, minCols: 1, minRows: 1 })
  })

  it('enters from the palette like every other atom', () => {
    expect(OSB_PALETTE_TYPES).toContain('badge')
    expect(OSB_REGISTRY.badge.kind).toBe('atom')
  })

  it('keeps every config key driven by a field (no orphan knobs)', () => {
    const keys = (Object.keys(OSB_BADGE_DEFAULTS) as (keyof OSBBadgeConfig)[]).sort()
    expect(keys).toEqual(OSB_BADGE_FIELDS.map((f) => f.key).sort())
  })
})
