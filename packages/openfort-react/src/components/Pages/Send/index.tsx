/**
 * Send page router
 *
 * Renders the EVM send form. Solana is reached via the dedicated `sol:send`
 * route (registered in ConnectModal), so it isn't in this shared registry.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'
import type React from 'react'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { EthereumSend } from './EthereumSend'

const SEND_REGISTRY: Partial<Record<ChainTypeEnum, React.FC>> = {
  [ChainTypeEnum.EVM]: EthereumSend,
}

const Send: React.FC = () => {
  const { chainType } = useOpenfortCore()
  const Component = SEND_REGISTRY[chainType]
  return Component ? <Component /> : <EthereumSend />
}

export default Send
