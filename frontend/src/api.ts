// Thin wrappers over same-origin /api/*. Each returns {status, body}.
//
// CSRF posture: every call is same-origin and relies on the session cookie the
// backend sets with `HttpOnly; SameSite=Lax`, which is what stops a hostile
// page from driving these endpoints — a cross-site POST does not carry it.
// `credentials: 'same-origin'` is fetch's default; it is spelled out here so
// the intent is explicit rather than assumed.

export interface ApiResult {
  status: number
  body: unknown
}

/** One string field from an untyped JSON body — the single place we narrow `unknown`. */
export function strField(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const value: unknown = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

// Base defaults to same-origin. Integration tests point it at the real
// backend under test; browsers never call this.
let apiBase = ''

export function setApiBase(url: string): void {
  apiBase = url
}

async function call(path: string, opts?: RequestInit): Promise<ApiResult> {
  const r = await fetch(apiBase + path, { credentials: 'same-origin', ...opts })
  // Non-JSON bodies (proxy errors, empty responses) must not throw.
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

const jsonPost = (path: string, body: unknown): Promise<ApiResult> =>
  call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const getState = (slug: string): Promise<ApiResult> =>
  call(`/api/state?slug=${encodeURIComponent(slug)}`)

export interface ExchangePayload {
  code: string | null
  state: string | null
  installation_id?: number
}

export const postExchange = (payload: ExchangePayload): Promise<ApiResult> => jsonPost('/api/exchange', payload)

export interface PublishFile {
  path: string
  content: string
}

export const publishFiles = (files: PublishFile[], message: string): Promise<ApiResult> =>
  jsonPost('/api/publish', { files, message })
