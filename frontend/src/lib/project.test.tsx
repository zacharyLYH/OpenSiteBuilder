import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Home from '../pages/Home'
import CanvasPage from '../canvas/CanvasPage'
import { getProjectSlug, setProjectSlug, clearProjectSlug, PROJECT_COOKIE } from './project'
import { clearCookies, mockLocation } from '../test-utils'

beforeEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  clearCookies()
  // Publish hits GET /api/state; keep it local so no backend is needed.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ state: 's' }), { status: 200 })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// E2E-ish at the storage seam: full publish → exit → publish-again journey
// goes only through cookies, and every intermediate state stays readable
// via getProjectSlug (the same call Nav/Canvas use for the app name).
describe('project cookie lifecycle (e2e-ish)', () => {
  it('publishes name1, exits, publishes name2 — localStorage stays empty', async () => {
    // --- leg 1: publish project "name1" from Home ---
    let href = mockLocation('http://localhost/')
    const home1 = render(<Home />)
    fireEvent.change(screen.getByLabelText(/site name/i), { target: { value: 'name1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await vi.waitFor(() => expect(href()).toContain('oauth/authorize'))
    // Intermediate state 1: cookie readable right after publish.
    expect(getProjectSlug()).toBe('name1')
    expect(document.cookie).toContain(`${PROJECT_COOKIE}=name1`)
    expect(localStorage.length).toBe(0)
    home1.unmount()

    // --- leg 2: canvas reads the name, then exits (clears) ---
    href = mockLocation('http://localhost/canvas')
    const canvas = render(<CanvasPage />)
    // Intermediate state 2: canvas resolves the app name from the cookie.
    expect(getProjectSlug()).toBe('name1')
    expect((await screen.findByTestId('canvas-project')).textContent).toBe('name1')
    fireEvent.click(screen.getByRole('button', { name: 'Exit project' }))
    expect(href()).toBe('/')
    // Intermediate state 3: exit wiped the cookie, storage still untouched.
    expect(getProjectSlug()).toBeNull()
    expect(document.cookie).not.toContain(PROJECT_COOKIE)
    expect(localStorage.length).toBe(0)
    canvas.unmount()

    // --- leg 3: publish a second project "name2" ---
    href = mockLocation('http://localhost/')
    const home2 = render(<Home />)
    fireEvent.change(screen.getByLabelText(/site name/i), { target: { value: 'name2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await vi.waitFor(() => expect(href()).toContain('oauth/authorize'))
    expect(getProjectSlug()).toBe('name2')
    expect(document.cookie).toContain(`${PROJECT_COOKIE}=name2`)
    expect(localStorage.length).toBe(0)
    home2.unmount()
  })

  it('unit: set/get/clear round-trips through the renamed cookie only', () => {
    expect(getProjectSlug()).toBeNull()
    setProjectSlug('alpha')
    expect(getProjectSlug()).toBe('alpha')
    // Old key is gone: no legacy localStorage fallback.
    expect(localStorage.getItem('osb_last_slug')).toBeNull()
    expect(localStorage.length).toBe(0)
    clearProjectSlug()
    expect(getProjectSlug()).toBeNull()
  })
})
