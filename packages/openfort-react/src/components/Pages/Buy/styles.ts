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

export const AmountColumnCard = styled(AmountCard)`
  flex-direction: column;
  align-items: stretch;
`

export const AmountRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

export const AmountRowInput = styled(AmountInput)`
  flex: 1;
  min-width: 0;
  text-align: left;
`

export const TokenPillButton = styled(SelectorButton)`
  width: auto;
  flex: 0 0 auto;
  padding: 6px 12px;
  border-radius: 999px;
`

export const TokenPillContent = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
`

export const TokenPillLogo = styled.div`
  width: 22px;
  flex: 0 0 auto;
`

export const ConversionLine = styled.div`
  margin-top: 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--ck-body-color-muted);
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

export const SummaryValue = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--ck-body-color);
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

export const ChainLogoImg = styled.img`
  border-radius: 50%;
`
