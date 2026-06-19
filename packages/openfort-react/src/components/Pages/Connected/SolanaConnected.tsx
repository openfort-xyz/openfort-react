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
import { ReceiveIcon, SendIcon, UserRoundIcon } from '../../../assets/icons'
import { BALANCE_INVALIDATE_EVENT, fetchSolanaBalance } from '../../../hooks/useBalance'
import useLocales from '../../../hooks/useLocales'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import { formatSol } from '../../../solana/hooks/utils'
import { useSolanaContext } from '../../../solana/SolanaContext'
import { nFormatter, truncateSolanaAddress } from '../../../utils'
import { logger } from '../../../utils/logger'
import Avatar from '../../Common/Avatar'
import Button from '../../Common/Button'
import { CopyText } from '../../Common/CopyToClipboard/CopyText'
import { useThemeContext } from '../../ConnectKitThemeProvider/ConnectKitThemeProvider'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ConnectedPageLayout } from './ConnectedPageLayout'
import { ActionButton, Balance, LinkedProvidersToggle } from './styles'

const SolanaConnected: React.FC = () => {
  const context = useOpenfort()
  const { setHeaderLeftSlot, setRoute } = context
  const locales = useLocales()

  const wallet = useSolanaEmbeddedWallet()
  const { embeddedAccounts } = useOpenfortCore()
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

  const balanceResult = useAsyncData({
    queryKey: ['solana-balance', address, rpcUrl],
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

  useEffect(() => {
    if (!address || !rpcUrl) return
    const handler = () => balanceResult.refetch().catch(() => {})
    window.addEventListener(BALANCE_INVALIDATE_EVENT, handler)
    return () => window.removeEventListener(BALANCE_INVALIDATE_EVENT, handler)
  }, [address, rpcUrl, balanceResult.refetch])

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
      <Balance
        key="solana-balance"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {nFormatter(Number(balanceSol))} SOL
      </Balance>
    ) : null

  return (
    <PageContent onBack={null} header={locales.profileScreen_heading}>
      <ConnectedPageLayout
        address={address ?? ''}
        displayName={<CopyText value={address ?? ''}>{truncateSolanaAddress(address ?? '', separator)}</CopyText>}
        avatar={avatar}
        balance={balanceNode}
        actions={
          <>
            <ActionButton icon={<SendIcon />} onClick={() => context.setRoute(routes.SOL_SEND)}>
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
