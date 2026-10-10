import { useMemo, useRef, useState } from 'react'
import GridLayout, {
  useContainerWidth,
  type Compactor,
  type Layout,
  type LayoutItem,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './canvas.css'
import { OSB_NODE_TYPES, OSB_REGISTRY, type OSBNodeType } from '../osb/registry'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import ConfigDrawer from './ConfigDrawer'
import { loadDoc, currentProjectName, storageKey, canPlace, type CanvasDoc } from './doc'
import { clearProjectSlug } from '../lib/project'
import { GRID_COLS, GRID_MARGIN_X, GRID_MARGIN_Y, canvasMetrics, minGridWidth } from './grid'
import { pushDoc } from './push'
import { useDebouncedEffect } from './useDebouncedEffect'

// Free-form grid: no auto-compact, no overlap, colliding moves snap back.
const noOverlap: Compactor = {
  type: null,
  allowOverlap: false,
  preventCollision: true,
  compact: (layout) => layout,
}

export default function CanvasPage() {
  const [projectName] = useState(currentProjectName)
  const key = storageKey(projectName)
  const [doc, setDoc] = useState<CanvasDoc>(() => loadDoc(key))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const { width, containerRef, mounted } = useContainerWidth()
  // One query owns every resolution-dependent size (cell, dots, scroll height).
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 856
  const { cell, dotRows, height } = canvasMetrics(width, viewportHeight, doc.nodes)
  // Palette drag type travels in a ref, not dataTransfer (reliable in tests).
  const dragType = useRef<OSBNodeType | null>(null)

  // Debounced persist; key is the project name from onboarding.
  useDebouncedEffect(() => {
    localStorage.setItem(key, JSON.stringify(doc))
  }, [doc, key], 500)

  const layout: Layout = useMemo(
    () =>
      doc.nodes.map((n) => {
        const g = OSB_REGISTRY[n.type].grid
        const item: LayoutItem = {
          i: n.id,
          x: n.x,
          y: n.y,
          w: n.cols,
          h: n.rows,
          minW: g.minCols,
          minH: g.minRows,
          maxW: g.maxCols,
          maxH: g.maxRows,
        }
        return item
      }),
    [doc],
  )

  const commit = (next: Layout) => {
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.map((n) => {
        const l = next.find((m) => m.i === n.id)
        return l ? { ...n, x: l.x, y: l.y, cols: l.w, rows: l.h } : n
      }),
    }))
  }

  const onDrop = (_layout: Layout, item: LayoutItem | undefined) => {
    const type = dragType.current
    dragType.current = null
    if (!type || !item) return
    const g = OSB_REGISTRY[type].grid
    const rect = { x: item.x, y: item.y, cols: g.cols, rows: g.rows }
    // KISS: overlaps never land; the user rearranges manually.
    if (!canPlace(doc.nodes, rect)) return
    setDoc((d) => ({ ...d, nodes: [...d.nodes, { id: crypto.randomUUID(), type, config: {}, ...rect }] }))
  }

  const selected = doc.nodes.find((n) => n.id === selectedId) ?? null
  const side = selected && selected.x + selected.cols / 2 >= GRID_COLS / 2 ? 'left' : 'right'

  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <header className="flex h-14 items-center gap-2 border-b border-slate-200 px-3">
        <Badge data-testid="canvas-project" variant="secondary" className="font-mono">
          {projectName}
        </Badge>
        {OSB_NODE_TYPES.map((t) => (
          <Button
            key={t}
            data-testid={`palette-${t}`}
            variant="outline"
            size="sm"
            draggable
            onPointerDown={() => {
              dragType.current = t
            }}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', t)
            }}
            className="cursor-grab"
          >
            {OSB_REGISTRY[t].name}
          </Button>
        ))}
        <span className="ml-auto text-xs text-slate-400">Drag onto the canvas · drag to move · corner to resize</span>
        {pushMsg && (
          <span data-testid="push-status" className="text-xs text-slate-500">
            {pushMsg}
          </span>
        )}
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
        <Button
          size="sm"
          disabled={pushing || doc.nodes.length === 0}
          onClick={() => {
            setPushing(true)
            setPushMsg('Pushing…')
            pushDoc(doc, projectName)
              .then((r) => {
                setPushMsg(r.ok ? `Pushed ${r.commit!.slice(0, 7)}` : `Push failed: ${r.error}`)
              })
              .catch((e) => setPushMsg(`Push failed: ${String(e)}`))
              .finally(() => setPushing(false))
          }}
        >
          {pushing ? 'Pushing…' : 'Push'}
        </Button>
      </header>

      <main data-testid="canvas" onClick={() => setSelectedId(null)} className="relative h-[calc(100vh-3.5rem)] overflow-auto">
        <div ref={containerRef} style={{ minWidth: minGridWidth(), height }} className="relative">
          <div className="canvas-backdrop pointer-events-none absolute inset-0" />
          <div
            aria-hidden
            data-testid="canvas-dots"
            className="canvas-dots absolute left-0 top-0"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, ${cell}px)`,
              gridAutoRows: `${cell}px`,
              gap: `${GRID_MARGIN_X}px`,
              width: GRID_COLS * cell + GRID_MARGIN_X * (GRID_COLS - 1),
            }}
          >
            {Array.from({ length: GRID_COLS * dotRows }, (_, i) => (
              <i key={i} className="canvas-dot" />
            ))}
          </div>
        {doc.nodes.length === 0 && (
          <div
            data-testid="canvas-empty"
            className="pointer-events-none fixed bottom-0 left-0 right-0 top-14 flex flex-col items-center justify-center gap-1"
          >
            <p className="text-sm font-medium text-slate-500">Drag a component here to start building</p>
            <p className="text-xs text-slate-400">
              {OSB_NODE_TYPES.map((t) => OSB_REGISTRY[t].name).join(' · ')} from the bar above
            </p>
          </div>
        )}
        {mounted && (
          <GridLayout
            width={width}
            layout={layout}
            className="min-h-full"
            gridConfig={{ cols: GRID_COLS, rowHeight: cell, margin: [GRID_MARGIN_X, GRID_MARGIN_Y], containerPadding: [0, 0] }}
            compactor={noOverlap}
            dropConfig={{ enabled: true, defaultItem: { w: 10, h: 10 } }}
            onDropDragOver={() => {
              const t = dragType.current
              return t ? { w: OSB_REGISTRY[t].grid.cols, h: OSB_REGISTRY[t].grid.rows } : false
            }}
            onDrop={onDrop}
            resizeConfig={{ handles: ['se'] }}
            onDragStop={commit}
            onResizeStop={commit}
          >
            {doc.nodes.map((n) => (
              <div
                key={n.id}
                data-testid="canvas-node"
                data-type={n.type}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedId(n.id)
                }}
                className={n.id === selectedId ? 'canvas-selected h-full' : 'h-full'}
              >
                {OSB_REGISTRY[n.type].render(n.config)}
              </div>
            ))}
          </GridLayout>
        )}
        </div>
      </main>

      {selected && (
        <ConfigDrawer
          key={selected.id}
          node={selected}
          side={side}
          onClose={() => setSelectedId(null)}
          onApply={(id, config) =>
            setDoc((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, config } : n)) }))
          }
        />
      )}
    </div>
  )
}
