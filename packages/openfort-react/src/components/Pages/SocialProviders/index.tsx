'use client'

import type React from 'react'
import { useProviders } from '../../../hooks/openfort/useProviders.js'
import { ModalHeading } from '../../Common/Modal/styles.js'
import PoweredByFooter from '../../Common/PoweredByFooter/index.js'
import { ScrollArea } from '../../Common/ScrollArea/index.js'
import { PageContent } from '../../PageContent/index.js'
import { ProviderButton } from '../Providers/index.js'

const SocialProviders: React.FC = () => {
  const { remainingSocialProviders } = useProviders()

  return (
    <PageContent>
      <ModalHeading>Log in or sign up</ModalHeading>
      <ScrollArea mobileDirection={'horizontal'}>
        {remainingSocialProviders.map((auth) => (
          <ProviderButton key={auth} provider={auth} />
        ))}
      </ScrollArea>
      <PoweredByFooter showDisclaimer={true} />
    </PageContent>
  )
}

export default SocialProviders
