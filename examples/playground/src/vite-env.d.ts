/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Overrides the Base Sepolia RPC endpoint. The e2e suite sets it to a local anvil
   * fork so on-chain reads resolve against pinned, test-seeded state.
   */
  readonly VITE_EVM_FORK_RPC_URL?: string
}
