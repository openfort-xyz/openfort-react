import styled from '../../../styles/styled/index.js'

export const TickListContainer = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  padding-bottom: 8px;
`

export const TickItem = styled.li`
  display: flex;
  align-items: center;
  text-align: left;
  gap: 6px;
  font-size: 13px;
  line-height: 18px;
  color: var(--ck-body-color-muted);
`

export const TickIconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
`
