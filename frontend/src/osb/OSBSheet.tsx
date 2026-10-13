import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

/**
 * Transplanted from shadcn/ui `sheet.tsx` (MIT, Radix variant via the shadcn
 * registry). A Sheet IS a Dialog: same Radix wiring (modal focus trap,
 * scroll lock, Escape + outside-press dismiss), only the panel docks to an
 * edge and slides in instead of zooming center-screen. Deliberate adaptations
 * for OpenSiteBuilder, each marked ADAPT below:
 *
 * ADAPT-1 (icon): `X` from lucide-react is inlined as XIcon with lucide's
 *   exact X paths, so the published template needs no extra dependency.
 * ADAPT-2 (theme): shadcn's `bg-background` / `border` tokens come from
 *   ambient CSS vars, which OSB does not have — drawer themes are explicit
 *   per-drawer configs. Neutral slate bases live here; callers override
 *   colors through `className` (tailwind-merge), exactly how shadcn
 *   consumers customize.
 * ADAPT-3 (width): shadcn's fixed `w-3/4 sm:max-w-sm` is dropped for the
 *   side variants OSB uses as an overlay shell. Panel width comes from the
 *   shell footprint via `style`, so shells stay resizable.
 * ADAPT-4 (close): `showCloseButton` (default true) mirrors the dialog
 *   base — OSB drawers hide it via the `showClose` drawer setting.
 *
 * This is the ONE sheet copy the canvas settings panel renders and publish
 * ships (see OSB README: single source of truth — the dialog base lives
 * at ./OSBDialog the same way).
 */

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    data-slot="sheet-overlay"
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  'fixed z-50 flex flex-col gap-4 bg-white p-4 shadow-xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b border-slate-200 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 border-t border-slate-200 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full border-r border-slate-200 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        right:
          'inset-y-0 right-0 h-full border-l border-slate-200 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  showCloseButton?: boolean
  /**
   * ADAPT-5 (editor panel): the canvas settings drawer reuses this Sheet
   * non-modally (`modal={false}`) as a persistent side panel — no dim, no
   * extra X (it owns its own close control). User-facing drawers keep the
   * shadcn default `true` (overlay + X, the dismiss contract).
   */
  showOverlay?: boolean
}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = 'right', className, children, showCloseButton = true, showOverlay = true, ...props }, ref) => (
    <SheetPortal>
      {showOverlay && <SheetOverlay />}
      <SheetPrimitive.Content ref={ref} data-slot="sheet-content" className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-slate-400 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100">
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  ),
)
SheetContent.displayName = SheetPrimitive.Content.displayName

/** Lucide's X, inlined (see ADAPT-1). */
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="sheet-header" className={cn('flex items-center justify-between', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="sheet-footer" className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} data-slot="sheet-title" className={cn('text-sm font-semibold text-slate-900', className)} {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} data-slot="sheet-description" className={cn('text-sm text-slate-500', className)} {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
