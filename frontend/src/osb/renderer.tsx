import type { SiteNode } from '../site/types'
import { OSB_REGISTRY } from './registry'

/**
 * Generic node renderer: site.json -> React. The editor preview and the
 * publisher share this, so what you see is what ships (PRD §11).
 * Unknown config keys are ignored; missing keys use component defaults.
 */
export default function OSBNodeRenderer({ node }: { node: SiteNode }) {
  return <>{OSB_REGISTRY[node.type].render(node.config)}</>
}
