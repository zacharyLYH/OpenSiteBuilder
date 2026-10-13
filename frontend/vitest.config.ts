import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The publish payload reads the template's package.json + lock as raw text
  // from ../template (outside the frontend root), so the dev/test server must
  // be allowed to serve the repo root.
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    globalSetup: ['./vitest.global-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    // IO-bound against real backends; finders may wait up to 10s.
    testTimeout: 30000,
  },
})
