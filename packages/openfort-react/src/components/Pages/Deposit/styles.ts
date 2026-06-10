import styled from '../../../styles/styled'

export const DepositContent = styled.div`
  min-height: 360px;
  display: flex;
  flex-direction: column;
`

export const OptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
`

export const OptionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 64px;
  box-sizing: border-box;
  padding: 14px 16px;
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

export const OptionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
`

export const OptionTitle = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--ck-body-color);
`

export const OptionSubtitle = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--ck-body-color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
