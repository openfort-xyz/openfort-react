import { OpenfortError, OpenfortReactErrorType } from '../../errors/base.js'

type OperationOwner = object

type OperationContext<TSnapshot> = {
  /** Publishes the latest observable value to every mounted consumer. */
  publish: (snapshot: TSnapshot) => void
  /** Reports whether the principal and retention window still own this operation. */
  isCurrent: () => boolean
}

type PersistentOperationOptions<TResult, TSnapshot> = {
  owner: OperationOwner
  key: string
  /** Serializes mutually exclusive mutations that use different operation keys. */
  lane?: string
  principalIsCurrent: () => boolean
  start: (context: OperationContext<TSnapshot>) => Promise<TResult>
  /** Time a settled result remains available for a remounted consumer. */
  settledRetentionMs?: number
  /** Stops restartable background work after its last observer leaves. */
  orphanRetentionMs?: number
}

type OperationEntry<TResult, TSnapshot> = {
  promise: Promise<TResult>
  epoch: number
  lane: string | undefined
  principalIsCurrent: () => boolean
  active: boolean
  settled: boolean
  snapshot: TSnapshot | undefined
  hasSnapshot: boolean
  listeners: Set<(snapshot: TSnapshot) => void>
  settledTimer: ReturnType<typeof setTimeout> | null
  orphanTimer: ReturnType<typeof setTimeout> | null
  orphanRetentionMs: number | undefined
}

export type PersistentOperation<TResult, TSnapshot = never> = {
  promise: Promise<TResult>
  isCurrent: () => boolean
  getSnapshot: () => TSnapshot | undefined
  subscribe: (listener: (snapshot: TSnapshot) => void) => () => void
}

const DEFAULT_SETTLED_RETENTION_MS = 10 * 60 * 1000
type OwnerRegistry = {
  epoch: number
  operations: Map<string, OperationEntry<unknown, unknown>>
}

const operationRegistries = new WeakMap<OperationOwner, OwnerRegistry>()

function registryFor(owner: OperationOwner): OwnerRegistry {
  const existing = operationRegistries.get(owner)
  if (existing) return existing
  const registry = { epoch: 0, operations: new Map<string, OperationEntry<unknown, unknown>>() }
  operationRegistries.set(owner, registry)
  return registry
}

function removeEntry(owner: OperationOwner, key: string, entry: OperationEntry<unknown, unknown>): void {
  const registry = operationRegistries.get(owner)
  if (registry?.operations.get(key) !== entry) return
  entry.active = false
  if (entry.settledTimer) clearTimeout(entry.settledTimer)
  if (entry.orphanTimer) clearTimeout(entry.orphanTimer)
  registry.operations.delete(key)
}

export class PersistentOperationLaneBusyError extends OpenfortError {
  override readonly name = 'PersistentOperationLaneBusyError'

  constructor() {
    super('Another wallet operation is already in progress.', {
      type: OpenfortReactErrorType.WALLET_ERROR,
    })
  }
}

/** Returns one client-scoped operation that a remounted page can observe again. */
export function getOrCreatePersistentOperation<TResult, TSnapshot = never>(
  options: PersistentOperationOptions<TResult, TSnapshot>
): PersistentOperation<TResult, TSnapshot> {
  const registry = registryFor(options.owner)
  const candidate = registry.operations.get(options.key) as OperationEntry<TResult, TSnapshot> | undefined
  if (
    candidate &&
    candidate.epoch === registry.epoch &&
    candidate.active &&
    candidate.principalIsCurrent() &&
    options.principalIsCurrent()
  ) {
    return operationHandle(options.owner, options.key, candidate)
  }
  if (candidate) removeEntry(options.owner, options.key, candidate as OperationEntry<unknown, unknown>)

  if (options.lane) {
    const laneIsBusy = Array.from(registry.operations.values()).some(
      (entry) =>
        entry.epoch === registry.epoch &&
        entry.active &&
        !entry.settled &&
        entry.lane === options.lane &&
        entry.principalIsCurrent()
    )
    if (laneIsBusy) {
      return {
        promise: Promise.reject(new PersistentOperationLaneBusyError()),
        isCurrent: () => false,
        getSnapshot: () => undefined,
        subscribe: () => () => {},
      }
    }
  }

  let resolveOperation: (result: TResult | PromiseLike<TResult>) => void = () => {}
  let rejectOperation: (cause?: unknown) => void = () => {}
  const entry: OperationEntry<TResult, TSnapshot> = {
    promise: new Promise<TResult>((resolve, reject) => {
      resolveOperation = resolve
      rejectOperation = reject
    }),
    epoch: registry.epoch,
    lane: options.lane,
    principalIsCurrent: options.principalIsCurrent,
    active: true,
    settled: false,
    snapshot: undefined as TSnapshot | undefined,
    hasSnapshot: false as boolean,
    listeners: new Set<(snapshot: TSnapshot) => void>(),
    settledTimer: null,
    orphanTimer: null,
    orphanRetentionMs: options.orphanRetentionMs,
  }

  const context: OperationContext<TSnapshot> = {
    isCurrent: () => entry.epoch === registry.epoch && entry.active && entry.principalIsCurrent(),
    publish: (snapshot) => {
      if (!entry.active || !entry.principalIsCurrent()) return
      entry.snapshot = snapshot
      entry.hasSnapshot = true
      for (const listener of entry.listeners) {
        try {
          listener(snapshot)
        } catch {
          // One consumer cannot prevent the remaining consumers from receiving the snapshot.
        }
      }
    },
  }
  registry.operations.set(options.key, entry as OperationEntry<unknown, unknown>)
  try {
    options.start(context).then(resolveOperation, rejectOperation)
  } catch (cause) {
    rejectOperation(cause)
  }

  void entry.promise.then(
    () => settleEntry(options.owner, options.key, entry, options.settledRetentionMs),
    () => settleEntry(options.owner, options.key, entry, options.settledRetentionMs)
  )
  return operationHandle(options.owner, options.key, entry)
}

function settleEntry<TResult, TSnapshot>(
  owner: OperationOwner,
  key: string,
  entry: OperationEntry<TResult, TSnapshot>,
  retentionMs = DEFAULT_SETTLED_RETENTION_MS
): void {
  if (!entry.active) return
  entry.settled = true
  entry.settledTimer = setTimeout(() => removeEntry(owner, key, entry as OperationEntry<unknown, unknown>), retentionMs)
}

function operationHandle<TResult, TSnapshot>(
  owner: OperationOwner,
  key: string,
  entry: OperationEntry<TResult, TSnapshot>
): PersistentOperation<TResult, TSnapshot> {
  return {
    promise: entry.promise,
    isCurrent: () => entry.epoch === registryFor(owner).epoch && entry.active && entry.principalIsCurrent(),
    getSnapshot: () => (entry.hasSnapshot ? entry.snapshot : undefined),
    subscribe: (listener) => {
      if (!entry.active) return () => {}
      if (entry.orphanTimer) {
        clearTimeout(entry.orphanTimer)
        entry.orphanTimer = null
      }
      entry.listeners.add(listener)
      if (entry.hasSnapshot) {
        try {
          listener(entry.snapshot as TSnapshot)
        } catch {
          // Subscription remains usable when a consumer rejects its initial snapshot.
        }
      }
      return () => {
        entry.listeners.delete(listener)
        if (entry.listeners.size > 0 || entry.orphanRetentionMs === undefined || entry.settled) return
        entry.orphanTimer = setTimeout(
          () => removeEntry(owner, key, entry as OperationEntry<unknown, unknown>),
          entry.orphanRetentionMs
        )
      }
    },
  }
}

/** Removes settled work after its result has been consumed so an explicit retry starts fresh work. */
export function clearPersistentOperation(owner: OperationOwner, key: string): void {
  const entry = operationRegistries.get(owner)?.operations.get(key)
  if (entry?.settled) removeEntry(owner, key, entry)
}

/** Invalidates every operation owned by a provider before its principal changes. */
export function invalidatePersistentOperations(owner: OperationOwner): void {
  const registry = registryFor(owner)
  registry.epoch += 1
  for (const [key, entry] of registry.operations) removeEntry(owner, key, entry)
}

/** Reports whether a remounted consumer can attach to an existing operation. */
export function hasPersistentOperation(owner: OperationOwner, key: string): boolean {
  const registry = operationRegistries.get(owner)
  const entry = registry?.operations.get(key)
  return !!registry && !!entry?.active && entry.epoch === registry.epoch && entry.principalIsCurrent()
}

/** Returns an existing operation without creating replacement work. */
export function getPersistentOperation<TResult, TSnapshot = never>(
  owner: OperationOwner,
  key: string
): PersistentOperation<TResult, TSnapshot> | null {
  const registry = operationRegistries.get(owner)
  const entry = registry?.operations.get(key) as OperationEntry<TResult, TSnapshot> | undefined
  if (!registry || !entry?.active || entry.epoch !== registry.epoch || !entry.principalIsCurrent()) return null
  return operationHandle(owner, key, entry)
}
