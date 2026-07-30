'use client'

import { motion } from 'framer-motion'
import type React from 'react'
import { useEffect, useState } from 'react'
import { useChainId } from 'wagmi'
import Chain from '../../../components/Common/Chain/index.js'
import { SwitchChainButton } from '../../../components/Common/Chain/styles.js'
import Tooltip from '../../../components/Common/Tooltip/index.js'
import { routes } from '../../../components/Openfort/types.js'
import { useOpenfort } from '../../../components/Openfort/useOpenfort.js'
import defaultTheme from '../../../constants/defaultTheme.js'
import useLocales from '../../../hooks/useLocales.js'
import styled from '../../../styles/styled/index.js'
import { flattenChildren, isMobile } from '../../../utils/index.js'
import { useSwitchChainFiltered } from '../../useSwitchChainFiltered.js'
import ChainSelectDropdown from '../ChainSelectDropdown/index.js'

const Container = styled(motion.div)``

const ChevronDown = ({ ...props }) => (
  <svg
    aria-hidden="true"
    width="11"
    height="6"
    viewBox="0 0 11 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M1.5 1L5.5 5L9.5 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ChainSelector: React.FC = () => {
  const { open, triggerResize, setRoute } = useOpenfort()
  const [isOpen, setIsOpen] = useState(false)
  const chainId = useChainId()
  const { chains } = useSwitchChainFiltered()

  const chain = chains.find((c) => c.id === chainId)

  const locales = useLocales({
    CHAIN: chain?.name ?? 'UNKNOWN',
  })

  const mobile = isMobile() || (typeof window !== 'undefined' && window?.innerWidth < defaultTheme.mobileWidth)

  useEffect(() => {
    if (!open) setIsOpen(false)
  }, [open])

  useEffect(() => {
    triggerResize()
  }, [chainId, triggerResize])

  const disabled = chains.length <= 1

  return (
    <Container>
      <ChainSelectDropdown offsetX={-12} open={!mobile && isOpen} onClose={() => setIsOpen(false)}>
        {chain && (
          <SwitchChainButton
            aria-label={flattenChildren(locales.switchNetworks).toString()}
            disabled={disabled}
            onClick={() => {
              if (mobile) {
                setRoute(routes.ETH_SWITCH_NETWORK)
              } else {
                setIsOpen(!isOpen)
              }
            }}
          >
            {/* Show the chain name on hover whether or not a switch is available
                (single configured chain, smart/delegated account, etc.). */}
            <Tooltip message={locales.chainNetwork} xOffset={-6} delay={0.01}>
              <Chain id={chain?.id} />
            </Tooltip>
            {!disabled && <ChevronDown style={{ top: 1, left: -3 }} />}
          </SwitchChainButton>
        )}
      </ChainSelectDropdown>
    </Container>
  )
}

export default ChainSelector
