import { useRouter } from '@tanstack/react-router'
import posthog from 'posthog-js'
import { useEffect } from 'react'

export const Analytics = () => {
  const router = useRouter()

  useEffect(() => {
    // we wait for next frame to ensure the location is updated
    setTimeout(() => {
      if (!router.state.matches.length) return

      const lastMatch = router.state.matches[router.state.matches.length - 1]

      if (lastMatch) {
        posthog.capture('$pageview', {
          path: lastMatch.fullPath,
          params: lastMatch.params,
        })
      }
    })
  }, [router]) // track route changes

  return null
}
