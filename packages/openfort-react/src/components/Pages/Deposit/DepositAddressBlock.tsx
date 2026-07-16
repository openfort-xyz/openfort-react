'use client'

import type { PaymentMethod, SessionStatus } from '../../../hooks/openfort/useFunding'
import { CopyIconButton } from '../../Common/CopyToClipboard/CopyIconButton'
import CustomQRCode from '../../Common/CustomQRCode'
import { AssetChainLogo } from './AssetChainLogo'
import { DepositStatus } from './DepositStatus'
import { DepositDetails } from './Details'
import { addressBox, codeStyle, depositAddressLabel } from './formStyles'
import { QRWrapper, Skeleton } from './styles'

type DepositAddressBlockProps = {
  /** Logo URLs for the QR badge (token over chain). */
  assetLogo: string | null
  chainLogo: string | null
  receiverAddress: string | null
  pm: PaymentMethod | null
  /** Source currency (symbol + decimals) for formatting the Details fee/min. */
  sourceCurrency: { symbol: string; decimals: number } | null
  /** Cross-chain routes carry a fee/min Details panel; same-chain transfers don't. */
  sameChain: boolean
  loading: boolean
  /** Live session status, rendered as the "Waiting for your deposit…" line under the address. */
  status?: SessionStatus | 'idle'
}

/** The QR + copyable deposit address (plus cross-chain Details) for a route. */
export function DepositAddressBlock({
  assetLogo,
  chainLogo,
  receiverAddress,
  pm,
  sourceCurrency,
  sameChain,
  loading,
  status,
}: DepositAddressBlockProps) {
  if (loading && !sameChain && !pm) {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
          <Skeleton $w="220px" $h="220px" $r="12px" />
        </div>
        <div style={depositAddressLabel}>Your deposit address</div>
        <Skeleton $h="44px" $r="12px" />
      </>
    )
  }
  if (!receiverAddress) return null

  return (
    <>
      <QRWrapper>
        <CustomQRCode
          // Encode the EIP-681 / Solana Pay URI (address + amount + network) so a
          // scanner prefills the send; fall back to the bare address same-chain.
          value={pm?.addressUri ?? receiverAddress}
          image={
            <AssetChainLogo assetLogo={assetLogo ?? ''} chainLogo={chainLogo ?? ''} symbol={sourceCurrency?.symbol} />
          }
          imageClip={false}
        />
      </QRWrapper>
      <div style={depositAddressLabel}>Your deposit address</div>
      <div style={addressBox}>
        <code style={codeStyle}>{receiverAddress}</code>
        <CopyIconButton value={receiverAddress} size={28} />
      </div>
      {status && <DepositStatus status={status} />}
      {!sameChain && pm && <DepositDetails pm={pm} sourceCurrency={sourceCurrency} />}
    </>
  )
}
