import { describe, it, expect } from 'vitest'
import { generatePage } from './codegen'
import type { CanvasDoc } from './doc'

const doc = (nodes: CanvasDoc['nodes']): CanvasDoc => ({ version: 1, nodes })

describe('generatePage', () => {
  it('emits imports + one tag per node in flow order (y, then x)', () => {
    const out = generatePage(
      doc([
        { id: 'b', type: 'button', config: { label: 'Go' }, x: 9, y: 0, cols: 3, rows: 1 },
        { id: 'a', type: 'hero', config: { title: 'Hi' }, x: 0, y: 0, cols: 8, rows: 4 },
        { id: 'c', type: 'card', config: {}, x: 0, y: 5, cols: 4, rows: 3 },
      ]),
    )
    expect(out).toContain(`import OSBHero from './osb/OSBHero'`)
    expect(out).toContain(`export default function SitePage()`)
    const hero = out.indexOf('<OSBHero')
    const button = out.indexOf('<OSBButton')
    const card = out.indexOf('<OSBCard')
    expect(hero).toBeGreaterThan(-1)
    expect(button).toBeGreaterThan(-1)
    // Same row: left (hero x=0) before right (button x=9); card row below.
    expect(hero).toBeLessThan(button)
    expect(button).toBeLessThan(card)
  })

  it('embeds configs as JSON so text cannot break markup', () => {
    const out = generatePage(
      doc([{ id: 'a', type: 'button', config: { label: 'Say "hi" </main>' }, x: 0, y: 0, cols: 3, rows: 1 }]),
    )
    expect(out).toContain(`config={{"label":"Say \\"hi\\" </main>"}}`)
    // The payload sits inside a JS expression container, never raw JSX text.
    expect(out).not.toContain('>Say "hi"')
  })

  it('drops unknown types and renders an empty shell for empty docs', () => {
    const out = generatePage(
      doc([{ id: 'a', type: 'video' as never, config: {}, x: 0, y: 0, cols: 1, rows: 1 }]),
    )
    expect(out).not.toContain('<OSBVideo')
    expect(out).toContain('<main>')
    expect(generatePage(doc([]))).toContain('<main>')
  })
})
