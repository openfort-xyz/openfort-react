'use client'

import ErrorFallbackPage from '../ErrorFallbackPage'

/**
 * Catch-all page for flows that would otherwise spin forever
 * (loading watchdog timeouts, unreachable states).
 */
const NotFoundFallback = () => (
  <ErrorFallbackPage
    header="This is taking longer than expected"
    description="We couldn't load this screen. Go back and try again."
  />
)

export default NotFoundFallback
