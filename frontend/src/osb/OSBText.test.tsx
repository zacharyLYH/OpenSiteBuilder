import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import OSBText, {
  OSB_TEXT_DEFAULTS,
  OSB_TEXT_FIELDS,
  OSB_TEXT_FONTS,
  OSB_TEXT_HEADINGS,
  OSB_TEXT_TONES,
} from './OSBText'
import { OSBThemeProvider } from './OSBTheme'
import type { OSBField } from './types'

const selectOptions = (key: string): { value: string; label: string }[] => {
  const field = OSB_TEXT_FIELDS.find((f) => f.key === key) as OSBField | undefined
  if (!field || field.kind !== 'select') throw new Error(`expected a select field for ${key}`)
  return field.options
}

describe('OSBText rendering', () => {
  it('renders a paragraph by default', () => {
    const { container } = render(<OSBText config={{ text: 'Hello' }} />)
    expect(container.querySelector('p')?.textContent).toBe('Hello')
    expect(container.querySelector('h1')).toBeNull()
  })

  it('renders the matching semantic heading tag for every level', () => {
    for (const heading of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const) {
      const { container, unmount } = render(<OSBText config={{ text: 'T', heading }} />)
      expect(container.querySelector(heading)?.textContent).toBe('T')
      unmount()
    }
  })

  it('applies bold, italic and font classes', () => {
    const { container } = render(<OSBText config={{ text: 'T', bold: true, italic: true, font: 'mono' }} />)
    const p = container.querySelector('p')
    expect(p?.className).toContain('font-bold')
    expect(p?.className).toContain('italic')
    expect(p?.className).toContain('font-mono')
  })

  it('paints the gradient tone with the shadcn bg-clip-text recipe', () => {
    const { container } = render(<OSBText config={{ text: 'T', tone: 'gradient' }} />)
    const cls = container.querySelector('p')?.className ?? ''
    expect(cls).toContain('bg-clip-text')
    expect(cls).toContain('text-transparent')
    expect(cls).toContain('from-indigo-500')
  })

  it('reads the muted/primary tone from the GLOBAL theme (provider)', () => {
    const light = render(<OSBText config={{ text: 'T', tone: 'muted' }} />)
    expect(light.container.querySelector('p')?.className).toContain('text-slate-500')
    light.unmount()
    const dark = render(
      <OSBThemeProvider theme="dark">
        <OSBText config={{ text: 'T', tone: 'muted' }} />
      </OSBThemeProvider>,
    )
    expect(dark.container.querySelector('p')?.className).toContain('text-slate-400')
  })

  it('falls back to defaults for missing keys so old docs keep loading', () => {
    const { container } = render(<OSBText config={{}} />)
    expect(container.querySelector('p')?.textContent).toBe('Text')
  })
})

describe('OSBText registry shape (single source with the render)', () => {
  it('derives each select field from its exported option list', () => {
    expect(selectOptions('heading')).toEqual(OSB_TEXT_HEADINGS)
    expect(selectOptions('font')).toEqual(OSB_TEXT_FONTS)
    expect(selectOptions('tone')).toEqual(OSB_TEXT_TONES)
  })

  it('ships readable defaults', () => {
    expect(OSB_TEXT_DEFAULTS.heading).toBe('none')
    expect(OSB_TEXT_DEFAULTS.tone).toBe('default')
    expect(OSB_TEXT_DEFAULTS.bold).toBe(false)
  })
})
