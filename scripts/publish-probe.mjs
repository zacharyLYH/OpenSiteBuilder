// Tight-loop probe: exercises G1(presence)+P1 against a fixed probe repo.
// Skips R1/R2/E1. Mints GH_INSTALL directly from the stored install.
// Usage: node scripts/publish-probe.mjs [--marker e2e-<ts>] [--ensure]
// --ensure also enables Pages (run once after repo creation).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const env = loadEnv()
const OWNER = env.TEST_OWNER
const REPO = 'osb-e2e-probe'
const API = 'https://api.github.com'

function mintJWT() {
  const key = fs.readFileSync(path.join(root, env.PRIVATE_KEY_PATH), 'utf8')
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const h = b64({ alg: 'RS256', typ: 'JWT' })
  const p = b64({ iss: env.APP_ID, iat: now - 60, exp: now + 600 })
  const sig = crypto.sign('rsa-sha256', Buffer.from(h + '.' + p), key).toString('base64url')
  return h + '.' + p + '.' + sig
}

async function gh(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch { /* non-json */ }
  return { status: res.status, json }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const args = process.argv.slice(2)
const marker = (args[args.indexOf('--marker') + 1] || `e2e-${Date.now()}`)
const ensure = args.includes('--ensure')

const appJWT = mintJWT()
// Discover the install by owner: reinstalls mint a fresh ID, so never pin it.
const installs = await gh('GET', `${API}/app/installations?per_page=100`, appJWT)
const match = (installs.json || []).find((i) => i.account?.login?.toLowerCase() === OWNER.toLowerCase())
if (!match) throw new Error(`no installation found for ${OWNER}`)
const installationId = match.id
console.log(`install: ${installationId}`)
const inst = await gh('POST', `${API}/app/installations/${installationId}/access_tokens`, appJWT, {})
if (inst.status !== 201) throw new Error(`install token failed: ${inst.status}`)
const token = inst.json.token
console.log('install-token: ok')

const repo = await gh('GET', `${API}/repos/${OWNER}/${REPO}`, token)
if (repo.status === 404) {
  console.log(`repo missing: create it once with gh CLI, then rerun:`)
  console.log(`  gh repo create ${OWNER}/${REPO} --template ${env.TEMPLATE_OWNER}/${env.TEMPLATE_REPO} --public`)
  process.exit(2)
}
if (repo.status !== 200) throw new Error(`repo lookup failed: ${repo.status}`)
console.log('repo: exists')

if (ensure) {
  const pages = await gh('POST', `${API}/repos/${OWNER}/${REPO}/pages`, token, { build_type: 'workflow' })
  console.log(`pages: ${pages.status === 201 ? 'enabled' : pages.status === 409 ? 'already-enabled' : 'FAILED ' + pages.status}`)
}

// P1-equivalent: append a run marker export, single-file commit.
let content = fs.readFileSync(path.join(root, 'template/src/App.jsx'), 'utf8')
content = content.replace(/\nexport const __probe = ".*"\n?$/, '')
content += `\nexport const __probe = "${marker}"\n`
const ref = await gh('GET', `${API}/repos/${OWNER}/${REPO}/git/ref/heads/main`, token)
const base = ref.json.object.sha
const blob = await gh('POST', `${API}/repos/${OWNER}/${REPO}/git/blobs`, token, { content, encoding: 'utf-8' })
const tree = await gh('POST', `${API}/repos/${OWNER}/${REPO}/git/trees`, token, {
  base_tree: base,
  tree: [{ path: 'src/App.jsx', mode: '100644', type: 'blob', sha: blob.json.sha }],
})
const commit = await gh('POST', `${API}/repos/${OWNER}/${REPO}/git/commits`, token, {
  message: `probe ${marker}`, tree: tree.json.sha, parents: [base],
})
const upd = await gh('PATCH', `${API}/repos/${OWNER}/${REPO}/git/refs/heads/main`, token, { sha: commit.json.sha })
if (upd.status !== 200) throw new Error(`ref update failed: ${upd.status}`)
console.log(`pushed: ${commit.json.sha.slice(0, 7)} marker=${marker}`)

// Poll the Actions run for this SHA.
for (let i = 0; i < 60; i++) {
  await sleep(10000)
  const runs = await gh('GET', `${API}/repos/${OWNER}/${REPO}/actions/runs?head_sha=${commit.json.sha}&per_page=1`, token)
  const run = runs.json?.workflow_runs?.[0]
  if (!run) continue
  if (run.status === 'completed') {
    console.log(`actions: ${run.conclusion}`)
    if (run.conclusion !== 'success') process.exit(1)
    break
  }
  if (i % 6 === 0) console.log(`actions: ${run.status}...`)
}

// Poll the live site for the marker.
const site = `https://${OWNER}.github.io/${REPO}/`
for (let i = 0; i < 30; i++) {
  await sleep(10000)
  try {
    const html = await (await fetch(site)).text()
    if (html.includes(marker)) {
      console.log(`live: ok ${site}`)
      process.exit(0)
    }
  } catch { /* retry */ }
  if (i % 3 === 0) console.log('live: waiting...')
}
console.log('live: TIMEOUT marker not found')
process.exit(1)
