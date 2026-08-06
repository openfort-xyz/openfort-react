'use client'

import { useEffect, useState } from 'react'
import type { Hex } from 'viem'
import { useConnectionStrategy } from '../../../core/ConnectionStrategyContext.js'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext.js'
import { useUser } from '../../../hooks/openfort/useUser.js'
import { truncateEthAddress } from '../../../utils/index.js'
import { logger } from '../../../utils/logger.js'
import { useThemeContext } from '../../ConnectKitThemeProvider/ConnectKitThemeProvider.js'
import type { LinkedAccount } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { LinkedProviderText } from '../../Pages/LinkedProviders/styles.js'

export const WalletDisplay = ({ walletAddress }: { walletAddress: string }) => {
  const strategy = useConnectionStrategy()
  const bridge = useEthereumBridge()
  const [ensName, setEnsName] = useState<string | undefined>(undefined)
  const context = useOpenfort()
  const themeContext = useThemeContext()
  // Only resolve ENS on mainnet (1); testnets throw "network does not support ENS"
  const useEns = strategy?.kind === 'bridge' && !!bridge?.getEnsName && (bridge.chainId ?? 0) === 1

  useEffect(() => {
    if (!useEns || !walletAddress || !bridge?.getEnsName) return
    bridge
      .getEnsName({ address: walletAddress as Hex })
      .then(setEnsName)
      .catch((_err) => {
        // ENS resolution can fail on testnets; non-fatal
        if (process.env.NODE_ENV === 'development') {
          logger.warn('[Openfort] ENS resolution failed')
        }
      })
  }, [useEns, bridge, walletAddress])

  const separator = ['web95', 'rounded', 'minimal'].includes(themeContext.theme ?? context.uiConfig.theme ?? '')
    ? '....'
    : undefined

  return ensName ?? truncateEthAddress(walletAddress, separator)
}

export const ProviderHeader: React.FC<{ account: LinkedAccount }> = ({ account }) => {
  const { user } = useUser()
  switch (account.provider) {
    case 'wallet':
    case 'siwe':
      return (
        <LinkedProviderText>
          <WalletDisplay walletAddress={account.accountId!} />
        </LinkedProviderText>
      )
    case 'phone':
      return <LinkedProviderText>{account.accountId}</LinkedProviderText>
    default:
      return (
        <LinkedProviderText style={{ textTransform: user?.email ? 'none' : 'capitalize' }}>
          {user?.email ?? account.provider}
        </LinkedProviderText>
      )
  }
}
