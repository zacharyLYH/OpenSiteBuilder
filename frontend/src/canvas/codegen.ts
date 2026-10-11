import { OSB_NODE_TYPES, OSB_REGISTRY } from '../osb/registry'
import type { CanvasDoc, PlacedNode } from './doc'

/** Registry key -> published component tag/file ('card' -> 'OSBCard'). */
export const tagFor = (type: string): string => `OSB${type[0].toUpperCase()}${type.slice(1)}`

const HEADER = [
  '// Generated from the OpenSiteBuilder canvas. Do not edit by hand.',
  ...OSB_NODE_TYPES.map((t) => `import ${tagFor(t)} from './osb/${tagFor(t)}'`),
].join('\n')

const byFlow = (a: PlacedNode, b: PlacedNode) => a.y - b.y || a.x - b.x

function renderNode(node: PlacedNode, kids: PlacedNode[]): string {
  const cfg = `config={${JSON.stringify(node.config ?? {})}}`
  if (kids.length === 0) return `<${tagFor(node.type)} ${cfg} />`
  const inner = kids
    .sort(byFlow)
    .map((k) => `<${tagFor(k.type)} config={${JSON.stringify(k.config ?? {})}} />`)
    .join('\n')
  const indented = inner
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n')
  return `<${tagFor(node.type)} ${cfg}>\n${indented}\n    </${tagFor(node.type)}>`
}

/**
 * Canvas doc -> publishable React page. v1 emits semantic flow order
 * (top-to-bottom, left-to-right); grid coordinates are a composition aid,
 * not published layout. Configs embed via JSON so text can never break
 * out into markup — the JSON is always correct AND the React is too.
 * Tags/imports derive from the registry, so a new node type is added once.
 * Children render nested inside their container.
 */
export function generatePage(doc: CanvasDoc): string {
  const valid = new Set(doc.nodes.filter((n) => n.type in OSB_REGISTRY).map((n) => n.id))
  const roots = doc.nodes
    .filter((n) => n.type in OSB_REGISTRY && (n.parentId === null || !valid.has(n.parentId)))
    .sort(byFlow)
  const body = roots
    .map((n) => {
      const kids = doc.nodes
        .filter((k) => k.parentId === n.id && k.type in OSB_REGISTRY)
        .sort(byFlow)
      return `      ${renderNode(n, kids)}`
    })
    .join('\n')
  return `${HEADER}\nexport default function SitePage() {
  return (
    <main>
${body}
    </main>
  )
}
`
}
