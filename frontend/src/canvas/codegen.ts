import { OSB_NODE_TYPES, OSB_REGISTRY } from '../osb/registry'
import { modalsOf, type CanvasDoc, type ModalDoc, type PlacedNode } from './doc'

/** Registry key -> published component tag/file ('card' -> 'OSBCard'). */
export const tagFor = (type: string): string => `OSB${type[0].toUpperCase()}${type.slice(1)}`

const baseHeader = [
  '// Generated from the OpenSiteBuilder canvas. Do not edit by hand.',
  ...OSB_NODE_TYPES.map((t) => `import ${tagFor(t)} from './osb/${tagFor(t)}'`),
  `import { OSBModalBody } from './osb/OSBModal'`,
].join('\n')

const byFlow = (a: PlacedNode, b: PlacedNode) => a.y - b.y || a.x - b.x

/** Configs embed via JSON so text can never break out into markup. */
const cfgOf = (config: Record<string, unknown> | undefined): string => `config={${JSON.stringify(config ?? {})}}`

/** A trigger button opens its popup through page state; any other button
 * renders exactly as before (link, new-tab, or plain). */
function renderButton(node: PlacedNode, modalIds: Set<string>): string {
  const modalId = (node.config as { modalId?: unknown } | undefined)?.modalId
  const opener =
    typeof modalId === 'string' && modalIds.has(modalId) ? ` onClick={() => setOpenModal(${JSON.stringify(modalId)})}` : ''
  return `<${tagFor(node.type)} ${cfgOf(node.config)}${opener} />`
}

function renderNode(node: PlacedNode, kids: PlacedNode[], modalIds: Set<string>): string {
  if (kids.length === 0) {
    if (node.type === 'button') return renderButton(node, modalIds)
    return `<${tagFor(node.type)} ${cfgOf(node.config)} />`
  }
  const inner = kids
    .sort(byFlow)
    .map((k) =>
      k.type === 'button'
        ? renderButton(k, modalIds)
        : `<${tagFor(k.type)} ${cfgOf(k.config)} />`,
    )
    .join('\n')
  return `<${tagFor(node.type)} ${cfgOf(node.config)}>\n${inner.replace(/^/gm, '  ')}\n    </${tagFor(node.type)}>`
}

/** One controlled popup: page state decides which (if any) is open. Absolute
 * kids (shared OSBModalBody) so published matches the editor grid exactly. */
function renderModal(modal: ModalDoc): string {
  const kids = [...modal.children].sort(byFlow)
  // Buttons inside a popup never open another one (validated at edit time),
  // so nested configs render plain here — no opener is ever emitted.
  const geom = (k: PlacedNode): string =>
    `{ id: ${JSON.stringify(k.id)}, x: ${k.x}, y: ${k.y}, cols: ${k.cols}, rows: ${k.rows} }`
  const open = `openModal === ${JSON.stringify(modal.id)}`
  const change = `onOpenChange={(o) => setOpenModal(o ? ${JSON.stringify(modal.id)} : null)}`
  const shell = `<OSBModal ${cfgOf(modal.config)} cols={${modal.cols}} rows={${modal.rows}} open={${open}} ${change}`
  if (kids.length === 0) return `${shell} />`
  const rendered = kids
    .map((k) => `        if (id === ${JSON.stringify(k.id)}) return <${tagFor(k.type)} ${cfgOf(k.config)} />`)
    .join('\n')
  return `${shell}>\n      <OSBModalBody cols={${modal.cols}} rows={${modal.rows}} kids={[${kids.map(geom).join(', ')}]} renderKid={(id) => {\n${rendered}\n        return null\n      }} />\n    </OSBModal>`
}

/**
 * Canvas doc -> publishable React page. v1 emits semantic flow order
 * (top-to-bottom, left-to-right); grid coordinates are a composition aid,
 * not published layout. Configs embed via JSON so text can never break
 * out into markup — the JSON is always correct AND the React is too.
 * Tags/imports derive from the registry, so a new node type is added once.
 * Children render nested inside their container. Popups render after the
 * page behind one shared piece of state: which popup (if any) is open.
 */
export function generatePage(doc: CanvasDoc): string {
  const valid = new Set(doc.nodes.filter((n) => n.type in OSB_REGISTRY).map((n) => n.id))
  const roots = doc.nodes
    .filter((n) => n.type in OSB_REGISTRY && n.type !== 'modal' && (n.parentId === null || !valid.has(n.parentId)))
    .sort(byFlow)
  const modals = modalsOf(doc)
  const modalIds = new Set(modals.map((m) => m.id))
  const header = modals.length > 0 ? `import { useState } from 'react'\n${baseHeader}` : baseHeader
  const body = roots
    .map((n) => {
      const kids = doc.nodes
        .filter((k) => k.parentId === n.id && k.type in OSB_REGISTRY)
        .sort(byFlow)
      return `      ${renderNode(n, kids, modalIds)}`
    })
    .join('\n')
  const popupLayer = modals.map((m) => `      ${renderModal(m)}`).join('\n')
  const stateLine = modals.length > 0 ? '\n  const [openModal, setOpenModal] = useState(null)' : ''
  const layers = [body, popupLayer].filter((s) => s.length > 0).join('\n')
  return `${header}\nexport default function SitePage() {${stateLine}
  return (
    <main>
${layers}
    </main>
  )
}
`
}
