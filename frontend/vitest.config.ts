import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    globalSetup: ['./vitest.global-setup.ts'],
    // IO-bound against real backends; finders may wait up to 10s.
    testTimeout: 30000,
  },
})
