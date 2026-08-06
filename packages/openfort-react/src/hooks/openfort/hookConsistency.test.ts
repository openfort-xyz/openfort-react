import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenfortError } from '../../errors/base.js'
import { logger } from '../../utils/logger.js'
import { onError, onSuccess } from './hookConsistency.js'

describe('hook callback isolation', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the action result and continues after a synchronous success callback failure', () => {
    const data = { value: 1 }
    const perCallSuccess = vi.fn()

    expect(
      onSuccess({
        hookOptions: {
          onSuccess: () => {
            throw new Error('consumer callback failed')
          },
        },
        options: { onSuccess: perCallSuccess },
        data,
      })
    ).toBe(data)

    expect(perCallSuccess).toHaveBeenCalledWith(data)
    expect(logger.error).toHaveBeenCalledWith(
      '[openfort-hook] onSuccess callback threw',
      expect.objectContaining({ message: 'consumer callback failed' })
    )
  })

  it('resolves with the action error while reporting an asynchronous error callback rejection', async () => {
    const error = new OpenfortError('action failed')

    expect(
      onError({
        hookOptions: {
          onError: async () => {
            throw new Error('async consumer callback failed')
          },
        },
        error,
      })
    ).toEqual({ error })

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        '[openfort-hook] onError callback rejected',
        expect.objectContaining({ message: 'async consumer callback failed' })
      )
    )
  })
})
