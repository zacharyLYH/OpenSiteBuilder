import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './OSBDropdownMenu'
import { useOSBTheme } from './OSBTheme'
import { resolveConfig, type OSBField, type OSBMenuItem } from './types'

/** Preferred side for the panel. `auto` is Radix's own default (below);
 * either way the panel still flips rather than run off the screen. */
export type OSBDropdownDirection = 'auto' | 'bottom' | 'top' | 'right' | 'left'

export type OSBDropdownConfig = {
  /** Trigger button text. */
  label: string
  /** Menu options — inspector-edited data, never canvas nodes (PRD §6.2). */
  items: OSBMenuItem[]
  direction: OSBDropdownDirection
}

export const OSB_DROPDOWN_DEFAULTS: OSBDropdownConfig = {
  label: 'Menu',
  items: [],
  direction: 'auto',
}

/** The one option list behind the "Opens" drawer field. */
export const OSB_DROPDOWN_DIRECTIONS: { value: OSBDropdownDirection; label: string }[] = [
  { value: 'auto', label: 'Automatically' },
  { value: 'bottom', label: 'Below' },
  { value: 'top', label: 'Above' },
  { value: 'right', label: 'To the right' },
  { value: 'left', label: 'To the left' },
]

export const OSB_DROPDOWN_FIELDS: OSBField[] = [
  { key: 'label', label: 'Menu label', kind: 'text', required: true },
  {
    key: 'items',
    label: 'Menu items',
    hint: 'Add the options visitors can pick.',
    kind: 'items',
    // The row shape lives with the field, so the ONE items editor renders a
    // menu row and a card row without a second control.
    itemFields: [
      { key: 'label', label: 'Item label', placeholder: 'Label' },
      { key: 'link', label: 'Item link', placeholder: 'Link' },
    ],
    // A menu row may hold one nested list — its submenu (MENU_MAX_DEPTH).
    subItems: true,
  },
  {
    key: 'direction',
    label: 'Opens',
    hint: 'The menu still flips when it would run off the screen.',
    kind: 'select',
    options: OSB_DROPDOWN_DIRECTIONS,
  },
]

/** One canvas row, in px — the height a one-row trigger fills. */
const ROW_PX = 40
/** Menu text at scale 1 (text-sm), and the widest the panel follows its trigger. */
const MENU_FONT_REM = 0.875
const MENU_MAX_W = 320

/**
 * The trigger fills its grid box, but the options are portaled outside it, so
 * they cannot inherit that box the way a button does. Follow the trigger's
 * rendered size instead, so resizing a dropdown resizes its items too (box is
 * the component). Half the box's growth keeps a menu a menu: one row reads
 * normal, two rows is 1.5x, three rows or more caps at 2x. jsdom has no
 * ResizeObserver, so tests just see the 1x panel.
 */
function useTriggerBox(ref: RefObject<HTMLButtonElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // offsetWidth/Height, not getBoundingClientRect: a grid drag/resize scales
    // the item with a transform, and only the committed size may count.
    const measure = () => setBox({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

export interface OSBDropdownProps {
  config?: Partial<OSBDropdownConfig>
  children?: ReactNode
}

/** Options render as plain items; a row with children renders as a submenu
 * instead — it opens rather than navigates, so its own link is ignored.
 * Nesting stops at one submenu level (MENU_MAX_DEPTH). */
function renderItems(items: OSBMenuItem[], fontSize: string, minWidth?: number): ReactNode[] {
  return items.map((item, i) => {
    const kids = item.children
    if (kids !== undefined && kids.length > 0)
      return (
        <DropdownMenuSub key={i}>
          <DropdownMenuSubTrigger style={{ fontSize: 'inherit' }}>{item.label}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent style={{ fontSize, minWidth }}>{renderItems(kids, fontSize, minWidth)}</DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    // The option text follows the panel's size, not its own text-sm.
    return (
      <DropdownMenuItem key={i} asChild={item.link.length > 0} style={{ fontSize: 'inherit' }}>
        {item.link.length > 0 ? <a href={item.link}>{item.label}</a> : <span>{item.label}</span>}
      </DropdownMenuItem>
    )
  })
}

export default function OSBDropdown({ config }: OSBDropdownProps) {
  const c = resolveConfig(OSB_DROPDOWN_DEFAULTS, config)
  const theme = useOSBTheme()
  const label = c.label.length === 0 ? 'Menu' : c.label
  // A corrupt config may carry no items array; treat anything else as empty.
  const items = Array.isArray(c.items) ? c.items : []
  const triggerRef = useRef<HTMLButtonElement>(null)
  const box = useTriggerBox(triggerRef)
  const scale = Math.min(2, Math.max(1, (box.h / ROW_PX + 1) / 2))
  const fontSize = `${(MENU_FONT_REM * scale).toFixed(3)}rem`
  const minWidth = box.w > 0 ? Math.min(box.w, MENU_MAX_W) : undefined
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          data-testid="osb-dropdown-trigger"
          style={{ fontSize }}
          className={
            theme === 'dark'
              ? 'inline-flex h-full w-full items-center justify-center gap-2 rounded-md bg-slate-50 px-4 font-medium text-slate-900 hover:bg-slate-200'
              : 'inline-flex h-full w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 font-medium text-slate-50 hover:bg-slate-900/90'
          }
        >
          {label}
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      {items.length > 0 && (
        <DropdownMenuContent side={c.direction === 'auto' ? undefined : c.direction} style={{ minWidth, fontSize }}>
          {renderItems(items, fontSize, minWidth)}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}

