'use client'

import { useEffect } from 'react'
import Loader from '../../Common/Loading/index.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'

const ConnectedSuccess: React.FC = () => {
  const { setOpen } = useOpenfort()

  // hide on connect
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [setOpen])

  return (
    <PageContent>
      <Loader isLoading={false} isSuccess={true} header="Successfully connected" />
    </PageContent>
  )
}

export default ConnectedSuccess
