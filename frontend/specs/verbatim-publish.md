# Verbatim Publish — Source of Truth

This file is the single authority on the canvas/publish contract. Where it
conflicts with older code, comments, or docs, this file wins — including the
PRD: §5.4 ("visual guides do not determine published layout") and §13.2
("arbitrary coordinate placement is not the default") are OVERRIDDEN by §1
below. `nesting-rules.md` still owns structure (what nests where); this file
owns fidelity (what publish looks like).

## 1. Principle

**What the user sees while editing is what ships, minus editing features.**
The canvas arrangement is a promise: a node at cells (x, y, cols, rows) must
appear at that place, at that size, in the published page. The current split
— free-form geometry on the canvas, order-only flow at publish — breaks that
promise silently (three cards arranged in a row publish as three stacked
rows). Anything else is a trust bug, not a layout preference.

"Minus editing features" is exhaustive and closed — §4 lists every pixel the
editor may draw that publish must not.

## 2. Non-goals

- This file does not change what nests where (`nesting-rules.md` still rules).
- This file does not design mobile reflow — §6 records it as the one open
  decision, with a recommendation.
- This file does not add components, knobs, or patterns.

## 3. Contract rules

### R1 — Geometry is the doc, and the doc is complete

Every placed node already carries integer cells (x, y, cols, rows) gated by
R1–R4. Publish reads them for EVERY node — root, container child, overlay
child — never just overlays. `siteObject` keeps footprints on all nodes; a
manifest node without geometry is invalid for publish (see §7, pin P3).

### R2 — One mapping from cells to pixels, shared everywhere

- Horizontal: percent of the 32-column grid (`left = x/32*100%`,
  `width = cols/32*100%`) — the exact `overlayChildStyle` rule overlays
  already ship, generalized to every parent.
- Vertical: rows × `CELL_PX` (canonical 28px — the existing
  `OVERLAY_CELL_PX`, promoted to the single constant both surfaces import).
- A page's height is its content extent (max child bottom + pad) × `CELL_PX`.
  No other sizing input exists: drop size = canvas size = published size.

### R3 — Style isolation: equal computed styles, modulo chrome

A node must compute the same styles in the canvas and in the published page:
same Tailwind build, same fonts, same line-heights. Builder chrome CSS
(`canvas.css`, header/drawer styles) must never leak into node boxes — any
leak is a verbatim bug, caught by §7 pin P5. The component sources stay the
single source of truth (already true); this rule extends it to the styles
they compute under.

### R4 — Text wraps identically at equal widths; widths are pinned, not wished

Text is the stress case: same box + same font metrics ⇒ same line breaks ⇒
same height. Horizontal percent boxes scale cleanly across desktop widths,
but fixed row heights do not reflow text that wraps more at narrower px
widths — a tier that fits 3 lines at 1440px may need 4 at 1024px and clip
(or disagree with the canvas, which is the verbatim break this rule exists
to prevent). So equal-width rendering is exact, and the widths it is exact
at are enumerated, not assumed: the P5 pin runs at 1280 / 1440 / 1920, and
a wrapping divergence at any of them is a red test. The author fixes it the
way they would on the canvas today — wider box or shorter copy. Min-height
boxes (floor + grow) are rejected: they trade clipping for overlap, which is
a second betrayal, not a fix. Row inference (flex rows from y-overlap) is
rejected for this contract: reading rows out of free geometry reintroduces
the pixel-magic this file exists to avoid — a later epic, not this one.

### R5 — Containers are mini-canvases, not flow boxes

Card, carousel, and columns children are absolutely positioned on the canvas
today and flowed at publish today — the same betrayal at smaller scale.
Under this contract every parent renders percent boxes (the `OSBOverlayBody`
pattern generalized). Consequences, stated plainly:

- Card `padding` stays a pure visual inset (as on the canvas); flow gaps die.
- Carousel slides keep full-bleed track behavior (slides are already boxes).
- Columns keeps its job: explicit responsive grouping (stacks that reflow
  tier-by-tier on phones). Position-dealing stays — it now agrees with the
  canvas thirds instead of reinterpreting them.

### R6 — Empty states render their shells, never editor hints

Dashed empty-hint slots, drop ghosts, and landing highlights are editor
chrome (§4) and never publish. An empty container publishes its bare shell
(card chrome, carousel track, columns grid) — which is what the canvas shows
underneath the hint.

## 4. Editor chrome inventory (publishes nothing on this list)

Dot guides, neon backdrop, selection outlines, resize handles, Remove
buttons, drop ghosts, red conflict flashes, empty-hint slots, the header bar,
the settings drawer, overlay-editor scaffolding. The pin (§7, P7) enumerates
these as forbidden selectors in published output.

## 5. Worked example (normative)

Doc: three 6×5 cards at x = 0, 6, 12. Canvas shows three tiers side by side.
Publish renders three absolute boxes at left 0% / 18.75% / 37.5%, each
18.75% wide — the columns screenshot (`qa-pricing-tiers.png`) is the visual
record of this exact case. Any future change that stacks them is a contract
violation, caught by pin P5 before a human ever looks.

## 6. Open decision: viewports narrower than the grid

Absolute percent boxes scale horizontally without breaking, but fixed
`CELL_PX` row heights cannot reflow text that wraps more at 390px — strict
verbatim is impossible on phones (this is why every site builder compromises
here). Options:

- (a) **Stack below `md:`** (RECOMMENDED): single-column flow under 768px,
  tier-by-tier like columns already do. Deviates from verbatim on phones in
  exchange for usability; desktop — where the promise is made — stays exact.
  Compatible with PRD §13.7 (one page, breakpoint behavior, not a second site).
- (b) **Scaled stage**: `transform: scale()` the desktop layout to fit.
  Pixel-verbatim everywhere, unreadably small text on phones. Rejected unless
  someone asks for posters, not pages.
- (c) **Per-breakpoint overrides**: editor stores alternate geometry per
  breakpoint. Full power, full complexity — a later epic, not this contract.

Until (a)/(c) is chosen, desktop-exact is the contract and narrow screens
must at minimum never clip, overlap, or overflow (the existing 390px
no-overflow edge coverage stays green).

## 7. Pinning (how this contract is tested)

| Pin | Layer | Assertion |
|-----|-------|-----------|
| P1 | unit | `siteObject` keeps x/y/cols/rows on every node; card/container kids included. Round-trip: doc → manifest → geometry identical. |
| P2 | unit | Engine renders every node as a percent box per R2 (left/width %, top/height px). No flow positioning remains in `OSBNodeView`. |
| P3 | unit | `validateSite` rejects publish manifests with missing/non-integer geometry. |
| P4 | unit | Style isolation: the set of stylesheets that match a node box is identical in builder and template builds (no `canvas.css` leakage). |
| P5 | e2e | **Canvas-vs-published equivalence** (the money test): seed doc → canvas in preview mode with selection cleared → per-node boxes; mount the same manifest → per-node boxes. Compare in CELL units (canvas box ÷ measured pitch vs mount box ÷ `CELL_PX`): x, y, cols, rows equal within sub-pixel epsilon. Runs at **1280 / 1440 / 1920** viewports (R4): a wrapping divergence at any width fails. Fails on any drift. |
| P6 | e2e | **Screenshot pair**: preview-canvas baseline + mount baseline for the same doc (the pricing tiers). Committed baselines; any pixel change on either surface forces human review. P5 catches silent drift, P6 catches visible-but-geometrically-equal regressions (fonts, colors, wrapping). |
| P7 | e2e | Forbidden-chrome scan: none of the §4 selectors exist in mounted output. |

P5 is the behavior pin; P6 is the eyeball pin. Neither compares the two
surfaces' pixels to each other (brittle, needs new deps) — P5 compares
numbers, P6 pins each surface independently.

## 8. Blast radius (for the implementation plan, not this file)

Engine flow removal, `siteObject` footprints everywhere, validation
tightening, every committed snapshot regenerates, `nesting-rules.md` gains a
fidelity pointer, PRD §§5.4/13.2 marked overridden. The columns container
survives — its value moves from "only way to get side-by-side" to "explicit
responsive grouping."
