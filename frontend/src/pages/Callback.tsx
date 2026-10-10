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
  const q = new URLSearchParams(window.location.search)
  const [result, setResult] = React.useState<ExchangeResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [installUrl, setInstallUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    const code = q.get('code')
    const state = q.get('state')
    const inst = Number(q.get('installation_id'))
    // State may be absent on the install leg; the backend falls back
    // to the pending cookie. Only code is mandatory here.
    if (!code) {
      setError('callback is missing code')
      return
    }
    const payload: ExchangePayload = { code, state }
    if (inst) payload.installation_id = inst
    postExchange(payload)
      .then(({ status, body }) => {
        if (status !== 200) {
          setError(body.error || `exchange failed: ${status}`)
          if (status === 409 && body.install_url) {
            setInstallUrl(body.install_url)
            // Publish already consented to this journey; continue automatically.
            setTimeout(() => { window.location.href = body.install_url }, 1500)
          }
        } else {
          try {
            localStorage.setItem('osb_last_slug', body.slug)
          } catch { /* private mode */ }
          setResult(body)
        }
      })
      .catch((e) => setError(String(e)))
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
          <p>Repo ensured: <code className="rounded bg-slate-100 px-1">{result.owner}/{result.slug}</code></p>
          <p>Created this run: <code className="rounded bg-slate-100 px-1">{String(result.created)}</code></p>
          <p>Site: <a className="underline" href={result.url}>{result.url}</a></p>
          <p><a className="underline" href={`/editor?slug=${encodeURIComponent(result.slug)}`}>Open editor</a></p>
        </div>
      )}
      {!error && !result && <p className="mt-4 text-sm text-slate-600">Exchanging with backend…</p>}
      </div>
    </main>
  )
}
