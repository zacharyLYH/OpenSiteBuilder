/**
 * Project slug storage. Exactly one writer (Home publish, where the user
 * gives the name) and one clearer (canvas Exit project). Everything else
 * only reads.
 *
 * Cookie-backed (FE-only): survives refresh + tab close until explicitly
 * cleared, and travels automatically on every same-origin navigation.
 * NOTE: `HttpOnly` can only be set by a server `Set-Cookie` response —
 * `document.cookie` cannot create a readable HttpOnly cookie (and JS could
 * never read it back for Nav/Canvas). So the FE writer sets everything a
 * readable cookie supports (`Path`, `Max-Age`, `SameSite`, `Secure` on
 * https); if a backend ever owns this cookie it should add `HttpOnly`.
 */
export const PROJECT_COOKIE = 'obs_curr_project_name'

const MAX_AGE = 31536000 // 1 year: persists across refreshes/tab closures

function cookieAttrs(maxAge: number): string {
  const secure = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : ''
  return `; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

function readCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null
    const cookies = document.cookie ? document.cookie.split('; ') : []
    for (const c of cookies) {
      const eq = c.indexOf('=')
      if (eq < 0) continue
      if (decodeURIComponent(c.slice(0, eq)) === name) {
        return decodeURIComponent(c.slice(eq + 1))
      }
    }
    return null
  } catch {
    return null
  }
}

function writeCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${cookieAttrs(maxAge)}`
}

export function getProjectSlug(): string | null {
  try {
    return readCookie(PROJECT_COOKIE)
  } catch {
    return null
  }
}

/** The single write — called only from Home publish. */
export function setProjectSlug(slug: string): void {
  try {
    writeCookie(PROJECT_COOKIE, slug, MAX_AGE)
  } catch {
    /* private mode */
  }
}

/** The single clear — called only from canvas Exit project. */
export function clearProjectSlug(): void {
  try {
    writeCookie(PROJECT_COOKIE, '', 0)
  } catch {
    /* private mode */
  }
}

