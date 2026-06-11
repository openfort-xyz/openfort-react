import type { WalletStatus } from '../types'

type InternalState<TWallet, TProvider> = {
  status: WalletStatus
  activeWallet: TWallet | null
  provider: TProvider | null
  error: string | null
}

type StatusResult<TWallet, TProvider, TActions> = TActions & {
  status: WalletStatus
  activeWallet: TWallet | null
  provider?: TProvider
  error?: string
}

function buildStatusResult<TWallet, TProvider, TActions>(
  state: InternalState<TWallet, TProvider>,
  actions: TActions,
  overrides: Partial<{ activeWallet: TWallet | null; provider?: TProvider; error?: string }>
): StatusResult<TWallet, TProvider, TActions> {
  return { ...actions, status: state.status, activeWallet: state.activeWallet ?? null, ...overrides } as StatusResult<
    TWallet,
    TProvider,
    TActions
  >
}

const STATUS_RESULT_BUILDERS: Record<
  WalletStatus,
  <TWallet, TProvider, TActions>(
    state: InternalState<TWallet, TProvider>,
    actions: TActions
  ) => StatusResult<TWallet, TProvider, TActions>
> = {
  disconnected: (s, a) => buildStatusResult(s, a, { activeWallet: null }),
  'fetching-wallets': (s, a) => buildStatusResult(s, a, { activeWallet: null }),
  connecting: (s, a) => buildStatusResult(s, a, { activeWallet: s.activeWallet! }),
  reconnecting: (s, a) => buildStatusResult(s, a, { activeWallet: s.activeWallet! }),
  creating: (s, a) => buildStatusResult(s, a, { activeWallet: null }),
  'needs-recovery': (s, a) => buildStatusResult(s, a, { activeWallet: s.activeWallet! }),
  connected: (s, a) => buildStatusResult(s, a, { activeWallet: s.activeWallet!, provider: s.provider! }),
  error: (s, a) => buildStatusResult(s, a, { activeWallet: s.activeWallet, error: s.error! }),
}

export function buildEmbeddedWalletStatusResult<TWallet, TProvider, TActions extends object>(
  state: InternalState<TWallet, TProvider>,
  actions: TActions
): StatusResult<TWallet, TProvider, TActions> {
  const builder = STATUS_RESULT_BUILDERS[state.status] ?? STATUS_RESULT_BUILDERS.disconnected
  return builder(state, actions)
}
