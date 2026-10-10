// Thin wrappers over same-origin /api/*. Each returns {status, body}.

export interface ApiResult {
  status: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
}

async function call(path: string, opts?: RequestInit): Promise<ApiResult> {
  const r = await fetch(path, opts)
  return { status: r.status, body: await r.json() }
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

export const getRepoFiles = (slug: string): Promise<ApiResult> =>
  call(`/api/repo?slug=${encodeURIComponent(slug)}`);

export const getRepoFile = (slug: string, path: string): Promise<ApiResult> =>
  call(`/api/repo?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(path)}`);

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
