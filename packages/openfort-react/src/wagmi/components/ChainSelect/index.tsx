'use client'

import { motion } from 'framer-motion'
import type React from 'react'
import { useEffect, useState } from 'react'
import { css } from 'styled-components'
import { useChainId, useSwitchChain } from 'wagmi'
import Chain from '../../../components/Common/Chain'
import Tooltip from '../../../components/Common/Tooltip'
import { routes } from '../../../components/Openfort/types'
import { useOpenfort } from '../../../components/Openfort/useOpenfort'
import defaultTheme from '../../../constants/defaultTheme'
import useLocales from '../../../hooks/useLocales'
import styled from '../../../styles/styled'
import { flattenChildren, isMobile } from '../../../utils'
import ChainSelectDropdown from '../ChainSelectDropdown'

const Container = styled(motion.div)``

const SwitchChainButton = styled(motion.button)`
  --color: var(
    --ck-dropdown-button-color,
    var(--ck-button-primary-color, var(--ck-body-color))
  );
  --background: var(
    --ck-dropdown-button-background,
    var(--ck-secondary-button-background, var(--ck-body-background-secondary))
  );
  --box-shadow: var(
    --ck-dropdown-button-box-shadow,
    var(
      --ck-secondary-button-box-shadow,
      var(--ck-button-primary-box-shadow),
      none
    )
  );

  --hover-color: var(--ck-dropdown-button-hover-color, var(--color));
  --hover-background: var(
    --ck-dropdown-button-hover-background,
    var(--background)
  );
  --hover-box-shadow: var(
    --ck-dropdown-button-hover-box-shadow,
    var(--box-shadow)
  );

  --active-color: var(--ck-dropdown-button-active-color, var(--hover-color));
  --active-background: var(
    --ck-dropdown-button-active-background,
    var(--hover-background)
  );
  --active-box-shadow: var(
    --ck-dropdown-button-active-box-shadow,
    var(--hover-box-shadow)
  );

  appearance: none;
  user-select: none;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 15px;
  width: 52px;
  height: 30px;
  padding: 2px 6px 2px 3px;
  font-size: 16px;
  line-height: 19px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transform: translateZ(0px);

  transition: 100ms ease;
  transition-property: transform, background-color, box-shadow, color;

  color: var(--color);
  background: var(--background);
  box-shadow: var(--box-shadow);

  svg {
    position: relative;
    display: block;
  }

  ${(props) =>
    props.disabled
      ? css`
          width: auto;
          padding: 3px;
          position: relative;
          left: -22px;
        `
      : css`
          cursor: pointer;

          @media only screen and (min-width: ${defaultTheme.mobileWidth + 1}px) {
            &:hover,
            &:focus-visible {
              color: var(--hover-color);
              background: var(--hover-background);
              box-shadow: var(--hover-box-shadow);
            }
            &:active {
              color: var(--active-color);
              background: var(--active-background);
              box-shadow: var(--active-box-shadow);
            }
          }
        `}
`

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
  const { chains } = useSwitchChain()

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
            {disabled ? (
              <Tooltip message={locales.chainNetwork} xOffset={-6} delay={0.01}>
                <Chain id={chain?.id} />
              </Tooltip>
            ) : (
              <Chain id={chain?.id} />
            )}
            {!disabled && <ChevronDown style={{ top: 1, left: -3 }} />}
          </SwitchChainButton>
        )}
      </ChainSelectDropdown>
    </Container>
  )
}

export default ChainSelector
