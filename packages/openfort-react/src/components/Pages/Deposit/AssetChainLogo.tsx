'use client'

import type { SyntheticEvent } from 'react'

const hide = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

/**
 * Center logo for the deposit QR: the asset logo with the chain logo as a small
 * badge bottom-left, so scanners can confirm the right token + network at a glance.
 * Kept fully within the logo slot (no overflow) so it never covers QR data modules.
 */
export function AssetChainLogo({ assetLogo, chainLogo }: { assetLogo: string; chainLogo: string }) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <img src={assetLogo} alt="" onError={hide} style={{ display: 'block', width: '100%', borderRadius: '50%' }} />
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
    </div>
  )
}
