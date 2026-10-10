import { OSB_NODE_TYPES, OSB_REGISTRY } from '../osb/registry'
import type { CanvasDoc } from './doc'

/** Registry key -> published component tag/file ('card' -> 'OSBCard'). */
export const tagFor = (type: string): string => `OSB${type[0].toUpperCase()}${type.slice(1)}`

const HEADER = [
  '// Generated from the OpenSiteBuilder canvas. Do not edit by hand.',
  ...OSB_NODE_TYPES.map((t) => `import ${tagFor(t)} from './osb/${tagFor(t)}'`),
].join('\n')

/**
 * Canvas doc -> publishable React page. v1 emits semantic flow order
 * (top-to-bottom, left-to-right); grid coordinates are a composition aid,
 * not published layout. Configs embed via JSON so text can never break
 * out into markup — the JSON is always correct AND the React is too.
 * Tags/imports derive from the registry, so a new node type is added once.
 */
export function generatePage(doc: CanvasDoc): string {
  const nodes = [...doc.nodes]
    .filter((n) => n.type in OSB_REGISTRY)
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const body = nodes
    .map((n) => `      <${tagFor(n.type)} config={${JSON.stringify(n.config ?? {})}} />`)
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
