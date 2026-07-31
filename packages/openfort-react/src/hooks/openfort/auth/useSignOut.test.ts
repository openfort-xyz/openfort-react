import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const logout = vi.fn<() => Promise<void>>()
vi.mock('../../../openfort/useOpenfort', () => ({
  useOpenfortCore: (selector: (state: { logout: typeof logout }) => unknown) => selector({ logout }),
}))

const { useSignOut } = await import('./useSignOut.js')

describe('useSignOut', () => {
  beforeEach(() => logout.mockReset())

  it('does not report success until logout resolves', async () => {
    let resolveLogout: (() => void) | undefined
    logout.mockReturnValue(new Promise<void>((resolve) => (resolveLogout = resolve)))
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useSignOut({ onSuccess }))

    let operation: Promise<unknown>
    act(() => {
      operation = result.current.signOut()
    })
    expect(result.current.isLoading).toBe(true)
    expect(onSuccess).not.toHaveBeenCalled()

    await act(async () => {
      resolveLogout?.()
      await operation
    })
    expect(result.current.isSuccess).toBe(true)
    expect(onSuccess).toHaveBeenCalledOnce()
  })
})
