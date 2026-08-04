import { expect, it, vi } from 'vitest'
import { WalletNotConnectedError } from '../../errors/wallet.js'
import {
  captureEmbeddedSignerSession,
  holdEmbeddedSignerOperationsDuringAuthTransition,
  invalidateEmbeddedSignerOperations,
  isEmbeddedSignerOperationInvalidationError,
  reserveEmbeddedSignerPublication,
  runEmbeddedSignerOperation,
} from './embeddedSignerOperationQueue.js'

it('reserves publication ownership across hook instances that share a client', () => {
  const client = {} as never
  const otherClient = {} as never
  const first = reserveEmbeddedSignerPublication(client)
  const independent = reserveEmbeddedSignerPublication(otherClient)

  expect(first()).toBe(true)
  expect(independent()).toBe(true)

  const second = reserveEmbeddedSignerPublication(client)

  expect(first()).toBe(false)
  expect(second()).toBe(true)
  expect(independent()).toBe(true)
})

it('lets async preparation detect that its captured wallet session was invalidated', () => {
  const client = {} as never
  const session = captureEmbeddedSignerSession(client)

  invalidateEmbeddedSignerOperations(client)

  expect(() => session.assertCurrent()).toThrowError(
    expect.objectContaining({
      name: 'WalletNotConnectedError',
      shortMessage: 'The wallet session changed before the operation could finish.',
    })
  )
})

it('reserves the client queue before starting the first operation', async () => {
  const client = {} as never
  const events: string[] = []
  let releaseFirst!: () => void
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })

  const first = runEmbeddedSignerOperation(client, async () => {
    events.push('first:start')
    await firstGate
    events.push('first:end')
  })
  const second = runEmbeddedSignerOperation(client, async () => {
    events.push('second:start')
  })

  await vi.waitFor(() => expect(events).toEqual(['first:start']))
  releaseFirst()
  await Promise.all([first, second])
  expect(events).toEqual(['first:start', 'first:end', 'second:start'])
})

it('rejects signer work reserved while an authentication transition is pending', async () => {
  const client = {} as never
  let finishTransition!: () => void
  const transition = new Promise<void>((resolve) => {
    finishTransition = resolve
  })
  holdEmbeddedSignerOperationsDuringAuthTransition(client, transition)

  const operation = vi.fn(async () => undefined)
  const pending = runEmbeddedSignerOperation(client, operation)
  await Promise.resolve()
  expect(operation).not.toHaveBeenCalled()

  finishTransition()

  await expect(pending).rejects.toMatchObject({
    name: 'WalletNotConnectedError',
    shortMessage: 'The wallet session changed before the operation could run.',
  })
  expect(operation).not.toHaveBeenCalled()
})

it('rejects a reserved operation when its wallet session is invalidated', async () => {
  const client = {} as never
  let releaseFirst!: () => void
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const firstStarted = vi.fn()
  const first = runEmbeddedSignerOperation(client, async () => {
    firstStarted()
    await firstGate
  })
  await vi.waitFor(() => expect(firstStarted).toHaveBeenCalledOnce())
  const secondOperation = vi.fn(async () => undefined)
  const second = runEmbeddedSignerOperation(client, secondOperation)

  invalidateEmbeddedSignerOperations(client)
  releaseFirst()

  await expect(first).rejects.toMatchObject({
    name: 'WalletNotConnectedError',
    shortMessage: 'The wallet session changed before the operation could finish.',
  })
  await expect(second).rejects.toMatchObject({
    name: 'WalletNotConnectedError',
    shortMessage: 'The wallet session changed before the operation could run.',
  })
  expect(secondOperation).not.toHaveBeenCalled()
})

it('suppresses a running operation result when its wallet session is invalidated', async () => {
  const client = {} as never
  let resolveOperation!: (value: string) => void
  const operationResult = new Promise<string>((resolve) => {
    resolveOperation = resolve
  })
  const operation = vi.fn(() => operationResult)
  const running = runEmbeddedSignerOperation(client, operation)

  await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce())
  invalidateEmbeddedSignerOperations(client)
  const nextOperation = vi.fn(async () => 'current-session-result')
  const next = runEmbeddedSignerOperation(client, nextOperation)
  resolveOperation('stale-sensitive-result')

  await expect(running).rejects.toMatchObject({
    name: 'WalletNotConnectedError',
    shortMessage: 'The wallet session changed before the operation could finish.',
  })
  await expect(next).resolves.toBe('current-session-result')
  expect(nextOperation).toHaveBeenCalledOnce()
})

it('replaces a running operation error when its wallet session is invalidated', async () => {
  const client = {} as never
  let rejectOperation!: (error: Error) => void
  const operationResult = new Promise<never>((_resolve, reject) => {
    rejectOperation = reject
  })
  const operation = vi.fn(() => operationResult)
  const running = runEmbeddedSignerOperation(client, operation)

  await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce())
  invalidateEmbeddedSignerOperations(client)
  rejectOperation(new Error('stale operation failure'))

  await expect(running).rejects.toMatchObject({
    name: 'WalletNotConnectedError',
    shortMessage: 'The wallet session changed before the operation could finish.',
  })
})

it('lets a running operation guard its synchronous commit after awaited work', async () => {
  const client = {} as never
  let resolveWork!: () => void
  const work = new Promise<void>((resolve) => {
    resolveWork = resolve
  })
  const started = vi.fn()
  const commit = vi.fn()
  const running = runEmbeddedSignerOperation(client, async ({ assertCurrent }) => {
    started()
    await work
    assertCurrent()
    commit()
  })

  await vi.waitFor(() => expect(started).toHaveBeenCalledOnce())
  invalidateEmbeddedSignerOperations(client)
  resolveWork()

  const error = await running.catch((cause: unknown) => cause)
  expect(isEmbeddedSignerOperationInvalidationError(error)).toBe(true)
  expect(error).toMatchObject({
    name: 'WalletNotConnectedError',
    shortMessage: 'The wallet session changed before the operation could finish.',
  })
  expect(commit).not.toHaveBeenCalled()
})

it('does not classify ordinary wallet connection failures as queue invalidation', () => {
  expect(isEmbeddedSignerOperationInvalidationError(new WalletNotConnectedError())).toBe(false)
})
