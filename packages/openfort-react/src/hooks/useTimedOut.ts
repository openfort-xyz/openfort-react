'use client'

import { useEffect, useState } from 'react'

/** Returns true once `ms` milliseconds have elapsed since mount. */
export function useTimedOut(ms: number): boolean {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), ms)
    return () => clearTimeout(timeout)
  }, [ms])

  return timedOut
}
