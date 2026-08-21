'use client'

import Logos from '../../../assets/logos.js'
import { useSolanaContext } from '../../../solana/SolanaContext.js'
import { ChainContainer, LogoContainer, SwitchChainButton } from '../Chain/styles.js'
import Tooltip from '../Tooltip/index.js'

/** `mainnet-beta` → "Mainnet"; otherwise capitalize the cluster name. */
function formatCluster(cluster?: string): string {
  if (!cluster) return ''
  if (cluster === 'mainnet-beta') return 'Mainnet'
  return cluster.charAt(0).toUpperCase() + cluster.slice(1)
}

/** Solana mark rendered in the same circular container as the EVM `Chain` icon. */
const SolanaChainIcon = () => (
  <ChainContainer size={24} radius="50%">
    <LogoContainer initial={false} animate={{ opacity: 1 }}>
      <Logos.Solana style={{ width: '62%', height: 'auto' }} />
    </LogoContainer>
  </ChainContainer>
)

/**
 * Read-only Solana network indicator for the Connected modal. Mirrors the EVM
 * `ChainSelect` in its single-network (`disabled`) state — the same pill button
 * and tooltip — so EVM and Solana headers stay visually consistent. There is no
 * switch: the cluster is fixed by `walletConfig.solana` and cannot change at
 * runtime, so the button never gains a chevron or dropdown.
 */
const SolanaChain = () => {
  const cluster = useSolanaContext()?.cluster
  const label = cluster ? `Solana · ${formatCluster(cluster)}` : 'Solana'

  return (
    <SwitchChainButton type="button" disabled aria-label={label}>
      <Tooltip message={label} xOffset={-6} delay={0.01}>
        <SolanaChainIcon />
      </Tooltip>
    </SwitchChainButton>
  )
}

export default SolanaChain
