'use client'

import { useMemo, useRef } from 'react'
import type { Hex } from 'viem'

import { useUser } from '../../../hooks/openfort/useUser.js'
import { useResolvedIdentity } from '../../../hooks/useResolvedIdentity.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import styled from '../../../styles/styled/index.js'
import { truncateEthAddress } from '../../../utils/index.js'
import Button from '../../Common/Button/index.js'
import { CopyText } from '../../Common/CopyToClipboard/CopyText.js'
import FitText from '../../Common/FitText/index.js'
import { ModalBody, ModalContent, ModalH1, ModalHeading } from '../../Common/Modal/styles.js'
import { getProviderName } from '../../Common/Providers/getProviderName.js'
import { ProviderHeader } from '../../Common/Providers/ProviderHeader.js'
import { ProviderIcon } from '../../Common/Providers/ProviderIcon.js'
import { useThemeContext } from '../../ConnectKitThemeProvider/ConnectKitThemeProvider.js'
import type { LinkedAccount } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'

export const ProviderIconContainer = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`

export const ProviderIconWrapper = styled.div`
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--ck-body-background-secondary);
  border-radius: 28px;
`

export const ProviderIconInner = styled.div`
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`

const SiweContent = ({ account }: { account: LinkedAccount }) => {
  const address = account.accountId as Hex
  const context = useOpenfort()
  const chainType = useOpenfortCore((s) => s.chainType)
  const themeContext = useThemeContext()

  const identity = useResolvedIdentity({
    address,
    chainType,
    enabled: !!address,
  })
  const ensName = identity.status === 'success' ? identity.name : undefined

  const separator = ['web95', 'rounded', 'minimal'].includes(themeContext.theme ?? context.uiConfig.theme ?? '')
    ? '....'
    : undefined

  return (
    <>
      <ModalH1>
        <CopyText value={address}>{ensName ?? truncateEthAddress(address, separator)}</CopyText>
      </ModalH1>
      <div style={{ marginTop: '16px' }}>
        Linked via Sign-In with Ethereum (SIWE)
        <Button onClick={() => context.setRoute({ route: 'removeLinkedProvider', account })}>Remove this wallet</Button>
      </div>
    </>
  )
}

const OAuthContent = ({ account }: { account: LinkedAccount }) => {
  const { user } = useUser()
  const { setRoute } = useOpenfort()

  return (
    <>
      <ModalH1>{account.provider.charAt(0).toUpperCase() + account.provider.slice(1)}</ModalH1>
      <div style={{ marginTop: '16px' }}>
        {user?.email}
        <Button onClick={() => setRoute({ route: 'removeLinkedProvider', account })}>Remove {account.provider}</Button>
      </div>
    </>
  )
}

const LinkedProvider: React.FC = () => {
  const { route } = useOpenfort()
  const lastAccountRef = useRef<LinkedAccount | null>(null)

  const account = useMemo(() => {
    if (route.route === 'linkedProvider') {
      lastAccountRef.current = route.account
      return route.account
    }
    // During exit animations or route transitions, return the last known account
    return lastAccountRef.current
  }, [route])

  const getProviderDetails = (account: LinkedAccount) => {
    switch (account.provider) {
      case 'siwe':
        return <SiweContent account={account} />
      case 'google':
      case 'facebook':
      case 'twitter':
        return <OAuthContent account={account} />
      default:
        return (
          <div
            style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'column' }}
          >
            <div>
              Authentication method: <b>{getProviderName(account.provider)}</b>
            </div>
            <FitText>
              <ProviderHeader account={account} />
            </FitText>
          </div>
        )
    }
  }

  if (!account) return null

  return (
    <PageContent>
      <ModalHeading>{getProviderName(account.provider)}</ModalHeading>
      <ModalContent style={{ paddingBottom: 0 }}>
        <ProviderIconContainer>
          <ProviderIconWrapper>
            <ProviderIconInner>
              <ProviderIcon account={account} />
            </ProviderIconInner>
          </ProviderIconWrapper>
        </ProviderIconContainer>
        <ModalBody>{getProviderDetails(account)}</ModalBody>
      </ModalContent>
    </PageContent>
  )
}

export default LinkedProvider
