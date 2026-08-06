import { describe, expect, it, vi } from 'vitest'
import {
  clearPersistentOperation,
  getOrCreatePersistentOperation,
  invalidatePersistentOperations,
  PersistentOperationLaneBusyError,
} from './persistentOperationRegistry.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe('persistentOperationRegistry', () => {
  it('reattaches the same key without restarting remote work', async () => {
    const owner = {}
    const pending = deferred<string>()
    const start = vi.fn(() => pending.promise)

    const first = getOrCreatePersistentOperation({ owner, key: 'create:evm', principalIsCurrent: () => true, start })
    const second = getOrCreatePersistentOperation({ owner, key: 'create:evm', principalIsCurrent: () => true, start })

    expect(second.promise).toBe(first.promise)
    expect(start).toHaveBeenCalledTimes(1)
    pending.resolve('created')
    await expect(second.promise).resolves.toBe('created')
  })

  it('rejects a different semantic operation while its lane is busy', async () => {
    const owner = {}
    const pending = deferred<string>()
    const automatic = vi.fn(() => pending.promise)
    const passkey = vi.fn(async () => 'passkey')

    getOrCreatePersistentOperation({
      owner,
      key: 'create:evm:automatic',
      lane: 'create:evm',
      principalIsCurrent: () => true,
      start: automatic,
    })
    const conflict = getOrCreatePersistentOperation({
      owner,
      key: 'create:evm:passkey',
      lane: 'create:evm',
      principalIsCurrent: () => true,
      start: passkey,
    })

    await expect(conflict.promise).rejects.toBeInstanceOf(PersistentOperationLaneBusyError)
    expect(automatic).toHaveBeenCalledTimes(1)
    expect(passkey).not.toHaveBeenCalled()
    pending.resolve('automatic')
  })

  it('does not clear or time out pending non-cancellable work', async () => {
    vi.useFakeTimers()
    const owner = {}
    const pending = deferred<string>()
    const start = vi.fn(() => pending.promise)
    const first = getOrCreatePersistentOperation({ owner, key: 'recover', principalIsCurrent: () => true, start })

    clearPersistentOperation(owner, 'recover')
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    const reattached = getOrCreatePersistentOperation({ owner, key: 'recover', principalIsCurrent: () => true, start })

    expect(reattached.promise).toBe(first.promise)
    expect(start).toHaveBeenCalledTimes(1)
    pending.resolve('recovered')
    await reattached.promise
    vi.useRealTimers()
  })

  it('allows an explicit retry after a settled operation is consumed', async () => {
    const owner = {}
    const start = vi.fn(async () => 'done')
    const first = getOrCreatePersistentOperation({ owner, key: 'verify', principalIsCurrent: () => true, start })
    await first.promise

    clearPersistentOperation(owner, 'verify')
    const retry = getOrCreatePersistentOperation({ owner, key: 'verify', principalIsCurrent: () => true, start })

    expect(retry.promise).not.toBe(first.promise)
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('isolates listener failures from sibling subscribers', async () => {
    const owner = {}
    const pending = deferred<void>()
    let publish!: (snapshot: string) => void
    const operation = getOrCreatePersistentOperation<void, string>({
      owner,
      key: 'track',
      principalIsCurrent: () => true,
      start: async (context) => {
        publish = context.publish
        return pending.promise
      },
    })
    const sibling = vi.fn()
    operation.subscribe(() => {
      throw new Error('consumer failed')
    })
    operation.subscribe(sibling)

    publish('processing')

    expect(sibling).toHaveBeenCalledWith('processing')
    pending.resolve()
    await operation.promise
  })

  it('invalidates work when its owner epoch or principal changes', async () => {
    const owner = {}
    let principalIsCurrent = true
    const firstPending = deferred<string>()
    const first = getOrCreatePersistentOperation({
      owner,
      key: 'create',
      principalIsCurrent: () => principalIsCurrent,
      start: () => firstPending.promise,
    })

    principalIsCurrent = false
    const principalReplacement = getOrCreatePersistentOperation({
      owner,
      key: 'create',
      principalIsCurrent: () => true,
      start: async () => 'new-principal',
    })
    expect(first.isCurrent()).toBe(false)
    await expect(principalReplacement.promise).resolves.toBe('new-principal')

    invalidatePersistentOperations(owner)
    expect(principalReplacement.isCurrent()).toBe(false)
    const providerReplacement = getOrCreatePersistentOperation({
      owner,
      key: 'create',
      principalIsCurrent: () => true,
      start: async () => 'new-provider-epoch',
    })
    await expect(providerReplacement.promise).resolves.toBe('new-provider-epoch')
    firstPending.resolve('stale')
  })

  it('keeps sibling provider owners isolated', async () => {
    const firstOwner = {}
    const secondOwner = {}
    const firstStart = vi.fn(async () => 'first')
    const secondStart = vi.fn(async () => 'second')

    const first = getOrCreatePersistentOperation({
      owner: firstOwner,
      key: 'shared-key',
      principalIsCurrent: () => true,
      start: firstStart,
    })
    const second = getOrCreatePersistentOperation({
      owner: secondOwner,
      key: 'shared-key',
      principalIsCurrent: () => true,
      start: secondStart,
    })

    await expect(first.promise).resolves.toBe('first')
    await expect(second.promise).resolves.toBe('second')
    expect(firstStart).toHaveBeenCalledTimes(1)
    expect(secondStart).toHaveBeenCalledTimes(1)
  })
})
