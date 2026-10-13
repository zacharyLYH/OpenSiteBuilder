import { defineOverlaySuite } from './overlay-journey'

// Drawer journey through the shared overlay factory: kind + shots + slugs +
// the mount matrix are the only drawer-specific facts. Baselines keep their
// osb-drawer names.
defineOverlaySuite({
  kind: 'drawer',
  shotPrefix: 'osb-drawer',
  slug: 'e2e-drawer',
  titleWord: 'drawer',
  fillFx: 7.5 / 10,
  outsideClick: { x: 400, y: 400 },
  variants: [
    { name: 'default', config: {} },
    { name: 'left', config: { title: 'Menu', side: 'left' } },
    { name: 'outlined', config: { title: 'Menu', variant: 'outlined' } },
    { name: 'plain', config: { title: 'Menu', variant: 'plain' } },
    { name: 'no-close', config: { title: 'Menu', showClose: false } },
    { name: 'empty-fallback', config: { title: '' } },
    { name: 'dark-default', theme: 'dark', config: {} },
    { name: 'dark-left', theme: 'dark', config: { title: 'Menu', side: 'left' } },
  ],
  sideAssert: 'left-0',
})
