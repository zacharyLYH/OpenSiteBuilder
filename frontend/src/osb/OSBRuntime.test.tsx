import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OSBRuntime from './OSBRuntime'
import type { SiteManifest, SiteNode } from '../site/types'

/** A slotted container's engine path runs through Embla, which jsdom cannot
 * measure (no matchMedia/ResizeObserver/IntersectionObserver). Shimmed here so
 * the published carousel mounts exactly as it does in a browser. */
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

/** A manifest with one of everything: a leaf, a container + child, a trigger,
 * and the overlay it opens. */
const manifest = (over: Partial<SiteManifest> = {}): SiteManifest => ({
  version: '0.1',
  site: { name: 'Test', theme: 'light' },
  pages: [
    {
      id: 'home',
      path: '/',
      title: 'Home',
      nodes: [
        { id: 't', type: 'text', config: { text: 'Hello runtime' } },
        {
          id: 'card',
          type: 'card',
          config: {},
          children: [{ id: 'bt', type: 'button', config: { label: 'Inside card' } }],
        },
        { id: 'open', type: 'button', config: { label: 'Open popup', targetId: 'm1' } },
      ],
      overlays: [
        {
          id: 'm1',
          type: 'modal',
          config: { title: 'Popup' },
          cols: 12,
          rows: 10,
          children: [{ id: 'mt', type: 'text', config: { text: 'Popup body' }, x: 1, y: 1, cols: 8, rows: 2 }],
        },
      ],
    },
  ],
  ...over,
})

describe('OSBRuntime (the engine)', () => {
  it('renders manifest nodes through the registry, containers included', () => {
    render(<OSBRuntime manifest={manifest()} />)
    expect(screen.getByText('Hello runtime')).toBeTruthy()
    // A container renders its children (recursion is the whole engine).
    expect(screen.getByText('Inside card')).toBeTruthy()
  })

  it('lays a slotted container out as slides, with each child in its own slide', () => {
    const m = manifest()
    m.pages[0].nodes.push({
      id: 'car',
      type: 'carousel',
      config: { items: 2 },
      cols: 12,
      rows: 6,
      children: [
        { id: 'c1', type: 'text', config: { text: 'Slide one' }, x: 0, y: 1, cols: 3, rows: 1, slot: 0 },
        { id: 'c2', type: 'text', config: { text: 'Slide two' }, x: 6, y: 1, cols: 3, rows: 1, slot: 1 },
      ],
    })
    render(<OSBRuntime manifest={m} />)
    const slides = screen.getAllByTestId('osb-carousel-slide')
    expect(slides).toHaveLength(2)
    expect(slides[0].textContent).toContain('Slide one')
    expect(slides[1].textContent).toContain('Slide two')
    // Both kids start at their own slide's left edge (2 slides over 12 cells =
    // 6-cell bands), so each slide's layout is slide-local.
    for (const slide of slides) {
      expect((slide.firstElementChild as HTMLElement).style.left).toBe('0%')
    }
  })

  it('applies the global site theme, not a per-node one', () => {
    const light = render(<OSBRuntime manifest={manifest()} />)
    expect(light.container.querySelector('main')?.className).toContain('bg-white')
    light.unmount()
    const dark = render(<OSBRuntime manifest={manifest({ site: { name: 'T', theme: 'dark' } })} />)
    expect(dark.container.querySelector('main')?.className).toContain('bg-slate-950')
  })

  it('opens the overlay a trigger points at, then closes it', () => {
    render(<OSBRuntime manifest={manifest()} />)
    // Closed by default — no overlay is portaled.
    expect(screen.queryByText('Popup body')).toBeNull()
    fireEvent.click(screen.getByText('Open popup'))
    expect(screen.getByText('Popup body')).toBeTruthy()
    // The transplanted shadcn contract: X closes.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Popup body')).toBeNull()
  })

  it('drops unknown node types instead of throwing (forward compatible)', () => {
    const m = manifest()
    m.pages[0].nodes.push({ id: 'x', type: 'audio' as never, config: {} })
    render(<OSBRuntime manifest={m} />)
    expect(screen.getByText('Hello runtime')).toBeTruthy()
  })

  it('leaves a trigger with a dangling overlay reference inert', () => {
    const m = manifest()
    m.pages[0].nodes[2] = { id: 'open', type: 'button', config: { label: 'Open popup', targetId: 'missing' } }
    render(<OSBRuntime manifest={m} />)
    // No overlay exists, so the click is a no-op — never a crash.
    fireEvent.click(screen.getByText('Open popup'))
    expect(screen.queryByText('Popup body')).toBeNull()
  })

  it('renders nothing for an empty manifest', () => {
    const { container } = render(<OSBRuntime manifest={{ version: '0.1', site: { name: 'x', theme: 'light' }, pages: [] }} />)
    expect(container.firstChild).toBeNull()
  })

  it('stops at a corrupt nesting depth instead of overflowing the stack', () => {
    // A 40-deep chain is invalid for the builder, but a hand-edited manifest
    // must degrade, never crash the browser (depth guard).
    const deep: SiteNode = { id: 'n0', type: 'card', config: {} }
    let cur = deep
    for (let i = 1; i < 40; i++) {
      const child: SiteNode = { id: `n${i}`, type: 'card', config: {} }
      cur.children = [child]
      cur = child
    }
    cur.children = [{ id: 'leaf', type: 'text', config: { text: 'deep' } }]
    const m = manifest()
    m.pages[0].nodes = [deep]
    expect(() => render(<OSBRuntime manifest={m} />)).not.toThrow()
  })
})