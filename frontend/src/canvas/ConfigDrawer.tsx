import { useState } from 'react'
import { OSB_REGISTRY } from '../osb/registry'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { Textarea } from '../components/ui/textarea'
import type { PlacedNode } from './doc'
import { useDebouncedEffect } from './useDebouncedEffect'

function FieldControl({
  id,
  kind,
  options,
  value,
  onChange,
}: {
  id: string
  kind: string
  options?: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  if (kind === 'longtext') {
    return <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  if (kind === 'select' && options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (kind === 'theme') {
    return (
      <div className="flex gap-1 rounded-md bg-slate-100 p-1">
        {['light', 'dark'].map((t) => (
          <Button
            key={t}
            type="button"
            variant={value === t ? 'default' : 'secondary'}
            size="sm"
            onClick={() => onChange(t)}
            className="flex-1 capitalize"
          >
            {t}
          </Button>
        ))}
      </div>
    )
  }
  return <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
}

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
  const [dirty, setDirty] = useState(false)

  // Draft commits back on a debounce, but only after a real edit —
  // selecting a node must never rewrite its stored config.
  useDebouncedEffect(() => {
    if (dirty) onApply(node.id, draft)
  }, [draft, dirty, node.id], 300)

  return (
    <Sheet
      open
      modal={false}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <SheetContent side={side} data-testid="config-drawer" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{entry.name} settings</SheetTitle>
          <SheetClose asChild>
            <Button type="button" aria-label="Close settings" variant="outline" size="sm">
              ✕
            </Button>
          </SheetClose>
        </SheetHeader>
        <Badge variant="secondary" className="w-fit capitalize">
          {node.type}
        </Badge>
        <div className="pointer-events-none overflow-hidden rounded-md border border-slate-200">
          {entry.render(draft)}
        </div>
        {entry.fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <Label htmlFor={`osb-field-${f.key}`}>{f.label}</Label>
            <FieldControl
              id={`osb-field-${f.key}`}
              kind={f.kind}
              options={f.kind === 'select' ? f.options : undefined}
              value={String(draft[f.key] ?? '')}
              onChange={(v) => {
                setDirty(true)
                setDraft((d) => ({ ...d, [f.key]: v }))
              }}
            />
            {f.hint && <p className="text-xs text-slate-500">{f.hint}</p>}
          </div>
        ))}
      </SheetContent>
    </Sheet>
  )
}
