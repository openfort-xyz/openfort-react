'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { embeddedWalletId } from '../../../constants/openfort.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import type { ConnectedEmbeddedEthereumWallet } from '../../../ethereum/types.js'
import { toSolanaUserWallet } from '../../../hooks/openfort/walletTypes.js'
import { useResolvedIdentity } from '../../../hooks/useResolvedIdentity.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import type { ConnectedEmbeddedSolanaWallet } from '../../../solana/types.js'
import styled from '../../../styles/styled/index.js'
import { truncateEthAddress } from '../../../utils/index.js'
import { walletConfigs } from '../../../wallets/walletConfigs.js'
import Button from '../../Common/Button/index.js'
import { ModalHeading } from '../../Common/Modal/styles.js'
import { RECOVERY_METHOD_LABEL, WalletRecoveryIcon } from '../../Common/WalletRecoveryIcon/index.js'
import { recoverRoute } from '../../Openfort/routeHelpers.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { ProviderIcon, ProviderLabel, ProvidersButton } from '../Providers/styles.js'

const RecoveryTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  background: var(--ck-body-background-secondary, #f0f0f0);
  color: var(--ck-body-color-muted, #999);
`

const WalletListScroll = styled.div`
  max-height: min(400px, 50vh);
  overflow-x: hidden;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--ck-body-color-muted, #c47a2a);
    border-radius: 4px;
  }
  scrollbar-width: thin;
  scrollbar-color: var(--ck-body-color-muted, #c47a2a) transparent;
`

function WalletRow({
  chainType,
  wallet,
}: {
  chainType: ChainTypeEnum
  wallet: ConnectedEmbeddedEthereumWallet | ConnectedEmbeddedSolanaWallet
}) {
  const { setRoute } = useOpenfort()
  const identity = useResolvedIdentity({
    address: wallet.address,
    chainType,
    enabled: !!wallet.address,
  })
  const display =
    chainType === ChainTypeEnum.SVM
      ? wallet.address.length > 12
        ? `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`
        : wallet.address
      : identity.status === 'success'
        ? (identity.name ?? truncateEthAddress(wallet.address))
        : truncateEthAddress(wallet.address)

  const walletIcon = () => {
    if (wallet.id === embeddedWalletId) {
      return <WalletRecoveryIcon recovery={wallet.recoveryMethod} />
    }
    if (chainType === ChainTypeEnum.EVM) {
      const walletConfig = Object.entries(walletConfigs).find(([key]) => key.includes(wallet.id))?.[1]
      if (walletConfig) return walletConfig.icon
    }
    return null
  }

  const handleClick = () => {
    if (chainType === ChainTypeEnum.SVM) {
      const walletForRoute = toSolanaUserWallet(wallet as ConnectedEmbeddedSolanaWallet)
      setRoute(recoverRoute(chainType, walletForRoute))
      return
    }
    setRoute(recoverRoute(chainType, wallet as ConnectedEmbeddedEthereumWallet))
  }

  const tag = wallet.recoveryMethod != null ? RECOVERY_METHOD_LABEL[wallet.recoveryMethod] : undefined

  return (
    <ProvidersButton>
      <Button onClick={handleClick}>
        <ProviderLabel>
          {display}
          {tag && <RecoveryTag>{tag}</RecoveryTag>}
        </ProviderLabel>
        <ProviderIcon>{walletIcon()}</ProviderIcon>
      </Button>
    </ProvidersButton>
  )
}

/** Connected-page routes that indicate the user navigated here from "Manage wallets" */
const CONNECTED_ROUTES = new Set<string>([routes.CONNECTED, routes.ETH_CONNECTED, routes.SOL_CONNECTED])

export default function SelectWalletToRecover() {
  const { chainType } = useOpenfortCore()
  const { previousRoute } = useOpenfort()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const embeddedWallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  const wallets = embeddedWallet.wallets

  const list = wallets.map((wallet) => <WalletRow key={wallet.id} chainType={chainType} wallet={wallet} />)

  // When arriving from a connected page (Manage wallets), go back there without logging out.
  // When arriving from the login flow, go back to providers and log out.
  const fromConnected = previousRoute != null && CONNECTED_ROUTES.has(previousRoute.route)

  return (
    <PageContent onBack={fromConnected ? 'back' : routes.PROVIDERS} logoutOnBack={!fromConnected}>
      <ModalHeading>Select a wallet</ModalHeading>
      <WalletListScroll>{list}</WalletListScroll>
    </PageContent>
  )
}
