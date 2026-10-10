import { useMemo } from 'react'
import type { SiteNode } from '../site/types'
import { OSB_REGISTRY } from './registry'

function parseHash(): SiteNode[] | null {
  try {
    const m = window.location.hash.match(/^#nodes=(.*)$/)
    if (!m) return null
    const nodes = JSON.parse(decodeURIComponent(m[1])) as SiteNode[]
    if (!Array.isArray(nodes)) return null
    return nodes.filter((n) => n && typeof n.type === 'string' && n.type in OSB_REGISTRY)
  } catch {
    return null
  }
}

function isDark(n: SiteNode): boolean {
  return (n.config as { theme?: unknown } | undefined)?.theme === 'dark'
}

/**
 * Generic screenshot mount. Knows NOTHING per-component: it renders whatever
 * node list the spec passes in `#nodes=<json>` through the registry.
 * All edge cases live in the spec files, not here.
 * Dev-only `/osb-mount` route. Never linked in prod.
 */
export default function OsbMount() {
  const nodes = useMemo(() => parseHash(), [])
  if (nodes === null) {
    return <div data-testid="osb-mount-empty">missing #nodes=[site.json nodes]</div>
  }
  return (
    <div data-testid="osb-mount" className="bg-slate-200 p-4">
      {nodes.map((n, i) => (
        <div
          key={typeof n.id === 'string' ? n.id : i}
          className={isDark(n) ? 'bg-slate-950 p-4' : 'bg-white p-4'}
        >
          {OSB_REGISTRY[n.type].render(n.config)}
        </div>
      ))}
    </div>
  )
}
