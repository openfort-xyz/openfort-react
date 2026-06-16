'use client'

import type { PaymentMethod } from '../../../hooks/openfort/useFunding'
import { CopyIconButton } from '../../Common/CopyToClipboard/CopyIconButton'
import CustomQRCode from '../../Common/CustomQRCode'
import { ModalBody } from '../../Common/Modal/styles'
import { AssetChainLogo } from './AssetChainLogo'
import { DepositDetails } from './Details'
import { addressBox, codeStyle } from './formStyles'
import { chainLogo, tokenLogo } from './sources'
import { QRWrapper } from './styles'

type DepositAddressBlockProps = {
  chain: string
  token: string
  receiverAddress: string | null
  pm: PaymentMethod | null
  /** Cross-chain routes carry a fee/min Details panel; same-chain transfers don't. */
  sameChain: boolean
  loading: boolean
}

/** The QR + copyable deposit address (plus cross-chain Details) for a route. */
export function DepositAddressBlock({
  chain,
  token,
  receiverAddress,
  pm,
  sameChain,
  loading,
}: DepositAddressBlockProps) {
  if (loading && !sameChain && !pm) {
    return <ModalBody style={{ marginTop: 12 }}>Fetching deposit address…</ModalBody>
  }
  if (!receiverAddress) return null

  return (
    <>
      <QRWrapper>
        <CustomQRCode
          value={receiverAddress}
          image={<AssetChainLogo assetLogo={tokenLogo(chain, token)} chainLogo={chainLogo(chain)} />}
          imageBackground="#fff"
        />
      </QRWrapper>
      <div style={addressBox}>
        <code style={codeStyle}>{receiverAddress}</code>
        <CopyIconButton value={receiverAddress} />
      </div>
      {!sameChain && pm && <DepositDetails pm={pm} />}
    </>
  )
}
