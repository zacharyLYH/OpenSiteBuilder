import { useState } from 'react'
import { OSB_REGISTRY } from '../osb/registry'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { Textarea } from '../components/ui/textarea'
import type { OSBField } from '../osb/types'
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
  if (field.kind === 'theme')
    return (
      <div className="flex gap-1 rounded-md bg-slate-100 p-1">
        {['light', 'dark'].map((t) => (
          <Button
            key={t}
            type="button"
            variant={text === t ? 'default' : 'secondary'}
            size="sm"
            onClick={() => onChange(t)}
            className="flex-1 capitalize"
          >
            {t}
          </Button>
        ))}
      </div>
    )
  return <Input id={id} value={text} onChange={(e) => onChange(e.target.value)} />
}

// Style-only inspector: text content and chrome (variant, theme, alignment).
// Structure (add / move / resize / delete) lives on the canvas alone — this
// drawer never creates, moves, resizes, or deletes nodes.
export default function ConfigDrawer({
  node,
  side,
  onClose,
  onApply,
}: {
  node: PlacedNode
  side: 'left' | 'right'
  onClose: () => void
  onApply: (id: string, config: Record<string, unknown>) => void
}) {
  const entry = OSB_REGISTRY[node.type]
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...entry.defaults, ...node.config })
  // Selecting a node never rewrites its stored config — only a real edit does.
  const edit = (key: string, value: string | boolean) => {
    const next = { ...draft, [key]: value }
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
        {entry.fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <Label htmlFor={`osb-field-${f.key}`}>{f.label}</Label>
            <FieldControl field={f} value={draft[f.key]} onChange={(v) => edit(f.key, v)} />
            {f.hint && <p className="text-xs text-slate-500">{f.hint}</p>}
          </div>
        ))}
      </SheetContent>
    </Sheet>
  )
}
