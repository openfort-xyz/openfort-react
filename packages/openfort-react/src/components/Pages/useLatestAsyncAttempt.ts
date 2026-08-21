'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePageActivity } from '../Common/Modal/pageActivity.js'

/** Keeps async page work from committing after a newer attempt or page deactivation. */
export function useLatestAsyncAttempt() {
  const active = usePageActivity()
  const mountedRef = useRef(true)
  const latestAttemptRef = useRef(0)
  const activeRef = useRef(active)

  if (activeRef.current !== active) {
    activeRef.current = active
    latestAttemptRef.current += 1
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      latestAttemptRef.current += 1
    }
  }, [])

  const beginAttempt = useCallback(() => {
    latestAttemptRef.current += 1
    return latestAttemptRef.current
  }, [])

  const isCurrentAttempt = useCallback(
    (attempt: number) => mountedRef.current && activeRef.current && latestAttemptRef.current === attempt,
    []
  )

  const cancelAttempt = useCallback((attempt: number) => {
    if (latestAttemptRef.current === attempt) latestAttemptRef.current += 1
  }, [])

  return { active, beginAttempt, isCurrentAttempt, cancelAttempt }
}
