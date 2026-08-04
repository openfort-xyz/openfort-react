'use client'

import { Suspense } from 'react'
import { Spinner } from '../Common/Spinner/index.js'

/**
 * Placeholder shown while a code-split page's chunk arrives. It matches the
 * standard page width so the modal does not snap to zero and back while loading.
 */
export const PageLoading = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 295,
      height: 180,
    }}
  >
    <Spinner />
  </div>
)

/** Wraps a code-split page in the shared modal-sized loading fallback. */
export const withPageLoading = (page: React.ReactNode) => <Suspense fallback={<PageLoading />}>{page}</Suspense>
