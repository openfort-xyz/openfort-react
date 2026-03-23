import styled from '../../../styles/styled'
import { PageContent } from '../../PageContent'

export const SelectTokenContent = styled(PageContent)`
  min-height: 320px;
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;
`

export const TokenList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 6px;
  flex: 1;
`

export const TokenButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border-radius: var(--ck-secondary-button-border-radius);
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-secondary-button-background);
  color: var(--ck-body-color);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;

  &:hover {
    background: var(--ck-secondary-button-hover-background);
    border-color: var(--ck-body-color-muted);
  }
`
export const TokenContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border-radius: var(--ck-secondary-button-border-radius);
  border: 1px solid var(--ck-body-divider);
  background: var(--ck-secondary-button-background);
  color: var(--ck-body-color);
`

export const TokenInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  text-align: right;
`

export const TokenSymbol = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--ck-body-color);
`

export const TokenName = styled.span`
  font-size: 13px;
  color: var(--ck-body-color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const TokenBalance = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--ck-body-color);
`

export const TokenLeftGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`

export const TokenLogoArea = styled.div`
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
`

export const TokenLogoFallback = styled.div<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${(p) => p.$bg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  user-select: none;
`

export const TokenLogoImg = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
`

export const ChainBadge = styled.div`
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--ck-body-background);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 0.7px var(--ck-body-background);
`

export const EmptyState = styled.div`
  margin-top: 28px;
  font-size: 13px;
  color: var(--ck-body-color-muted);
  text-align: center;
`

export const InfoLink = styled.button`
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  font-size: 13px;
  font-weight: 400;
  color: var(--ck-body-color-muted, rgba(255, 255, 255, 0.4));
  padding: 0 0 8px;
  cursor: pointer;
  transition: color 0.15s ease;
  svg { opacity: 0.6; }
  &:hover {
    color: var(--ck-body-color, #fff);
    svg { opacity: 1; }
  }
`

export const ContentWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`

export const ChainGroup = styled.div`
  &:not(:first-child) {
    margin-top: 16px;
  }
`

export const ChainGroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ck-body-color, #fff);
  margin-bottom: 8px;
`

export const TokenPill = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--ck-body-background-secondary, rgba(255, 255, 255, 0.06));
  font-size: 13px;
  font-weight: 500;
  color: var(--ck-body-color-muted, rgba(255, 255, 255, 0.6));
  &:not(:last-child) {
    margin-bottom: 4px;
  }
`

export const TokenPillSymbol = styled.span`
  color: var(--ck-body-color, #fff);
  font-weight: 600;
`
