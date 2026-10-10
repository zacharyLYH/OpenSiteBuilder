import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Home from './Home'
import { mockLocation, installHttp, resetScenario, useIsolatedServers } from '../test-utils'

let closeServers: () => Promise<void>

beforeAll(async () => {
  closeServers = await useIsolatedServers()
}, 120000)

afterAll(async () => {
  await closeServers()
})

beforeEach(async () => {
  vi.unstubAllGlobals()
  localStorage.clear()
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
    expect(localStorage.getItem('osb_last_slug')).toBe('my-shop')
    expect(href()).toContain('redirect_uri=' + encodeURIComponent('http://localhost/callback'))
  })

  it('shows the error and stays put when state fails', async () => {
    const href = mockLocation('http://localhost/')
    render(<Home />)
    fireEvent.change(screen.getByLabelText(/site name/i), { target: { value: 'bad slug!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    expect(await screen.findByText(/bad slug/i)).toBeTruthy()
    expect(href()).toBe('http://localhost/')
    expect(localStorage.getItem('osb_last_slug')).toBeNull()
  })

  it('opens the editor without rewriting the project slug', () => {
    localStorage.setItem('osb_last_slug', 'my-shop')
    const href = mockLocation('http://localhost/')
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))

    // Single-writer rule: opening never touches storage, only publish does.
    expect(localStorage.getItem('osb_last_slug')).toBe('my-shop')
    expect(href()).toBe('/canvas')
  })
})
