// Published-site file assembly: the static skeleton + the runtime sources.
// Neutral home (no grid dependency): v1 canvas/push and v2 list/push share
// it, so the folder-sync rule lives once. See docs/codegen-v2.md.
import osbTypesSrc from '../osb/types.ts?raw'
import registrySrc from '../osb/registry.tsx?raw'
import siteTypesSrc from '../site/types.ts?raw'
import cnSrc from '../lib/utils.ts?raw'
// The published shell's build environment. Derived from the frontend's own
// package.json at build time — the single source of truth — so a component
// that adds a dependency keeps working in a repo created earlier with zero
// manual sync. Only identity (name) and scripts are rewritten: the
// frontend's build runs `tsc` against a tsconfig the shell doesn't have, so
// the shell gets plain `vite` scripts. Deps ship verbatim to match the lock
// (`npm ci` rejects drift), at the cost of builder-only tooling that never
// ships to browsers.
import frontendPkgSrc from '../../package.json?raw'
import frontendLockSrc from '../../package-lock.json?raw'

/**
 * The published repo's package.json: the frontend's own dependency sets with
 * the shell's identity and vite-only scripts.
 */
export function publishedPackageJson(): string {
  const pkg = JSON.parse(frontendPkgSrc) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  return (
    JSON.stringify(
      {
        name: 'osb-site',
        version: '0.0.0',
        type: 'module',
        private: true,
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: pkg.dependencies ?? {},
        devDependencies: pkg.devDependencies ?? {},
      },
      null,
      2,
    ) + '\n'
  )
}

/** The published repo's lockfile: the frontend's own, matching the deps above. */
export function publishedPackageLock(): string {
  return frontendLockSrc
}

// Every OSB* source, read as text at build time: the components, the engine
// (OSBRuntime), the theme provider, and the shadcn bases they import. A new
// node type ships automatically — no per-type publishing code.
const OSB_SOURCES = import.meta.glob('../osb/OSB*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface RuntimeFile {
  path: string
  content: string
}

/**
 * Runtime files every published page needs. The distribution rule is the
 * glob above — every `OSB*` source — minus co-located tests; non-OSB helpers
 * never match and never ship. The static App.jsx imports the engine under
 * ./osb/* and the manifest, so the FE osb/ sources stay the single source of
 * truth — folder-sync, not codegen.
 */
export const RUNTIME_FILES: RuntimeFile[] = [
  ...Object.entries(OSB_SOURCES)
    // Tests co-locate with components: never publish them.
    .filter(([p]) => !p.includes('.test.'))
    .map(([p, content]) => ({
      path: 'src/' + p.replace('../', ''),
      content,
    })),
  { path: 'src/osb/registry.tsx', content: registrySrc },
  { path: 'src/osb/types.ts', content: osbTypesSrc },
  { path: 'src/site/types.ts', content: siteTypesSrc },
  { path: 'src/lib/utils.ts', content: cnSrc },
  // Build environment (dependencies) — see the import note above.
  { path: 'package.json', content: publishedPackageJson() },
  { path: 'package-lock.json', content: publishedPackageLock() },
]

/**
 * THE skeleton: the one static entry point every published site gets. It
 * imports the manifest and hands it to the engine — no generated JSX, no
 * markup that can break.
 */
export const APP_JSX = `import site from '../site.json'
import { OSBRuntime } from './osb/OSBRuntime'

export default function App() {
  return <OSBRuntime manifest={site} />
}
`
