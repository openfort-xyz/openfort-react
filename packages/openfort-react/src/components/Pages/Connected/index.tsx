'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import type React from 'react'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import EthereumConnected from './EthereumConnected.js'
import SolanaConnected from './SolanaConnected.js'

const CONNECTED_REGISTRY: Partial<Record<ChainTypeEnum, React.FC>> = {
  [ChainTypeEnum.EVM]: EthereumConnected,
  [ChainTypeEnum.SVM]: SolanaConnected,
}

const Connected: React.FC = () => {
  const { chainType } = useOpenfortCore()
  const Component = CONNECTED_REGISTRY[chainType]
  return Component ? <Component /> : null
}

export default Connected
