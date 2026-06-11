import type React from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { DisconnectIcon } from '../../../assets/icons'
import Button from '../../../components/Common/Button'
import { OrDivider } from '../../../components/Common/Modal'
import { ModalBody, ModalContent } from '../../../components/Common/Modal/styles'
import { PageContent } from '../../../components/PageContent'
import useLocales from '../../../hooks/useLocales'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import ChainSelectList from '../ChainSelectList'

const SwitchNetworks: React.FC = () => {
  const chainId = useChainId()
  const { chains } = useSwitchChain()
  const { logout } = useOpenfortCore()
  const locales = useLocales({})

  const chainIsSupported = chainId != null && chains.some((c) => c.id === chainId)

  return (
    <PageContent width={278}>
      <ModalContent style={{ padding: 0, marginTop: -10 }}>
        {!chainIsSupported && (
          <ModalBody>
            {locales.warnings_chainUnsupported} {locales.warnings_chainUnsupportedResolve}
          </ModalBody>
        )}

        <div style={{ padding: '6px 8px' }}>
          <ChainSelectList variant="secondary" />
        </div>

        {!chainIsSupported && (
          <div style={{ paddingTop: 12 }}>
            <OrDivider />
            <Button icon={<DisconnectIcon />} variant="secondary" onClick={() => logout()}>
              {locales.disconnect}
            </Button>
          </div>
        )}
      </ModalContent>
    </PageContent>
  )
}

export default SwitchNetworks
