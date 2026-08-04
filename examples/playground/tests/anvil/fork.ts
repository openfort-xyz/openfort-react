/**
 * Shared configuration for the anvil fork the `*.fork.spec.ts` suites run against.
 *
 * Imported from three places that must agree on the same values: the Playwright
 * config (which boots anvil and passes its URL to the dev server), the global
 * setup, and the specs that seed chain state.
 */

import { baseSepolia } from 'viem/chains'

/**
 * Chain the fork-backed specs run against. Base Sepolia is the chain the embedded
 * wallet connects on (`DEFAULT_EVM_CHAIN`) and it hosts {@link FORK_MINT_CONTRACT},
 * so a fork of it exposes the same contract code the playground already reads.
 */
export const FORK_CHAIN = baseSepolia

/**
 * Height anvil forks at. Pinning it means every run starts from byte-identical
 * chain state, so an on-chain assertion only reflects what the test itself wrote.
 */
export const FORK_BLOCK_NUMBER = 44_800_000n

/**
 * Upstream node anvil pulls forked state from. Defaults to the public Base Sepolia
 * endpoint so the suite needs no RPC secret; point `EVM_FORK_URL` at a dedicated
 * provider to avoid public rate limits.
 */
export function resolveForkUpstreamUrl(configuredUrl = process.env.EVM_FORK_URL): string {
  return configuredUrl?.trim() || 'https://sepolia.base.org'
}

/** Returns only the upstream origin for diagnostics, excluding credential-bearing URL paths and queries. */
export function forkUpstreamOrigin(upstreamUrl: string): string {
  try {
    return new URL(upstreamUrl).origin
  } catch {
    return '[invalid fork upstream URL]'
  }
}

/** Removes URL paths and queries from process diagnostics before they reach CI logs. */
export function redactForkDiagnostics(diagnostics: string): string {
  return diagnostics.replaceAll(/https?:\/\/[^\s]+/g, (value) => forkUpstreamOrigin(value))
}

export const FORK_UPSTREAM_URL = resolveForkUpstreamUrl()

/** Port the local anvil instance listens on. */
export const ANVIL_PORT = Number(process.env.ANVIL_PORT ?? 8545)

/** URL both the playground and the specs use to reach the fork. */
export const ANVIL_RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`

/**
 * ERC-20 with a permissionless `mint(address,uint256)`, deployed on Base Sepolia and
 * therefore present in the fork. Specs mint to the connected wallet to put a known
 * balance on chain; the playground reads it back through `balanceOf`.
 */
export const FORK_MINT_CONTRACT = '0xbabe0001489722187FbaF0689C47B2f5E97545C5' as const

/**
 * anvil's first prefunded development account. This key is published in anvil's own
 * output and controls funds only inside the local fork.
 */
export const ANVIL_FUNDER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const

/** True when the run boots anvil and points the playground's RPC at it. */
export const IS_FORK_RUN = process.env.PLAYGROUND_EVM_FORK === '1'
