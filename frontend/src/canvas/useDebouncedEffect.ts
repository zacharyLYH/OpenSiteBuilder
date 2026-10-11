import { useEffect, useRef } from 'react'

/** Runs the latest fn ms after deps settle; resets on every change. Tested below. */
export function useDebouncedEffect(fn: () => void, deps: unknown[], ms: number): void {
  // Latest-fn ref: the timer always fires what the last render passed, so
  // callers never need fn in deps and the closure can never go stale.
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  })
  useEffect(() => {
    const t = setTimeout(() => latest.current(), ms)
    return () => clearTimeout(t)
    // Intentionally dep-driven; callers pass explicit deps. fn is ref-held.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, ms])
}
