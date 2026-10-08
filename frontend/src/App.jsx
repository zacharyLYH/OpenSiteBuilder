import React from 'react'
import { Button } from './components/ui/button.jsx'

const APP_SLUG = 'opensitebuilder-bytesbylyh-dev'
const CLIENT_ID = 'Iv23liBOHhapv9XPFgLw'

function useQuery() {
  return new URLSearchParams(window.location.search)
}

function Callback() {
  const q = useQuery()
  const [result, setResult] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [installUrl, setInstallUrl] = React.useState(null)

  React.useEffect(() => {
    const payload = {
      code: q.get('code'),
      state: q.get('state'),
    }
    const inst = Number(q.get('installation_id'))
    if (inst) payload.installation_id = inst
    // State may be absent on the install leg; the backend falls back
    // to the pending cookie. Only code is mandatory here.
    if (!payload.code) {
      setError('callback is missing code')
      return
    }
    fetch('/api/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (r) => ({ status: r.status, body: await r.json() }))
      .then(({ status, body }) => {
        if (status !== 200) {
          setError(body.error || `exchange failed: ${status}`)
          if (status === 409 && body.install_url) {
            setInstallUrl(body.install_url)
            // Publish already consented to this journey; continue automatically.
            setTimeout(() => { window.location.href = body.install_url }, 1500)
          }
        } else setResult(body)
      })
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Callback received</h1>
      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {installUrl && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-slate-600">Taking you to GitHub to install the app, then press Publish once more.</p>
          <a className="text-sm underline" href={installUrl}>Continue to GitHub</a>
        </div>
      )}
      {result && (
        <div className="mt-4 space-y-2 text-sm">
          <p>Repo ensured: <code className="rounded bg-slate-100 px-1">{result.owner}/{result.slug}</code></p>
          <p>Created this run: <code className="rounded bg-slate-100 px-1">{String(result.created)}</code></p>
          <p>Site: <a className="underline" href={result.url}>{result.url}</a></p>
        </div>
      )}
      {!error && !result && <p className="mt-4 text-sm text-slate-600">Exchanging with backend…</p>}
    </main>
  )
}

function Home() {
  const [slug, setSlug] = React.useState('osb-e2e-probe')
  const [error, setError] = React.useState(null)

  async function publish() {
    setError(null)
    const r = await fetch(`/api/state?slug=${encodeURIComponent(slug)}`)
    const body = await r.json()
    if (!r.ok) {
      setError(body.error || 'state failed')
      return
    }
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/callback')}&state=${encodeURIComponent(body.state)}`
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">OpenSiteBuilder</h1>
      <p className="mt-2 text-sm text-slate-600">Editor stub. Pick a site name, then Publish. The site publishes to your GitHub account.</p>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          Site name
          <input className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </label>
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={publish}>Publish</Button>
          <Button variant="secondary">Preview</Button>
        </div>
      </div>
    </main>
  )
}

export default function App() {
  if (window.location.pathname === '/callback') return <Callback />
  return <Home />
}
