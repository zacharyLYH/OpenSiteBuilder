import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CanvasPage from './CanvasPage'
import { mockLocation } from '../test-utils'
import { getProjectSlug, setProjectSlug, PROJECT_COOKIE } from '../lib/project'
import { storageKey } from './doc'

function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=', 1)[0]?.trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  clearCookies()
})

describe('CanvasPage', () => {
  it('redirects home when no project cookie exists (no fallback name)', async () => {
    expect(getProjectSlug()).toBeNull()
    const href = mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    expect(await screen.findByTestId('canvas-no-project')).toBeTruthy()
    await waitFor(() => expect(href()).toBe('/'))
  })

  it('exits the current project back to home', () => {
    setProjectSlug('shop')
    const href = mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    // Canvas reads the project name from the cookie (intermediate state).
    expect(getProjectSlug()).toBe('shop')
    expect(document.cookie).toContain(`${PROJECT_COOKIE}=shop`)
    fireEvent.click(screen.getByRole('button', { name: 'Exit project' }))
    expect(getProjectSlug()).toBeNull()
    expect(localStorage.getItem('osb_last_slug')).toBeNull()
    expect(href()).toBe('/')
  })

  it('opens the style-only settings drawer when a placed node is clicked', async () => {
    setProjectSlug('shop')
    localStorage.setItem(
      storageKey('shop'),
      JSON.stringify({
        version: 1,
        nodes: [{ id: 'n1', type: 'button', config: { label: 'Go' }, parentId: null, x: 0, y: 0, cols: 4, rows: 1 }],
      }),
    )
    mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    fireEvent.click(await screen.findByTestId('canvas-node'))
    expect(await screen.findByTestId('config-drawer')).toBeTruthy()
    // Style-only: no structural controls in the drawer.
    expect(screen.queryByTestId('add-child-button')).toBeNull()
    expect(screen.queryByTestId('remove-node')).not.toBeNull()
  })

  it('selects a nested child without selecting the parent (fine-grained selection)', async () => {
    setProjectSlug('shop')
    localStorage.setItem(
      storageKey('shop'),
      JSON.stringify({
        version: 1,
        nodes: [
          { id: 'card1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
          { id: 'kid1', type: 'button', config: { label: 'In' }, parentId: 'card1', x: 1, y: 1, cols: 4, rows: 1 },
        ],
      }),
    )
    mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    const kids = await screen.findAllByTestId('canvas-node')
    const kidEl = kids.find((el) => el.getAttribute('data-id') === 'kid1')!
    fireEvent.click(kidEl)
    const drawer = await screen.findByTestId('config-drawer')
    expect(drawer.textContent).toContain('Button settings')
  })

  it('shows a resize handle on the selected nested child', async () => {
    setProjectSlug('shop')
    localStorage.setItem(
      storageKey('shop'),
      JSON.stringify({
        version: 1,
        nodes: [
          { id: 'card1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
          { id: 'kid1', type: 'button', config: { label: 'In' }, parentId: 'card1', x: 1, y: 1, cols: 4, rows: 1 },
        ],
      }),
    )
    mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    const kids = await screen.findAllByTestId('canvas-node')
    fireEvent.click(kids.find((el) => el.getAttribute('data-id') === 'kid1')!)
    // Nested atoms resize in place (roots use the grid handle instead).
    expect(await screen.findByTestId('resize-kid1')).toBeTruthy()
  })

  it('shows child bounds while the container is selected', async () => {
    setProjectSlug('shop')
    localStorage.setItem(
      storageKey('shop'),
      JSON.stringify({
        version: 1,
        nodes: [
          { id: 'card1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
          { id: 'kid1', type: 'text', config: { text: 'Hi' }, parentId: 'card1', x: 1, y: 1, cols: 8, rows: 2 },
        ],
      }),
    )
    mockLocation('http://localhost/canvas')
    const { container } = render(<CanvasPage />)
    // Transparent atoms are invisible otherwise: selecting the shell draws
    // every child's box.
    expect(container.querySelector('.show-child-bounds')).toBeNull()
    const nodes = await screen.findAllByTestId('canvas-node')
    fireEvent.click(nodes.find((el) => el.getAttribute('data-id') === 'card1')!)
    await screen.findByTestId('config-drawer')
    expect(container.querySelector('.show-child-bounds')).not.toBeNull()
  })

  it('shows the empty hint for childless containers, no sidebar Add path', async () => {
    setProjectSlug('shop')
    localStorage.setItem(
      storageKey('shop'),
      JSON.stringify({
        version: 1,
        nodes: [{ id: 'card1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 }],
      }),
    )
    mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    const nodes = await screen.findAllByTestId('canvas-node')
    fireEvent.click(nodes.find((el) => el.getAttribute('data-id') === 'card1')!)
    await screen.findByTestId('config-drawer')
    // Empty container shows the dashed hint slot; structure comes from canvas.
    expect(await screen.findByTestId('empty-hint-card1')).toBeTruthy()
    expect(screen.queryByTestId(/add-child-/)).toBeNull()
  })

  it('removes the selected node from the canvas Remove control', async () => {
    setProjectSlug('shop')
    localStorage.setItem(
      storageKey('shop'),
      JSON.stringify({
        version: 1,
        nodes: [{ id: 'n1', type: 'button', config: { label: 'Go' }, parentId: null, x: 0, y: 0, cols: 4, rows: 1 }],
      }),
    )
    mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    fireEvent.click(await screen.findByTestId('canvas-node'))
    fireEvent.click(await screen.findByTestId('remove-node'))
    await waitFor(() => expect(screen.queryByTestId('canvas-node')).toBeNull())
    expect(await screen.findByTestId('canvas-empty')).toBeTruthy()
  })

  it('warns when pieces are scattered instead of touching', async () => {
    setProjectSlug('shop')
    localStorage.setItem(
      storageKey('shop'),
      JSON.stringify({
        version: 1,
        nodes: [
          { id: 'c1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
          { id: 't1', type: 'text', config: { text: 'Far' }, parentId: null, x: 24, y: 0, cols: 8, rows: 2 },
        ],
      }),
    )
    mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    expect(await screen.findByTestId('doc-warning')).toBeTruthy()
  })
})
