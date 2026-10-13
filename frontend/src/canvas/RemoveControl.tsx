import { Button } from '../components/ui/button'

/**
 * THE one "Remove" affordance for a selected canvas node. The root shell and
 * the shared child layer both render this control; callers own only its testid
 * and positioning classes, so the two never drift. It is a view-only overlay
 * control: the click never reaches the node underneath (stopPropagation).
 *
 * Built on the shadcn `Button` like the rest of the builder chrome; the size
 * overrides are deliberate — these controls sit inside a node's clipped box,
 * so they stay as small as the node's own content.
 */
export default function RemoveControl({
  testid,
  id,
  onRemove,
  className,
}: {
  testid: string
  id: string
  onRemove: (id: string) => void
  className: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid={testid}
      aria-label="Remove element"
      onClick={(e) => {
        e.stopPropagation()
        onRemove(id)
      }}
      className={className}
    >
      Remove
    </Button>
  )
}
