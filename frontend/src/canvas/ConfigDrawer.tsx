import { useState } from 'react'
import { OSB_REGISTRY } from '../osb/registry'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { Textarea } from '../components/ui/textarea'
import { isFieldVisible, type OSBField } from '../osb/types'
import type { PlacedNode } from './doc'

/** The one control per field kind — the field itself carries its options. */
function FieldControl({
  field,
  value,
  onChange,
}: {
  field: OSBField
  value: unknown
  onChange: (v: string | boolean) => void
}) {
  const id = `osb-field-${field.key}`
  const text = typeof value === 'string' ? value : (value ?? '').toString()
  if (field.kind === 'longtext')
    return <Textarea id={id} rows={3} value={text} onChange={(e) => onChange(e.target.value)} />
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
  const edit = (key: string, value: string | boolean) => {
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
        className="overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{entry.name} settings</SheetTitle>
          <SheetClose asChild>
            <Button type="button" aria-label="Close settings" variant="outline" size="sm">
              ✕
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="pointer-events-none overflow-hidden rounded-md border border-slate-200">
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
      </SheetContent>
    </Sheet>
  )
}
