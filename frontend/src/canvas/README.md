# The canvas — where to look

The visual editor. One page, one document, one grid. Read this before the code.

If you are new here, read the files in this order. Each one is a single idea,
and later files only build on earlier ones.

| # | File | Owns | Read it when you need to know |
|---|------|------|-------------------------------|
| 1 | `grid.ts` | Sizes. Cells are true squares; the header height is `HEADER_PX`. | "how wide is a cell?" / "where does the canvas end?" |
| 2 | `doc.ts` | The document and every rule about it. | "may this node go here?" / "what does the file look like?" |
| 3 | `gesture.ts` | The verdict for a drag in flight. | "will this land, and who flashes red?" |
| 4 | `useCanvasDoc.ts` | Loading, saving, and the refs around the doc. | "where does the doc come from and go?" |
| 5 | `useDragSession.ts` | The armed drag + its transient feedback. | "what is being dragged right now?" |
| 6 | `CanvasPage.tsx` | The controller: selection + the gesture handlers. | "what happens when the user drops something?" |
| 7 | `CanvasStage.tsx` | The rendering: board, nodes, ghosts, bounds. | "why does it look like that?" |
| 8 | `CanvasHeader.tsx` | The app bar, the global theme + preview controls, and the checks panel. | "where do the buttons/messages live?" |
| 9 | `ConfigDrawer.tsx` | Non-spatial props (text, style, link). | "how does the settings panel work?" |
| 10 | `PlacedChildLayer.tsx` / `childResize.ts` | The shared child surface: percent boxes, selection chrome, and the one SE-resize gesture. | "how do card children and popup children render/drag/resize?" |
| 11 | `push.ts` | Publishing: doc → `site.json` manifest + the OSB runtime (no generated JSX). | "what actually ships to GitHub?" |
| 12 | `canvas.css` | Drag visuals. | "why is that border blue/red?" |

`../../specs/nesting-rules.md` (a sibling of `src/`) is the authority on
layout rules. Where this file and that one disagree, that one wins.

## The one thing to understand first

There are **two** kinds of drag on this canvas, and they are handled in
different files. Confusing them is the most common way to get lost.

- **HTML5 drag** — the browser's own drag. Started from the palette, or from a
  nested atom (an atom inside a card is `draggable`). The page sees
  `dragstart` / `dragover` / `drop`. This is what `CanvasPage`'s
  `onDrop` / `onRootDragOver` / `hoverContainer` / `containerDrop` handle.
- **RGL drag** — a pointer drag owned by `react-grid-layout` (RGL). Used for
  moving and resizing anything at the **root** of the page (cards and loose
  atoms). RGL reports positions through `onDrag`, `onDragStop`, `onResizeStop`.

Nothing else should need to know which is which; both end up asking the same
question, which is the next section.

## The data flow

Every gesture — palette drop, node move, nested resize — walks the same path:

```
pointer / RGL event
      │
      ▼
  plan* (gesture.ts)  ── the pointer's position becomes a cell rect,
      │                  which is routed to a parent and then JUDGED
      ▼
   plan.ok ?  ── no  ──▶  reject(reason)  ──▶  header says why, doc untouched
      │
     yes
      ▼
  insertNode / moveNode / insertPattern / removeNode  (doc.ts)
      │            ── the same gate runs again, so the op layer is safe alone
      ▼
   new CanvasDoc ──▶ useState ──▶ persisted (debounced) + re-rendered
```

Three consequences worth remembering:

1. **The preview and the landing read the same judge.** `gesture.ts` exposes
   one query (`planRoute` / `planAt`) and one verdict, so live feedback cannot
   disagree with the final result. If you change a rule, change it there.
2. **There is exactly one gate.** `canInsertReason` in `doc.ts` is the only
   thing that decides whether a placement is allowed. Everything else —
   hover, drop, file validation — calls it rather than re-checking rules.
3. **A refusal is never silent.** Rejected gestures leave the document
   untouched and put a plain-language reason in the header.

`PlacedChildLayer.tsx` + `childResize.ts` are the ONE implementation of "a
child inside a parent": the canvas container body and the popup editor render
the same markup and share the same resize gesture, differing only in the
testid vocabulary they pass in.

## Where things are written down

- Structure (what exists, and where) → the document, in `doc.ts`.
- Non-spatial per-node props (text, variant, settings, link) → `ConfigDrawer.tsx`.
- Global theme (light/dark) and the editor grid toggle → `CanvasHeader.tsx` +
  `OSBThemeProvider`; the theme is document state (`doc.theme`), the preview
  toggle is an editor-only preference.
- Styles and transient feedback → `canvas.css` + the `Feedback` object in
  `gesture.ts`.

## Two gotchas with the grid library

These are RGL behaviours, not ours, and they explain otherwise-odd code:

- **RGL keeps its own layout across gestures.** That is why the board is
  remounted with a fresh `key` (`epoch` from `useCanvasDoc`) after every
  gesture: without it, a refused drag lingers on screen as a phantom. It is
  also why `commit` persists *only* the item the user actually dragged.
- **RGL pulls a released item back inside the columns** but draws its drop
  placeholder from its own rounding. So `centeredCell` (`grid.ts`) clamps to
  the same bounds on purpose: a preview that offers a landing outside the
  canvas would otherwise contradict where the item ends up.
