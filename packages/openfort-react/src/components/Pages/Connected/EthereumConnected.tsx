'use client'

/**
 * Ethereum Connected Page
 *
 * Displays the connected Ethereum wallet with balance and actions.
 * This is the Ethereum-specific view extracted from the original Connected component.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'
import type React from 'react'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { formatUnits } from 'viem'
import { ReceiveIcon, SendIcon, UserRoundIcon } from '../../../assets/icons.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets.js'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext.js'
import useLocales from '../../../hooks/useLocales.js'
import { useResolvedIdentity } from '../../../hooks/useResolvedIdentity.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { nFormatter, truncateEthAddress } from '../../../utils/index.js'
import { logger } from '../../../utils/logger.js'
import Avatar from '../../Common/Avatar/index.js'
import Button from '../../Common/Button/index.js'
import { TextLinkButton } from '../../Common/Button/styles.js'
import Chain from '../../Common/Chain/index.js'
import { CopyText } from '../../Common/CopyToClipboard/CopyText.js'
import { useThemeContext } from '../../ConnectKitThemeProvider/ConnectKitThemeProvider.js'
import { defaultSendFormState, routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { getAssetDecimals } from '../Send/utils.js'
import { ConnectedPageLayout } from './ConnectedPageLayout.js'
import { ActionButton, Balance, ChainSelectorContainer, LinkedProvidersToggle, Unsupported } from './styles.js'

const LazyChainSelector = lazy(() => import('../../../wagmi/components/ChainSelect/index.js'))

function getFirstBalanceAsset(
  assets: Awaited<ReturnType<typeof useEthereumWalletAssets>>['data']
): (NonNullable<typeof assets>[number] & { balance: bigint }) | undefined {
  return assets?.find((a) => a.balance && a.balance > BigInt(0)) as
    | (NonNullable<typeof assets>[number] & { balance: bigint })
    | undefined
}

const EthereumConnected: React.FC = () => {
  const context = useOpenfort()
  const { setHeaderLeftSlot, setRoute, chains } = context
  const themeContext = useThemeContext()
  const bridge = useEthereumBridge()

  const wallet = useEthereumEmbeddedWallet()
  const { embeddedAccounts } = useOpenfortCore()
  const hasEthereumWallets = (embeddedAccounts?.filter((a) => a.chainType === ChainTypeEnum.EVM) ?? []).length > 0

  // Use embedded wallet if available, otherwise fall back to bridge (external wallet)
  const embeddedConnected = wallet.status === 'connected'
  const bridgeConnected = !!(bridge?.account.isConnected && bridge?.account.address)
  const isConnected = embeddedConnected || bridgeConnected
  const address = embeddedConnected
    ? (wallet.address as `0x${string}`)
    : bridgeConnected
      ? (bridge.account.address as `0x${string}`)
      : undefined
  const chainId = embeddedConnected ? wallet.chainId : bridgeConnected ? bridge.chainId : undefined

  const { chainType } = useOpenfortCore()
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && chainType !== ChainTypeEnum.EVM) {
      logger.warn(
        '[EthereumConnected] This component is for EVM only. Current chainType is not EVM; ensure OpenfortProvider uses chainType={ChainTypeEnum.EVM}.'
      )
    }
  }, [chainType])
  const chain = chains.find((c) => c.id === chainId)

  const identity = useResolvedIdentity({
    address: address ?? '',
    chainType,
    ensChainId: chainId ?? 0,
    enabled: isConnected && !!address,
  })
  const ensName = identity.status === 'success' ? identity.name : undefined

  const { data: assets, isLoading } = useEthereumWalletAssets()
  // Total is summed from the multi-chain assets so the headline matches the
  // "Your assets" breakdown. The single-chain path omits fiat for native ETH,
  // which would otherwise drop it from the total.
  const { data: multiChainAssets } = useEthereumWalletAssets({ multiChain: true })
  const totalBalanceUsd = useMemo(() => {
    if (!multiChainAssets) return 0
    return multiChainAssets.reduce((acc, asset) => {
      if (!asset.metadata || !asset.balance) return acc
      const price: number = asset.metadata?.fiat?.value ?? 0
      if (!price) return acc
      const balance = Number(formatUnits(asset.balance ?? BigInt(0), getAssetDecimals(asset)))
      return acc + price * balance
    }, 0)
  }, [multiChainAssets])

  // Re-measure on mount, after paint, and when the async assets resolve. Without
  // the post-paint pass, returning to this screen (assets already cached) measures
  // before layout settles and the modal keeps the shorter height, clipping the
  // actions below the fold.
  useEffect(() => {
    context.triggerResize()
    const id = requestAnimationFrame(() => context.triggerResize())
    return () => cancelAnimationFrame(id)
  }, [context.triggerResize, isLoading, totalBalanceUsd])

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

  const { setSendForm } = context

  const separator = ['web95', 'rounded', 'minimal'].includes(themeContext.theme ?? context.uiConfig.theme ?? '')
    ? '....'
    : undefined
  const locales = useLocales()

  const balanceNode =
    assets && !isLoading ? (
      <TextLinkButton
        type="button"
        onClick={() => {
          // The inventory always shows the chain's native token + stablecoin
          // defaults, so there's no empty state to gate on.
          setRoute(routes.ASSET_INVENTORY)
        }}
      >
        <Balance
          key={`chain-${chain?.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          ${nFormatter(totalBalanceUsd)}
        </Balance>
      </TextLinkButton>
    ) : null

  const noWalletFallback = hasEthereumWallets ? (
    <Button onClick={() => context.setRoute(routes.SELECT_WALLET_TO_RECOVER)}>Manage wallets</Button>
  ) : (
    <Button
      onClick={() => context.setRoute({ route: routes.CONNECTORS, connectType: 'link' })}
      icon={
        <Unsupported initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <svg width="130" height="120" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <title>Unsupported wallet icon</title>
            <path
              d="M2.61317 11.2501H9.46246C10.6009 11.2501 11.3256 10.3506 11.3256 9.3549C11.3256 9.05145 11.255 8.73244 11.0881 8.43303L7.65903 2.14708C7.659 2.14702 7.65897 2.14696 7.65893 2.1469C7.65889 2.14682 7.65884 2.14673 7.65879 2.14664C7.31045 1.50746 6.6741 1.17871 6.04 1.17871C5.41478 1.17871 4.763 1.50043 4.41518 2.14968L0.993416 8.43476C0.828865 8.72426 0.75 9.04297 0.75 9.3549C0.75 10.3506 1.47471 11.2501 2.61317 11.2501Z"
              fill="currentColor"
              stroke="var(--ck-body-background, #fff)"
              strokeWidth="1.5"
            />
            <path
              d="M6.03258 7.43916C5.77502 7.43916 5.63096 7.29153 5.62223 7.02311L5.55675 4.96973C5.54802 4.69684 5.74446 4.5 6.02821 4.5C6.3076 4.5 6.51277 4.70131 6.50404 4.9742L6.43856 7.01864C6.42546 7.29153 6.2814 7.43916 6.03258 7.43916ZM6.03258 9.11676C5.7401 9.11676 5.5 8.9065 5.5 8.60677C5.5 8.30704 5.7401 8.09678 6.03258 8.09678C6.32506 8.09678 6.56515 8.30256 6.56515 8.60677C6.56515 8.91097 6.32069 9.11676 6.03258 9.11676Z"
              fill="white"
            />
          </svg>
        </Unsupported>
      }
    >
      Connect wallet
    </Button>
  )

  return (
    <PageContent onBack={null} header={locales.profileScreen_heading}>
      <ConnectedPageLayout
        address={address ?? ''}
        displayName={
          <CopyText value={address ?? ''}>{ensName ?? truncateEthAddress(address ?? '', separator)}</CopyText>
        }
        avatar={address ? <Avatar address={address} /> : <span />}
        beforeAvatar={
          <ChainSelectorContainer
            key={chainId ?? 'loading'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {bridge ? (
              <Suspense fallback={<Chain id={chainId} />}>
                <LazyChainSelector />
              </Suspense>
            ) : (
              <Chain id={chainId} />
            )}
          </ChainSelectorContainer>
        }
        balance={balanceNode}
        actions={
          <>
            <ActionButton
              icon={<SendIcon />}
              onClick={() => {
                const firstBalanceAsset = getFirstBalanceAsset(assets)
                if (!firstBalanceAsset) {
                  setRoute(routes.NO_ASSETS_AVAILABLE)
                  return
                }
                setSendForm({ ...defaultSendFormState, asset: firstBalanceAsset })
                context.setRoute(routes.SEND)
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
        isBalanceLoading={isLoading}
        noWalletFallback={noWalletFallback}
      />
    </PageContent>
  )
}

export default EthereumConnected
