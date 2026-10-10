// Builds the test backend binary once per run and sweeps leftovers.
// Per-file servers live in src/test-servers.ts; this file only prepares
// the shared binary they all execute.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sweepStaleArtifacts, TEST_BIN } from './src/test-servers'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export default async function setup(): Promise<() => Promise<void>> {
  sweepStaleArtifacts(true)
  await new Promise<void>((resolve, reject) => {
    const build = spawn('go', ['build', '-o', TEST_BIN, './cmd/server'], { cwd: path.join(root, 'backend') })
    build.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`go build failed: ${code}`))))
    build.on('error', reject)
  })
  return async () => {
    sweepStaleArtifacts(true)
  }
}
