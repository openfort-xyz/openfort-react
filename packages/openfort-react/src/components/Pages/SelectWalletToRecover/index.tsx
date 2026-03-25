import { ChainTypeEnum } from '@openfort/openfort-js'
import { embeddedWalletId } from '../../../constants/openfort'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import type { ConnectedEmbeddedEthereumWallet } from '../../../ethereum/types'
import { toSolanaUserWallet } from '../../../hooks/openfort/walletTypes'
import { useResolvedIdentity } from '../../../hooks/useResolvedIdentity'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import type { ConnectedEmbeddedSolanaWallet } from '../../../solana/types'
import styled from '../../../styles/styled'
import { truncateEthAddress } from '../../../utils'
import { walletConfigs } from '../../../wallets/walletConfigs'
import Button from '../../Common/Button'
import { ModalHeading } from '../../Common/Modal/styles'
import { RECOVERY_METHOD_LABEL, WalletRecoveryIcon } from '../../Common/WalletRecoveryIcon'
import { recoverRoute } from '../../Openfort/routeHelpers'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ProviderIcon, ProviderLabel, ProvidersButton } from '../Providers/styles'

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

export default function SelectWalletToRecover() {
  const { chainType } = useOpenfortCore()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const embeddedWallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  const wallets = embeddedWallet.wallets

  const list = wallets.map((wallet) => <WalletRow key={wallet.id} chainType={chainType} wallet={wallet} />)

  return (
    <PageContent onBack={routes.PROVIDERS} logoutOnBack>
      <ModalHeading>Select a wallet to recover</ModalHeading>
      <WalletListScroll>{list}</WalletListScroll>
    </PageContent>
  )
}
