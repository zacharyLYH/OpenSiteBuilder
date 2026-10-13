import { describe, it, expect } from 'vitest'
import { generatePage } from './codegen'
import type { CanvasDoc } from './doc'

const doc = (nodes: CanvasDoc['nodes']): CanvasDoc => ({ version: 1, nodes })
const R = (id: string, type: CanvasDoc['nodes'][number]['type'], x = 0, y = 0, cols = 4, rows = 2) => ({
  id,
  type,
  config: {},
  parentId: null as unknown as null,
  x,
  y,
  cols,
  rows,
})

describe('generatePage', () => {
  it('emits imports + one tag per node in flow order (y, then x)', () => {
    const out = generatePage(
      doc([
        { ...R('b', 'button', 9, 0, 3, 1), config: { label: 'Go' } },
        { ...R('a', 'text', 0, 0, 8, 2), config: { text: 'Hi' } },
        { ...R('c', 'card', 0, 5, 12, 10) },
      ]),
    )
    expect(out).toContain(`import OSBText from './osb/OSBText'`)
    expect(out).toContain(`export default function SitePage()`)
    const text = out.indexOf('<OSBText')
    const button = out.indexOf('<OSBButton')
    const card = out.indexOf('<OSBCard')
    expect(text).toBeGreaterThan(-1)
    expect(button).toBeGreaterThan(-1)
    // Same row: left (text x=0) before right (button x=9); card row below.
    expect(text).toBeLessThan(button)
    expect(button).toBeLessThan(card)
  })

  it('nests children inside their container tag', () => {
    const out = generatePage(
      doc([
        { ...R('card1', 'card', 0, 0, 12, 10) },
        { id: 'b1', type: 'button', config: { label: 'Go' }, parentId: 'card1', x: 1, y: 1, cols: 4, rows: 1 },
      ]),
    )
    const open = out.indexOf('<OSBCard')
    const child = out.indexOf('<OSBButton')
    const close = out.indexOf('</OSBCard>')
    expect(open).toBeGreaterThan(-1)
    expect(child).toBeGreaterThan(open)
    expect(close).toBeGreaterThan(child)
  })

  it('embeds configs as JSON so text cannot break markup', () => {
    const out = generatePage(
      doc([{ ...R('a', 'button'), config: { label: 'Say "hi" </main>' } }]),
    )
    expect(out).toContain(`config={{"label":"Say \\"hi\\" </main>"}}`)
    // The payload sits inside a JS expression container, never raw JSX text.
    expect(out).not.toContain('>Say "hi"')
  })

  it('drops unknown types and renders an empty shell for empty docs', () => {
    const out = generatePage(
      doc([{ id: 'a', type: 'audio' as never, config: {}, parentId: null, x: 0, y: 0, cols: 1, rows: 1 }]),
    )
    expect(out).not.toContain('<OSBVideo')
    expect(out).toContain('<main className=')
    expect(generatePage(doc([]))).toContain('<main className=')
  })

  it('wraps the one global theme around the page (never per node)', () => {
    const light = generatePage(doc([{ ...R('a', 'text'), config: { text: 'Hi' } }]))
    expect(light).toContain(`import { OSBThemeProvider } from './osb/OSBTheme'`)
    expect(light).toContain('<OSBThemeProvider theme="light">')
    expect(light).toContain('bg-white text-slate-900')
    // No per-node theme leaks into configs anymore.
    expect(light).not.toContain('"theme"')

    const dark = generatePage({ ...doc([{ ...R('a', 'text') }]), theme: 'dark' })
    expect(dark).toContain('<OSBThemeProvider theme="dark">')
    expect(dark).toContain('bg-slate-950 text-slate-50')
  })
})
