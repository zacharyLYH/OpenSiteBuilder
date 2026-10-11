# OSB user components

Components end users put on their sites. All prefixed `OSB` to separate them
from the builder's own UI (`src/components/`). Two kinds only: atoms
(`OSBText`, `OSBButton`, `OSBImage` — the visible leaves) and one container
(`OSBCard` — empty chrome with no intrinsic content). Named compositions
(card with content, …) are patterns in `patterns.ts`: factories that insert
ordinary nodes, not new types. There are no ghost internals — if the user can
see it, it is a node. Light + dark are the only themes — every config has a
`theme` key, rendered via explicit class maps (no ambient `.dark` ancestor,
no interpolated class strings per PRD §6.6).

## Config rule

Each component declares `XxxConfig` + `XXX_DEFAULTS`, takes
`config?: Partial<XxxConfig>`, merges via `resolveConfig`. Missing key =>
default. To add a knob: interface + defaults + render. Nothing else.

## Registry

`registry.tsx` (`OSB_REGISTRY`) is the single record of node types: each type
name is written once as a key. `OSBNodeType`, `OSB_NODE_TYPES`, defaults, and
rendering all derive from it — nothing is re-declared elsewhere.
Insert menu / editor / publisher all read it — no per-component branches.

## Sizing rule

The grid box is the component: every atom fills its footprint, so the
bounding box never disagrees with the render. Footprints are whole cells
(see `specs/nesting-rules.md`).

## Screenshots

One Playwright spec per component in `frontend/e2e/` (`osb-button.spec.ts`, …),
one screenshot per case (`osb-button-primary.png`, …) so failures are easy to
parse and specs parallelize cleanly. Edge cases are encoded AS DATA in the spec
(a `CASES` list of `SiteNode`s) and mounted through the generic dev-only
`/osb-mount` harness (`mount.tsx`, rendered by `App.tsx` in DEV only), which
knows nothing per-component. Run: `npm run test:e2e`.

## Sources we leach from

Tailwind-based, source-available React component code we adapt (not install)
styling/patterns from. Licenses checked 2026; re-verify before copying.

| Library | License | What we take |
|---|---|---|
| [shadcn/ui](https://ui.shadcn.com) (+ Radix primitives) | MIT | Button/typography scale, `cva` variant pattern, `cn()` merging |
| [Tailwind UI / Catalyst](https://tailwindui.com) (paid) | Commercial — reference only, do NOT copy | Visual taste, spacing/radius choices |
| [Headless UI](https://headlessui.com) | MIT | Accessible interaction patterns (later: menu/dialog) |
| [DaisyUI](https://daisyui.com) | MIT | Theme-token approach (we keep 2 themes only) |
| [Mantine](https://mantine.dev) | MIT | Defaults-per-prop API shape |
| [Chakra UI](https://chakra-ui.com) | MIT | Semantic tone scales (muted text etc.) |

Rule: copy the *values* (spacing, contrast pairs) into our static class maps,
keep OSB props minimal per PRD §2.1.
