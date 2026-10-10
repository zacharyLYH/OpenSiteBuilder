// GitHub App authorize URL for the OAuth leg. The public client ID is served
// by the backend (single source: the CLIENT_ID env var), never hardcoded here.
export function githubAuthorizeUrl(clientId: string, state: string): string {
  return (
    'https://github.com/login/oauth/authorize' +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(window.location.origin + '/callback')}` +
    `&state=${encodeURIComponent(state)}`
  )
}
