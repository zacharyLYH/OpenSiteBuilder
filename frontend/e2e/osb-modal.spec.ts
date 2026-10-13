import { defineOverlaySuite } from './overlay-journey'

// Popup journey through the shared overlay factory: kind + shots + slugs
// are the only modal-specific facts. Baselines keep their osb-modal names.
defineOverlaySuite({
  kind: 'modal',
  shotPrefix: 'osb-modal',
  slug: 'e2e-modal',
  titleWord: 'modal',
  fillFx: 9.5 / 12,
  outsideClick: { x: 40, y: 400 },
  variants: [],
})
