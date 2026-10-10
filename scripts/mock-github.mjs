// Dev-only GitHub double for integrated frontend tests.
// Mirrors backend/internal/server/mock_github_test.go fixtures. Never ships: no Dockerfile
// context includes scripts/.
//
// Control: POST /__scenario {userLogin, installLogin, repoExists,
//   generateStatus, pagesStatus, exchangeFails, updateRefStatus}
// Inspect: GET /__calls -> {calls, tokens, generateBody}
// Reset: POST /__reset
import http from 'node:http'

const USER_TOKEN = 'gh-user-token'
const INSTALL_TOKEN = 'gh-install-token'
const INSTALL_ID = 7

const happy = () => ({
  userLogin: 'maya',
  installLogin: 'maya',
  repoExists: false,
  generateStatus: 201,
  pagesStatus: 201,
  exchangeFails: false,
  updateRefStatus: 200,
})

let opts = happy()
let calls = {}
let tokens = {}
let generateBody = ''
let blobCount = 0

function record(req) {
  const key = `${req.method} ${new URL(req.url, 'http://x').pathname}`
  calls[key] = (calls[key] || 0) + 1
  const auth = req.headers.authorization
  if (auth) {
    tokens[key] = tokens[key] || []
    tokens[key].push(auth)
  }
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = ''
    req.on('data', (c) => { s += c })
    req.on('end', () => resolve(s))
  })
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x')
  const p = u.pathname

  if (p === '/__scenario' && req.method === 'POST') {
    opts = { ...happy(), ...JSON.parse(await readBody(req)) }
    return json(res, 200, { ok: true })
  }
  if (p === '/__reset' && req.method === 'POST') {
    opts = happy()
    calls = {}
    tokens = {}
    generateBody = ''
    blobCount = 0
    return json(res, 200, { ok: true })
  }
  if (p === '/__calls' && req.method === 'GET') {
    return json(res, 200, { calls, tokens, generateBody })
  }

  record(req)

  if (req.method === 'POST' && p === '/login/oauth/access_token') {
    if (opts.exchangeFails) return json(res, 200, { error: 'bad_verification_code' })
    return json(res, 200, { access_token: USER_TOKEN })
  }
  if (req.method === 'GET' && p === '/user') {
    return json(res, 200, { login: opts.userLogin })
  }
  if (req.method === 'GET' && p === '/app/installations') {
    return json(res, 200, [{ id: INSTALL_ID, account: { login: opts.installLogin } }])
  }
  if (req.method === 'GET' && p.startsWith('/app/installations/')) {
    if (p === `/app/installations/${INSTALL_ID}`) {
      return json(res, 200, { account: { login: opts.installLogin }, repository_selection: 'all' })
    }
    return json(res, 404, { message: 'Not Found' })
  }
  if (req.method === 'POST' && p.endsWith('/access_tokens')) {
    return json(res, 201, { token: INSTALL_TOKEN })
  }
  if (req.method === 'POST' && p.endsWith('/generate')) {
    generateBody = await readBody(req)
    if (opts.generateStatus === 201) return json(res, 201, { id: 'new-repo' })
    return json(res, opts.generateStatus, { message: 'mocked generate failure' })
  }
  if (req.method === 'POST' && p.endsWith('/pages')) {
    if (opts.pagesStatus === 201) return json(res, 201, { html_url: 'https://example.github.io/x/' })
    return json(res, opts.pagesStatus, { message: 'mocked pages state' })
  }
  if (p.includes('/git/ref/heads/main') && req.method === 'GET') {
    return json(res, 200, { object: { sha: 'base-sha' } })
  }
  if (p.endsWith('/git/blobs') && req.method === 'POST') {
    blobCount += 1
    return json(res, 201, { sha: `blob-${blobCount}` })
  }
  if (p.endsWith('/git/trees') && req.method === 'POST') {
    return json(res, 201, { sha: 'tree-sha' })
  }
  if (p.endsWith('/git/commits') && req.method === 'POST') {
    return json(res, 201, { sha: 'commit-sha' })
  }
  if (p.includes('/git/refs/heads/main') && req.method === 'PATCH') {
    if (opts.updateRefStatus === 200) return json(res, 200, { ref: 'refs/heads/main' })
    return json(res, opts.updateRefStatus, { message: 'mocked ref failure' })
  }
  if (req.method === 'GET' && p.startsWith('/repos/') && p.split('/').length === 4) {
    if (opts.repoExists) return json(res, 200, { full_name: 'x/y' })
    return json(res, 404, { message: 'Not Found' })
  }
  return json(res, 404, { message: `mock: unhandled ${req.method} ${p}` })
})

const port = Number(process.argv[process.argv.indexOf('--port') + 1] || 0)
server.listen(port, '127.0.0.1', () => {
  console.log(`MOCK_READY port=${server.address().port}`)
})
