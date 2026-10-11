/**
 * Project slug storage, cookie-backed so it survives refresh and tab close.
 * Writers: Home publish and Home "Open editor"; clearer: canvas Exit project.
 *
 * This is a UI hint — "which project am I showing" — and never an
 * authorization input. The server does not read it and cannot be trusted to;
 * it stays readable by JavaScript on purpose so the canvas can render the
 * project name without a round trip. That is safe precisely because it grants
 * nothing: every privileged call is authorized by the backend's own
 * `HttpOnly; SameSite=Lax` session cookie (see src/api.ts).
 */
export const PROJECT_COOKIE = 'obs_curr_project_name'

// 30 days: long enough to reopen the last project across visits, short enough
// that a shared browser forgets it. The session cookie is the real gate.
const MAX_AGE = 60 * 60 * 24 * 30

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`
  const hit = document.cookie.split('; ').find((c) => c.startsWith(prefix))
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : null
}

function writeCookie(name: string, value: string, maxAge: number): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

/** No fallback: an empty or missing cookie means "no project", never a fake name. */
export function getProjectSlug(): string | null {
  const v = readCookie(PROJECT_COOKIE)
  return !v || v.trim() === '' ? null : v
}

/** The single write — called only from Home publish. */
export const setProjectSlug = (slug: string): void => writeCookie(PROJECT_COOKIE, slug, MAX_AGE)

/** The single clear — called only from canvas Exit project. */
export const clearProjectSlug = (): void => writeCookie(PROJECT_COOKIE, '', 0)

