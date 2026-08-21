'use client'

import { useRef } from 'react'

/**
 * Keeps the newest `value` readable from a ref without making it a dependency.
 *
 * The action hooks take an options object that a consumer will usually write
 * inline. Depending on it directly would give every action a new identity on
 * each render, so an effect depending on one would re-fire forever; reading it
 * through a ref keeps the action stable while still seeing the current
 * callbacks.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value)
  ref.current = value
  return ref
}
