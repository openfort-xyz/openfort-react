import { motion } from 'framer-motion'
import { css, keyframes } from 'styled-components'
import defaultTheme from '../../../constants/defaultTheme'
import styled from '../../../styles/styled'

type ChainContainerProps = {
  size?: number | string
  radius?: number | string
}

export const ChainContainer = styled.div<ChainContainerProps>`
  --bg: transparent;
  --color: #333;
  ${(props) =>
    typeof props.size === 'string'
      ? css`
          --width: ${props.size};
          --height: ${props.size};
        `
      : css`
          --width: ${props.size && props.size >= 0 ? `${props.size}px` : '24px'};
          --height: ${props.size && props.size >= 0 ? `${props.size}px` : '24px'};
        `};
  ${(props) =>
    typeof props.radius === 'string'
      ? css`
          --radius: ${props.radius};
        `
      : css`
          --radius: ${props.radius && props.radius >= 0 ? `${props.radius}px` : '24px'};
        `};
  display: block;
  position: relative;
  width: var(--width);
  height: var(--height);
  min-width: var(--width);
  min-height: var(--height);
  border-radius: var(--radius);
  background: var(--ck-body-background-secondary);
  pointer-events: none;
  user-select: none;
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  > div {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`

export const LogoContainer = styled(motion.div)`
  display: block;
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
`

const Spin = keyframes`
  0%{ transform: rotate(0deg); }
  100%{ transform: rotate(360deg); }
`
export const LoadingContainer = styled(motion.div)`
  position: absolute;
  inset: 0;
  animation: ${Spin} 1s linear infinite;
  svg {
    display: block;
    position: absolute;
    inset: 0;
  }
`

export const Unsupported = styled(motion.div)`
  z-index: 2;
  position: absolute;
  top: 0;
  right: 0;
  width: 40%;
  height: 40%;
  min-width: 13px;
  min-height: 13px;
  color: var(--ck-body-color-danger, red);
  svg {
    display: block;
    position: relative;
    top: -30%;
    right: -30%;
  }
`

/**
 * Pill-shaped chain indicator/switch button shown in the connected header.
 *
 * Shared by the EVM `ChainSelect` (which adds a chevron + dropdown when more
 * than one chain is available) and the read-only Solana indicator (which always
 * renders in the `disabled` single-network state). The `disabled` branch
 * collapses to an icon-only badge and shifts left to keep the icon aligned with
 * the enabled pill.
 */
export const SwitchChainButton = styled(motion.button)`
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
