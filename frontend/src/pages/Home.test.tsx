import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Home from './Home'
import { getProjectSlug, PROJECT_COOKIE } from '../lib/project'
import { mockLocation, installHttp, resetScenario, useIsolatedServers } from '../test-utils'

let closeServers: () => Promise<void>

beforeAll(async () => {
  closeServers = await useIsolatedServers()
}, 120000)

afterAll(async () => {
  await closeServers()
})

function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=', 1)[0]?.trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

beforeEach(async () => {
  vi.unstubAllGlobals()
  localStorage.clear()
  clearCookies()
  installHttp()
  await resetScenario()
})

describe('Home publish flow originates correct requests', () => {
  it('lowercases the slug while typing', () => {
    mockLocation('http://localhost/')
    render(<Home />)
    const input = screen.getByLabelText(/site name/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'My-SHOP' } })
    expect(input.value).toBe('my-shop')
  })

  it('persists slug then redirects to GitHub authorize on Publish', async () => {
    const href = mockLocation('http://localhost/')
    render(<Home />)
    fireEvent.change(screen.getByLabelText(/site name/i), { target: { value: 'my-shop' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => {
      expect(href()).toContain('https://github.com/login/oauth/authorize')
    })
    // Slug must survive the GitHub round trip for the return leg.
    expect(getProjectSlug()).toBe('my-shop')
    expect(document.cookie).toContain(`${PROJECT_COOKIE}=my-shop`)
    // Cookie-only: nothing leaks into localStorage.
    expect(localStorage.length).toBe(0)
    expect(href()).toContain('redirect_uri=' + encodeURIComponent('http://localhost/callback'))
  })

  it('shows the error and stays put when state fails', async () => {
    const href = mockLocation('http://localhost/')
    render(<Home />)
    fireEvent.change(screen.getByLabelText(/site name/i), { target: { value: 'bad slug!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    expect(await screen.findByText(/bad slug/i)).toBeTruthy()
    expect(href()).toBe('http://localhost/')
    expect(getProjectSlug()).toBeNull()
  })

  it('opens the editor with the typed slug so the canvas has a project', () => {
    const href = mockLocation('http://localhost/')
    render(<Home />)
    fireEvent.change(screen.getByLabelText(/site name/i), { target: { value: 'my-shop' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))

    // The canvas reads its name from the cookie and has no fallback, so
    // entering must establish it.
    expect(getProjectSlug()).toBe('my-shop')
    expect(href()).toBe('/canvas')
  })

  it('opens the editor with the default name when the input is empty', () => {
    const href = mockLocation('http://localhost/')
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))

    expect(getProjectSlug()).toBe('my-site')
    expect(href()).toBe('/canvas')
  })
})
