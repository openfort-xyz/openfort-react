'use client'

import { type SyntheticEvent, useState } from 'react'
import { symbolToColor } from '../../../constants/logos'

const hide = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

/**
 * Center logo for the deposit QR: the asset logo with the chain logo as a small
 * badge bottom-left, so scanners can confirm the right token + network at a glance.
 * Falls back to a colored monogram when the token has no usable logo, so the QR
 * centre is never blank (and never collapses to just the chain badge). Kept fully
 * within the logo slot (no overflow) so it never covers QR data modules.
 */
export function AssetChainLogo({
  assetLogo,
  chainLogo,
  symbol,
}: {
  assetLogo: string
  chainLogo: string
  symbol?: string
}) {
  const [assetFailed, setAssetFailed] = useState(false)
  const showMonogram = !assetLogo || assetFailed

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {showMonogram ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            background: symbolToColor(symbol || '?'),
            color: '#fff',
            fontWeight: 600,
            fontSize: 28,
          }}
        >
          {(symbol || '?').charAt(0).toUpperCase()}
        </div>
      ) : (
        <img
          src={assetLogo}
          alt=""
          onError={() => setAssetFailed(true)}
          style={{ display: 'block', width: '100%', borderRadius: '50%' }}
        />
      )}
      {chainLogo && (
        <img
          src={chainLogo}
          alt=""
          onError={hide}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '42%',
            borderRadius: '50%',
            border: '2px solid #fff',
            background: '#fff',
          }}
        />
      )}
    </div>
  )
}
