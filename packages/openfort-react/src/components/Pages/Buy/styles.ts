import styled from '../../../styles/styled'
import { ButtonContainer } from '../../Common/Button/styles'

export const Section = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 16px;
  gap: 10px;
`

export const SectionLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ck-body-color-muted);
`

export const AmountCard = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--ck-secondary-button-border-radius);
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-secondary-button-background);
  color: var(--ck-body-color);
`

export const CurrencySymbol = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: var(--ck-body-color-muted);
  line-height: 1;
`

export const AmountInput = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  color: var(--ck-body-color);
  font-size: 24px;
  font-weight: 600;
  line-height: 1;
  padding: 0;
  outline: none;
  width: 100%;

  &::placeholder {
    color: var(--ck-body-color-muted);
  }
`

export const PresetList = styled.div`
  display: flex;
  gap: 10px;
  width: 100%;
`

export const PresetButton = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 8px 12px;
  border-radius: 999px;
  border: none;
  background: ${({ $active }) => ($active ? 'var(--ck-accent-color)' : 'var(--ck-secondary-button-background)')};
  color: ${({ $active }) => ($active ? 'var(--ck-accent-text-color)' : 'var(--ck-body-color)')};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: ${({ $active }) => ($active ? 'var(--ck-accent-color)' : 'var(--ck-secondary-button-hover-background)')};
  }
`

export const SelectorButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--ck-secondary-button-border-radius);
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-secondary-button-background);
  color: var(--ck-body-color);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  text-align: left;

  &:hover {
    background: var(--ck-secondary-button-hover-background);
    border-color: var(--ck-body-color-muted);
  }
`

export const SelectorTitle = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--ck-body-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SelectorRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ck-body-color-muted);
`

export const ContinueButtonWrapper = styled.div`
  margin-top: 24px;
  display: flex;
  gap: 12px;

  > button {
    flex: 1;
  }

  ${ButtonContainer} {
    margin: 0;
  }
`

export const StackedButtonWrapper = styled.div`
  display: flex;
  gap: 12px;

  > button {
    flex: 1;
  }
`

export const PendingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px auto 32px;
  height: 120px;
`

// --- Amount-first buy screen (token decided → amount, currency, method) ---

export const BuyHeadingButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;
  padding: 4px 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--ck-body-color);
  font-size: 17px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: var(--ck-secondary-button-background);
  }
`

export const BuyHeadingLogo = styled.div`
  width: 22px;
  flex: 0 0 auto;
`

export const BigAmountRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  margin-top: 24px;
`

export const BigAmountSymbol = styled.span`
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  margin-top: 7px;
  color: var(--ck-body-color);
`

export const BigAmountInput = styled.input`
  border: none;
  background: transparent;
  outline: none;
  padding: 0;
  color: var(--ck-body-color);
  font-size: 44px;
  font-weight: 700;
  line-height: 1.1;
  text-align: left;
  min-width: 1ch;

  &::placeholder {
    color: var(--ck-body-color-muted);
  }
`

export const CenteredRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 12px;
`

export const CurrencyPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px 5px 6px;
  border-radius: 999px;
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-secondary-button-background);
  color: var(--ck-body-color-muted);
`

/** Round-cropped flag for the currency pill (emoji flags are rectangular; the circle clips them). */
export const FlagBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-body-background, #fff);
  font-size: 15px;
  line-height: 1;
  overflow: hidden;
`

/**
 * The payment-method switch below the amount — deliberately plain grey text
 * (not a button) that jumps back to the method picker. Shared by the buy
 * (onramp) screen and the wallet/exchange transfer pages.
 */
export const MethodRowButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 18px auto 0;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--ck-body-color-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    color: var(--ck-body-color);
  }
`

export const SummarySection = styled.div`
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--ck-body-divider, rgba(0, 0, 0, 0.08));
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
`

export const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

export const SummaryLabel = styled.span`
  color: var(--ck-body-color-muted);
`

export const SummaryMuted = styled.span`
  color: var(--ck-body-color-muted);
`

export const CurrencySelect = styled.select`
  appearance: none;
  background: transparent;
  border: none;
  color: var(--ck-body-color);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: right;
  font-family: inherit;
`
