'use client'

import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import Button from '../Button'
import Loader from '../Loading'

type ErrorFallbackPageProps = {
  header: string
  description: string
}

/** Shared error page with a single way out: back to the providers (sign-in) screen. */
const ErrorFallbackPage = ({ header, description }: ErrorFallbackPageProps) => {
  const { setRoute } = useOpenfort()
  const { user } = useOpenfortCore()

  return (
    <PageContent onBack={routes.PROVIDERS}>
      <Loader header={header} isError description={description} />
      <Button onClick={() => setRoute(routes.PROVIDERS)}>{user ? 'Go back' : 'Back to sign in'}</Button>
    </PageContent>
  )
}

export default ErrorFallbackPage
