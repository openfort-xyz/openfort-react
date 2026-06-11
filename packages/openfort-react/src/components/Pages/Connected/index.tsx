import { ChainTypeEnum } from '@openfort/openfort-js'
import type React from 'react'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import EthereumConnected from './EthereumConnected'
import SolanaConnected from './SolanaConnected'

const CONNECTED_REGISTRY: Partial<Record<ChainTypeEnum, React.FC>> = {
  [ChainTypeEnum.EVM]: EthereumConnected,
  [ChainTypeEnum.SVM]: SolanaConnected,
}

export const Connected: React.FC = () => {
  const { chainType } = useOpenfortCore()
  const Component = CONNECTED_REGISTRY[chainType]
  return Component ? <Component /> : null
}
