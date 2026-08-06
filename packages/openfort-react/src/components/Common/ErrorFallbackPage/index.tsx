'use client'

import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import Button from '../Button/index.js'
import Loader from '../Loading/index.js'

type ErrorFallbackPageProps = {
  header: string
  description: string
  /**
   * Offers a reload alongside the usual way out.
   *
   * `React.lazy` caches a rejected chunk fetch and never retries the import, so
   * a page whose chunk 404'd after a deploy stays broken for the rest of the
   * session however the user navigates. Reloading the document is the only
   * thing that clears it.
   */
  onReload?: () => void
  /**
   * Runs alongside the route change when the user backs out. A boundary passes
   * its reset here: navigating to `providers` while `providers` is the failing
   * page changes no route key, so without this the boundary stays latched on
   * the error screen.
   */
  onGoBack?: () => void
}

/** Shared error page with a way out: back to the providers (sign-in) screen. */
const ErrorFallbackPage = ({ header, description, onReload, onGoBack }: ErrorFallbackPageProps) => {
  const { setRoute } = useOpenfort()
  const user = useOpenfortCore((s) => s.user)
  const goBack = () => {
    onGoBack?.()
    setRoute(routes.PROVIDERS)
  }

  return (
    <PageContent onBack={routes.PROVIDERS}>
      <Loader header={header} isError description={description} />
      {onReload && <Button onClick={onReload}>Reload</Button>}
      <Button variant={onReload ? 'secondary' : 'primary'} onClick={goBack}>
        {user ? 'Go back' : 'Back to sign in'}
      </Button>
    </PageContent>
  )
}

export default ErrorFallbackPage
