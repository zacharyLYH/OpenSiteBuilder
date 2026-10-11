import React from 'react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ErrorNote } from '../components/Notice'
import { getState } from '../api'
import { githubAuthorizeUrl } from '../config'
import { setProjectSlug } from '../lib/project'

const STEPS = [
  { n: '01', title: 'Name it', text: 'Pick a site name. We create the repo in your GitHub account — no terminal, no setup.' },
  { n: '02', title: 'We wire the build', text: 'Actions, Pages, and deploys configure themselves on first publish.' },
  { n: '03', title: 'Edit visually', text: 'Change copy and blocks in the editor. Every save ships through the same pipeline.' },
]

export default function Home() {
  const [slug, setSlug] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  function openEditor() {
    // Entering the canvas requires a project cookie (the canvas has no
    // fallback name). The typed name wins; empty input starts 'my-site',
    // the same default the input placeholder advertises.
    const name = slug.trim() === '' ? 'my-site' : slug
    setProjectSlug(name)
    window.location.href = '/canvas'
  }

  async function publish() {
    setError(null)
    setBusy(true)
    try {
      const { status, body } = await getState(slug)
      if (status !== 200) {
        setError(body.error || 'state failed')
        return
      }
      setProjectSlug(slug)
      window.location.href = githubAuthorizeUrl(body.client_id, body.state)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-100" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-slate-500/30 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-16 text-center">
          <Badge variant="secondary" className="bg-white/10 text-slate-200 hover:bg-white/10">Free · Powered by GitHub Pages</Badge>
          <h1 className="mt-5 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
            Ship a site in minutes
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
            Pick a name. We create the repo, wire the build, and hand you an editor — all on your GitHub account.
          </p>
          <Card className="mx-auto mt-8 max-w-xl border-white/10 bg-white text-left shadow-2xl">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="site-name">Site name</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="site-name"
                    className="h-12 flex-1 text-base"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="my-site"
                  />
                  <Button className="h-12 px-8 text-base" onClick={publish} disabled={busy}>
                    {busy ? 'Starting…' : 'Publish'}
                  </Button>
                  <Button className="h-12 px-6 text-base" variant="outline" onClick={openEditor}>
                    Open editor
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Live at <span className="font-mono">https://&lt;you&gt;.github.io/{slug || 'my-site'}/</span>
                </p>
              </div>
              <ErrorNote message={error} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-3xl gap-4 px-6 py-12 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.n}>
            <CardContent className="space-y-2 p-6">
              <span className="font-mono text-xs font-bold text-slate-400">{s.n}</span>
              <h2 className="text-base font-semibold">{s.title}</h2>
              <p className="text-sm leading-relaxed text-slate-600">{s.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
