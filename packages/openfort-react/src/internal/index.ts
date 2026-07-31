/**
 * Implementation internals for `@openfort/react`.
 *
 * Imported as `@openfort/react/internal`. This entry point exposes the wiring the
 * documented entry points are built on — the zustand store shape, its React
 * context, and the selectors that read it. Prefer this entry point for these
 * internals; deprecated compatibility exports of the same symbols remain at the
 * package root until the next major release. The internal entry point may change
 * in any release, including patch releases.
 *
 * Reach for `useUser`, `useEthereumEmbeddedWallet`, or `useSolanaEmbeddedWallet`
 * from the public entry points first; use this only when no public hook covers
 * what you need.
 *
 * @packageDocumentation
 */

export { StoreContext } from '../openfort/context.js'
export {
  selectActiveAddress,
  selectChainType,
  selectEmbeddedState,
  selectIsAuthenticated,
  selectIsLoading,
  selectUser,
  selectWalletStatus,
} from '../openfort/selectors.js'
export type { OpenfortStore, OpenfortStoreState } from '../openfort/store.js'
