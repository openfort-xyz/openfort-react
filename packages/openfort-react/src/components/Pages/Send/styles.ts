import styled from '../../../styles/styled/index.js'

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 20px;
`

/** Rounded container shared by the "To" and "Amount" boxes. */
export const SendCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--ck-secondary-button-border-radius);
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-secondary-button-background);
  text-align: left;
`

export const CardLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: var(--ck-body-color-muted);
`

/** "To" box: inline label, recipient input, and a Paste button. */
export const ToRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

export const RecipientInput = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--ck-body-color);
  font-size: 15px;
  font-weight: 500;
  padding: 0;
  outline: none;

  &::placeholder {
    color: var(--ck-body-color-muted);
  }
`

export const PasteButton = styled.button`
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-body-background);
  color: var(--ck-body-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;

  &:hover {
    background: var(--ck-secondary-button-hover-background);
  }
`

/** "Amount" box: large amount input with an inline token selector. */
export const AmountRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

export const AmountField = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--ck-body-color);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.1;
  padding: 0;
  outline: none;

  &::placeholder {
    color: var(--ck-body-color-muted);
  }
`

export const PillLogo = styled.span`
  display: flex;
  align-items: center;
  width: 22px;
  flex-shrink: 0;
`

export const TokenPill = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-body-background);
  color: var(--ck-body-color);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;

  &:hover {
    background: var(--ck-secondary-button-hover-background);
    border-color: var(--ck-body-color-muted);
  }
`

/** Bottom row of the amount box: fiat value (left), balance + Use max (right). */
export const AmountMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

export const MetaText = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--ck-body-color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const BalanceMeta = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--ck-body-color-muted);
`

export const UseMaxButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ck-accent-color, var(--ck-focus-color, #1a88f8));
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const ErrorText = styled.span`
  display: block;
  margin-top: 2px;
  font-size: 13px;
  color: var(--ck-body-color-danger);
`
