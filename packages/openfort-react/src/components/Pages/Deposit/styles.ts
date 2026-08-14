import { keyframes } from 'styled-components'
import styled from '../../../styles/styled'

/** Sizes to the content so short method lists don't leave a cut-looking gap. */
export const DepositContent = styled.div`
  display: flex;
  flex-direction: column;
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`

/** Separates the chain/currency step (above) from the action buttons (below). */
export const StepDivider = styled.div`
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--ck-body-divider, #ededed);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ck-body-color-muted, #6b7280);
`

/** Sizes a brand logo (svg/img) to 20px for use inside wallet/exchange buttons. */
export const ButtonLogo = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg,
  img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }
`

/** Loading placeholder block. */
export const Skeleton = styled.div<{ $w?: string; $h?: string; $r?: string }>`
  width: ${(p) => p.$w ?? '100%'};
  height: ${(p) => p.$h ?? '16px'};
  border-radius: ${(p) => p.$r ?? '8px'};
  background: var(--ck-body-divider, #ededed);
  animation: ${pulse} 1.4s ease-in-out infinite;
`

/** A vertical stack of skeleton lines with consistent spacing. */
export const SkeletonStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
`

export const OptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
`

export const OptionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 52px;
  box-sizing: border-box;
  padding: 10px 14px;
  border-radius: var(--ck-secondary-button-border-radius);
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-secondary-button-background);
  color: var(--ck-body-color);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease;
  text-align: left;

  &:hover:not(:disabled) {
    background: var(--ck-secondary-button-hover-background);
    border-color: var(--ck-body-color-muted);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

/** Left group: action icon badge + the title/subtitle text. */
export const OptionLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

/** Holds the per-action icon on the left of each row (no background). */
export const OptionIconBadge = styled.div`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ck-body-color, #1a1a2e);

  /* Brand logos render at their intrinsic size — cap everything to the
     badge's icon size so e.g. the Apple mark matches the action icons. */
  svg,
  img {
    width: 20px;
    height: 20px;
  }
`

/** Overlapping strip of token/wallet/exchange logos on the right of each row. */
export const LogoCluster = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  padding-left: 2px;

  img,
  svg {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    margin-left: -7px;
    border: 1.5px solid var(--ck-secondary-button-background, #fff);
    background: var(--ck-body-background, #fff);
    object-fit: cover;
    box-sizing: content-box;
  }
  img:first-child,
  svg:first-child {
    margin-left: 0;
  }

  @media (max-width: 420px) {
    padding-left: 2px;
    img,
    svg {
      width: 16px;
      height: 16px;
    }
  }
`

export const OptionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
`

export const OptionTitle = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--ck-body-color);

  @media (max-width: 420px) {
    font-size: 13px;
  }
`

export const OptionSubtitle = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: var(--ck-body-color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;

  @media (max-width: 420px) {
    font-size: 10px;
  }
`

/** Sized, centered wrapper so the QR (which sizes off its parent width) renders. */
export const QRWrapper = styled.div`
  display: block;
  margin: 14px auto;
  width: 100%;
  max-width: 300px;

  > div {
    width: 100%;
  }
`
