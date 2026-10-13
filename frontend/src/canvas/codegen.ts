import { OSB_NODE_TYPES, OSB_REGISTRY, isOverlayType, isTriggerType } from '../osb/registry'
import { buttonOverlayTarget } from '../osb/OSBButton'
import { childrenOf, overlaysOf, themeOf, type CanvasDoc, type OverlayDoc, type PlacedNode } from './doc'

/** Registry key -> published component tag/file ('card' -> 'OSBCard'). */
export const tagFor = (type: string): string => `OSB${type[0].toUpperCase()}${type.slice(1)}`

const baseHeader = [
  '// Generated from the OpenSiteBuilder canvas. Do not edit by hand.',
  `import { OSBThemeProvider } from './osb/OSBTheme'`,
  ...OSB_NODE_TYPES.map((t) => `import ${tagFor(t)} from './osb/${tagFor(t)}'`),
  `import { OSBOverlayBody } from './osb/OSBOverlay'`,
].join('\n')

const byFlow = (a: PlacedNode, b: PlacedNode) => a.y - b.y || a.x - b.x

/** Configs embed via JSON so text can never break out into markup. */
const cfgOf = (config: Record<string, unknown> | undefined): string => `config={${JSON.stringify(config ?? {})}}`

/** A leaf tag. Only a trigger (its id is a live overlay) carries an opener;
 * every other node — link, new-tab, plain, or overlay child — renders config
 * alone. One rule for root, child, and overlay-kid leaves. */
const renderLeaf = (n: PlacedNode, overlayIds: Set<string>): string => {
  const opener = isTriggerType(n.type)
    ? (() => {
        const t = buttonOverlayTarget(n.config, overlayIds)
        return t ? ` onClick={() => setOpenOverlay(${JSON.stringify(t)})}` : ''
      })()
    : ''
  return `<${tagFor(n.type)} ${cfgOf(n.config)}${opener} />`
}

/** Overlay children never open another overlay (validated at edit time), so
 * they render with no ids in scope. */
const NO_OPENER: Set<string> = new Set()

function renderNode(node: PlacedNode, kids: PlacedNode[], overlayIds: Set<string>): string {
  // Kids arrive in flow order (childrenOf(..., true)); no re-sort here.
  if (kids.length === 0) return renderLeaf(node, overlayIds)
  const inner = kids.map((k) => renderLeaf(k, overlayIds)).join('\n')
  return `<${tagFor(node.type)} ${cfgOf(node.config)}>\n${inner.replace(/^/gm, '  ')}\n    </${tagFor(node.type)}>`
}

/** One controlled overlay: page state decides which (if any) is open.
// Absolute kids (shared OSBOverlayBody) so published matches the editor grid
// exactly. The tag comes from the registry key — a new kind needs no new
// code here. */
function renderOverlay(shell: OverlayDoc): string {
  const tag = tagFor(shell.overlayType)
  const kids = [...shell.children].sort(byFlow)
  const geom = (k: PlacedNode): string =>
    `{ id: ${JSON.stringify(k.id)}, x: ${k.x}, y: ${k.y}, cols: ${k.cols}, rows: ${k.rows} }`
  const open = `openOverlay === ${JSON.stringify(shell.id)}`
  const change = `onOpenChange={(o) => setOpenOverlay(o ? ${JSON.stringify(shell.id)} : null)}`
  const openTag = `<${tag} ${cfgOf(shell.config)} cols={${shell.cols}} rows={${shell.rows}} open={${open}} ${change}`
  if (kids.length === 0) return `${openTag} />`
  const rendered = kids.map((k) => `        if (id === ${JSON.stringify(k.id)}) return ${renderLeaf(k, NO_OPENER)}`).join('\n')
  return `${openTag}>\n      <OSBOverlayBody cols={${shell.cols}} rows={${shell.rows}} kids={[${kids.map(geom).join(', ')}]} renderKid={(id) => {\n${rendered}\n        return null\n      }} />\n    </${tag}>`
}

/**
 * Canvas doc -> publishable React page. v1 emits semantic flow order
 * (top-to-bottom, left-to-right); grid coordinates are a composition aid,
 * not published layout. Configs embed via JSON so text can never break
 * out into markup — the JSON is always correct AND the React is too.
 * Tags/imports derive from the registry, so a new node type is added once.
 * Children render nested inside their container. Overlays render after the
 * page behind one shared piece of state: which overlay (if any) is open.
 */
export function generatePage(doc: CanvasDoc): string {
  const valid = new Set(doc.nodes.filter((n) => n.type in OSB_REGISTRY).map((n) => n.id))
  const roots = doc.nodes
    .filter((n) => n.type in OSB_REGISTRY && !isOverlayType(n.type) && (n.parentId === null || !valid.has(n.parentId)))
    .sort(byFlow)
  const overlays = overlaysOf(doc)
  const overlayIds = new Set(overlays.map((m) => m.id))
  const needState = overlays.length > 0
  const header = needState ? `import { useState } from 'react'\n${baseHeader}` : baseHeader
  const body = roots
    .map((n) => {
      const kids = childrenOf(doc.nodes, n.id, true).filter((k) => k.type in OSB_REGISTRY)
      return `      ${renderNode(n, kids, overlayIds)}`
    })
    .join('\n')
  const overlayLayer = overlays.map((m) => `      ${renderOverlay(m)}`).join('\n')
  const stateLine = needState ? '\n  const [openOverlay, setOpenOverlay] = useState(null)' : ''
  const layers = [body, overlayLayer].filter((s) => s.length > 0).join('\n')
  // Theme is global: the whole page is wrapped once, not themed per node.
  const theme = themeOf(doc)
  const pageBg = theme === 'dark' ? 'bg-slate-950 text-slate-50' : 'bg-white text-slate-900'
  return `${header}\nexport default function SitePage() {${stateLine}
  return (
    <OSBThemeProvider theme=${JSON.stringify(theme)}>
      <main className=${JSON.stringify(`${pageBg} min-h-screen`)}>
${layers}
      </main>
    </OSBThemeProvider>
  )
}
`
}
