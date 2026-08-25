'use client'

import { useMemo } from 'react'
import { EmailIcon, PhoneIcon, WalletIcon } from '../../../assets/icons.js'
import Logos, { providersLogos } from '../../../assets/logos.js'
import { useExternalConnectors } from '../../../wallets/useExternalConnectors.js'
import FitText from '../../Common/FitText/index.js'
import type { LinkedAccount } from '../../Openfort/types.js'

const WalletIconWrapper: React.FC<{ account: LinkedAccount }> = ({ account }) => {
  const wallets = useExternalConnectors()
  const wallet = useMemo(() => {
    return wallets.find((w) => w.id?.toLowerCase() === account.walletClientType)
  }, [account, wallets])

  if (account.walletClientType === 'walletconnect') return <Logos.WalletConnect />

  if (wallet) return <>{wallet.iconConnector ?? wallet.icon}</>

  return <WalletIcon />
}

export const ProviderIcon: React.FC<{ account: LinkedAccount }> = ({ account }) => {
  switch (account.provider) {
    case 'email':
    case 'credential':
      return <EmailIcon />
    // TODO: Show the SIWE provider's own icon instead of the generic wallet icon.
    case 'wallet':
    case 'siwe':
      return <WalletIconWrapper account={account} />
    case 'phone':
      return <PhoneIcon />
    case 'google':
    case 'twitter':
    case 'facebook':
      return providersLogos[account.provider]
    default:
      return <FitText>{account.provider.substring(0, 4).toUpperCase()}</FitText>
  }
}
