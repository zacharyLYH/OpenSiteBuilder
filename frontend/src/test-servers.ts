// Per-file isolated servers for parallel tests. Each test file gets its
// own mock GitHub plus its own real backend, so scenarios never leak
// across files. Everything spawned here is killed and deleted on close,
// plus a sweep for leftovers from killed runs.
//
// The backend binary is built once per run by globalSetup (see
// vitest.global-setup.ts) and reused by every file.
import { spawn, type ChildProcess } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const root = path.resolve(here, '..', '..')

export const TEST_BIN = path.join(os.tmpdir(), 'osb-test-backend.bin')

export interface Servers {
  backendUrl: string
  mockUrl: string
  close: () => Promise<void>
}

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port
      s.close(() => resolve(port))
    })
  })
}

function waitForOutput(proc: ChildProcess, needle: RegExp, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = ''
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${needle}`)), timeoutMs)
    if (!proc.stdout) {
      clearTimeout(timer)
      reject(new Error('child process has no piped stdout'))
      return
    }
    proc.stdout.on('data', (c: Buffer) => {
      buf += c.toString()
      const m = buf.match(needle)
      if (m) {
        clearTimeout(timer)
        resolve(m[1] ?? m[0])
      }
    })
    proc.on('error', reject)
  })
}

async function waitForHealth(url: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url)
      if (r.status === 200) return
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`backend never healthy at ${url}`)
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// sweep removes binaries and keys from runs that died without cleanup,
// and reaps their orphaned mock/backend processes via pidfiles.
// dropBin also removes the shared run binary; only the global setup,
// which rebuilds it right after, may pass true.
export function sweepStaleArtifacts(dropBin = false): void {
  let entries: string[]
  try {
    entries = fs.readdirSync(os.tmpdir())
  } catch {
    return
  }
  for (const name of entries) {
    const procFile = name.match(/^osb-test-procs-(\d+)(-\d+)?\.json$/)
    if (procFile) {
      const ownerPid = Number(procFile[1])
      if (!alive(ownerPid)) {
        try {
          const procs = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), name), 'utf8')) as {
            mockPid?: number
            backendPid?: number
          }
          for (const pid of [procs.mockPid, procs.backendPid]) {
            if (pid && alive(pid)) {
              try {
                process.kill(pid, 'SIGKILL')
              } catch { /* already gone */ }
            }
          }
        } catch { /* unreadable: drop it */ }
        try {
          fs.unlinkSync(path.join(os.tmpdir(), name))
        } catch { /* ignore */ }
      }
      continue
    }
    const m = name.match(/^osb-test-(backend|key)-(\d+)(\.bin|\.pem)?$/)
    if (!m) continue
    if (!alive(Number(m[2]))) {
      try {
        fs.unlinkSync(path.join(os.tmpdir(), name))
      } catch { /* ignore */ }
    }
  }
  // Shared run binary is rebuilt every run; drop it when orphaned too.
  if (dropBin) {
    try {
      fs.unlinkSync(TEST_BIN)
    } catch { /* ignore */ }
  }
}

export async function startServers(): Promise<Servers> {
  sweepStaleArtifacts()

  const mockPort = await freePort()
  const mockProc = spawn('node', [path.join(root, 'scripts/mock-github.mjs'), '--port', String(mockPort)], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await waitForOutput(mockProc, /MOCK_READY port=(\d+)/, 15000)

  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const exported = privateKey.export({ type: 'pkcs1', format: 'pem' })
  if (typeof exported !== 'string') throw new Error('key export must be PEM text')
  const keyPem = exported
  const keyPath = path.join(os.tmpdir(), `osb-test-key-${process.pid}.pem`)
  fs.writeFileSync(keyPath, keyPem, { mode: 0o600 })

  const backendPort = await freePort()
  const backendProc = spawn(TEST_BIN, [], {
    env: {
      ...process.env,
      ADDR: `127.0.0.1:${backendPort}`,
      APP_ID: '123',
      APP_SLUG: 'test-app',
      CLIENT_ID: 'test-client',
      CLIENT_SECRET: 'test-secret',
      PRIVATE_KEY_PATH: keyPath,
      SESSION_HMAC_KEY: 'test-session-key-32-bytes-long!!',
      PUBLIC_BASE_URL: `http://127.0.0.1:${backendPort}`,
      TEMPLATE_OWNER: 'tmpl-owner',
      TEMPLATE_REPO: 'tmpl-repo',
      GITHUB_API_BASE: `http://127.0.0.1:${mockPort}`,
      GITHUB_OAUTH_BASE: `http://127.0.0.1:${mockPort}`,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  await waitForHealth(`http://127.0.0.1:${backendPort}/healthz`)

  // Pidfile lets the next sweep reap these processes if this run dies.
  // Port suffix keeps parallel files in one worker from overwriting it.
  const procFile = path.join(os.tmpdir(), `osb-test-procs-${process.pid}-${backendPort}.json`)
  try {
    fs.writeFileSync(
      procFile,
      JSON.stringify({ mockPid: mockProc.pid, backendPid: backendProc.pid }),
    )
  } catch { /* best effort */ }

  let closed = false
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    mockProc.kill()
    backendProc.kill()
    try {
      fs.unlinkSync(keyPath)
    } catch { /* ignore */ }
    try {
      fs.unlinkSync(procFile)
    } catch { /* ignore */ }
  }
  return {
    backendUrl: `http://127.0.0.1:${backendPort}`,
    mockUrl: `http://127.0.0.1:${mockPort}`,
    close,
  }
}
