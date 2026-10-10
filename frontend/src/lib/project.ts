/**
 * Project slug storage. Exactly one writer (Home publish, where the user
 * gives the name) and one clearer (canvas Exit project). Everything else
 * only reads.
 */
const KEY = 'osb_last_slug'

export function getProjectSlug(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** The single write — called only from Home publish. */
export function setProjectSlug(slug: string): void {
  try {
    localStorage.setItem(KEY, slug)
  } catch {
    /* private mode */
  }
}

/** The single clear — called only from canvas Exit project. */
export function clearProjectSlug(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* private mode */
  }
}
