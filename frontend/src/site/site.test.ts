import { describe, it, expect } from 'vitest'
import example from './site.example.json'
import { validateSite } from './validate'

describe('site.json', () => {
  it('example document validates', () => {
    expect(validateSite(example)).toEqual({ ok: true, errors: [] })
  })

  it('round-trips through JSON losslessly', () => {
    const doc: unknown = JSON.parse(JSON.stringify(example))
    expect(validateSite(doc)).toEqual({ ok: true, errors: [] })
    expect(doc).toEqual(example)
  })

  it('rejects unknown version, bad theme, unknown node type', () => {
    expect(validateSite({ ...example, version: '9.9' }).ok).toBe(false)
    expect(
      validateSite({ ...example, site: { name: 'x', theme: 'sepia' } }).errors,
    ).toContain('site.theme must be "light" or "dark"')
    expect(
      validateSite({
        ...example,
        pages: [{ id: 'p', path: '/', title: 't', nodes: [{ id: 'n', type: 'video' }] }],
      }).ok,
    ).toBe(false)
  })

  it('rejects duplicate ids and paths not starting with /', () => {
    const dup = {
      ...example,
      pages: [
        { id: 'p', path: '/', title: 'a', nodes: [{ id: 'n', type: 'card' }] },
        { id: 'p', path: 'about', title: 'b', nodes: [] },
      ],
    }
    const v = validateSite(dup)
    expect(v.ok).toBe(false)
    expect(v.errors.join('|')).toContain('duplicate page id')
    expect(v.errors.join('|')).toContain('must start with "/"')
  })
})
