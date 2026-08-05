'use client'

import { Component, type ErrorInfo, type ReactNode, Suspense } from 'react'
import { logger } from '../../utils/logger.js'
import ErrorFallbackPage from '../Common/ErrorFallbackPage/index.js'
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

type PageErrorBoundaryState = { hasError: boolean }

/**
 * Keeps a page failure inside the modal.
 *
 * `React.lazy` rejects when a chunk cannot be fetched — the usual cause being a
 * deploy that replaced the content-hashed file the open page still refers to.
 * `Suspense` does not catch that, so without a boundary here the rejection
 * unwinds past `OpenfortProvider` into the host application.
 */
export class PageErrorBoundary extends Component<{ children: ReactNode }, PageErrorBoundaryState> {
  override state: PageErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): PageErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Failed to render a modal page', error, info.componentStack)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <ErrorFallbackPage
          header="Something went wrong"
          description="This screen could not be loaded. Check your connection, or reload the page if it was recently updated."
          onReload={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}

/** Wraps a code-split page in the shared modal-sized loading fallback. */
export const withPageLoading = (page: ReactNode) => (
  <PageErrorBoundary>
    <Suspense fallback={<PageLoading />}>{page}</Suspense>
  </PageErrorBoundary>
)
