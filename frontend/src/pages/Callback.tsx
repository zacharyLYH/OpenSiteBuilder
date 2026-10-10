import React from 'react'
import { ErrorNote } from '../components/Notice'
import { postExchange, type ExchangePayload } from '../api'

interface ExchangeResult {
  owner: string
  slug: string
  created: boolean
  url: string
}

export default function Callback() {
  const [result, setResult] = React.useState<ExchangeResult | null>(null)
  const [installUrl, setInstallUrl] = React.useState<string | null>(null)
  // Missing code is knowable at mount, so seed it here rather than set state
  // synchronously inside the effect.
  const [error, setError] = React.useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('code') === null
      ? 'callback is missing code'
      : null,
  )

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const q = new URLSearchParams(window.location.search)
    const code = q.get('code')
    const state = q.get('state')
    const inst = Number(q.get('installation_id'))
    // State may be absent on the install leg; the backend falls back
    // to the pending cookie. Only code is mandatory here.
    if (!code) return
    const payload: ExchangePayload = { code, state }
    if (inst) payload.installation_id = inst
    postExchange(payload)
      .then(({ status, body }) => {
        if (status !== 200) {
          setError(body.error || `exchange failed: ${status}`)
          if (status === 409 && body.install_url) {
            setInstallUrl(body.install_url)
            // Publish already consented to this journey; continue automatically.
            timer = setTimeout(() => { window.location.href = body.install_url }, 1500)
          }
        } else {
          setResult(body)
        }
      })
      .catch((e) => setError(String(e)))
    return () => clearTimeout(timer)
  }, [])

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Connecting GitHub…</h1>
      <ErrorNote message={error} />
      {installUrl && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-slate-600">Redirecting to GitHub… If nothing happens, <a className="underline" href={installUrl}>click here to continue</a>.</p>
        </div>
      )}
      {result && (
        <div className="mt-4 space-y-2 text-sm">
          <p>Site connected: <code className="rounded bg-slate-100 px-1">{result.owner}/{result.slug}</code></p>
          <p><a className="underline" href={result.url}>{result.url}</a></p>
          <p><a className="underline" href="/canvas">Open visual editor</a></p>
        </div>
      )}
      {!error && !result && <p className="mt-4 text-sm text-slate-600">Exchanging with backend…</p>}
      </div>
    </main>
  )
}
