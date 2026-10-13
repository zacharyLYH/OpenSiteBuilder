import { OSB_NODE_TYPES, canContain } from '../osb/registry'
import { SITE_SCHEMA_VERSION, type SiteNode } from './types'

export interface SiteValidation {
  ok: boolean
  errors: string[]
}

/**
 * Hand-written validator (no schema dep — KISS). Every producer/consumer
 * of site.json runs this before trusting the document.
 */
export function validateSite(doc: unknown): SiteValidation {
  const errors: string[] = []
  if (typeof doc !== 'object' || doc === null) {
    return { ok: false, errors: ['document must be an object'] }
  }
  const d = doc as Record<string, unknown>

  if (d['version'] !== SITE_SCHEMA_VERSION) {
    errors.push(`version must be ${JSON.stringify(SITE_SCHEMA_VERSION)}`)
  }

  const site = d['site'] as Record<string, unknown> | undefined
  if (typeof site !== 'object' || site === null) {
    errors.push('site must be an object')
  } else {
    if (typeof site['name'] !== 'string' || site['name'].length === 0) {
      errors.push('site.name must be a non-empty string')
    }
    if (site['theme'] !== 'light' && site['theme'] !== 'dark') {
      errors.push('site.theme must be "light" or "dark"')
    }
  }

  const pages = Array.isArray(d['pages']) ? (d['pages'] as unknown[]) : null
  if (!pages || pages.length === 0) {
    errors.push('pages must be a non-empty array')
    return { ok: errors.length === 0, errors }
  }

  const pageIds = new Set<string>()
  const nodeIds = new Set<string>()

  /** Ids must be non-empty and unique among their own kind. */
  const checkId = (kind: string, path: string, id: unknown, seen: Set<string>): void => {
    if (typeof id !== 'string' || id.length === 0) errors.push(`${path}.id must be a non-empty string`)
    else if (seen.has(id)) errors.push(`duplicate ${kind} id ${JSON.stringify(id)}`)
    else seen.add(id)
  }

  function checkNode(n: unknown, path: string, parentType: string | null): void {
    const node = n as (Record<string, unknown> & { children?: SiteNode[] }) | null
    if (typeof node !== 'object' || node === null) {
      errors.push(`${path} must be an object`)
      return
    }
    checkId('node', path, node['id'], nodeIds)
    const type = node['type']
    if (typeof type !== 'string' || !(OSB_NODE_TYPES as readonly string[]).includes(type)) {
      errors.push(`${path}.type must be one of ${OSB_NODE_TYPES.join(', ')}`)
      return
    }
    if (node['config'] !== undefined && (typeof node['config'] !== 'object' || node['config'] === null)) {
      errors.push(`${path}.config must be an object when present`)
    }
    const kids = node.children
    if (kids === undefined) {
      if (parentType !== null && !canContain(parentType, type)) {
        errors.push(`${path} type ${JSON.stringify(type)} is not an atom in a container`)
      }
      return
    }
    if (!Array.isArray(kids)) {
      errors.push(`${path}.children must be an array when present`)
      return
    }
    if (parentType !== null) {
      errors.push(`${path} nests too deep (max depth 1)`)
      return
    }
    // Recursion re-checks every child against this container type, so the
    // atom-only rule lives in exactly one place below.
    for (const [k, c] of kids.entries()) checkNode(c, `${path}.children[${k}]`, type)
  }

  /** Overlay footprint + kid boxes travel as plain numbers; present means integer.
   * One checker for popups (`modals`) + drawers — only the type word differs. */
  function checkOverlays(overlays: unknown, path: string, type: 'modal' | 'drawer'): void {
    if (overlays === undefined) return
    if (!Array.isArray(overlays)) {
      errors.push(`${path} must be an array when present`)
      return
    }
    for (const [i, m] of (overlays as unknown[]).entries()) {
      if (typeof m !== 'object' || m === null) {
        errors.push(`${path}[${i}] must be an object`)
        continue
      }
      const overlay = m as Record<string, unknown>
      checkId(type, `${path}[${i}]`, overlay['id'], nodeIds)
      const overlayType = overlay['type']
      if (overlayType !== type) {
        errors.push(`${path}[${i}].type must be ${JSON.stringify(type)}`)
        continue
      }
      if (overlay['config'] !== undefined && (typeof overlay['config'] !== 'object' || overlay['config'] === null)) {
        errors.push(`${path}[${i}].config must be an object when present`)
      }
      for (const key of ['cols', 'rows'] as const) {
        const v = overlay[key]
        if (v !== undefined && !(typeof v === 'number' && Number.isInteger(v))) {
          errors.push(`${path}[${i}].${key} must be an integer when present`)
        }
      }
      const kids = overlay['children']
      if (kids === undefined) continue
      if (!Array.isArray(kids)) {
        errors.push(`${path}[${i}].children must be an array when present`)
        continue
      }
      for (const [k, c] of (kids as unknown[]).entries()) {
        if (typeof c !== 'object' || c === null) {
          errors.push(`${path}[${i}].children[${k}] must be an object`)
          continue
        }
        const kid = c as Record<string, unknown>
        checkId('node', `${path}[${i}].children[${k}]`, kid['id'], nodeIds)
        const kidType = kid['type']
        if (typeof kidType !== 'string' || !canContain(type, kidType)) {
          errors.push(`${path}[${i}].children[${k}] type ${JSON.stringify(kidType)} is not an atom in a ${type === 'modal' ? 'popup' : 'drawer'}`)
          continue
        }
        if (kid['config'] !== undefined && (typeof kid['config'] !== 'object' || kid['config'] === null)) {
          errors.push(`${path}[${i}].children[${k}].config must be an object when present`)
        }
        for (const key of ['x', 'y', 'cols', 'rows'] as const) {
          const v = kid[key]
          if (v !== undefined && !(typeof v === 'number' && Number.isInteger(v))) {
            errors.push(`${path}[${i}].children[${k}].${key} must be an integer when present`)
          }
        }
      }
    }
  }

  for (const [i, p] of pages.entries()) {
    if (typeof p !== 'object' || p === null) {
      errors.push(`pages[${i}] must be an object`)
      continue
    }
    const page = p as Record<string, unknown>
    checkId('page', `pages[${i}]`, page['id'], pageIds)
    const pagePath = page['path']
    if (typeof pagePath !== 'string' || !pagePath.startsWith('/')) {
      errors.push(`pages[${i}].path must start with "/"`)
    }
    if (typeof page['title'] !== 'string') {
      errors.push(`pages[${i}].title must be a string`)
    }
    if (!Array.isArray(page['nodes'])) {
      errors.push(`pages[${i}].nodes must be an array`)
      continue
    }
    for (const [j, n] of (page['nodes'] as unknown[]).entries()) checkNode(n, `pages[${i}].nodes[${j}]`, null)
    checkOverlays(page['modals'], `pages[${i}].modals`, 'modal')
    checkOverlays(page['drawers'], `pages[${i}].drawers`, 'drawer')
  }

  return { ok: errors.length === 0, errors }
}
