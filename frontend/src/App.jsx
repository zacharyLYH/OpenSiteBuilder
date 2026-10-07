import React from 'react'
import { Button } from './components/ui/button.jsx'

function useQuery() {
  return new URLSearchParams(window.location.search)
}

export default function App() {
  const path = window.location.pathname
  const q = useQuery()

  if (path === '/callback') {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">Callback received</h1>
        <p className="mt-2 text-sm text-slate-600">Stub route. No exchange call yet.</p>
        <dl className="mt-4 space-y-2 text-sm">
          <dt className="font-medium">code</dt>
          <dd><code className="rounded bg-slate-100 px-1">{q.get('code') || '(missing)'}</code></dd>
          <dt className="font-medium">installation_id</dt>
          <dd><code className="rounded bg-slate-100 px-1">{q.get('installation_id') || '(missing)'}</code></dd>
          <dt className="font-medium">setup_action</dt>
          <dd><code className="rounded bg-slate-100 px-1">{q.get('setup_action') || '(missing)'}</code></dd>
          <dt className="font-medium">state</dt>
          <dd><code className="rounded bg-slate-100 px-1">{q.get('state') || '(missing)'}</code></dd>
        </dl>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">OpenSiteBuilder</h1>
      <p className="mt-2 text-sm text-slate-600">Editor stub. Publish flow arrives in a later step.</p>
      <div className="mt-4 flex gap-2">
        <Button>Publish</Button>
        <Button variant="secondary">Preview</Button>
      </div>
    </main>
  )
}
