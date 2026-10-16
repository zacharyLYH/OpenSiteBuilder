// V2 plain canvas: the manifest as a vertical list. No grid, no cells, no
// RGL — order in each children array IS the layout. Palette adds, gaps show
// where, click selects, bottom bar moves/deletes, Push ships the manifest.
import { useContext, useEffect, useState } from 'react'
import { OSB_PALETTE_TYPES, OSB_REGISTRY, isContainerType, type OSBNodeType } from '../osb/registry'
import { OSBThemeProvider, useSiteThemeClass } from '../osb/OSBTheme'
import type { OSBTheme } from '../osb/types'
import type { SiteNode } from '../site/types'
import { clearProjectSlug, getProjectSlug } from '../lib/project'
import { Button } from '../components/ui/button'
import ConfigDrawer from '../canvas/ConfigDrawer'
import { useListDoc } from './store'
import { pushManifest } from './push'
import { DragCtx, Gap, type Landing } from './dnd'
import { canHold, checkMove, findNode, parentOf } from './ops'

type PushState = { kind: 'busy' | 'ok' | 'error'; text: string } | null

function NodeView({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: SiteNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}): React.ReactNode {
  const entry = OSB_REGISTRY[node.type]
  const kids = node.children ?? []
  const { setPayload, setRejected } = useContext(DragCtx)
  // Empty containers show one gap + hint: the only way anything lands inside.
  const inner =
    kids.length === 0 && isContainerType(node.type) ? (
      <>
        <Gap to={{ parentId: node.id, index: 0 }} />
        <p className="text-xs text-slate-400">Drop here</p>
      </>
    ) : (
      <>
        {kids.map((k, i) => (
          <span key={k.id} style={{ display: 'contents' }}>
            <Gap to={{ parentId: node.id, index: i }} />
            <NodeView node={k} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          </span>
        ))}
        {kids.length > 0 && <Gap to={{ parentId: node.id, index: kids.length }} />}
      </>
    )
  const body = kids.length > 0 || isContainerType(node.type) ? inner : undefined
  return (
    <div
      data-testid="canvas-node"
      data-type={node.type}
      data-id={node.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/osb-node', node.id)
        e.dataTransfer.effectAllowed = 'move'
        setRejected(null)
        setPayload(node.id)
      }}
      onDragEnd={() => setPayload(null)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.id)
      }}
      className={node.id === selectedId ? 'canvas-selected outline outline-2 outline-teal-600' : undefined}
    >
      {entry.render(node.config, body)}
    </div>
  )
}

export default function ListCanvas() {
  const [projectName] = useState(getProjectSlug)
  const { doc, insert, move, remove, configure } = useListDoc(projectName)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [push, setPush] = useState<PushState>(null)
  const [complaint, setComplaint] = useState<string | null>(null)
  const [payload, setPayload] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [rejected, setRejected] = useState<string | null>(null)
  // No project cookie means no doc and no name: send the user home.
  useEffect(() => {
    if (!projectName) window.location.href = '/'
  }, [projectName])
  const nodes = doc.pages[0]?.nodes ?? []
  const theme: OSBTheme = doc.site?.theme === 'dark' ? 'dark' : 'light'
  useSiteThemeClass(theme)
  if (!projectName) return null

  const say = (reason: string, at?: { parentId: string | null; index: number }) => {
    setComplaint(reason)
    setRejected(at ? `${at.parentId ?? 'root'}:${at.index}` : null)
    window.setTimeout(() => {
      setComplaint(null)
      setRejected(null)
    }, 2600)
  }

  // Live hover verdict: the same gate the drop enforces, so the halo never
  // lies. Palette types judge against the current tree; existing nodes judge
  // as moves (cycle + hold on the without-tree, via checkMove).
  const judge = (p: string, to: Landing): boolean => {
    if (p.startsWith('new:')) return canHold(doc.pages[0]?.nodes ?? [], to.parentId, p.slice(4) as OSBNodeType) === null
    return checkMove(doc, p, to.parentId) === null
  }

  // Every drop lands here: existing nodes move, palette types insert fresh.
  // Rejections voice AND halo the refusing gap — never silent, never invisible.
  const land = (p: string, to: Landing) => {
    if (p.startsWith('new:')) {
      const type = p.slice(4) as OSBNodeType
      const id = crypto.randomUUID()
      const bad = insert(to.parentId, to.index, { id, type, config: {} })
      if (bad) return say(bad, to)
      setSelectedId(id)
      return
    }
    const bad = move(p, to.parentId, to.index)
    if (bad) say(bad, to)
  }

  const add = (type: OSBNodeType) => {
    const id = crypto.randomUUID()
    const parentId = targetId
    const siblings = parentId ? (findNode(doc, parentId)?.children ?? []) : nodes
    const bad = insert(parentId, siblings.length, { id, type, config: {} })
    if (bad) return say(bad)
    setSelectedId(id)
  }

  const selected = selectedId ? findNode(doc, selectedId) : null

  const onPush = async () => {
    if (push?.kind === 'busy') return
    setPush({ kind: 'busy', text: 'Pushing…' })
    const r = await pushManifest(doc)
    setPush(r.ok ? { kind: 'ok', text: `Pushed ${r.commit.slice(0, 7)}` } : { kind: 'error', text: r.error })
  }

  return (
    <OSBThemeProvider theme={theme}>
      <DragCtx.Provider value={{ payload, setPayload, hover, setHover, rejected, setRejected, judge, land }}>
      <header className="flex h-14 items-center gap-2 overflow-x-auto border-b border-slate-200 px-3">
        <span data-testid="canvas-project" className="font-mono text-xs text-slate-500">
          {projectName}
        </span>
        {OSB_PALETTE_TYPES.map((t) => (
          <Button
            key={t}
            data-testid={`palette-${t}`}
            variant="outline"
            size="sm"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', t)
              setRejected(null)
              setPayload(`new:${t}`)
            }}
            onDragEnd={() => setPayload(null)}
            onClick={() => add(t)}
          >
            {OSB_REGISTRY[t].name}
          </Button>
        ))}
        <Button
          data-testid="add-card"
          variant="outline"
          size="sm"
          onClick={() => {
            const id = crypto.randomUUID()
            const bad = insert(null, nodes.length, { id, type: 'card', config: {} })
            if (bad) return say(bad)
            setSelectedId(id)
          }}
        >
          Card
        </Button>
        {complaint && (
          <span data-testid="drop-message" role="status" className="text-xs font-medium text-rose-600">
            {complaint}
          </span>
        )}
        {push && (
          <span data-testid="push-status" role="status" className="text-xs text-slate-600">
            {push.text}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearProjectSlug()
              window.location.href = '/'
            }}
          >
            Exit project
          </Button>
          {/* Never disables mid-click: a button that disables itself on
              mousedown traps assistive tech and test clicks in a retry loop.
              Double-submit is guarded in onPush instead. */}
          <Button data-testid="push" size="sm" disabled={nodes.length === 0} onClick={onPush}>
            {push?.kind === 'busy' ? 'Pushing…' : 'Push'}
          </Button>
        </div>
      </header>
      {/* No click-to-deselect on the canvas: settings live in a portal, and
          portal clicks bubble through the React tree — a canvas-level deselect
          would murder the drawer on every field click. Deselect explicitly
          via the drawer's Close button. */}
      <main className="mx-auto max-w-3xl p-4">
        {nodes.length === 0 && <p className="text-sm text-slate-400">Blank page. Add text, a button, or a card above.</p>}
        {nodes.map((n, i) => (
          <span key={n.id} style={{ display: 'contents' }}>
            <Gap to={{ parentId: null, index: i }} />
            <NodeView node={n} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
          </span>
        ))}
        <Gap to={{ parentId: null, index: nodes.length }} />
        {selected && (
          <ConfigDrawer
            key={selected.id}
            node={selected}
            side="right"
            onClose={() => setSelectedId(null)}
            onApply={(_id, patch) => {
              const bad = configure(selected.id, patch)
              if (bad) say(bad)
            }}
          />
        )}
        {selected && (
          <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-white px-3 py-2 shadow-lg">
            <span className="text-xs text-slate-500">{selected.type}</span>
            {(() => {
              // Only offer moves that can land: nesting needs a sibling
              // container, and only containers take new children. Anything
              // else would voice a rejection the bar itself invited.
              const parentId = parentOf(doc, selected.id)
              const scope = parentId ? (findNode(doc, parentId)?.children ?? []) : nodes
              const nestTarget = scope.filter((n) => n.id !== selected.id && isContainerType(n.type)).pop()
              return (
                <>
                  {nestTarget && (
                    <Button
                      data-testid="nest-in"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const bad = move(selected.id, nestTarget.id, 99)
                        if (bad) say(bad)
                      }}
                    >
                      Nest
                    </Button>
                  )}
                  {isContainerType(selected.type) && (
                    <Button data-testid="target-here" variant="outline" size="sm" onClick={() => setTargetId(selected.id)}>
                      Add inside
                    </Button>
                  )}
                </>
              )
            })()}
            <Button
              data-testid="remove-node"
              variant="outline"
              size="sm"
              onClick={() => {
                const bad = remove(selected.id)
                if (bad) return say(bad)
                setSelectedId(null)
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </main>
      </DragCtx.Provider>
    </OSBThemeProvider>
  )
}
