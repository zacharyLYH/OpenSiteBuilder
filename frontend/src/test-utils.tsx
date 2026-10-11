import { vi } from 'vitest'
import { setApiBase } from './api'
import { startServers, type Servers } from './test-servers'

let servers: Servers | null = null

// useIsolatedServers gives the calling test file its own mock GitHub
// plus its own real backend. Call in beforeAll, close in afterAll.
// Isolation is what lets files run parallel.
export async function useIsolatedServers(): Promise<() => Promise<void>> {
  servers = await startServers()
  setApiBase(servers.backendUrl)
  return async () => {
    await servers?.close()
    servers = null
    setApiBase('')
  }
}

/** Drop every cookie — the project cookie is the only cross-test state. */
export function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=', 1)[0]?.trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

function requireServers(): Servers {
  if (!servers) throw new Error('useIsolatedServers() was not called in beforeAll')
  return servers
}

// Captures navigations: our pages only read origin/pathname/search and
// assign href, so a capturing stub is a faithful stand-in.
export function mockLocation(url: string): () => string {
  const u = new URL(url)
  let href = u.href
  const stub = {
    get href(): string {
      return href
    },
    set href(v: string) {
      href = v
    },
    origin: u.origin,
    pathname: u.pathname,
    search: u.search,
  }
  try {
    Object.defineProperty(window, 'location', { configurable: true, value: stub })
  } catch {
    delete (window as unknown as Record<string, unknown>).location
    ;(window as unknown as Record<string, unknown>).location = stub
  }
  return () => href
}

// installHttp gives fetch a cookie jar, which browsers do natively and
// Node does not. Requests stay real HTTP against the file's backend.
export function installHttp(): void {
  const { backendUrl } = requireServers()
  const jar = new Map<string, string>()
  const realFetch = globalThis.fetch.bind(globalThis) as typeof fetch
  const wrapped = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('/')) url = backendUrl + url
    const headers = new Headers(init?.headers)
    if (jar.size > 0) {
      headers.set('Cookie', [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '))
    }
    const res = await realFetch(url, { ...init, headers })
    const getSet =
      (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie ??
      (() => {
        const one = res.headers.get('set-cookie')
        return one ? [one] : []
      })
    for (const c of getSet.call(res.headers)) {
      const pair = c.split(';', 1)[0]
      const eq = pair.indexOf('=')
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
    return res
  }) as typeof fetch
  vi.stubGlobal('fetch', wrapped)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setScenario(s: Record<string, any>): Promise<void> {
  const { mockUrl } = requireServers()
  const r = await fetch(`${mockUrl}/__scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  })
  if (!r.ok) throw new Error(`scenario failed: ${r.status}`)
}

export async function resetScenario(): Promise<void> {
  const { mockUrl } = requireServers()
  await fetch(`${mockUrl}/__reset`, { method: 'POST' })
}

export interface MockCalls {
  calls: Record<string, number>
  tokens: Record<string, string[]>
  generateBody: string
}

export async function mockCalls(): Promise<MockCalls> {
  const { mockUrl } = requireServers()
  return (await (await fetch(`${mockUrl}/__calls`)).json()) as MockCalls
}

// login runs the real exchange against the file's backend with any code
// (the mock accepts all) and leaves the session in the jar.
export async function login(slug: string): Promise<void> {
  const { backendUrl } = requireServers()
  const st = await (await fetch(`${backendUrl}/api/state?slug=${slug}`)).json()
  const r = await fetch(`${backendUrl}/api/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'test-code', state: st.state }),
  })
  if (r.status !== 200) throw new Error(`login failed: ${r.status} ${await r.text()}`)
}
