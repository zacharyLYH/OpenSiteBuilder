# OSB user components

Components end users put on their sites. All prefixed `OSB` to separate them
from the builder's own UI (`src/components/`). Three kinds: atoms
(`OSBText`, `OSBButton`, `OSBImage`, `OSBVideo`, `OSBDropdown` — the visible
leaves; collection-backed components like the dropdown keep their items in
config, never as canvas nodes), containers (`OSBCard` — empty chrome with no
intrinsic content), and overlays
(`OSBModal`, `OSBDrawer` — shells in `overlays[]`, opened from triggers).
Named compositions
(card with content, …) are patterns in `patterns.ts`: factories that insert
ordinary nodes, not new types. There are no ghost internals — if the user can
see it, it is a node. Light + dark are the only themes, and theme is GLOBAL:
the canvas sets it from the document (header control) and the published page
sets it from `site.theme`; components read it via `useOSBTheme` (see
`OSBTheme.tsx`). No per-component theme config, no ambient `.dark` ancestor,
no interpolated class strings (PRD §6.6).

## Config rule

Each component declares `XxxConfig` + `XXX_DEFAULTS`, takes
`config?: Partial<XxxConfig>`, merges via `resolveConfig`. Missing key =>
default. To add a knob: interface + defaults + render. Nothing else.

### Single source of truth (canvas == engine == publish)

There is no generated code. The visual builder renders these components through
`OSB_REGISTRY.render(...)`; the published site renders them through
`OSBRuntime` (which looks the same registry up by node type); and `push.ts`
ships these exact source files. One copy, two consumers — never re-implement a
component for the publish path. Concretely:

- Every drawer `select`'s options are the **same exported list** the render
  reads (e.g. `OSB_BUTTON_VARIANTS`, `OSB_TEXT_HEADINGS`), never a second
  hand-kept list.
- New config keys arrive as `config` JSON on both paths automatically, so a
  new knob needs no codegen change. Theme is the exception: it is global, so
  it travels as `site.theme` / the `OSBThemeProvider`, never inside a node.
- Older saved docs keep loading: `resolveConfig` fills missing keys from
  defaults, and `OSBButton` normalizes the pre-shadcn `primary`/`md` values.

### Dependencies in shipped components

Anything an `OSB*` component imports is either shipped (`../lib/utils.ts`,
`osb/types.ts`, other `OSB*` files) or must be a dependency of the publish
**template** (`template/package.json` + lock), because the published repo
installs from there. That is why `class-variance-authority` (the shadcn `cva`
mechanism) is in the template. To keep a dependency a *new* component adds
working in an older user repo, publish also ships `template/package.json` +
`template/package-lock.json` (they travel as a pair — `npm ci` needs both).

## Shadcn vocabulary

Where shadcn has a component we **vendor its source** (not just the values)
and adapt it for OSB, keeping a short `ADAPT-n` note per change. The two
adaptations are always the same: (1) shadcn CSS-var tokens → explicit slate +
`theme` prop (no ambient `.dark`), and (2) OSB-only renderer requirements
(fill-the-grid-box, free-form child nodes, extra emphasis variants).

- **Button** — shadcn `buttonVariants` copied through `cva`: `default`,
  `secondary`, `destructive`, `outline`, `ghost`, `link`; sizes
  `sm`/`default`/`lg`. Dark is an OSB-only axis overlaid by one full class
  string per variant; the button fills its grid box instead of a fixed height.
- **Card** — shadcn `card.tsx` vendored wholesale: `Card`, `CardHeader`,
  `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`
  with their `data-slot` markers and `gap-6`/`py-6`/`px-6` rhythm. The OSB
  container uses `Card` as its shell and drops flow children into
  `CardContent`; on the canvas children are overlaid on the same shell. Four
  user knobs layer on top: emphasis variant, corner radius, elevation, and
  inner spacing (defaults reproduce shadcn).
- **Dialog / Popup** — shadcn `dialog.tsx` vendored in `OSBDialog.tsx`
  (Radix wiring, overlay, focus trap, animations, close); `OSBModal` adds the
  OSB axes (variant/theme/showClose, resizable footprint).
- **Dropdown / Menu** — shadcn `dropdown-menu.tsx` vendored in
  `OSBDropdownMenu.tsx`. Options are inspector-edited config data
  (`config.items`), never canvas nodes: a row with `children` is a submenu
  (one level, `MENU_MAX_DEPTH`), and the "Opens" field picks the preferred
  side — Radix still flips the panel rather than let it run off screen. The
  trigger fills its grid box like a button (so a dropdown defaults to button
  size), and because the panel is portaled outside that box it follows the
  trigger's rendered size instead — resizing the node resizes its items too,
  capped at 2x.
- **Text** — shadcn typography scale for H1–H6, plus bold/italic, font family
  (`font-sans`/`serif`/`mono`) and a `bg-clip-text` gradient tone.

## Registry

`registry.tsx` (`OSB_REGISTRY`) is the single record of node types: each type
name is written once as a key. `OSBNodeType`, `OSB_NODE_TYPES`, defaults, and
rendering all derive from it — nothing is re-declared elsewhere. It is a pure
lookup table: types, defaults, fields, grids, kind/trigger/chrome metadata, and
a `render`. It holds no preview or overlay-rendering logic — that lives in the
engine.
Insert menu / editor / engine all read it — no per-component branches.

## The engine (`OSBRuntime.tsx`)

The player half of "player + manifest". The canvas no longer emits `.jsx`; it
emits a `site.json` manifest (`frontend/src/site/types.ts`), and the published
site imports it and hands it to `OSBRuntime`. The engine walks the node tree,
looks each `type` up in `OSB_REGISTRY`, and renders the matching component —
`OSBNodeView` recurses containers, `OSBOverlayView` renders overlay manifest
nodes through the shared `OSBOverlayShell` (the shadcn dialog/sheet; chrome
comes from the registry, so a new kind needs no engine edit), and a trigger
atom gets its overlay opener from `config.targetId`. If the JSON is valid, the
site renders: there is no string-crammed markup to break. The screenshot
harness (`mount.tsx`) and the editor's Test button both render through the same
`OSBNodeView` / `OSBOverlayShell`, so canvas preview, screenshots, and the
published site agree by construction.

## Sizing rule

The grid box is the component: every atom fills its footprint, so the
bounding box never disagrees with the render. Footprints are whole cells
(see `specs/nesting-rules.md`).

## Screenshots

One Playwright spec per component in `frontend/e2e/` (`osb-button.spec.ts`, …),
one screenshot per case (`osb-button-default.png`, …) so failures are easy to
parse and specs parallelize cleanly. Edge cases are encoded AS DATA in the spec
(a `CASES` list of `SiteNode`s) and mounted through the generic dev-only
`/osb-mount` harness (`mount.tsx`, rendered by `App.tsx` in DEV only), which
knows nothing per-component. Run: `npm run test:e2e`.

## Sources we leach from

Tailwind-based, source-available React component code we adapt (not install)
styling/patterns from. Licenses checked 2026; re-verify before copying.

| Library | License | What we take |
|---|---|---|
| [shadcn/ui](https://ui.shadcn.com) (+ Radix primitives) | MIT | Vendored Button (`cva`), Card slots, Dialog, typography scale, `cn()` merging |
| [Tailwind UI / Catalyst](https://tailwindui.com) (paid) | Commercial — reference only, do NOT copy | Visual taste, spacing/radius choices |
| [Headless UI](https://headlessui.com) | MIT | Accessible interaction patterns (later: menu/dialog) |
| [DaisyUI](https://daisyui.com) | MIT | Theme-token approach (we keep 2 themes only) |
| [Mantine](https://mantine.dev) | MIT | Defaults-per-prop API shape |
| [Chakra UI](https://chakra-ui.com) | MIT | Semantic tone scales (muted text etc.) |

Rule: for anything shadcn ships as a component, copy the *source* into this
folder, adapt only what OSB needs (explicit themes + renderer), and export one
option list per user-facing knob so the drawer and the render never drift.
Keep OSB props minimal per PRD §2.1.
