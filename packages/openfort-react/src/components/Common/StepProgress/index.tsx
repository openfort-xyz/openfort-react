'use client'

import type React from 'react'
import styled from '../../../styles/styled'

const Track = styled.div`
  display: flex;
  gap: 6px;
  justify-content: center;
  margin: 0 0 4px;
`

const Segment = styled.div<{ $done: boolean }>`
  width: 28px;
  height: 4px;
  border-radius: 2px;
  transition: background 0.2s;
  background: ${({ $done }) => ($done ? 'var(--ck-body-color)' : 'var(--ck-body-divider, rgba(0,0,0,0.12))')};
`

const Caption = styled.div`
  margin-bottom: 2px;
  text-align: center;
  font-size: 13px;
  color: var(--ck-body-color-muted);
`

type StepProgressProps = {
  /** 1-based position of the step being shown. */
  current: number
  total: number
}

/**
 * How far through a multi-step form the user is. Only worth showing when a
 * screen was split because it was too long to face in one go — it promises the
 * end is near, so the count must be the real number of screens left.
 */
const StepProgress: React.FC<StepProgressProps> = ({ current, total }) => (
  <>
    <Track>
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional track
        <Segment key={i} $done={i < current} />
      ))}
    </Track>
    <Caption>
      Step {current} of {total}
    </Caption>
  </>
)

export default StepProgress
