import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCopyToClipboard } from './useCopyToClipboard.js'

describe('useCopyToClipboard', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>()

  beforeEach(() => {
    vi.useRealTimers()
    writeText.mockReset()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  })

  it('reports copied only after the clipboard write succeeds', async () => {
    let resolveWrite: (() => void) | undefined
    writeText.mockReturnValue(new Promise<void>((resolve) => (resolveWrite = resolve)))
    const { result } = renderHook(() => useCopyToClipboard())

    let copyPromise: Promise<void>
    act(() => {
      copyPromise = result.current.copy('  wallet-address  ')
    })
    expect(writeText).toHaveBeenCalledWith('wallet-address')
    expect(result.current.copied).toBe(false)

    await act(async () => {
      resolveWrite?.()
      await copyPromise
    })
    expect(result.current.copied).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('handles a rejected write without reporting success or rejecting copy', async () => {
    writeText.mockRejectedValue(new Error('permission denied'))
    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await expect(result.current.copy('value')).resolves.toBeUndefined()
    })
    expect(result.current.copied).toBe(false)
    expect(result.current.error?.message).toBe('permission denied')
  })

  it('handles an unavailable clipboard API', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await expect(result.current.copy('value')).resolves.toBeUndefined()
    })
    expect(result.current.copied).toBe(false)
    expect(result.current.error?.message).toBe('Clipboard API is unavailable.')
  })

  it('clears copied after the configured delay', async () => {
    vi.useFakeTimers()
    writeText.mockResolvedValue()
    const { result } = renderHook(() => useCopyToClipboard(500))
    await act(async () => result.current.copy('value'))
    expect(result.current.copied).toBe(true)

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.copied).toBe(false)
  })
})
