'use client'

import { useEffect } from 'react'
import styled from '../../../styles/styled/index.js'
import { Spinner } from '../../Common/Spinner/index.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--ck-body-divider, #e4e4e7);
  background: var(--ck-body-background-secondary, #fafafa);
  font-size: 14px;
  color: var(--ck-body-color-muted, #6b7280);
`

/**
 * "Waiting for your deposit…" banner shown under the deposit address for a
 * same-chain "transfer from address". Arrival detection lives in
 * {@link import('./useSameChainArrival.js').useSameChainArrival}; on arrival the
 * page swaps to {@link import('./SameChainDepositSuccess.js').SameChainDepositSuccess}.
 */
export function SameChainDepositStatus() {
  const { triggerResize } = useOpenfort()

  useEffect(() => {
    triggerResize()
  }, [triggerResize])

  return (
    <Banner>
      <Spinner />
      <span>Waiting for your deposit…</span>
    </Banner>
  )
}
