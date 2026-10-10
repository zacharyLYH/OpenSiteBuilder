// Thin wrappers over same-origin /api/*. Each returns {status, body}.

export interface ApiResult {
  status: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
}

// Base defaults to same-origin. Integration tests point it at the real
// backend under test; browsers never call this.
let apiBase = ''

export function setApiBase(url: string): void {
  apiBase = url
}

async function call(path: string, opts?: RequestInit): Promise<ApiResult> {
  const r = await fetch(apiBase + path, opts)
  // Non-JSON bodies (proxy errors, empty responses) must not throw.
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

export const getState = (slug: string): Promise<ApiResult> =>
  call(`/api/state?slug=${encodeURIComponent(slug)}`);

export interface ExchangePayload {
  code: string | null
  state: string | null
  installation_id?: number
}

export const postExchange = (payload: ExchangePayload): Promise<ApiResult> =>
  call('/api/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export interface PublishFile {
  path: string
  content: string
}

export const publishFiles = (files: PublishFile[], message: string): Promise<ApiResult> =>
  call('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, message }),
  });
