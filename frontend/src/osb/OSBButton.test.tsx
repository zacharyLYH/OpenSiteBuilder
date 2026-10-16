import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OSBButton, {
  sanitizeHref,
  OSB_BUTTON_DEFAULTS,
  OSB_BUTTON_FIELDS,
  OSB_BUTTON_SIZES,
  OSB_BUTTON_VARIANTS,
} from './OSBButton'
import { OSBThemeProvider } from './OSBTheme'
import ConfigDrawer from '../canvas/ConfigDrawer'
import type { SiteNode } from '../site/types'

describe('sanitizeHref', () => {
  it('returns empty for empty / blank / non-string input', () => {
    expect(sanitizeHref('')).toBe('')
    expect(sanitizeHref('   ')).toBe('')
    expect(sanitizeHref(undefined)).toBe('')
    expect(sanitizeHref(null)).toBe('')
    expect(sanitizeHref(42)).toBe('')
  })

  it('passes through safe absolute, anchor, and root-relative URLs', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com')
    expect(sanitizeHref('http://example.com/a?b=1')).toBe('http://example.com/a?b=1')
    expect(sanitizeHref('mailto:hi@example.com')).toBe('mailto:hi@example.com')
    expect(sanitizeHref('tel:+123456')).toBe('tel:+123456')
    expect(sanitizeHref('#section')).toBe('#section')
    expect(sanitizeHref('/about')).toBe('/about')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeHref('  https://example.com  ')).toBe('https://example.com')
  })

  it('prefixes bare domains with https', () => {
    expect(sanitizeHref('example.com')).toBe('https://example.com')
    expect(sanitizeHref('example.com/pricing')).toBe('https://example.com/pricing')
  })

  it('keeps relative paths as-is', () => {
    expect(sanitizeHref('about')).toBe('about')
  })

  it('blocks script-capable schemes', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('')
    expect(sanitizeHref('JaVaScRiPt:alert(1)')).toBe('')
    expect(sanitizeHref('data:text/html,<h1>hi</h1>')).toBe('')
    expect(sanitizeHref('vbscript:msgbox(1)')).toBe('')
  })
})

describe('OSBButton link rendering', () => {
  it('renders a <button> when no href is set (default)', () => {
    render(<OSBButton config={{ label: 'Go' }} />)
    const btn = screen.getByRole('button', { name: 'Go' })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.hasAttribute('href')).toBe(false)
  })

  it('renders a real anchor when href is set', () => {
    render(<OSBButton config={{ label: 'Docs', href: 'https://example.com' }} />)
    const link = screen.getByRole('link', { name: 'Docs' })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://example.com')
    expect(link.hasAttribute('target')).toBe(false)
    expect(link.hasAttribute('rel')).toBe(false)
  })

  it('opens in a new tab with noopener when openInNewTab is true', () => {
    render(<OSBButton config={{ label: 'Docs', href: 'https://example.com', openInNewTab: true }} />)
    const link = screen.getByRole('link', { name: 'Docs' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('ignores openInNewTab when there is no link', () => {
    render(<OSBButton config={{ label: 'Go', openInNewTab: true }} />)
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('falls back to a plain button for blocked schemes', () => {
    render(<OSBButton config={{ label: 'X', href: 'javascript:alert(1)' }} />)
    expect(screen.getByRole('button', { name: 'X' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('prefixes bare domains in the rendered href', () => {
    render(<OSBButton config={{ label: 'Site', href: 'example.com' }} />)
    expect(screen.getByRole('link', { name: 'Site' }).getAttribute('href')).toBe('https://example.com')
  })

  it('falls back to placeholder text for empty labels (linked and unlinked)', () => {
    const { unmount } = render(<OSBButton config={{ label: '' }} />)
    expect(screen.getByRole('button', { name: 'Button' })).toBeTruthy()
    unmount()
    render(<OSBButton config={{ label: '', href: 'https://example.com' }} />)
    expect(screen.getByRole('link', { name: 'Button' })).toBeTruthy()
  })

  it('forwards clicks from both variants', () => {
    const onClick = vi.fn()
    const { unmount } = render(<OSBButton config={{ label: 'A' }} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    unmount()
    // Anchor hrefs make jsdom attempt navigation: use a same-document hash.
    render(<OSBButton config={{ label: 'B', href: '#docs' }} onClick={onClick} />)
    fireEvent.click(screen.getByRole('link', { name: 'B' }))
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})

describe('OSBButton shadcn variants', () => {
  it('renders every shadcn variant with its copied class values', () => {
    const expected: Record<string, string> = {
      default: 'bg-slate-900',
      secondary: 'bg-slate-100',
      destructive: 'bg-red-600',
      outline: 'border-slate-200',
      ghost: 'hover:bg-slate-100',
      link: 'hover:underline',
    }
    for (const [variant, needle] of Object.entries(expected)) {
      const { unmount } = render(<OSBButton config={{ label: 'Go', variant: variant as never }} />)
      expect(screen.getByRole('button', { name: 'Go' }).className).toContain(needle)
      unmount()
    }
  })

  it('overlays the GLOBAL dark theme over the variant (provider)', () => {
    render(
      <OSBThemeProvider theme="dark">
        <OSBButton config={{ label: 'Go' }} />
      </OSBThemeProvider>,
    )
    const cls = screen.getByRole('button', { name: 'Go' }).className
    expect(cls).toContain('bg-slate-50')
    expect(cls).toContain('text-slate-900')
  })

  it('derives the Style/Size drawer fields from their option lists (single source)', () => {
    const field = (key: string) => {
      const f = OSB_BUTTON_FIELDS.find((x) => x.key === key)
      if (!f || f.kind !== 'select') throw new Error(`expected a select field for ${key}`)
      return f.options
    }
    expect(field('variant')).toEqual(OSB_BUTTON_VARIANTS)
    expect(field('size')).toEqual(OSB_BUTTON_SIZES)
  })
})

describe('OSBButton registry shape', () => {
  it('defaults to unlinked, same-tab, primary/medium', () => {
    expect(OSB_BUTTON_DEFAULTS.href).toBe('')
    expect(OSB_BUTTON_DEFAULTS.openInNewTab).toBe(false)
    expect(OSB_BUTTON_DEFAULTS.variant).toBe('default')
    expect(OSB_BUTTON_DEFAULTS.size).toBe('default')
  })

  it('exposes link + new-tab drawer fields (old docs still load: missing keys fall back)', () => {
    const kinds = Object.fromEntries(OSB_BUTTON_FIELDS.map((f) => [f.key, f.kind]))
    expect(kinds.href).toBe('text')
    expect(kinds.openInNewTab).toBe('boolean')
  })
})

describe('ConfigDrawer link controls', () => {
  const buttonNode = (config: Record<string, unknown>): SiteNode => ({
    id: 'b1',
    type: 'button',
    config,
  })

  it('marks Button text as required with a red asterisk', () => {
    render(<ConfigDrawer node={buttonNode({ label: 'Go' })} side="right" onClose={() => {}} onApply={() => {}} />)
    const label = screen.getByText('Button text')
    expect(label.textContent).toContain('*')
    expect(label.querySelector('.text-red-600')).not.toBeNull()
  })

  it('hides the new-tab switch until a link is provided', () => {
    render(<ConfigDrawer node={buttonNode({ label: 'Go' })} side="right" onClose={() => {}} onApply={() => {}} />)
    expect(screen.getByLabelText('Link')).toBeTruthy()
    expect(screen.queryByLabelText('Open in a new tab')).toBeNull()
  })

  it('shows the switch once a link is typed, and applies the toggle', () => {
    const onApply = vi.fn()
    render(<ConfigDrawer node={buttonNode({ label: 'Go' })} side="right" onClose={() => {}} onApply={onApply} />)
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://example.com' } })
    const toggle = screen.getByLabelText('Open in a new tab')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(toggle.textContent).toBe('Off')
    fireEvent.click(toggle)
    expect(onApply).toHaveBeenLastCalledWith('b1', expect.objectContaining({ openInNewTab: true }))
  })

  it('clearing the link hides the switch and resets it to off', () => {
    const onApply = vi.fn()
    render(
      <ConfigDrawer
        node={buttonNode({ label: 'Go', href: 'https://example.com', openInNewTab: true })}
        side="right"
        onClose={() => {}}
        onApply={onApply}
      />,
    )
    expect(screen.getByLabelText('Open in a new tab')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: '  ' } })
    expect(screen.queryByLabelText('Open in a new tab')).toBeNull()
    expect(onApply).toHaveBeenLastCalledWith('b1', expect.objectContaining({ href: '  ', openInNewTab: false }))
  })

  it('typing a link applies href', () => {
    const onApply = vi.fn()
    render(<ConfigDrawer node={buttonNode({ label: 'Go' })} side="right" onClose={() => {}} onApply={onApply} />)
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://example.com' } })
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][1]).toMatchObject({ href: 'https://example.com' })
  })
})
