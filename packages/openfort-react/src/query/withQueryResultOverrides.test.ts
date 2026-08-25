import { describe, expect, it, vi } from 'vitest'
import { withQueryResultOverrides } from './withQueryResultOverrides.js'

describe('withQueryResultOverrides', () => {
  it('reads only properties requested by the consumer', () => {
    const readData = vi.fn()
    const readError = vi.fn()
    const result = Object.defineProperties(
      {},
      {
        data: { configurable: true, enumerable: true, get: () => readData() },
        error: { configurable: true, enumerable: true, get: () => readError() },
      }
    )
    const mapped = withQueryResultOverrides(result, {
      get data() {
        return result.data ?? null
      },
      isIdle: true,
    })

    expect(readData).not.toHaveBeenCalled()
    expect(readError).not.toHaveBeenCalled()

    expect(mapped.data).toBeNull()
    expect(readData).toHaveBeenCalledOnce()
    expect(readError).not.toHaveBeenCalled()
  })

  it('keeps override fields enumerable when consumers spread the result', () => {
    const mapped = withQueryResultOverrides({ status: 'pending' }, { data: null, isIdle: true })

    expect({ ...mapped }).toEqual({ status: 'pending', data: null, isIdle: true })
  })
})
