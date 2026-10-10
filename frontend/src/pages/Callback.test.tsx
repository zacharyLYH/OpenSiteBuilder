import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Callback from './Callback'
import { getState } from '../api'
import { mockLocation, installHttp, resetScenario, setScenario, mockCalls, useIsolatedServers } from '../test-utils'

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

describe('Callback drives the real exchange', () => {
  it('completes the authorize leg and binds the slug', async () => {
    const st = await getState('my-shop')
    mockLocation(`http://localhost/callback?code=c1&state=${st.body.state}`)
    // Real backend, mocked GitHub: repo missing so it generates.
    await setScenario({})
    render(<Callback />)

    expect(await screen.findByText(/maya\/my-shop/, {}, { timeout: 10000 })).toBeTruthy()
    // Single-writer rule: only Home publish sets the slug, never the callback.
    expect(localStorage.getItem('osb_last_slug')).toBeNull()
    const seen = await mockCalls()
    if (seen.calls['POST /repos/tmpl-owner/tmpl-repo/generate'] !== 1) {
      throw new Error(`generate must run once, saw ${JSON.stringify(seen.calls)}`)
    }
  })

  it('completes the install leg without url state via the pending cookie', async () => {
    // Real Publish always precedes the callback, which sets the cookie.
    await getState('my-shop')
    mockLocation('http://localhost/callback?code=c2&installation_id=7&setup_action=install')
    render(<Callback />)

    expect(await screen.findByText(/maya\/my-shop/, {}, { timeout: 10000 })).toBeTruthy()
    expect(localStorage.getItem('osb_last_slug')).toBeNull()
  })

  it('shows failure when the code is already spent', async () => {
    const st = await getState('my-shop')
    await setScenario({ exchangeFails: true })
    mockLocation(`http://localhost/callback?code=spent&state=${st.body.state}`)
    render(<Callback />)

    expect(await screen.findByText(/github authorization failed/i, {}, { timeout: 10000 })).toBeTruthy()
  })

  it('shows failure for an installation from another account', async () => {
    const st = await getState('my-shop')
    mockLocation(`http://localhost/callback?code=c9&state=${st.body.state}&installation_id=999`)
    render(<Callback />)

    expect(await screen.findByText(/installation lookup failed/i, {}, { timeout: 10000 })).toBeTruthy()
  })

  it('treats already-enabled pages as success', async () => {
    const st = await getState('my-shop')
    await setScenario({ pagesStatus: 409 })
    mockLocation(`http://localhost/callback?code=c4&state=${st.body.state}`)
    render(<Callback />)

    expect(await screen.findByText(/maya\/my-shop/, {}, { timeout: 10000 })).toBeTruthy()
  })

  it('auto-continues to the install page on 409', async () => {
    const st = await getState('my-shop')
    await setScenario({ installLogin: 'someone-else' })
    const href = mockLocation(`http://localhost/callback?code=c3&state=${st.body.state}`)
    render(<Callback />)

    expect(await screen.findByText(/Redirecting to GitHub/, {}, { timeout: 10000 })).toBeTruthy()
    await waitFor(
      () => {
        expect(href()).toBe('https://github.com/apps/test-app/installations/new')
      },
      { timeout: 8000 },
    )
  }, 20000)

  it('never contacts the backend without a code', async () => {
    mockLocation('http://localhost/callback?state=s9')
    render(<Callback />)

    expect(await screen.findByText('callback is missing code')).toBeTruthy()
    const seen = await mockCalls()
    if (seen.calls['POST /login/oauth/access_token'] !== undefined) {
      throw new Error('no GitHub contact allowed without a code')
    }
  })
})
