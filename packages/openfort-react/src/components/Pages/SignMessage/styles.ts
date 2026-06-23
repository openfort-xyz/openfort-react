import styled from '../../../styles/styled'

export const SignContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const Subtitle = styled.p`
  margin: 0;
  text-align: center;
  font-size: 15px;
  line-height: 1.4;
  color: var(--ck-body-color-muted, #999);
`

export const MessageBox = styled.div<{ $scroll?: boolean }>`
  padding: 16px;
  border-radius: 12px;
  background: var(--ck-body-background-secondary, rgba(0, 0, 0, 0.04));
  color: var(--ck-body-color, #111);
  font-size: 14px;
  line-height: 1.45;
  text-align: left;
  word-break: break-word;
  white-space: pre-wrap;
  ${({ $scroll }) => $scroll && 'max-height: 320px; overflow-y: auto;'}
`

export const DataList = styled.ul`
  margin: 0;
  padding-left: 18px;
  list-style: disc;
`

export const DataItem = styled.li`
  margin: 2px 0;
`

export const DataKey = styled.span`
  color: var(--ck-body-color-muted, #777);
`

export const ErrorText = styled.div`
  text-align: center;
  font-size: 13px;
  color: var(--ck-body-color-danger, #e7000b);
`

export const CopyRow = styled.div`
  display: flex;
  justify-content: center;
`
