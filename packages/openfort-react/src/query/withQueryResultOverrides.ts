/**
 * Adds lazily evaluated fields to a TanStack Query result.
 *
 * TanStack tracks which result properties a component reads. Copying or
 * destructuring the result reads every property and makes every state change
 * trigger a render. This proxy forwards only the fields the consumer requests.
 */
export function withQueryResultOverrides<Result extends object, Overrides extends object>(
  result: Result,
  overrides: Overrides
): Result & Overrides {
  return new Proxy(result, {
    get(target, property) {
      if (Object.hasOwn(overrides, property)) return Reflect.get(overrides, property, overrides)
      return Reflect.get(target, property, target)
    },
    getOwnPropertyDescriptor(target, property) {
      if (Object.hasOwn(overrides, property)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(overrides, property)
        return descriptor ? { ...descriptor, configurable: true } : undefined
      }
      return Reflect.getOwnPropertyDescriptor(target, property)
    },
    has(target, property) {
      return Object.hasOwn(overrides, property) || Reflect.has(target, property)
    },
    ownKeys(target) {
      return [...new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(overrides)])]
    },
  }) as Result & Overrides
}
