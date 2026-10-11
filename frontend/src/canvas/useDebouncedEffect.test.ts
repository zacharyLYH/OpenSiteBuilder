import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDebouncedEffect } from './useDebouncedEffect'

describe('useDebouncedEffect', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits ms before firing, once, with the latest closure', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    let value = 'a'
    const { rerender } = renderHook(({ v }: { v: string }) => {
      useDebouncedEffect(() => fn(v), [v], 500)
    }, { initialProps: { v: value } })

    value = 'b'
    rerender({ v: value })
    vi.advanceTimersByTime(499)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('restarts the clock on every change and cleans up on unmount', () => {    vi.useFakeTimers()
    const fn = vi.fn()
    const { rerender, unmount } = renderHook(({ v }: { v: number }) => {
      useDebouncedEffect(() => fn(v), [v], 300)
    }, { initialProps: { v: 1 } })

    rerender({ v: 2 })
    vi.advanceTimersByTime(200)
    rerender({ v: 3 })
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()
    unmount()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('fires the latest fn even when deps are unchanged', () => {
    vi.useFakeTimers()
    const { rerender } = renderHook(({ fn }: { fn: () => void }) => {
      useDebouncedEffect(fn, [], 500)
    }, { initialProps: { fn: () => {} } })

    const latest = vi.fn()
    rerender({ fn: latest })
    vi.advanceTimersByTime(500)
    expect(latest).toHaveBeenCalledTimes(1)
  })
})
