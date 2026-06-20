'use client'

import Logos from '../../../assets/logos'
import { useSolanaContext } from '../../../solana/SolanaContext'
import styled from '../../../styles/styled'
import Tooltip from '../Tooltip'

/** `mainnet-beta` → "Mainnet"; otherwise capitalize the cluster name. */
function formatCluster(cluster?: string): string {
  if (!cluster) return ''
  if (cluster === 'mainnet-beta') return 'Mainnet'
  return cluster.charAt(0).toUpperCase() + cluster.slice(1)
}

const Badge = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #131313;
  border: 2px solid var(--ck-body-background, #fff);
  box-sizing: border-box;
`

/**
 * Read-only Solana network indicator for the Connected modal — the Solana logo,
 * with the active cluster shown on hover. There is no switch: the cluster is
 * fixed by `walletConfig.solana`, and switching between Solana and EVM is
 * intentionally unsupported.
 */
const SolanaChain = () => {
  const cluster = useSolanaContext()?.cluster
  const label = cluster ? `Solana · ${formatCluster(cluster)}` : 'Solana'

  return (
    <Tooltip message={label}>
      <Badge aria-label={label}>
        <Logos.Solana style={{ width: '62%', height: 'auto' }} />
      </Badge>
    </Tooltip>
  )
}

export default SolanaChain
