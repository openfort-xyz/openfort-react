import type { OpenfortEthereumBridgeConnector } from '../ethereum/OpenfortEthereumBridgeContext'
import { useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext'

function useConnectors(): OpenfortEthereumBridgeConnector[] {
  const bridge = useEthereumBridge()
  return bridge?.connectors ?? []
}

function useConnector(id: string, uuid?: string): OpenfortEthereumBridgeConnector | undefined {
  const connectors = useConnectors()
  if (id === 'injected' && uuid) {
    return connectors.find((c) => c.id === id && c.name === uuid)
  }
  if (id === 'injected') {
    return connectors.find((c) => c.id === id && c.name?.includes('Injected'))
  }
  return connectors.find((c) => c.id === id)
}

export function useFamilyAccountsConnector() {
  return useConnector('familyAccountsProvider')
}
export function useFamilyConnector() {
  return useConnector('co.family.wallet')
}
