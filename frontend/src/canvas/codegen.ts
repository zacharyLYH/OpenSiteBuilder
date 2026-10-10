import { OSB_REGISTRY } from '../osb/registry'
import type { CanvasDoc } from './doc'

const HEADER = `// Generated from the OpenSiteBuilder canvas. Do not edit by hand.
import OSBButton from '../osb/OSBButton'
import OSBCard from '../osb/OSBCard'
import OSBHero from '../osb/OSBHero'
`

const TAG: Record<string, string> = {
  hero: 'OSBHero',
  card: 'OSBCard',
  button: 'OSBButton',
}

/**
 * Canvas doc -> publishable React page. v1 emits semantic flow order
 * (top-to-bottom, left-to-right); grid coordinates are a composition aid,
 * not published layout. Configs embed via JSON so text can never break
 * out into markup — the JSON is always correct AND the React is too.
 */
export function generatePage(doc: CanvasDoc): string {
  const nodes = [...doc.nodes]
    .filter((n) => n.type in OSB_REGISTRY && n.type in TAG)
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const body = nodes
    .map((n) => `      <${TAG[n.type]} config={${JSON.stringify(n.config ?? {})}} />`)
    .join('\n')
  return `${HEADER}
export default function SitePage() {
  return (
    <main>
${body}
    </main>
  )
}
`
}
