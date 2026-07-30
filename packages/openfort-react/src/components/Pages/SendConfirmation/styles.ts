import styled from '../../../styles/styled/index.js'
import { ButtonContainer } from '../../Common/Button/styles.js'

export const SummaryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 20px 0;
`

export const SummaryItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  text-align: left;
`

export const SummaryLabel = styled.span`
  font-size: 14px;
  color: var(--ck-body-color-muted);
`

const SummaryValue = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--ck-body-color);
  text-align: right;
  word-break: break-all;
`

export const AmountValue = styled(SummaryValue)`
  color: var(--ck-body-color);
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`

export const AddressValue = styled(SummaryValue)`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`

export const FeesValue = styled(SummaryValue)<{ $completed?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  text-decoration: ${(props) => (props.$completed ? 'line-through' : 'none')};
  opacity: ${(props) => (props.$completed ? 0.6 : 1)};
`

export const FiatValue = styled.span`
  margin-left: 6px;
  font-size: 13px;
  font-weight: 400;
  color: var(--ck-body-color-muted);
`

export const NetworkValue = styled(SummaryValue)`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;

  svg,
  img {
    width: 18px;
    height: 18px;
    border-radius: 50%;
  }
`

/** The would-be fee, struck through, shown next to "Sponsored". */
export const FeeStrike = styled.span`
  text-decoration: line-through;
  opacity: 0.55;
`

export const SponsoredText = styled.span`
  color: var(--ck-body-color-valid, #16a34a);
  font-weight: 600;
`

export const PayWithCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--ck-body-background-secondary, rgba(0, 0, 0, 0.04));
`

export const PayWithMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
`

export const PayWithAddress = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--ck-body-color);
`

export const PayWithBadge = styled.span`
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ck-body-color);
  background: var(--ck-body-background);
`

export const InfoIconWrapper = styled.span`
  color: var(--ck-body-color-muted);
  opacity: 0.6;
  line-height: 0;
  
  &:hover {
    opacity: 1;
  }
  
  svg {
    display: block;
    width: 14px;
    height: 14px;
    vertical-align: middle;
  }
`

export const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;

  > button {
    flex: 1;
  }

  ${ButtonContainer} {
    margin: 0;
  }
`

export const StatusMessage = styled.div<{
  $status: 'idle' | 'success' | 'error'
}>`
  margin-top: 16px;
  font-size: 14px;
  font-weight: ${(props) => (props.$status === 'idle' ? '600' : '500')};
  color: ${(props) => {
    if (props.$status === 'success') return 'var(--ck-body-color-valid)'
    if (props.$status === 'error') return 'var(--ck-body-color-danger)'
    return 'var(--ck-body-color)'
  }};
  text-align: center;
`

export const ErrorContainer = styled.div`
  margin-top: 16px;
  padding: 16px;
  background: var(--ck-body-background-secondary);
  border-radius: 12px;
  border: 1px solid var(--ck-body-color-danger, rgba(255, 71, 71, 0.2));
`

export const ErrorTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: var(--ck-body-color-danger);
  margin-bottom: 8px;
`

export const ErrorMessage = styled.div`
  font-size: 14px;
  color: var(--ck-body-color);
  margin-bottom: 8px;
  line-height: 1.4;
`

export const ErrorAction = styled.div`
  font-size: 13px;
  color: var(--ck-body-color-muted);
  line-height: 1.4;
`
