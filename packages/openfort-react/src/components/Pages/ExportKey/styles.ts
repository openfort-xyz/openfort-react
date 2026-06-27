import styled from '../../../styles/styled'

/** Press-and-hold reveal button: a fill grows left→right over the hold duration. */
export const HoldButton = styled.button`
  position: relative;
  overflow: hidden;
  width: 100%;
  padding: 14px 16px;
  border-radius: var(--ck-primary-button-border-radius, 16px);
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-secondary-button-background);
  color: var(--ck-body-color);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  transition: border-color 150ms ease;

  &:hover {
    border-color: var(--ck-body-color-muted);
  }
`

export const HoldFill = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: var(--ck-focus-color, #1a88f8);
  opacity: 0.22;
  pointer-events: none;
`

export const HoldLabel = styled.span`
  position: relative;
  z-index: 1;
`

export const KeyReveal = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  text-align: left;
`
