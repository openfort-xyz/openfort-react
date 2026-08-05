import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const observer = { disconnect: vi.fn() }

// Overrides the inert stub from the vitest setup: this suite asserts that the
// hook disconnects its observer on unmount.
Object.defineProperty(globalThis, 'ResizeObserver', {
  value: class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {
      observer.disconnect()
    }
  },
  configurable: true,
  writable: true,
})

const { useContentBounds } = await import('./useContentBounds.js')

describe('useContentBounds', () => {
  afterEach(() => {
    vi.useRealTimers()
    observer.disconnect.mockReset()
  })

  it('keeps its callback ref stable and clears transition resources on unmount', () => {
    vi.useFakeTimers()
    const callbackRefs = new Set<unknown>()

    function Probe() {
      const { contentRef } = useContentBounds([])
      callbackRefs.add(contentRef)
      return <div ref={contentRef} />
    }

    const view = render(<Probe />)
    act(() => vi.advanceTimersByTime(720))

    expect(callbackRefs.size).toBe(1)
    expect(vi.getTimerCount()).toBe(0)

    view.unmount()

    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('releases the detached node while the hook owner remains mounted', () => {
    vi.useFakeTimers()
    let inTransition: boolean | undefined

    function Probe({ showContent }: { showContent: boolean }) {
      const bounds = useContentBounds([])
      inTransition = bounds.inTransition
      return showContent ? <div ref={bounds.contentRef} /> : null
    }

    const view = render(<Probe showContent />)
    expect(vi.getTimerCount()).toBe(1)

    view.rerender(<Probe showContent={false} />)

    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(inTransition).toBe(false)

    view.unmount()
    expect(observer.disconnect).toHaveBeenCalledOnce()
  })
})
