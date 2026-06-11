import { embeddedWalletId } from '../constants/openfort'

type ConnectorLike = { id: string; name?: string }

export function shouldExcludeConnector(connector: ConnectorLike, allConnectors: ConnectorLike[]): boolean {
  const { id, name } = connector
  const has = (ids: string[]) => allConnectors.some((w) => ids.includes(w.id))

  if (id === embeddedWalletId || name?.toLowerCase().includes('openfort')) return true
  if (has(['io.metamask', 'io.metamask.mobile']) && (id === 'metaMask' || id === 'metaMaskSDK' || id === 'injected'))
    return true
  if (has(['com.coinbase.wallet']) && id === 'coinbaseWalletSDK') return true

  return false
}
