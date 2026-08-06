import type { Openfort } from '@openfort/openfort-js'
import { AuthenticationError } from '../../errors/auth.js'

export type AuthTransition<T> = {
  result: Promise<T>
  isCurrent: () => boolean
}

export type AuthTransitionStarter = <T>(mutation: () => Promise<T>) => AuthTransition<T>

export type AuthSession = {
  isCurrent: () => boolean
}

export type LocalAuthTransition<T> = AuthTransition<T> & {
  settleStale: () => boolean
}

type AuthTransitionState = {
  generation: number
  tail: Promise<void>
}

const transitionStates = new WeakMap<Openfort, AuthTransitionState>()

/** Result returned to a caller whose authentication action lost ownership. */
export function authTransitionSupersededResult() {
  return {
    error: new AuthenticationError('Authentication request was superseded by a newer request.'),
  } as const
}

function getTransitionState(client: Openfort): AuthTransitionState {
  const existing = transitionStates.get(client)
  if (existing) return existing

  const state = { generation: 0, tail: Promise.resolve() }
  transitionStates.set(client, state)
  return state
}

function enqueueTransition<T>(state: AuthTransitionState, mutation: () => Promise<T>): Promise<T> {
  const result = state.tail.then(mutation)
  state.tail = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

/** Captures ownership of the current authenticated principal without reserving a mutation. */
export function captureAuthSession(client: Openfort): AuthSession {
  const state = getTransitionState(client)
  const generation = state.generation
  return { isCurrent: () => state.generation === generation }
}

/** Reserves the latest auth transition and serializes its credential mutation for one client. */
export function reserveAuthTransition<T>(client: Openfort, mutation: () => Promise<T>): AuthTransition<T> {
  const state = getTransitionState(client)
  const generation = state.generation + 1
  state.generation = generation
  const result = enqueueTransition(state, mutation)

  return {
    result,
    isCurrent: () => state.generation === generation,
  }
}

/** Serializes a mutation owned by the current principal without changing that principal. */
export function reserveAuthenticatedMutation<T>(client: Openfort, mutation: () => Promise<T>): AuthTransition<T> {
  const state = getTransitionState(client)
  const generation = state.generation
  return {
    result: enqueueTransition(state, mutation),
    isCurrent: () => state.generation === generation,
  }
}

/** Keeps stale completion state local to the hook invocation that still owns it. */
export function startLocalAuthTransition<T>(
  startTransition: AuthTransitionStarter,
  localGeneration: { current: number },
  mutation: () => Promise<T>,
  onStale: () => void
): LocalAuthTransition<T> {
  const generation = ++localGeneration.current
  const transition = startTransition(mutation)
  return {
    ...transition,
    settleStale: () => {
      if (transition.isCurrent()) return false
      if (localGeneration.current === generation) onStale()
      return true
    },
  }
}
