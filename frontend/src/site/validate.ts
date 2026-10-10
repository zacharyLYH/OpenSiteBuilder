import { OSB_NODE_TYPES } from '../osb/registry'
import { SITE_SCHEMA_VERSION, type SiteDocument } from './types'

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

  if (!Array.isArray(d['pages']) || d['pages'].length === 0) {
    errors.push('pages must be a non-empty array')
  } else {
    const pageIds = new Set<string>()
    const nodeIds = new Set<string>()
    for (const [i, p] of (d['pages'] as unknown[]).entries()) {
      if (typeof p !== 'object' || p === null) {
        errors.push(`pages[${i}] must be an object`)
        continue
      }
      const page = p as Record<string, unknown>
      if (typeof page['id'] !== 'string' || page['id'].length === 0) {
        errors.push(`pages[${i}].id must be a non-empty string`)
      } else if (pageIds.has(page['id'])) {
        errors.push(`duplicate page id ${JSON.stringify(page['id'])}`)
      } else {
        pageIds.add(page['id'])
      }
      if (typeof page['path'] !== 'string' || !(page['path'] as string).startsWith('/')) {
        errors.push(`pages[${i}].path must start with "/"`)
      }
      if (typeof page['title'] !== 'string') {
        errors.push(`pages[${i}].title must be a string`)
      }
      if (!Array.isArray(page['nodes'])) {
        errors.push(`pages[${i}].nodes must be an array`)
        continue
      }
      for (const [j, n] of (page['nodes'] as unknown[]).entries()) {
        if (typeof n !== 'object' || n === null) {
          errors.push(`pages[${i}].nodes[${j}] must be an object`)
          continue
        }
        const node = n as Record<string, unknown>
        if (typeof node['id'] !== 'string' || node['id'].length === 0) {
          errors.push(`pages[${i}].nodes[${j}].id must be a non-empty string`)
        } else if (nodeIds.has(node['id'])) {
          errors.push(`duplicate node id ${JSON.stringify(node['id'])}`)
        } else {
          nodeIds.add(node['id'])
        }
        if (
          typeof node['type'] !== 'string' ||
          !(OSB_NODE_TYPES as readonly string[]).includes(node['type'])
        ) {
          errors.push(
            `pages[${i}].nodes[${j}].type must be one of ${OSB_NODE_TYPES.join(', ')}`,
          )
        }
        if (node['config'] !== undefined && (typeof node['config'] !== 'object' || node['config'] === null)) {
          errors.push(`pages[${i}].nodes[${j}].config must be an object when present`)
        }
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Serialize a validated document. Round-trips through JSON losslessly. */
export function serializeSite(doc: SiteDocument): string {
  return JSON.stringify(doc)
}

/** Parse + validate in one step. Throws on invalid input. */
export function parseSite(raw: string): SiteDocument {
  const doc: unknown = JSON.parse(raw)
  const v = validateSite(doc)
  if (!v.ok) throw new Error(`invalid site.json: ${v.errors.join('; ')}`)
  return doc as SiteDocument
}
