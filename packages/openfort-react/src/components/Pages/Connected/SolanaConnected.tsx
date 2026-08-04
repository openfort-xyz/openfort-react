'use client'

/**
 * Solana Connected Page
 *
 * Displays the connected Solana wallet with balance and actions.
 * Uses viem direct JSON-RPC calls for balance fetching.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'
import type React from 'react'
import { useEffect } from 'react'
import { ReceiveIcon, SendIcon, UserRoundIcon } from '../../../assets/icons.js'
import { fetchSolanaBalance } from '../../../hooks/useBalance.js'
import useLocales from '../../../hooks/useLocales.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { getOpenfortQueryScope, openfortKeys } from '../../../query/queryKeys.js'
import { useQuery } from '../../../query/useQuery.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import { formatSol } from '../../../solana/hooks/utils.js'
import { useSolanaContext } from '../../../solana/SolanaContext.js'
import { nFormatter, truncateSolanaAddress } from '../../../utils/index.js'
import { logger } from '../../../utils/logger.js'
import Avatar from '../../Common/Avatar/index.js'
import Button from '../../Common/Button/index.js'
import { TextLinkButton } from '../../Common/Button/styles.js'
import { CopyText } from '../../Common/CopyToClipboard/CopyText.js'
import SolanaChain from '../../Common/SolanaChain/index.js'
import { useThemeContext } from '../../ConnectKitThemeProvider/ConnectKitThemeProvider.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { ConnectedPageLayout } from './ConnectedPageLayout.js'
import { ActionButton, Balance, ChainSelectorContainer, LinkedProvidersToggle } from './styles.js'

const SolanaConnected: React.FC = () => {
  const context = useOpenfort()
  const { setHeaderLeftSlot, setRoute } = context
  const locales = useLocales()

  const wallet = useSolanaEmbeddedWallet()
  const client = useOpenfortCore((state) => state.client)
  const embeddedAccounts = useOpenfortCore((s) => s.embeddedAccounts)
  const { rpcUrl } = useSolanaContext()
  const hasSolanaWallets = (embeddedAccounts?.filter((a) => a.chainType === ChainTypeEnum.SVM) ?? []).length > 0
  const isAddressLoading = wallet.status === 'connected' && !wallet.address
  const address = wallet.status === 'connected' && wallet.address ? wallet.address : undefined

  const { triggerResize } = context
  // When the address becomes available, trigger a modal resize so the modal
  // height (measured via offsetHeight) reflects the full connected layout.
  useEffect(() => {
    if (address) triggerResize()
  }, [address, triggerResize])

  const balanceResult = useQuery({
    queryKey: openfortKeys.balance({
      address: address ?? '',
      chainType: ChainTypeEnum.SVM,
      clientScope: getOpenfortQueryScope(client),
      rpcUrl,
      commitment: 'confirmed',
    }),
    queryFn: async () => {
      if (!address || !rpcUrl) return null
      try {
        const balanceLamports = await fetchSolanaBalance(address, rpcUrl, 'confirmed')
        return balanceLamports.value
      } catch (error) {
        logger.error('Failed to fetch Solana balance:', error)
        return null
      }
    },
    enabled: Boolean(address && rpcUrl),
  })

  const lamports = balanceResult.data
  const isBalanceLoading = balanceResult.isLoading
  const balanceSol = lamports != null ? formatSol(BigInt(lamports), 9) : null

  // Re-measure when balance loads so the modal expands to fit balance + actions.
  useEffect(() => {
    if (!isBalanceLoading) triggerResize()
  }, [isBalanceLoading, triggerResize])

  useEffect(() => {
    if (!address) {
      setHeaderLeftSlot(null)
      return
    }

    setHeaderLeftSlot(
      <LinkedProvidersToggle
        type="button"
        onClick={() => setRoute(routes.PROFILE)}
        aria-label="Profile"
        title="Profile"
      >
        <UserRoundIcon />
      </LinkedProvidersToggle>
    )

    return () => {
      setHeaderLeftSlot(null)
    }
  }, [address, setHeaderLeftSlot, setRoute])

  const themeContext = useThemeContext()
  const solanaUI = context.walletConfig?.solana?.ui
  const CustomAvatar = solanaUI?.customAvatar
  const separator = ['web95', 'rounded', 'minimal'].includes(themeContext.theme ?? context.uiConfig.theme ?? '')
    ? '....'
    : undefined

  const avatar = address ? CustomAvatar ? <CustomAvatar address={address} /> : <Avatar address={address} /> : <span />

  const balanceNode =
    balanceSol != null && !isBalanceLoading ? (
      <TextLinkButton type="button" onClick={() => setRoute(routes.SOL_ASSET_INVENTORY)}>
        <Balance
          key="solana-balance"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {nFormatter(Number(balanceSol))} SOL
        </Balance>
      </TextLinkButton>
    ) : null

  return (
    <PageContent onBack={null} header={locales.profileScreen_heading}>
      <ConnectedPageLayout
        address={address ?? ''}
        displayName={<CopyText value={address ?? ''}>{truncateSolanaAddress(address ?? '', separator)}</CopyText>}
        avatar={avatar}
        beforeAvatar={
          <ChainSelectorContainer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            <SolanaChain />
          </ChainSelectorContainer>
        }
        balance={balanceNode}
        actions={
          <>
            <ActionButton
              icon={<SendIcon />}
              onClick={() => {
                // Nothing to send on an empty wallet — prompt to add funds first (mirrors EVM).
                const hasBalance = lamports != null && BigInt(lamports) > BigInt(0)
                context.setRoute(hasBalance ? routes.SOL_SEND : routes.NO_ASSETS_AVAILABLE)
              }}
            >
              Send
            </ActionButton>
            <ActionButton icon={<ReceiveIcon />} onClick={() => context.setRoute(routes.DEPOSIT)}>
              Deposit
            </ActionButton>
          </>
        }
        hideBalance={context?.uiConfig.hideBalance}
        isBalanceLoading={isBalanceLoading}
        isAddressLoading={isAddressLoading}
        noWalletFallback={
          hasSolanaWallets ? (
            <Button onClick={() => setRoute(routes.SELECT_WALLET_TO_RECOVER)}>Manage wallets</Button>
          ) : (
            <Button onClick={() => setRoute(routes.SOL_CREATE_WALLET)}>Create Solana Wallet</Button>
          )
        }
      />
    </PageContent>
  )
}

export default SolanaConnected
