import { useState } from 'react'
import { OSB_REGISTRY } from '../osb/registry'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { cn } from '../lib/utils'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { Sheet, SheetClose, SheetHeader, SheetTitle, SheetPortal } from '../components/ui/sheet'
import { Textarea } from '../components/ui/textarea'
import { isFieldVisible, MENU_MAX_DEPTH, type OSBField, type OSBMenuItem } from '../osb/types'
import type { PlacedNode } from './doc'

/** Repeatable label + link rows (dropdown options, …). Collection-backed data
 * lives in config, never on the canvas (PRD §6.2). A row may hold one nested
 * list — its submenu — and MENU_MAX_DEPTH stops the nesting there. */
function ItemsEditor({
  items,
  onChange,
  depth = 0,
}: {
  items: OSBMenuItem[]
  onChange: (items: OSBMenuItem[]) => void
  depth?: number
}) {
  const set = (i: number, patch: Partial<OSBMenuItem>) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div data-testid="osb-item-row" className="flex items-center gap-2">
            <Input aria-label="Item label" placeholder="Label" value={it.label} onChange={(e) => set(i, { label: e.target.value })} />
            <Input aria-label="Item link" placeholder="Link" value={it.link} onChange={(e) => set(i, { link: e.target.value })} />
            {depth + 1 < MENU_MAX_DEPTH && (
              <Button
                type="button"
                aria-label="Add sub-item"
                variant="outline"
                size="sm"
                onClick={() => set(i, { children: [...(it.children ?? []), { label: '', link: '' }] })}
              >
                ↳
              </Button>
            )}
            <Button type="button" aria-label="Remove item" variant="outline" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ✕
            </Button>
          </div>
          {it.children !== undefined && it.children.length > 0 && (
            <div data-testid="osb-sub-items" className="ml-3 border-l border-slate-200 pl-3">
              <ItemsEditor items={it.children} onChange={(next) => set(i, { children: next })} depth={depth + 1} />
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        data-testid="osb-add-item"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { label: '', link: '' }])}
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
  onChange: (v: string | boolean | OSBMenuItem[]) => void
}) {
  const id = `osb-field-${field.key}`
  const text = typeof value === 'string' ? value : (value ?? '').toString()
  if (field.kind === 'longtext')
    return <Textarea id={id} rows={3} value={text} onChange={(e) => onChange(e.target.value)} />
  if (field.kind === 'items')
    return <ItemsEditor items={Array.isArray(value) ? (value as OSBMenuItem[]) : []} onChange={onChange} />
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
  const edit = (key: string, value: string | boolean | OSBMenuItem[]) => {
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
      {/* Non-modal settings panel: composed from Radix primitives (not
          SheetContent) because a settings panel wants neither overlay nor X —
          it has its own Close button below. Positioning classes mirror
          shadcn's sheet; V2 rewrites this panel outright. */}
      <SheetPortal>
        <SheetPrimitive.Content
          data-testid="config-drawer"
          onOpenAutoFocus={(e) => e.preventDefault()}
          // A settings panel, not an overlay shell: it keeps a fixed width, or a
          // full-bleed preview (a video's intrinsic width) would swallow the canvas.
          className={cn(
            'fixed z-50 gap-4 bg-white p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 dark:bg-slate-950',
            side === 'left'
              ? 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm'
              : 'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
            'w-full max-w-sm overflow-y-auto',
          )}
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
            exception — a video's whole job is to play, so it stays clickable. */}
        <div className="pointer-events-none overflow-hidden rounded-md border border-slate-200 [&_video]:pointer-events-auto">
          {entry.render(draft)}
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
      </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  )
}
