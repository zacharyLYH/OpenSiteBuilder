import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Editor from './Editor'
import { mockLocation, installHttp, resetScenario, setScenario, login, mockCalls, useIsolatedServers } from '../test-utils'

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

describe('Editor asserts a live repo before editing', () => {
  it('refuses to load anything without a site and offers Publish', async () => {
    mockLocation('http://localhost/editor')
    render(<Editor />)

    expect(await screen.findByText('No site connected')).toBeTruthy()
    const seen = await mockCalls()
    if (Object.keys(seen.calls).length !== 0) {
      throw new Error(`no backend contact allowed, saw ${JSON.stringify(seen.calls)}`)
    }
    expect(localStorage.getItem('osb_last_slug')).toBeNull()
  })

  it('falls back to the persisted slug after refresh', async () => {
    await login('my-shop')
    localStorage.setItem('osb_last_slug', 'my-shop')
    mockLocation('http://localhost/editor')
    render(<Editor />)

    expect(await screen.findByDisplayValue('mock file body', {}, { timeout: 10000 })).toBeTruthy()
  })

  it('loads the editable file and pushes exactly it on save', async () => {
    await login('my-shop')
    mockLocation('http://localhost/editor?slug=my-shop')
    render(<Editor />)

    const area = (await screen.findByDisplayValue('mock file body', {}, { timeout: 10000 })) as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'hello world' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and push' }))

    expect(await screen.findByText(/commit-/, {}, { timeout: 10000 })).toBeTruthy()
    // The save must travel the real backend onto the install token.
    const seen = await mockCalls()
    for (const key of ['POST /repos/maya/my-shop/git/blobs']) {
      for (const bearer of seen.tokens[key] || []) {
        if (bearer !== 'Bearer gh-install-token') throw new Error(`wrong token on ${key}: ${bearer}`)
      }
    }
    if ((seen.calls['POST /repos/maya/my-shop/git/blobs'] || 0) !== 1) {
      throw new Error(`expected exactly one blob upload, saw ${JSON.stringify(seen.calls)}`)
    }
  })

  it('rejects oversized content with an error, not a push', async () => {
    await login('my-shop')
    await setScenario({})
    mockLocation('http://localhost/editor?slug=my-shop')
    render(<Editor />)

    const area = (await screen.findByDisplayValue('mock file body', {}, { timeout: 10000 })) as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'x'.repeat(200 * 1024 + 1) } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and push' }))

    expect(await screen.findByText(/file too large/i, {}, { timeout: 10000 })).toBeTruthy()
    const seen = await mockCalls()
    if ((seen.calls['POST /repos/maya/my-shop/git/blobs'] || 0) !== 0) {
      throw new Error('oversized content must never upload')
    }
  })

  it('surfaces push conflicts as a retryable error', async () => {
    await login('my-shop')
    await setScenario({ updateRefStatus: 422 })
    mockLocation('http://localhost/editor?slug=my-shop')
    render(<Editor />)

    const area = (await screen.findByDisplayValue('mock file body', {}, { timeout: 10000 })) as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'conflicting edit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and push' }))

    expect(await screen.findByText(/push conflict/i, {}, { timeout: 10000 })).toBeTruthy()
  })

  it('counts only allowlisted files, hiding workflow and stray files', async () => {
    await login('my-shop')
    await setScenario({
      treeExtras: [
        { path: '.github/workflows/deploy.yml', type: 'blob' },
        { path: 'secret.txt', type: 'blob' },
      ],
    })
    mockLocation('http://localhost/editor?slug=my-shop')
    render(<Editor />)

    expect(
      await screen.findByText(
        (_, el) => el?.textContent === '2 editable files. Paste valid React below.',
        {},
        { timeout: 10000 },
      ),
    ).toBeTruthy()
  })

  it('restarts onboarding when the repo belongs to another session', async () => {
    await login('site-a')
    mockLocation('http://localhost/editor?slug=site-b')
    render(<Editor />)

    expect(await screen.findByText(/restarting onboarding/i, {}, { timeout: 10000 })).toBeTruthy()
    const seen = await mockCalls()
    if (seen.calls['GET /repos/maya/site-b/git/trees/tree-sha'] !== undefined) {
      throw new Error('cross-site reads must stop before git')
    }
  })
})
