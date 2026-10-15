import { useState } from 'react'
import { gridBoxStyle } from '../osb/OSBOverlay'
import { OSB_REGISTRY } from '../osb/registry'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { Textarea } from '../components/ui/textarea'
import { isFieldVisible, MENU_MAX_DEPTH, type OSBField, type OSBFieldItemKey } from '../osb/types'
import type { PlacedNode } from './doc'

/** One collection row as the editor handles it: string keys plus an optional
 * nested list. The field declares which keys exist (`itemFields`). */
type ItemRow = Record<string, unknown>

/** A blank row for the field's declared keys — never a hardcoded shape. */
const blankRow = (itemFields: OSBFieldItemKey[]): ItemRow =>
  Object.fromEntries(itemFields.map((f) => [f.key, '']))

/** Repeatable rows for any collection-backed component: a dropdown's options,
 * a marquee's cards. The FIELD says which keys a row has,
 * so one editor serves them all (PRD §6.2: collection data lives in config,
 * never on the canvas). A row may hold one nested list — a menu's submenu —
 * and MENU_MAX_DEPTH stops the nesting there. */
function ItemsEditor({
  items,
  itemFields,
  subItems = false,
  onChange,
  depth = 0,
}: {
  items: ItemRow[]
  itemFields: OSBFieldItemKey[]
  subItems?: boolean
  onChange: (items: ItemRow[]) => void
  depth?: number
}) {
  const set = (i: number, patch: ItemRow) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => {
        const kids = subItems && Array.isArray(it.children) ? (it.children as ItemRow[]) : []
        return (
          <div key={i} className="flex flex-col gap-2">
            <div data-testid="osb-item-row" className="flex items-center gap-2">
              {itemFields.map((f) => (
                <Input
                  key={f.key}
                  aria-label={f.label}
                  placeholder={f.placeholder}
                  value={typeof it[f.key] === 'string' ? (it[f.key] as string) : ''}
                  onChange={(e) => set(i, { [f.key]: e.target.value })}
                />
              ))}
              {subItems && depth + 1 < MENU_MAX_DEPTH && (
                <Button
                  type="button"
                  aria-label="Add sub-item"
                  variant="outline"
                  size="sm"
                  onClick={() => set(i, { children: [...kids, blankRow(itemFields)] })}
                >
                  ↳
                </Button>
              )}
              <Button type="button" aria-label="Remove item" variant="outline" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
            {kids.length > 0 && (
              <div data-testid="osb-sub-items" className="ml-3 border-l border-slate-200 pl-3">
                <ItemsEditor
                  items={kids}
                  itemFields={itemFields}
                  subItems
                  onChange={(next) => set(i, { children: next })}
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        )
      })}
      <Button
        type="button"
        data-testid="osb-add-item"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, blankRow(itemFields)])}
      >
        ＋ Add item
      </Button>
    </div>
  )
}

/** The one control per field kind — the field itself carries its options. */
function FieldControl({
  field,
  value,
  onChange,
}: {
  field: OSBField
  value: unknown
  onChange: (v: string | boolean | number | ItemRow[]) => void
}) {
  const id = `osb-field-${field.key}`
  const text = typeof value === 'string' ? value : (value ?? '').toString()
  // A whole number the user steps (slide counts, timings). Out-of-range or
  // empty input is left to the owner, which clamps to its own bounds.
  if (field.kind === 'number') {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : field.min
    return (
      <Input
        id={id}
        type="number"
        min={field.min}
        max={field.max}
        step={1}
        value={n}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10)
          onChange(Number.isNaN(parsed) ? field.min : parsed)
        }}
      />
    )
  }
  if (field.kind === 'longtext')
    return <Textarea id={id} rows={3} value={text} onChange={(e) => onChange(e.target.value)} />
  if (field.kind === 'items')
    return (
      <ItemsEditor
        items={Array.isArray(value) ? (value as ItemRow[]) : []}
        itemFields={field.itemFields}
        subItems={field.subItems}
        onChange={onChange}
      />
    )
  if (field.kind === 'select')
    return (
      <Select value={text} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  if (field.kind === 'boolean')
    return (
      <Button
        id={id}
        type="button"
        role="switch"
        aria-checked={value === true}
        variant={value === true ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange(!(value === true))}
        className="w-20"
      >
        {value === true ? 'On' : 'Off'}
      </Button>
    )
  return <Input id={id} value={text} onChange={(e) => onChange(e.target.value)} />
}

// Style-only inspector: text content and chrome (variant, alignment). Theme is
// global (the header), never a per-node setting. Structure (add / move /
// resize / delete) lives on the canvas alone — this drawer never creates,
// moves, resizes, or deletes nodes. The optional
// `actions` slot lets the controller append node-type-specific intents
// (e.g. a button's popup attach) without branching the generic editor.
export default function ConfigDrawer({
  node,
  side,
  onClose,
  onApply,
  actions,
}: {
  node: PlacedNode
  side: 'left' | 'right'
  onClose: () => void
  onApply: (id: string, config: Record<string, unknown>) => void
  actions?: React.ReactNode
}) {
  const entry = OSB_REGISTRY[node.type]
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...entry.defaults, ...node.config })
  // Selecting a node never rewrites its stored config — only a real edit does.
  const edit = (key: string, value: string | boolean | number | ItemRow[]) => {
    const next = { ...draft, [key]: value }
    // A field that just hid (e.g. the link was cleared) must not keep a
    // stale value behind: hidden booleans fall back to their defaults.
    for (const f of entry.fields) {
      if (f.visibleWhen && f.kind === 'boolean' && !isFieldVisible(f, next)) {
        next[f.key] = entry.defaults[f.key]
      }
    }
    setDraft(next)
    onApply(node.id, next)
  }

  return (
    <Sheet
      open
      modal={false}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      {/* The panel never steals focus. Opening it because a node was selected
          must not move focus into the panel, or the canvas Delete hotkey would
          stop working the moment you select anything. */}
      <SheetContent
        side={side}
        data-testid="config-drawer"
        showOverlay={false}
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        // A settings panel, not an overlay shell: it keeps a fixed width, or a
        // full-bleed preview (a video's intrinsic width) would swallow the canvas.
        className="w-full max-w-sm overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{entry.name} settings</SheetTitle>
          <SheetClose asChild>
            <Button type="button" aria-label="Close settings" variant="outline" size="sm">
              ✕
            </Button>
          </SheetClose>
        </SheetHeader>
        {/* The preview is a thumbnail: clicks stay in the drawer. Media is the
            exception — a video's whole job is to play, so it stays clickable.
            A slotted container (carousel) is a fixed-grid box, so the preview
            gives it the flow box its slides are laid out in. */}
        <div className="pointer-events-none overflow-hidden rounded-md border border-slate-200 [&_video]:pointer-events-auto">
          {entry.slots ? (
            <div style={gridBoxStyle(node.cols, node.rows)}>{entry.render(draft)}</div>
          ) : (
            entry.render(draft)
          )}
        </div>
        {entry.fields.filter((f) => isFieldVisible(f, draft)).map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <Label htmlFor={`osb-field-${f.key}`}>
              {f.label}
              {f.required && (
                <span aria-hidden="true" className="ml-0.5 text-red-600">
                  *
                </span>
              )}
            </Label>
            <FieldControl field={f} value={draft[f.key]} onChange={(v) => edit(f.key, v)} />
            {f.hint && <p className="text-xs text-slate-500">{f.hint}</p>}
          </div>
        ))}
        {actions}
      </SheetContent>
    </Sheet>
  )
}
