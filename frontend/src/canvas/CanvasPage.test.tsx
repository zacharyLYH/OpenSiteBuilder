import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('opens the settings drawer when a placed node is clicked', async () => {
    setProjectSlug('shop')
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
