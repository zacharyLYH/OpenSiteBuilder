import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OSBModal, { OSB_MODAL_DEFAULTS, OSB_MODAL_FIELDS } from './OSBModal'
import { OSBOverlayBody, overlayChildStyle, overlayWidthPx } from './OSBOverlay'

const openModal = (config: Record<string, unknown> = {}, onOpenChange = () => {}) =>
  render(
    <OSBModal config={config} open onOpenChange={onOpenChange}>
      <p>Popup body</p>
    </OSBModal>,
  )

describe('OSBModal closed by default (no fake preview)', () => {
  it('renders nothing without open state', () => {
    const { container } = render(
      <OSBModal config={{ title: 'Offer' }}>
        <p>Body</p>
      </OSBModal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.textContent).not.toContain('Body')
  })

  it('hides the X control when showClose is false', () => {
    render(<OSBModal config={{ showClose: false }} open onOpenChange={() => {}} />)
    // jsdom runs no CSS, so assert the hiding rule itself: shadcn's X is a
    // direct-child button of the content, and this selector removes it.
    expect(screen.getByTestId('osb-modal-content').className).toContain('[&>button]:hidden')
  })

  it('sizes from the shell footprint', () => {
    // Shell width comes from the footprint; body height is natural content
    // (no fixed grid-rows box — shadcn content + scroll classes own it).
    expect(overlayWidthPx(12)).toBe('min(92vw, 336px)')
    expect(overlayWidthPx(6)).toBe('min(92vw, 168px)')
    // A 4-wide button at x=1 in a 12-wide shell keeps a 1/3 box anywhere.
    expect(overlayChildStyle({ cols: 12, rows: 10 }, { x: 1, y: 6, cols: 4, rows: 1 })).toMatchObject({
      position: 'absolute',
      left: `${(1 / 12) * 100}%`,
      width: `${(4 / 12) * 100}%`,
    })
  })

  it('keeps an atom at its grid footprint inside the shared body', () => {
    render(
      <OSBModal config={{ title: 'Offer' }} cols={12} open onOpenChange={() => {}}>
        <OSBOverlayBody
          cols={12}
          rows={10}
          kids={[{ id: 'b1', x: 1, y: 6, cols: 4, rows: 1 }]}
          renderKid={() => <button type="button">Got it</button>}
        />
      </OSBModal>,
    )
    const box = screen.getByText('Got it').parentElement
    expect(box?.style.width).toBe(`${(4 / 12) * 100}%`)
    expect(box?.style.left).toBe(`${(1 / 12) * 100}%`)
  })
})

describe('OSBModal dialog (controlled open)', () => {
  it('renders nothing when closed', () => {
    render(<OSBModal open={false} onOpenChange={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens with overlay, content, and an X that requests close', () => {
    const onOpenChange = vi.fn()
    openModal({ title: 'Offer' }, onOpenChange)
    // shadcn's overlay contract: one fixed full-viewport dismiss layer.
    expect(document.querySelectorAll('div.fixed.inset-0')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Offer' }).textContent).toContain('Popup body')
    // shadcn labels the close control "Close" with an sr-only span.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Escape requests close', () => {
    const onOpenChange = vi.fn()
    openModal({}, onOpenChange)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders a dismissing overlay (outside press is covered in a real browser)', () => {
    openModal({})
    // The overlay sits behind the content and takes pointer events, so a
    // press outside the popup reaches Radix's dismiss layer. jsdom cannot
    // emulate the full outside-press gesture — e2e/osb-modal.spec.ts does.
    const overlay = document.querySelector('div.fixed.inset-0')
    const content = screen.getByTestId('osb-modal-content')
    expect(overlay).toBeTruthy()
    expect(overlay!.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('OSBModal registry shape', () => {
  it('defaults to a named popup with a close button', () => {
    expect(OSB_MODAL_DEFAULTS).toMatchObject({ title: 'Popup', showClose: true })
  })

  it('declares its name required', () => {
    const kinds = Object.fromEntries(OSB_MODAL_FIELDS.map((f) => [f.key, f]))
    expect(kinds.title.required).toBe(true)
  })
})
