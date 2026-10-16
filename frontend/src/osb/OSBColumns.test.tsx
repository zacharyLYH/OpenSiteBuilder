// Columns adapter: splits render as fractions, stack on phone.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OSBColumns, {
  OSB_COLUMNS_DEFAULTS,
  OSB_COLUMNS_FIELDS,
  OSB_COLUMNS_SPLITS,
  SPLIT_COUNT,
  columnsFractions,
} from './OSBColumns'

describe('OSBColumns adapter', () => {
  it('defaults to 50/50', () => {
    expect(OSB_COLUMNS_DEFAULTS).toEqual({ split: '50-50' })
    expect(columnsFractions({})).toEqual(['1fr', '1fr'])
  })

  it('maps each split to fractions', () => {
    expect(columnsFractions({ split: '70-30' })).toEqual(['2fr', '1fr'])
    expect(columnsFractions({ split: '30-70' })).toEqual(['1fr', '2fr'])
    expect(columnsFractions({ split: 'triple' })).toEqual(['1fr', '1fr', '1fr'])
    expect(columnsFractions({ split: 'quad' })).toEqual(['1fr', '1fr', '1fr', '1fr'])
  })

  it('falls back to 50/50 on unknown split', () => {
    expect(columnsFractions({ split: 'nope' })).toEqual(['1fr', '1fr'])
  })

  it('renders one slot per child with fraction widths', () => {
    render(
      <OSBColumns config={{ split: '70-30' }}>
        <span>left</span>
        <span>right</span>
      </OSBColumns>,
    )
    const slots = screen.getAllByTestId('osb-column-slot')
    expect(slots).toHaveLength(2)
    expect(slots[0].style.flexGrow).toBe('2')
    expect(slots[1].style.flexGrow).toBe('1')
  })

  it('stacks vertical on phone, row on desktop', () => {
    const { container } = render(
      <OSBColumns config={{}}>
        <span>a</span>
      </OSBColumns>,
    )
    const cls = container.querySelector('[data-testid="osb-columns"]')?.className ?? ''
    expect(cls).toContain('flex-col')
    expect(cls).toContain('md:flex-row')
  })

  it('derives the split field from its option list', () => {
    const field = OSB_COLUMNS_FIELDS.find((f) => f.key === 'split')
    if (!field || field.kind !== 'select') throw new Error('expected split select')
    expect(field.options).toEqual(OSB_COLUMNS_SPLITS)
  })

  it('maps each split to its card count', () => {
    expect(SPLIT_COUNT['50-50']).toBe(2)
    expect(SPLIT_COUNT['70-30']).toBe(2)
    expect(SPLIT_COUNT['30-70']).toBe(2)
    expect(SPLIT_COUNT.triple).toBe(3)
    expect(SPLIT_COUNT.quad).toBe(4)
  })
})
