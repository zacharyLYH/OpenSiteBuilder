import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OSBDrawer, { OSB_DRAWER_DEFAULTS, OSB_DRAWER_FIELDS, OSB_DRAWER_SIDES } from './OSBDrawer'
import { OSBOverlayBody, overlayChildStyle, overlayHeightPx, overlayWidthPx } from './OSBOverlay'

const openDrawer = (config: Record<string, unknown> = {}, onOpenChange = () => {}) =>
  render(
    <OSBDrawer config={config} open onOpenChange={onOpenChange}>
      <p>Panel body</p>
    </OSBDrawer>,
  )

describe('OSBDrawer static shell (open undefined)', () => {
  it('renders content with an accessible name and a non-interactive X visual', () => {
    const { container } = render(
      <OSBDrawer config={{ title: 'Menu' }}>
        <p>Body</p>
      </OSBDrawer>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Menu' })
    expect(dialog.textContent).toContain('Body')
    // Static preview keeps the X visual so the drawer thumbnail is honest,
    // but it is not a control — the live sheet owns the real button.
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.textContent).toContain('✕')
  })

  it('hides the close visual when showClose is false', () => {
    const { container } = render(<OSBDrawer config={{ showClose: false }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.textContent).not.toContain('✕')
  })

  it('sizes from the shell footprint (shared overlay pitch)', () => {
    // One 28px pitch everywhere: editor shell, sheet, and published agree —
    // the same numbers as the modal.
    expect(overlayWidthPx(10)).toBe('min(92vw, 280px)')
    expect(overlayHeightPx(10)).toBe('280px')
    // A 4-wide button at x=1 in a 10-wide shell keeps its box anywhere.
    expect(overlayChildStyle({ cols: 10, rows: 10 }, { x: 1, y: 6, cols: 4, rows: 1 })).toMatchObject({
      position: 'absolute',
      left: `${(1 / 10) * 100}%`,
      width: `${(4 / 10) * 100}%`,
    })
  })

  it('keeps an atom at its grid footprint inside the shared body', () => {
    render(
      <OSBDrawer config={{ title: 'Menu' }} cols={10} rows={10}>
        <OSBOverlayBody
          cols={10}
          rows={10}
          kids={[{ id: 'b1', x: 1, y: 6, cols: 4, rows: 1 }]}
          renderKid={() => <button type="button">Got it</button>}
        />
      </OSBDrawer>,
    )
    const box = screen.getByText('Got it').parentElement
    expect(box?.style.width).toBe(`${(4 / 10) * 100}%`)
    expect(box?.style.left).toBe(`${(1 / 10) * 100}%`)
  })
})

describe('OSBDrawer sheet (controlled open)', () => {
  it('renders nothing when closed', () => {
    render(<OSBDrawer open={false} onOpenChange={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens with overlay, content, and an X that requests close', () => {
    const onOpenChange = vi.fn()
    openDrawer({ title: 'Menu' }, onOpenChange)
    // shadcn's overlay contract: one fixed full-viewport dismiss layer.
    expect(document.querySelectorAll('div.fixed.inset-0')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Menu' }).textContent).toContain('Panel body')
    // shadcn labels the close control "Close" with an sr-only span.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Escape requests close', () => {
    const onOpenChange = vi.fn()
    openDrawer({}, onOpenChange)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('docks to the configured side', () => {
    openDrawer({ side: 'left' })
    const content = screen.getByTestId('osb-drawer-content')
    // shadcn side variants: left docks left, right docks right.
    expect(content.className).toContain('left-0')
  })
})

describe('OSBDrawer registry shape', () => {
  it('defaults to a named panel on the right with a close button', () => {
    expect(OSB_DRAWER_DEFAULTS).toMatchObject({ title: 'Panel', side: 'right', showClose: true })
  })

  it('declares its name required and its side from one option list', () => {
    const kinds = Object.fromEntries(OSB_DRAWER_FIELDS.map((f) => [f.key, f]))
    expect(kinds.title.required).toBe(true)
    const side = OSB_DRAWER_FIELDS.find((f) => f.key === 'side')
    if (!side || side.kind !== 'select') throw new Error('expected a select field for side')
    expect(side.options).toEqual(OSB_DRAWER_SIDES)
  })
})
