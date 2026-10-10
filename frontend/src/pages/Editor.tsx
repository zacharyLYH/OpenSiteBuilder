import React from 'react'
import { Button } from '../components/ui/button'
import { ErrorNote } from '../components/Notice'
import { getRepoFiles, getRepoFile, publishFiles } from '../api'

const EDIT_PATH = 'src/App.jsx'

interface RepoFile {
  path: string
  sha: string
  size: number
}

export default function Editor() {
  const params = new URLSearchParams(window.location.search)
  let slug = params.get('slug') || ''
  if (!slug) {
    try {
      slug = localStorage.getItem('osb_last_slug') || ''
    } catch { /* private mode */ }
  }
  const [status, setStatus] = React.useState('checking')
  const [owner, setOwner] = React.useState('')
  const [files, setFiles] = React.useState<RepoFile[]>([])
  const [content, setContent] = React.useState('')
  const [lastPush, setLastPush] = React.useState<{ commit: string; url: string; at: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Assert a live repo backs this editor before anything else loads.
  React.useEffect(() => {
    if (!slug) {
      setStatus('no-site')
      return
    }
    getRepoFiles(slug)
      .then(({ status: st, body }) => {
        if (st === 401) {
          setStatus('no-access')
          return
        }
        if (st !== 200) {
          setStatus('error')
          setError(body.error || `repo check failed: ${st}`)
          return
        }
        setFiles(body.files || [])
        setOwner(body.owner || '')
        setStatus('ready')
        const hasApp = (body.files || []).some((f: RepoFile) => f.path === EDIT_PATH)
        if (hasApp) {
          getRepoFile(slug, EDIT_PATH)
            .then(({ status: fst, body: fb }) => {
              if (fst === 200) setContent(fb.content || '')
              else setError(fb.error || 'file load failed')
            })
            .catch((e) => setError(String(e)))
        }
      })
      .catch((e) => {
        setStatus('error')
        setError(String(e))
      })
  }, [])

  // A failed repo check means no guaranteed origin: restart onboarding.
  React.useEffect(() => {
    if (status !== 'error') return
    const t = setTimeout(() => {
      try {
        localStorage.removeItem('osb_last_slug')
      } catch { /* private mode */ }
      window.location.href = '/'
    }, 2500)
    return () => clearTimeout(t)
  }, [status])

  async function save() {
    setError(null)
    setLastPush(null)
    const { status: st, body } = await publishFiles(
      [{ path: EDIT_PATH, content }],
      `edit ${EDIT_PATH}`,
    )
    if (st !== 200) {
      setError(body.error || `push failed: ${st}`)
      return
    }
    setLastPush({ commit: body.commit, url: body.url, at: new Date().toLocaleTimeString() })
  }

  if (status === 'checking') {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-slate-600">Checking site…</p>
      </main>
    )
  }
  if (status === 'no-site' || status === 'no-access') {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">No site connected</h1>
        <p className="mt-2 text-sm text-slate-600">Publish a site first, then the editor opens on a guaranteed live repo.</p>
        <div className="mt-4">
          <a className="text-sm underline" href="/">Back to Publish</a>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Editor</h1>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">{slug}</span>
      </div>
      {status === 'error' && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <ErrorNote message={error} />
          <p className="mt-2 text-sm text-slate-600">No live repo here — restarting onboarding… <a className="underline" href="/">Go now</a></p>
        </div>
      )}
      {status !== 'error' && (
        <>
          <p className="mt-2 text-sm text-slate-600">{files.length} editable files. Paste valid React below.</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 font-mono text-xs text-slate-500">src/App.jsx</div>
            <textarea
              className="h-96 w-full p-4 font-mono text-sm focus:outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
            />
          </div>
        </>
      )}
      <ErrorNote message={status !== 'error' ? error : null} />
      {lastPush && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm shadow-sm">
          <p className="font-medium text-green-800">
            Updated — commit <code>{lastPush.commit.slice(0, 7)}</code> pushed at {lastPush.at}
          </p>
          <p className="mt-1 text-green-700">
            <a className="underline" href={`https://github.com/${owner}/${slug}/commit/${lastPush.commit}`}>
              View commit on GitHub
            </a>
            {' · '}
            <a className="underline" href={lastPush.url}>View live site</a>
            {' '} (first builds can take up to 10 minutes)
          </p>
        </div>
      )}
      {status !== 'error' && (
        <div className="mt-4 flex gap-2">
          <Button onClick={save}>Save and push</Button>
        </div>
      )}
    </main>
  )
}
