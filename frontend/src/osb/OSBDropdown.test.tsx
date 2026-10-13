import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent, within } from '@testing-library/react'
import OSBDropdown, { OSB_DROPDOWN_DEFAULTS, OSB_DROPDOWN_DIRECTIONS, OSB_DROPDOWN_FIELDS } from './OSBDropdown'
import ConfigDrawer from '../canvas/ConfigDrawer'
import type { PlacedNode } from '../canvas/doc'

describe('OSBDropdown closed trigger', () => {
  it('renders the label with a chevron and no menu', () => {
    render(<OSBDropdown config={{ label: 'Products' }} />)
    expect(screen.getByTestId('osb-dropdown-trigger').textContent).toContain('Products')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('falls back for empty labels', () => {
    render(<OSBDropdown config={{ label: '' }} />)
    expect(screen.getByTestId('osb-dropdown-trigger').textContent).toContain('Menu')
  })

  it('renders the trigger alone for an empty item list', () => {
    render(<OSBDropdown config={{ items: [] }} />)
    // No options, no portal: the trigger stands alone.
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('tolerates a legacy config with no items key', () => {
    render(<OSBDropdown config={{ label: 'Old' }} />)
    expect(screen.getByTestId('osb-dropdown-trigger').textContent).toContain('Old')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('OSBDropdown open menu', () => {
  it('lists the configured options as menu items', () => {
    render(
      <OSBDropdown
        config={{
          items: [
            { label: 'Shop', link: '' },
            { label: 'About', link: '' },
          ],
        }}
      />,
    )
    fireEvent.pointerDown(screen.getByTestId('osb-dropdown-trigger'))
    const items = screen.getAllByRole('menuitem')
    expect(items.map((el) => el.textContent)).toEqual(['Shop', 'About'])
  })

  it('keeps link options real anchors and plain options text', () => {
    render(<OSBDropdown config={{ items: [{ label: 'Shop', link: 'https://example.com' }, { label: 'Plain', link: '' }] }} />)
    fireEvent.pointerDown(screen.getByTestId('osb-dropdown-trigger'))
    // A linked option IS the anchor (asChild), so right-click + keyboard work.
    const shop = screen.getByRole('menuitem', { name: 'Shop' })
    expect(shop.tagName).toBe('A')
    expect(shop.getAttribute('href')).toBe('https://example.com')
    const plain = screen.getByRole('menuitem', { name: 'Plain' })
    expect(plain.tagName).not.toBe('A')
    expect(plain.querySelector('a')).toBeNull()
  })
})

describe('OSBDropdown follows its grid box', () => {
  it('grows the options with the trigger, and the panel never undercuts it', () => {
    // jsdom has no ResizeObserver; the component guards on it, so hand the
    // test a fake one it can drive by hand.
    const callbacks: (() => void)[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          callbacks.push(cb)
        }
        observe() {}
        disconnect() {}
      },
    )
    render(<OSBDropdown config={{ items: [{ label: 'Shop', link: '' }] }} />)
    const trigger = screen.getByTestId('osb-dropdown-trigger')
    // One row of grid is the natural trigger: menu text sits at text-sm.
    expect(trigger.style.fontSize).toBe('0.875rem')

    // A four-row trigger (the box is the component) scales the panel with it,
    // capped at 2x, and the panel is at least as wide as its trigger.
    Object.defineProperty(trigger, 'offsetHeight', { value: 160 })
    Object.defineProperty(trigger, 'offsetWidth', { value: 240 })
    act(() => callbacks.forEach((cb) => cb()))
    expect(trigger.style.fontSize).toBe('1.75rem')

    fireEvent.pointerDown(trigger)
    const menu = screen.getByRole('menu')
    expect(menu.style.fontSize).toBe('1.75rem')
    expect(menu.style.minWidth).toBe('240px')
    vi.unstubAllGlobals()
  })
})

describe('OSBDropdown submenus', () => {
  const nested = {
    items: [
      { label: 'Products', link: '', children: [{ label: 'Shop', link: '/shop' }, { label: 'Sale', link: '' }] },
      { label: 'Contact', link: '/contact' },
    ],
  }

  it('renders a row with children as a submenu that opens instead of navigating', () => {
    render(<OSBDropdown config={nested} />)
    fireEvent.pointerDown(screen.getByTestId('osb-dropdown-trigger'))
    const parent = screen.getByRole('menuitem', { name: 'Products' })
    expect(parent.getAttribute('aria-haspopup')).toBe('menu')
    expect(parent.tagName).not.toBe('A')
    // Nothing renders until it opens…
    expect(screen.queryByRole('menuitem', { name: 'Shop' })).toBeNull()
    fireEvent.click(parent)
    // …then its own rows appear as plain options (a linked one is the anchor).
    const shop = screen.getByRole('menuitem', { name: 'Shop' })
    expect(shop.tagName).toBe('A')
    expect(shop.getAttribute('href')).toBe('/shop')
    expect(screen.getByRole('menuitem', { name: 'Sale' }).tagName).not.toBe('A')
  })
})

describe('OSBDropdown opening direction', () => {
  const items = [{ label: 'Shop', link: '' }]

  it('defaults to automatic, which is the plain below-the-trigger menu', () => {
    expect(OSB_DROPDOWN_DEFAULTS.direction).toBe('auto')
    render(<OSBDropdown config={{ items }} />)
    fireEvent.pointerDown(screen.getByTestId('osb-dropdown-trigger'))
    expect(screen.getByRole('menu').getAttribute('data-side')).toBe('bottom')
  })

  it('passes an explicit side through to the panel', () => {
    render(<OSBDropdown config={{ items, direction: 'right' }} />)
    fireEvent.pointerDown(screen.getByTestId('osb-dropdown-trigger'))
    expect(screen.getByRole('menu').getAttribute('data-side')).toBe('right')
  })

  it('declares the field as the one option list of directions', () => {
    const direction = OSB_DROPDOWN_FIELDS.find((f) => f.key === 'direction')
    expect(direction).toMatchObject({ kind: 'select', options: OSB_DROPDOWN_DIRECTIONS })
  })
})

describe('OSBDropdown registry shape', () => {
  it('defaults to a labeled menu with no options', () => {
    expect(OSB_DROPDOWN_DEFAULTS).toMatchObject({ label: 'Menu', items: [] })
  })

  it('declares its label required and options as a collection field', () => {
    const kinds = Object.fromEntries(OSB_DROPDOWN_FIELDS.map((f) => [f.key, f]))
    expect(kinds.label.required).toBe(true)
    expect(kinds.items.kind).toBe('items')
  })

  it('edits through the generic drawer, adding and removing item rows', () => {
    const node: PlacedNode = { id: 'd1', type: 'dropdown', config: {}, parentId: null, x: 0, y: 0, cols: 6, rows: 4 }
    render(<ConfigDrawer node={node} side="right" onClose={() => {}} onApply={() => {}} />)
    expect(screen.getByText('Dropdown settings')).toBeTruthy()
    expect(screen.getByText('Menu label')).toBeTruthy()
    expect(screen.getByText('Menu items')).toBeTruthy()
    // Adding an option renders a label + link row, no canvas node involved.
    expect(screen.queryAllByTestId('osb-item-row')).toHaveLength(0)
    fireEvent.click(screen.getByTestId('osb-add-item'))
    expect(screen.getAllByTestId('osb-item-row')).toHaveLength(1)
    expect(screen.getByLabelText('Item label')).toBeTruthy()
    expect(screen.getByLabelText('Item link')).toBeTruthy()
  })

  it('edits one submenu level in place, and stops the nesting there', () => {
    const node: PlacedNode = { id: 'd1', type: 'dropdown', config: {}, parentId: null, x: 0, y: 0, cols: 3, rows: 1 }
    render(<ConfigDrawer node={node} side="right" onClose={() => {}} onApply={() => {}} />)
    fireEvent.click(screen.getByTestId('osb-add-item'))
    // "↳" gives a row a submenu: its own rows, indented inside the same list…
    fireEvent.click(screen.getByLabelText('Add sub-item'))
    expect(screen.getAllByTestId('osb-item-row')).toHaveLength(2)
    const sub = within(screen.getByTestId('osb-sub-items'))
    // …where a row takes siblings but never another submenu.
    expect(sub.queryByLabelText('Add sub-item')).toBeNull()
    fireEvent.click(sub.getByTestId('osb-add-item'))
    expect(screen.getAllByTestId('osb-item-row')).toHaveLength(3)
  })
})

