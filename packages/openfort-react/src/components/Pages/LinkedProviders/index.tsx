'use client'

import { useEffect } from 'react'
import { useProviders } from '../../../hooks/openfort/useProviders.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import Button from '../../Common/Button/index.js'
import { ModalBody, ModalContent, ModalHeading } from '../../Common/Modal/styles.js'
import { ProviderHeader } from '../../Common/Providers/ProviderHeader.js'
import { ProviderIcon } from '../../Common/Providers/ProviderIcon.js'
import type { LinkedAccount } from '../../Openfort/types.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import {
  LinkedProviderButtonContainer,
  LinkedProviderButtonWrapper,
  LinkedProvidersGroupWrapper,
  ProviderIconWrapper,
} from './styles.js'

const LinkedProvider: React.FC<{ account: LinkedAccount }> = ({ account }) => {
  const { setRoute } = useOpenfort()
  return (
    <LinkedProviderButtonContainer>
      <Button onClick={() => setRoute({ route: routes.LINKED_PROVIDER, account })} fitText={false}>
        <LinkedProviderButtonWrapper>
          <ProviderIconWrapper>
            <ProviderIcon account={account} />
          </ProviderIconWrapper>
          <ProviderHeader account={account} />
        </LinkedProviderButtonWrapper>
      </Button>
    </LinkedProviderButtonContainer>
  )
}

const AddLinkedProviderButton: React.FC = () => {
  const { setRoute } = useOpenfort()
  const { availableProviders: unlinkedProviders } = useProviders()

  return (
    <Button disabled={unlinkedProviders.length === 0} onClick={() => setRoute(routes.PROVIDERS)}>
      +
    </Button>
  )
}

const LinkedProvidersGroup: React.FC = () => {
  const { linkedAccounts, user, isLoading } = useOpenfortCore()
  const { triggerResize, emailInput: pendingEmail } = useOpenfort()

  useEffect(() => {
    if (!isLoading) triggerResize()
  }, [isLoading, triggerResize])

  // TODO: Show loading
  if (isLoading) {
    return (
      <div>
        <AddLinkedProviderButton />
      </div>
    )
  }

  // TODO: show error
  if (!user) {
    return (
      <div>
        <AddLinkedProviderButton />
      </div>
    )
  }

  return (
    <>
      <LinkedProvidersGroupWrapper>
        {linkedAccounts.length === 0 && !user.email && !user.phoneNumber && (
          <ModalContent>
            You are logged in as a guest.
            <ModalBody>Add authentication methods to avoid losing access to your account.</ModalBody>
          </ModalContent>
        )}
        {!linkedAccounts.find((a) => a.provider === 'credential') && user.email && (
          <LinkedProvider
            key={`credential-${user.email}`}
            account={{ provider: 'credential', accountId: user.email }}
          />
        )}
        {linkedAccounts.map((account) => (
          <LinkedProvider key={`${account.provider}-${account.accountId}`} account={account} />
        ))}
        {user.phoneNumber && (
          <LinkedProvider
            key={`phone-${user.phoneNumber}`}
            account={{ provider: 'phone', accountId: user.phoneNumber }}
          />
        )}
        {pendingEmail && (
          <LinkedProviderButtonContainer>
            <LinkedProviderButtonWrapper style={{ padding: '12px 20px', opacity: 0.6 }}>
              <ProviderIconWrapper>
                <ProviderIcon account={{ provider: 'credential', accountId: pendingEmail }} />
              </ProviderIconWrapper>
              <ProviderHeader account={{ provider: 'credential', accountId: pendingEmail }} />
              <ModalBody style={{ fontSize: 11, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                Awaiting validation
              </ModalBody>
            </LinkedProviderButtonWrapper>
          </LinkedProviderButtonContainer>
        )}
      </LinkedProvidersGroupWrapper>
      <AddLinkedProviderButton />
    </>
  )
}

const LinkedProviders: React.FC = () => {
  return (
    <PageContent>
      <ModalHeading>Authentication methods</ModalHeading>
      <LinkedProvidersGroup />
    </PageContent>
  )
}

export default LinkedProviders
