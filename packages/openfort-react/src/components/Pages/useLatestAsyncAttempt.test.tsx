import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { PageActivityProvider } from '../Common/Modal/pageActivity.js'
import { useLatestAsyncAttempt } from './useLatestAsyncAttempt.js'

describe('useLatestAsyncAttempt', () => {
  it('invalidates an older attempt when a new attempt starts', () => {
    const { result } = renderHook(() => useLatestAsyncAttempt())
    let first = 0
    let second = 0

    act(() => {
      first = result.current.beginAttempt()
      second = result.current.beginAttempt()
    })

    expect(result.current.isCurrentAttempt(first)).toBe(false)
    expect(result.current.isCurrentAttempt(second)).toBe(true)
  })

  it('invalidates the current attempt on unmount', () => {
    const { result, unmount } = renderHook(() => useLatestAsyncAttempt())
    const attempt = result.current.beginAttempt()

    unmount()

    expect(result.current.isCurrentAttempt(attempt)).toBe(false)
  })

  it('invalidates the current attempt as soon as its page becomes inactive', () => {
    let active = true
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PageActivityProvider active={active}>{children}</PageActivityProvider>
    )
    const { result, rerender } = renderHook(() => useLatestAsyncAttempt(), { wrapper })
    const attempt = result.current.beginAttempt()

    active = false
    rerender()

    expect(result.current.isCurrentAttempt(attempt)).toBe(false)
  })

  it('does not revive an attempt that started while the page was inactive', () => {
    let active = false
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PageActivityProvider active={active}>{children}</PageActivityProvider>
    )
    const { result, rerender } = renderHook(() => useLatestAsyncAttempt(), { wrapper })
    const attempt = result.current.beginAttempt()

    active = true
    rerender()

    expect(result.current.isCurrentAttempt(attempt)).toBe(false)
    expect(result.current.active).toBe(true)
  })
})
