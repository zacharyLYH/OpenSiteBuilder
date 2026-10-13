import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OSBCard, {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  OSB_CARD_DEFAULTS,
  OSB_CARD_FIELDS,
  OSB_CARD_PADDINGS,
  OSB_CARD_RADII,
  OSB_CARD_SHADOWS,
  OSB_CARD_VARIANTS,
} from './OSBCard'
import OSBText from './OSBText'
import { OSBThemeProvider } from './OSBTheme'

const shell = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector('[data-slot="card"]')
  if (!el) throw new Error('missing card shell')
  return el as HTMLElement
}

describe('OSBCard chrome (vendored from shadcn Card)', () => {
  it('renders shadcn card chrome by default (rounded, bordered, shadowed, padded)', () => {
    const { container } = render(<OSBCard config={{}} />)
    const cls = shell(container).className
    expect(cls).toContain('rounded-xl')
    expect(cls).toContain('border-slate-200')
    expect(cls).toContain('shadow-sm')
    expect(cls).toContain('gap-6')
    expect(cls).toContain('py-6')
  })

  it('variant controls the border emphasis; plain drops the visible border', () => {
    const outlined = render(<OSBCard config={{ variant: 'outlined' }} />)
    expect(shell(outlined.container).className).toContain('border-slate-300')
    outlined.unmount()
    const plain = render(<OSBCard config={{ variant: 'plain' }} />)
    expect(shell(plain.container).className).toContain('border-transparent')
  })

  it('exposes independent radius, depth and inner-spacing settings', () => {
    const { container } = render(
      <OSBCard config={{ radius: 'pill', shadow: 'strong', padding: 'spacious' }}>
        <OSBText config={{ text: 'x' }} />
      </OSBCard>,
    )
    const cls = shell(container).className
    expect(cls).toContain('rounded-3xl')
    expect(cls).toContain('shadow-lg')
    expect(screen.getByTestId('osb-card-children').className).toContain('gap-8')
    expect(screen.getByTestId('osb-card-children').className).toContain('px-8')
  })

  it('none/shadow-none and square corners are expressible', () => {
    const { container } = render(<OSBCard config={{ radius: 'none', shadow: 'none' }} />)
    const cls = shell(container).className
    expect(cls).toContain('rounded-none')
    expect(cls).toContain('shadow-none')
  })

  it('reads the global dark theme without touching the border radius', () => {
    const { container } = render(
      <OSBThemeProvider theme="dark">
        <OSBCard config={{}} />
      </OSBThemeProvider>,
    )
    const cls = shell(container).className
    expect(cls).toContain('bg-slate-900')
    expect(cls).toContain('border-slate-800')
    expect(cls).toContain('rounded-xl')
  })

  it('renders no ghost internals — only the real children it is given', () => {
    render(
      <OSBCard config={{}}>
        <OSBText config={{ text: 'Card title', heading: 'h4' }} />
        <OSBText config={{ text: 'Body', tone: 'muted' }} />
      </OSBCard>,
    )
    expect(screen.getByText('Card title').tagName).toBe('H4')
    expect(screen.getByText('Body')).toBeTruthy()
    expect(screen.getByTestId('osb-card-children').getAttribute('data-slot')).toBe('card-content')
  })

  it('omits the content slot when there are no children (empty container)', () => {
    render(<OSBCard config={{}} />)
    expect(screen.queryByTestId('osb-card-children')).toBeNull()
  })

  it('exports every shadcn slot as a real slot-marked component', () => {
    const { container } = render(
      <div>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </div>,
    )
    for (const slot of ['card-header', 'card-title', 'card-description', 'card-content', 'card-footer']) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull()
    }
  })
})

describe('OSBCard registry shape (single source with the render)', () => {
  it('derives every card setting field from its option list (single source)', () => {
    const options = (key: string) => {
      const field = OSB_CARD_FIELDS.find((f) => f.key === key)
      if (!field || field.kind !== 'select') throw new Error(`expected a select field for ${key}`)
      return field.options
    }
    expect(options('variant')).toEqual(OSB_CARD_VARIANTS)
    expect(options('radius')).toEqual(OSB_CARD_RADII)
    expect(options('shadow')).toEqual(OSB_CARD_SHADOWS)
    expect(options('padding')).toEqual(OSB_CARD_PADDINGS)
  })

  it('defaults reproduce shadcn Card', () => {
    expect(OSB_CARD_DEFAULTS).toEqual({
      variant: 'elevated',
      radius: 'rounded',
      shadow: 'soft',
      padding: 'cozy',
    })
  })
})
