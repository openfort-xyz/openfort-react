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
}

/** Shared error page with a single way out: back to the providers (sign-in) screen. */
const ErrorFallbackPage = ({ header, description }: ErrorFallbackPageProps) => {
  const { setRoute } = useOpenfort()
  const user = useOpenfortCore((s) => s.user)

  return (
    <PageContent onBack={routes.PROVIDERS}>
      <Loader header={header} isError description={description} />
      <Button onClick={() => setRoute(routes.PROVIDERS)}>{user ? 'Go back' : 'Back to sign in'}</Button>
    </PageContent>
  )
}

export default ErrorFallbackPage
