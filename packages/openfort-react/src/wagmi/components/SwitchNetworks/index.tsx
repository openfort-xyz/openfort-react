'use client'

import type React from 'react'
import { useChainId } from 'wagmi'
import { DisconnectIcon } from '../../../assets/icons.js'
import Button from '../../../components/Common/Button/index.js'
import { OrDivider } from '../../../components/Common/Modal/index.js'
import { ModalBody, ModalContent } from '../../../components/Common/Modal/styles.js'
import { PageContent } from '../../../components/PageContent/index.js'
import useLocales from '../../../hooks/useLocales.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { useSwitchChainFiltered } from '../../useSwitchChainFiltered.js'
import ChainSelectList from '../ChainSelectList/index.js'

const SwitchNetworks: React.FC = () => {
  const chainId = useChainId()
  const { chains } = useSwitchChainFiltered()
  const logout = useOpenfortCore((s) => s.logout)
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
