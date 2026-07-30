'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { AnimatePresence, motion } from 'framer-motion'
import type React from 'react'
import { useEffect, useState } from 'react'
import { keyframes } from 'styled-components'

import { chainConfigs } from '../../constants/chainConfigs.js'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useBalance } from '../../hooks/useBalance.js'
import useIsMounted from '../../hooks/useIsMounted.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { useSolanaEmbeddedWallet } from '../../solana/hooks/useSolanaEmbeddedWallet.js'
import styled from '../../styles/styled/index.js'
import { nFormatter } from '../../utils/index.js'
import Chain from '../Common/Chain/index.js'
import { useOpenfort } from '../Openfort/useOpenfort.js'

const Container = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`
const PlaceholderKeyframes = keyframes`
  0%,100%{ opacity: 0.1; transform: scale(0.75); }
  50%{ opacity: 0.75; transform: scale(1.2) }
`
const PulseContainer = styled.div`
  pointer-events: none;
  user-select: none;
  padding: 0 5px;
  span {
    display: inline-block;
    vertical-align: middle;
    margin: 0 2px;
    width: 3px;
    height: 3px;
    border-radius: 4px;
    background: currentColor;
    animation: ${PlaceholderKeyframes} 1000ms ease infinite both;
  }
`

type BalanceProps = {
  hideIcon?: boolean
  hideSymbol?: boolean
}

export const Balance: React.FC<BalanceProps> = ({ hideIcon, hideSymbol }) => {
  const isMounted = useIsMounted()
  const [isInitial, setIsInitial] = useState(true)

  // Use chain-specific hooks
  const { chainType } = useOpenfortCore()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  const isConnected = wallet.status === 'connected'
  const address = isConnected ? wallet.address : undefined
  const chainId = isConnected && chainType === ChainTypeEnum.EVM ? (wallet as typeof ethereumWallet).chainId : undefined
  const cluster = chainType === ChainTypeEnum.SVM && isConnected ? (wallet as typeof solanaWallet).cluster : undefined

  const { chains } = useOpenfort()
  const chainIsSupported = chainId != null && chains.some((c) => c.id === chainId)

  const balance = useBalance({
    address: address ?? '',
    chainType: chainType,
    chainId: chainId ?? 84532,
    cluster,
    enabled: isConnected && !!address,
    refetchInterval: 30_000, // Replaces blockNumber-based invalidation
  })

  const currentChain = chainConfigs.find((c) => c.id === chainId)
  const balanceFormatted = balance.status === 'success' ? balance.formatted : undefined
  const balanceSymbol = balance.status === 'success' ? balance.symbol : undefined

  const state = `${
    !isMounted || balanceFormatted === undefined ? `balance-loading` : `balance-${currentChain?.id}-${balanceFormatted}`
  }`

  useEffect(() => {
    setIsInitial(false)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={state}
          initial={
            balanceFormatted !== undefined && isInitial
              ? {
                  opacity: 1,
                }
              : { opacity: 0, position: 'absolute', top: 0, left: 0, bottom: 0 }
          }
          animate={{ opacity: 1, position: 'relative' }}
          exit={{
            opacity: 0,
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
          }}
          transition={{
            duration: 0.4,
            ease: [0.25, 1, 0.5, 1],
            delay: 0.4,
          }}
        >
          {!isConnected || !isMounted || balanceFormatted === undefined ? (
            <Container>
              {!hideIcon && chainType === ChainTypeEnum.EVM && <Chain id={chainId} />}
              <span style={{ minWidth: 32 }}>
                <PulseContainer>
                  <span style={{ animationDelay: '0ms' }} />
                  <span style={{ animationDelay: '50ms' }} />
                  <span style={{ animationDelay: '100ms' }} />
                </PulseContainer>
              </span>
            </Container>
          ) : chainType === ChainTypeEnum.EVM && !chainIsSupported ? (
            <Container>
              {!hideIcon && <Chain id={chainId} />}
              <span style={{ minWidth: 32 }}>???</span>
            </Container>
          ) : (
            <Container>
              {!hideIcon && chainType === ChainTypeEnum.EVM && <Chain id={chainId} />}
              <span style={{ minWidth: 32 }}>{nFormatter(Number(balanceFormatted))}</span>
              {!hideSymbol && balanceSymbol && ` ${balanceSymbol}`}
            </Container>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
