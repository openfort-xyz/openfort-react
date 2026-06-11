'use client'

import { useMemo } from 'react'
import { EmailIcon, PhoneIcon, WalletIcon } from '../../../assets/icons'
import Logos, { providersLogos } from '../../../assets/logos'
import { useExternalConnectors } from '../../../wallets/useExternalConnectors'
import FitText from '../../Common/FitText'
import type { LinkedAccount } from '../../Openfort/types'

const WalletIconWrapper: React.FC<{ account: LinkedAccount }> = ({ account }) => {
  const wallets = useExternalConnectors()
  const wallet = useMemo(() => {
    return wallets.find((w) => w.id?.toLowerCase() === account.walletClientType)
  }, [account])

  if (account.walletClientType === 'walletconnect') return <Logos.WalletConnect />

  if (wallet) return <>{wallet.iconConnector ?? wallet.icon}</>

  return <WalletIcon />
}

export const ProviderIcon: React.FC<{ account: LinkedAccount }> = ({ account }) => {
  switch (account.provider) {
    case 'email':
    case 'credential':
      return <EmailIcon />
    // OTP_TODO: Wallet icon
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
