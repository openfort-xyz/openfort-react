import styled from '../../../styles/styled/index.js'

export const SignContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  /* Cap to the modal viewport (InnerContainer caps at 88vh) so the message body
     is the only part that scrolls and the Sign button stays pinned and reachable
     on small screens. 112px ≈ PageContent top padding + PageContents padding,
     mirroring DepositWallet's Layout. */
  max-height: calc(88vh - 112px);
`

export const Subtitle = styled.p`
  flex-shrink: 0;
  margin: 0;
  text-align: center;
  font-size: 15px;
  line-height: 1.4;
  color: var(--ck-body-color-muted, #999);
`

export const MessageBox = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 16px;
  border-radius: 12px;
  background: var(--ck-body-background-secondary, rgba(0, 0, 0, 0.04));
  color: var(--ck-body-color, #111);
  font-size: 14px;
  line-height: 1.45;
  text-align: left;
  word-break: break-word;
  white-space: pre-wrap;
`

export const Footer = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

export const SuccessWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px 0 4px;
`

export const SuccessCircle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: #fff;
  background: var(--ck-body-color-valid, #16a34a);
`

export const SuccessTitle = styled.div`
  font-size: 17px;
  font-weight: 600;
  color: var(--ck-body-color, #111);
`

export const SignaturePreview = styled.code`
  display: block;
  max-width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--ck-body-background-secondary, rgba(0, 0, 0, 0.04));
  color: var(--ck-body-color-muted, #777);
  font-size: 12px;
  word-break: break-all;
  text-align: center;
`
