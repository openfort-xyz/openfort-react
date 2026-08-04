import type { Openfort } from '@openfort/openfort-js'
import { WalletNotConnectedError } from '../../errors/wallet.js'

const operationTails = new WeakMap<Openfort, Promise<void>>()
const operationGenerations = new WeakMap<Openfort, number>()
const publicationGenerations = new WeakMap<Openfort, number>()

class EmbeddedSignerOperationInvalidatedError extends WalletNotConnectedError {}

function assertOperationGeneration(client: Openfort, generation: number, shortMessage: string): void {
  if ((operationGenerations.get(client) ?? 0) !== generation) {
    throw new EmbeddedSignerOperationInvalidatedError(shortMessage)
  }
}

export type EmbeddedSignerOperationContext = {
  /** Throws when the wallet session that reserved the operation is no longer current. */
  assertCurrent: () => void
}

/** Captures the current wallet session so async preparation cannot cross an auth boundary unnoticed. */
export function captureEmbeddedSignerSession(client: Openfort): EmbeddedSignerOperationContext {
  const generation = operationGenerations.get(client) ?? 0
  return {
    assertCurrent: () =>
      assertOperationGeneration(client, generation, 'The wallet session changed before the operation could finish.'),
  }
}

/** Reserves client-wide ownership of the next embedded-wallet state publication. */
export function reserveEmbeddedSignerPublication(client: Openfort): () => boolean {
  const generation = (publicationGenerations.get(client) ?? 0) + 1
  publicationGenerations.set(client, generation)
  return () => publicationGenerations.get(client) === generation
}

/** Identifies queue invalidation without conflating it with other wallet connection failures. */
export function isEmbeddedSignerOperationInvalidationError(
  error: unknown
): error is EmbeddedSignerOperationInvalidatedError {
  return error instanceof EmbeddedSignerOperationInvalidatedError
}

/** Prevents signer operations reserved in the current session from starting. */
export function invalidateEmbeddedSignerOperations(client: Openfort): void {
  operationGenerations.set(client, (operationGenerations.get(client) ?? 0) + 1)
}

/**
 * Keeps signer work reserved during a credential transition behind a barrier,
 * then invalidates that work before the barrier opens.
 */
export function holdEmbeddedSignerOperationsDuringAuthTransition(client: Openfort, transition: Promise<unknown>): void {
  invalidateEmbeddedSignerOperations(client)

  const previous = operationTails.get(client) ?? Promise.resolve()
  let release!: () => void
  const reservedTail = new Promise<void>((resolve) => {
    release = resolve
  })
  operationTails.set(client, reservedTail)

  const transitionSettled = transition.then(
    () => invalidateEmbeddedSignerOperations(client),
    () => invalidateEmbeddedSignerOperations(client)
  )
  void Promise.all([previous, transitionSettled]).then(() => {
    release()
    if (operationTails.get(client) === reservedTail) operationTails.delete(client)
  })
}

/**
 * Serializes operations that read or replace one Openfort client's embedded signer.
 *
 * React hooks can be mounted more than once, so the queue is keyed by the client
 * rather than stored in one hook instance. The queue is intentionally non-reentrant:
 * an atomic operation that already holds it uses the raw provider from the client,
 * while public serialized providers acquire the queue for their own requests.
 */
export function runEmbeddedSignerOperation<T>(
  client: Openfort,
  operation: (context: EmbeddedSignerOperationContext) => Promise<T>
): Promise<T> {
  const previous = operationTails.get(client)
  const generation = operationGenerations.get(client) ?? 0
  let release!: () => void
  const reservedTail = new Promise<void>((resolve) => {
    release = resolve
  })
  operationTails.set(client, reservedTail)

  const result = (previous ?? Promise.resolve()).then(async () => {
    assertOperationGeneration(client, generation, 'The wallet session changed before the operation could run.')
    const context = captureEmbeddedSignerSession(client)
    let value: T
    try {
      value = await operation(context)
    } catch (error) {
      assertOperationGeneration(client, generation, 'The wallet session changed before the operation could finish.')
      throw error
    }
    assertOperationGeneration(client, generation, 'The wallet session changed before the operation could finish.')
    return value
  })
  void result.then(
    () => {
      release()
      if (operationTails.get(client) === reservedTail) operationTails.delete(client)
    },
    () => {
      release()
      if (operationTails.get(client) === reservedTail) operationTails.delete(client)
    }
  )
  return result
}
