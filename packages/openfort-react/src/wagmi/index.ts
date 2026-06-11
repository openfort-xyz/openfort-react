export { default as getDefaultConfig } from './defaultConfig'
export {
  default as getDefaultConnectors,
  default as wallets,
} from './defaultConnectors'
export { embeddedWalletConnector, setEmbeddedWalletProvider } from './embeddedConnector'
export { OpenfortWagmiBridge } from './OpenfortWagmiBridge'
export { useChainIsSupported } from './useChainIsSupported'
export { useChains } from './useChains'
export { useConnectWithSiwe } from './useConnectWithSiwe'
export { EmbeddedWalletWagmiSync } from './useEmbeddedWalletWagmiSync'
export type { AvailableWallet } from './useWalletAuth'
export { useWalletAuth } from './useWalletAuth'
