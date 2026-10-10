import { getProjectSlug } from '../lib/project'

export default function Nav() {
  const lastSlug = getProjectSlug() || ''
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center gap-6 p-4">
        <a href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-sm text-white">O</span>
          OpenSiteBuilder
        </a>
        <a href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">Publish</a>
        {lastSlug && (
          <a href="/canvas" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Editor ({lastSlug})
          </a>
        )}
      </nav>
    </header>
  )
}
