'use client'

import { useEffect } from 'react'
import Loader from '../../Common/Loading/index.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'

const ConnectedSuccess: React.FC = () => {
  const { setOpen } = useOpenfort()

  // hide on connect
  useEffect(() => {
    setTimeout(() => {
      setOpen(false)
    }, 1000)
  }, [])

  return (
    <PageContent>
      <Loader isLoading={false} isSuccess={true} header="Connected" />
    </PageContent>
  )
}

export default ConnectedSuccess
