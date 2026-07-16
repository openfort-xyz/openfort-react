import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'
import styled from '../../../styles/styled'
import { CopyIcon } from './CopyIcon'

const StyledButton = styled.button<{ $size: number }>`
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  padding: 0;
  border: none;
  border-radius: var(--ck-secondary-button-border-radius);
  background: var(--ck-accent-color, rgba(26, 136, 248, 0.1));
  cursor: pointer;
  transition: background 200ms ease;
  display: flex;
  align-items: center;
  justify-content: center;

  --color: var(--ck-accent-text-color, #1a88f8);
  --bg: var(--ck-accent-color, rgba(26, 136, 248, 0.1));

  &:hover:not(:disabled) {
    background: var(--ck-accent-color, rgba(26, 136, 248, 0.2));
    --bg: var(--ck-accent-color, rgba(26, 136, 248, 0.2));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

interface CopyIconButtonProps {
  value: string
  /** Button edge length in px (default 48). The icon scales to half. */
  size?: number
}

export const CopyIconButton = ({ value, size = 48 }: CopyIconButtonProps) => {
  const { copied, copy } = useCopyToClipboard()

  return (
    <StyledButton $size={size} onClick={() => copy(value)} disabled={!value} type="button">
      <CopyIcon copied={copied} size={Math.round(size / 2)} />
    </StyledButton>
  )
}
