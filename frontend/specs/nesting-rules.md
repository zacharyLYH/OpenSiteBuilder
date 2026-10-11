# Nesting & Layout Rules — Source of Truth

This file is the single authority on canvas structure, sizing, placement,
and validation. It replaces all prior layout beliefs. Where it conflicts
with older code, comments, or docs, this file wins.

## 1. Model: atoms, containers, patterns

- **Atom** — a visible leaf with no children: text (`p`), button, image.
  Minimum footprint 1x1. The only things a user can see on the canvas.
- **Container** — an empty canvas with chrome only (background, padding,
  radius, shadow). No intrinsic content. The only containers are the
  **page root** and **card**. There is no `section` type (see §8).
- **Collection-backed** — inspector-edited data with no canvas children
  (marquee items, accordion rows, dropdown options). Unchanged.
- **Pattern** — a palette recommendation, not a node type: a factory that
  inserts a container pre-filled with ordinary atoms (e.g. "Card" = card +
  title text + body text + button). After insert, everything is regular
  nodes. The palette holds atoms plus patterns; a bare empty card is never
  a starting point (it is what remains after children are deleted).

Depth is at most root > container > atom. Containers never go inside
containers. The root holds cards and loose atoms directly.

## 2. Sizing: the box is the component

The 1x1 cell is the unit. Every atom's grid footprint (`cols`/`rows`)
**equals its rendered size**, always in whole cells. Drop size = render
size. There is no independent "visual size" vs "layout size".

- Resizing an atom remaps to its config (text width, button size
  variant), never to empty padding. A bigger box means a bigger-looking
  component, and vice versa.
- A container's floor is its children's bounding box plus padding.
  Shrinking under it is rejected. Growing over a sibling is an overlap
  and is rejected (no absorb).

## 3. Placeability: the only reasons a drop is rejected

One predicate owns highlight, drop accept/reject, and file validation.
No per-component branches. A placement is rejected iff any holds:

- **R1 KIND** — atoms only inside containers; containers only at root;
  never container-in-container; collection-backed kinds never on canvas.
- **R2 CONTAINMENT** — the full child rect sits inside the parent inner
  rect (root: within canvas columns). Sticking out is rejected.
- **R3 EXCLUSIVITY** — siblings never overlap. Touching edges is fine
  (and required by §5).
- **R4 INTEGRITY** — rect is well-formed: integer coords, ≥ 1x1, ≥ the
  atom's declared minimum.

Nesting is child-driven only: dragging a container over an existing node
never absorbs it. Hit-testing uses the dragged item's center point
against the container rect.

## 4. Cohesion: if you can see it, it is a node or a style prop

Containers render chrome plus their children layer — nothing else. Atoms
render themselves. Ghost content is forbidden: no `actionLabel` phantom
button, no hero/navbar prop-rendered buttons, no title/body props that
render text. Pattern factories create those as real child nodes at
insert time, so the doc layer always knows where everything is.

## 5. Contiguity validator (site.json)

Within each sibling set (the root, and inside each container), rects
must form **one edge-connected patch**: every node shares at least a
partial edge segment with another node, transitively. Corner-only
contact does not count. Zero or one node is vacuously valid. Gaps and
islands fail validation.

Rationale: real sites are dense contiguous blocks; sparse scattered
layouts are almost always misdrops. Overlap is already rejected by §3;
this rule rejects the opposite failure (drift). Enforcement: editor
treats a disconnected drop as invalid with a reason; `site.json`
validation rejects disconnected docs.

## 6. Division of responsibility

- **Canvas** owns structure: add, move, resize (roots via grid handles,
  nested atoms via SE handle), reorder, delete. The only way to change
  what is where. Rejected gestures say why in the header (overlap, gap,
  …), never fail silently.
- **Sidebar** owns non-spatial props only: text content, styling
  (variant, theme, shadow, alignment), links, image sources. It never
  creates, moves, resizes, or deletes nodes, and never does spatial
  editing.

## 7. Adding a component

1. Atom or container or collection-backed? (Patterns need no new kind.)
2. Atom: footprint in whole cells equal to render size + min size.
   Container: chrome props only. Pattern: factory composing existing
   nodes — no new engine concepts.
3. Empty-state hint for containers (canvas only).
4. What the publisher already knows how to render.
5. New props reuse existing sidebar field types (text, select, theme)
   — never a custom spatial editor.

If it cannot be described with this vocabulary, extend the vocabulary
once for everyone — never branch one component.

## 8. Deprecated — do not revive

- **Section type.** Users compose space with cards and atoms directly.
- **Slots as fixed template regions.** Containers are free canvas, not
  pre-cut holes; "no slot where I want it" cannot happen.
- **Parent-owned allowlists of specific types.** Replaced by R1 (kind +
  depth only). Any atom may go in any container.
- **Side panel structural editing** (Add-child, spatial controls).
- **Ghost internals** (prop-rendered buttons/text that are not nodes).
- **Footprint ≠ render size** (big box, small pill).
- **Sparse layouts as valid.** Replaced by the §5 contiguity rule.
- **Container-in-container / recursion.** Still forbidden (depth ≤ 1).
