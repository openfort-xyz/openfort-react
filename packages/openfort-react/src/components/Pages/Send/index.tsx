/**
 * Send page router
 *
 * Picks EthereumSend or SolanaSend based on chainType.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'
import type React from 'react'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { EthereumSend } from './EthereumSend'

const SEND_REGISTRY: Partial<Record<ChainTypeEnum, React.FC>> = {
  [ChainTypeEnum.EVM]: EthereumSend,
  // [ChainTypeEnum.SVM]: SolanaSend,
}

const Send: React.FC = () => {
  const { chainType } = useOpenfortCore()
  const Component = SEND_REGISTRY[chainType]
  return Component ? <Component /> : <EthereumSend />
}

export default Send
