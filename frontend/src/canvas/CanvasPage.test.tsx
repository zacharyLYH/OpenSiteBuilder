import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CanvasPage from './CanvasPage'
import { mockLocation } from '../test-utils'
import { storageKey } from './doc'

beforeEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('CanvasPage', () => {
  it('exits the current project back to home', () => {
    localStorage.setItem('osb_last_slug', 'shop')
    const href = mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Exit project' }))
    expect(localStorage.getItem('osb_last_slug')).toBeNull()
    expect(href()).toBe('/')
  })

  it('opens the settings drawer when a placed node is clicked', async () => {
    localStorage.setItem('osb_last_slug', 'shop')
    localStorage.setItem(
      storageKey('shop'),
      JSON.stringify({
        version: 1,
        nodes: [{ id: 'n1', type: 'button', config: { label: 'Go' }, x: 0, y: 0, cols: 4, rows: 1 }],
      }),
    )
    mockLocation('http://localhost/canvas')
    render(<CanvasPage />)
    fireEvent.click(await screen.findByTestId('canvas-node'))
    expect(await screen.findByTestId('config-drawer')).toBeTruthy()
  })
})
