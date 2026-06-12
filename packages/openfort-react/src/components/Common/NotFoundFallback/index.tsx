'use client'

import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import Button from '../Button'
import Loader from '../Loading'

/**
 * Catch-all page for flows that would otherwise spin forever
 * (loading watchdog timeouts, unreachable states).
 */
const NotFoundFallback = () => {
  const { setRoute } = useOpenfort()

  return (
    <PageContent onBack={routes.PROVIDERS}>
      <Loader
        header="We couldn't find what you're looking for"
        isError
        description="This is taking longer than expected. Go back to sign in and try again."
      />
      <Button onClick={() => setRoute(routes.PROVIDERS)}>Back to sign in</Button>
    </PageContent>
  )
}

export default NotFoundFallback
