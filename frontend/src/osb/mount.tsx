import { useMemo, useState } from 'react'
import type { SiteNode } from '../site/types'
import { OSBThemeProvider } from './OSBTheme'
import { OSBNodeView, OSBOverlayView } from './OSBRuntime'
import { OSB_REGISTRY, isOverlayType } from './registry'
import type { OSBTheme } from './types'

interface MountSpec {
  nodes: SiteNode[]
  theme: OSBTheme
}

/** `#nodes=<json>&theme=dark` — theme is global, not a per-node config. */
function parseHash(): MountSpec | null {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const raw = params.get('nodes')
    if (!raw) return null
    const nodes = JSON.parse(raw) as SiteNode[]
    if (!Array.isArray(nodes)) return null
    return {
      theme: params.get('theme') === 'dark' ? 'dark' : 'light',
      nodes: nodes.filter((n) => n && typeof n.type === 'string' && n.type in OSB_REGISTRY),
    }
  } catch {
    return null
  }
}

/** One node, rendered by the SAME engine the published site uses. Overlays
 * mount open (screenshots capture the dialog/sheet, not a page). */
function renderSiteNode(n: SiteNode): React.ReactNode {
  if (isOverlayType(n.type)) return <MountedOverlay node={n} />
  return <OSBNodeView node={n} />
}

/** A mounted overlay is closable like the real thing: local open state. */
function MountedOverlay({ node }: { node: SiteNode }) {
  const [open, setOpen] = useState(true)
  return <OSBOverlayView overlay={node} open={open} onOpenChange={setOpen} />
}

/**
 * Generic screenshot mount for e2e specs: renders whatever node list the spec
 * passes in `#nodes=<json>&theme=dark` through the registry. Dev-only
 * /osb-mount route.
 */
export default function OsbMount() {
  const spec = useMemo(() => parseHash(), [])
  if (spec === null) {
    return <div data-testid="osb-mount-empty">missing #nodes=[site.json nodes]</div>
  }
  const { nodes, theme } = spec
  return (
    <OSBThemeProvider theme={theme}>
      <div
        data-testid="osb-mount"
        data-theme={theme}
        className={`p-4 ${theme === 'dark' ? 'bg-slate-950 text-slate-50' : 'bg-white text-slate-900'}`}
      >
        {nodes.map((n, i) => (
          <div key={typeof n.id === 'string' ? n.id : i}>{renderSiteNode(n)}</div>
        ))}
      </div>
    </OSBThemeProvider>
  )
}
