'use client'

import type { PaymentMethod } from '../../../hooks/openfort/useFunding'
import { CopyIconButton } from '../../Common/CopyToClipboard/CopyIconButton'
import CustomQRCode from '../../Common/CustomQRCode'
import { AssetChainLogo } from './AssetChainLogo'
import { DepositDetails } from './Details'
import { addressBox, codeStyle, depositAddressLabel } from './formStyles'
import { QRWrapper, Skeleton } from './styles'

type DepositAddressBlockProps = {
  /** Logo URLs for the QR badge (token over chain). */
  assetLogo: string | null
  chainLogo: string | null
  receiverAddress: string | null
  pm: PaymentMethod | null
  /** Cross-chain routes carry a fee/min Details panel; same-chain transfers don't. */
  sameChain: boolean
  loading: boolean
}

/** The QR + copyable deposit address (plus cross-chain Details) for a route. */
export function DepositAddressBlock({
  assetLogo,
  chainLogo,
  receiverAddress,
  pm,
  sameChain,
  loading,
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
          value={receiverAddress}
          image={<AssetChainLogo assetLogo={assetLogo ?? ''} chainLogo={chainLogo ?? ''} />}
          imageBackground="#fff"
        />
      </QRWrapper>
      <div style={depositAddressLabel}>Your deposit address</div>
      <div style={addressBox}>
        <code style={codeStyle}>{receiverAddress}</code>
        <CopyIconButton value={receiverAddress} size={28} />
      </div>
      {!sameChain && pm && <DepositDetails />}
    </>
  )
}
