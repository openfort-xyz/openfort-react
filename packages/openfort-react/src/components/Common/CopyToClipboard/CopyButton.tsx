import type React from 'react'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard.js'
import Button from '../Button/index.js'
import { CopyIcon } from './CopyIcon.js'

interface CopyButtonProps {
  value: string
  children: React.ReactNode
}

export const CopyButton = ({ value, children }: CopyButtonProps) => {
  const { copied, copy } = useCopyToClipboard()

  return (
    <Button disabled={!value} onClick={() => copy(value)} icon={<CopyIcon copied={copied} />}>
      {children}
    </Button>
  )
}
