// GitHub App identity shown to users during install/authorize.
// Secrets never live here; only the public client ID.
export const APP_SLUG = 'opensitebuilder-bytesbylyh-dev'
export const CLIENT_ID = 'Iv23liBOHhapv9XPFgLw'

export function githubAuthorizeUrl(clientId: string, state: string): string {
  return (
    'https://github.com/login/oauth/authorize' +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(window.location.origin + '/callback')}` +
    `&state=${encodeURIComponent(state)}`
  )
}
