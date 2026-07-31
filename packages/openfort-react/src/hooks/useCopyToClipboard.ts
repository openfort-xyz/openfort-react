'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useCopyToClipboard(resetDelay = 1000) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const mountedRef = useRef(true)

  const copy = useCallback(
    async (text: string): Promise<void> => {
      if (!text) return

      const trimmed = text.trim()
      try {
        if (!globalThis.navigator?.clipboard?.writeText) {
          throw new Error('Clipboard API is unavailable.')
        }
        await navigator.clipboard.writeText(trimmed)
        if (!mountedRef.current) return
        setError(null)
        setCopied(true)
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) setCopied(false)
        }, resetDelay)
      } catch (cause) {
        if (!mountedRef.current) return
        setCopied(false)
        setError(cause instanceof Error ? cause : new Error('Failed to copy text.'))
      }
    },
    [resetDelay]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { copied, error, copy }
}
