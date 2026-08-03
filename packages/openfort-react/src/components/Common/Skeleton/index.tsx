'use client'

import { keyframes } from 'styled-components'
import styled from '../../../styles/styled'

const shimmer = keyframes`
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
`

/**
 * Loading placeholder block — sized by the caller to roughly match the content
 * it stands in for, so screens never render empty while something loads.
 */
export const Skeleton = styled.div<{ $height?: number; $width?: string; $radius?: number }>`
  height: ${({ $height }) => $height ?? 14}px;
  width: ${({ $width }) => $width ?? '100%'};
  border-radius: ${({ $radius }) => $radius ?? 8}px;
  background: var(--ck-secondary-button-background, rgba(0, 0, 0, 0.06));
  animation: ${shimmer} 1.4s ease-in-out infinite;
`

/** A vertical stack of skeleton lines with consistent spacing. */
export const SkeletonStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
`
