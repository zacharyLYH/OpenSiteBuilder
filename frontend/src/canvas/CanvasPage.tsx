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
import { Input } from '../components/ui/input'
import ConfigDrawer from './ConfigDrawer'
import { loadDoc, projectSlug, storageKey, canPlace, type CanvasDoc, type PlacedNode } from './doc'
import { clearProjectSlug } from '../lib/project'
import { GRID_COLS, GRID_MARGIN_X, GRID_MARGIN_Y, minGridWidth, rowHeightFor } from './grid'
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
  const [slug] = useState(projectSlug)
  const key = storageKey(slug)
  const [doc, setDoc] = useState<CanvasDoc>(() => loadDoc(key))
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const { width, containerRef, mounted } = useContainerWidth()
  // True square cells: row height equals column width at any resolution.
  // The wrapper enforces the band minimum so RGL never measures too narrow.
  const cell = width > 0 ? rowHeightFor(width) : 48
  const dotRows = Math.max(
    30,
    ...doc.nodes.map((n) => n.y + n.rows + 8),
  )
  // Definite height so the empty grid is a real drop target and grows with content.
  const mainH = typeof window !== 'undefined' ? window.innerHeight - 56 : 800
  const bottom = doc.nodes.reduce((m, n) => Math.max(m, n.y + n.rows), 0)
  const wrapH = Math.max(mainH, bottom * (cell + GRID_MARGIN_Y) + 64)
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

  const onDrop = (next: Layout, item: LayoutItem | undefined) => {
    void next
    if (!item) return
    const type = dragType.current
    dragType.current = null
    if (!type || !(type in OSB_REGISTRY)) return
    const g = OSB_REGISTRY[type].grid
    const rect = { x: item.x, y: item.y, cols: g.cols, rows: g.rows }
    // KISS: overlaps never land; the user rearranges manually.
    if (!canPlace(doc.nodes, rect)) return
    const node: PlacedNode = { id: crypto.randomUUID(), type, config: {}, x: rect.x, y: rect.y, cols: g.cols, rows: g.rows }
    setDoc((d) => ({ ...d, nodes: [...d.nodes, node] }))
  }

  const selected = doc.nodes.find((n) => n.id === selectedId) ?? null
  const side = selected && selected.x + selected.cols / 2 >= GRID_COLS / 2 ? 'left' : 'right'
  const visible = OSB_NODE_TYPES.filter((t) =>
    OSB_REGISTRY[t].name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <header className="flex h-14 items-center gap-2 border-b border-slate-200 px-3">
        <Badge data-testid="canvas-project" variant="secondary" className="font-mono">
          {slug}
        </Badge>
        <Input
          aria-label="Find a component"
          placeholder="Find a component…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-44"
        />
        {visible.map((t) => (
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
            pushDoc(doc, slug)
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
        <div ref={containerRef} style={{ minWidth: minGridWidth(), height: wrapH }} className="relative">
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
            <p className="text-xs text-slate-400">Card · Hero · Button from the bar above</p>
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
              if (!t || !(t in OSB_REGISTRY)) return false
              const g = OSB_REGISTRY[t].grid
              return { w: g.cols, h: g.rows }
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
