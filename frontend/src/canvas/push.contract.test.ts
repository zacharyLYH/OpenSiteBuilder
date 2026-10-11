import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { pushDoc } from './push'
import { login, installHttp, resetScenario, useIsolatedServers } from '../test-utils'
import type { CanvasDoc } from './doc'

// Cross-stack contract: the exact payload the canvas pushes (App.jsx, site.json
// and the whole osb runtime) must pass the real backend's path allowlist
// (backend/internal/validate.PublishablePath). If either side drifts, this fails.
let closeServers: () => Promise<void>

beforeAll(async () => {
  closeServers = await useIsolatedServers()
  installHttp()
  await resetScenario()
}, 120000)

afterAll(async () => {
  await closeServers()
  vi.unstubAllGlobals()
})

const DOC: CanvasDoc = {
  version: 1,
  nodes: [{ id: 'n1', type: 'card', config: { title: 'Hi' }, parentId: null, x: 0, y: 0, cols: 10, rows: 10 }],
}

describe('publish path contract (real backend)', () => {
  it('accepts every runtime path the canvas ships', async () => {
    await login('contract-probe')
    const r = await pushDoc(DOC, 'contract-probe')
    expect(r.ok).toBe(true)
  })
})
