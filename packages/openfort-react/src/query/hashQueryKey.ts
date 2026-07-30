import type { QueryKey } from '@tanstack/react-query'

function hasObjectPrototype(value: unknown): boolean {
  return Object.prototype.toString.call(value) === '[object Object]'
}

/** True for `{}`-shaped values only — class instances, arrays and boxed types are excluded. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!hasObjectPrototype(value)) return false
  const ctor = (value as { constructor?: unknown }).constructor
  if (ctor === undefined) return true
  const prototype = (ctor as { prototype?: unknown }).prototype
  if (!hasObjectPrototype(prototype)) return false
  return Object.hasOwn(prototype as object, 'isPrototypeOf')
}

/**
 * Hash a query key to a stable cache string.
 *
 * TanStack Query's default hash function calls `JSON.stringify`, which throws
 * `TypeError: Do not know how to serialize a BigInt`. Openfort query keys carry
 * bigints (token amounts, balances, gas values), so bigints are encoded as their
 * decimal digits and object keys are sorted, making the hash independent of
 * property insertion order.
 */
export function hashQueryKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey, (_key, value) => {
    if (typeof value === 'bigint') return value.toString()
    if (isPlainObject(value)) {
      const sorted: Record<string, unknown> = {}
      for (const key of Object.keys(value).sort()) sorted[key] = value[key]
      return sorted
    }
    return value
  })
}
