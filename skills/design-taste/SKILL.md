---
name: design-taste
description: Keep OSB component visuals current with modern UI taste
---

# Design taste

Use me when adding or restyling an OSB component (`frontend/src/osb/`), or
when a component starts looking dated. I keep visuals current without
expanding the prop surface (PRD §2.1).

## Inputs (verify URLs before subscribing; taste only, never install)

- Component libraries: shadcn/ui, Tailwind CSS, Headless UI, DaisyUI,
  Mantine, Chakra UI (links already vetted in `frontend/src/osb/README.md`).
- Reference taste: Vercel, Linear, Stripe marketing/product pages.
- One gallery: Mobbin (real-app UI reference, filter by pattern).
- One links digest: Sidebar (short daily design links — skim, don't binge).
- Rule: at most one gallery + one digest. More inputs = more noise.

## How to apply

1. Steal values, not components: spacing, radius, contrast pairs, type scale.
2. Translate into OSB vocabulary: static class maps + `XxxConfig` defaults
   + existing `OSBField` kinds. No new knob without deleting one.
3. No interpolated class strings (PRD §6.6). Complete literals only.
4. Prove it with a screenshot case in `frontend/e2e/` (`CASES` list), never
   prose. Old shots must still pass unless the change is intentional.

## Anti-patterns

- Chasing every trend; restyle at most one component family per pass.
- Bespoke CSS per component; tokens and maps first.
- Dated tells: heavy gradients, tiny radius on big surfaces, gray-on-gray
  body text, centered everything, stock hero blobs.

## Refresh

Skim inputs when touching visuals; do a full pass only when 2+ components
look stale side by side.
