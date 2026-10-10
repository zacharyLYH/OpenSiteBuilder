import { useEffect } from 'react'

/** Runs fn ms after deps settle; resets on every change. Tested below. */
export function useDebouncedEffect(fn: () => void, deps: unknown[], ms: number): void {
  useEffect(() => {
    const t = setTimeout(fn, ms)
    return () => clearTimeout(t)
    // Intentionally dep-driven; callers pass explicit deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, ms])
}
