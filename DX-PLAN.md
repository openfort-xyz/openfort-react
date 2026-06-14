# @openfort/react — DX Improvement Plan

> Additive-only (zero breaking changes) · full transaction parity · tree-shakeable
> Produced from a 9-auditor codebase+docs pass → 6-architect design → adversarial red-team (`goAhead: true`).

---

## 0. TL;DR

The **bundle architecture is already good** — tree-shaking works, the 4 subpaths (`.`, `/ethereum`, `/solana`, `/wagmi`) cleanly isolate chains, wagmi is genuinely opt-in via `OpenfortEthereumBridgeContext`, the modal is lazy-split. *"Solana OR Ethereum OR both, wagmi or not"* is **structurally achieved** at the bundle level.

The DX pain is **above the bundler**: config sprawl, inconsistent hook shapes, chain asymmetry (EVM+wagmi is the only first-class transact path), a half-built state layer, and docs/CLI drift. All of it is fixable **additively** — nothing existing is renamed, removed, or retyped.

Two outright bugs surfaced en route (both verified directly, see §2). They are worth fixing **now**, independent of the DX work.

---

## 1. North-star golden path (before → after)

### EVM, no wagmi
**Before** — 4-deep provider nest + hand-rolled `eth_sendTransaction`, no `isSponsored` signal:
```tsx
'use client'
const qc = new QueryClient()
const wagmiConfig = createConfig(getDefaultConfig({ appName: 'My App', chains:[polygonAmoy], walletConnectProjectId:'...' }))
<QueryClientProvider client={qc}>
  <WagmiProvider config={wagmiConfig}>
    <OpenfortWagmiBridge>                          {/* mandatory, undocumented ordering */}
      <OpenfortProvider publishableKey={PK}
        walletConfig={{ shieldPublishableKey: SHIELD, ethereum:{ ethereumFeeSponsorshipId:'spon_...' } }}
        uiConfig={{ appName:'My App' }}>            {/* appName duplicated */}
        {children}
      </OpenfortProvider>
    </OpenfortWagmiBridge>
  </WagmiProvider>
</QueryClientProvider>
// to send: "use wagmi or viem directly" → hand-roll encode + eth_sendTransaction
```

**After** — one provider, sponsored send from the SDK, `isSponsored` signal:
```tsx
'use client'
import { OpenfortProvider } from '@openfort/react'
<OpenfortProvider
  publishableKey={PK}
  shieldPublishableKey={SHIELD}                    // NEW top-level (was buried)
  ethereum={{ chainId: 84532, ethereumFeeSponsorshipId: 'spon_...' }}>
  {children}
</OpenfortProvider>
```
```tsx
import { useSendTransaction, useEthereumBalance } from '@openfort/react/ethereum'
const { data: hash, isLoading, isError, error, isSponsored, sendTransaction } = useSendTransaction()
const { data: bal } = useEthereumBalance()
sendTransaction({ to: '0x…', value: parseEther('0.001') })   // sponsored, no wagmi, no QueryClient, no bridge
```
Still want wagmi? `import { OpenfortWagmiProvider } from '@openfort/react/wagmi'` — one provider that auto-mounts `QueryClient > WagmiProvider > OpenfortWagmiBridge > OpenfortProvider`; pass `chains` **or** `wagmiConfig`. The existing 4-nest + all wagmi hooks stay unchanged.

### Solana
**After** — one provider, sponsored SOL send (replaces ~90 hand-rolled `@solana/kit` lines):
```tsx
import { OpenfortProvider } from '@openfort/react'
<OpenfortProvider publishableKey={PK} shieldPublishableKey={SHIELD}
  solana={{ cluster:'devnet', sponsor:{ kora:{ rpcUrl: KORA_RPC, apiKey: KORA_KEY } } }}>
  {children}
</OpenfortProvider>
```
```tsx
import { useSolanaTransaction } from '@openfort/react/solana'
const { sendSol, data, isLoading, isError, error, isSponsored } = useSolanaTransaction()
sendSol({ to:'Gsbw…', amountSol: 0.01 })   // builds + signs + sends + confirms
```
Power users keep `@solana/kit`: `import { createSolanaSigner } from '@openfort/react/solana'` (the phantom `createTransactionSigner` JSDoc becomes a real export).

### Headless custom auth — zero UI deps, one error channel
```tsx
import { OpenfortProvider } from '@openfort/react/core'   // NEW headless subpath — no modal/framer/styled/qrcode
<OpenfortProvider publishableKey={PK} shieldPublishableKey={SHIELD} defaultThrowOnError>{children}</OpenfortProvider>
```
```tsx
import { useEmailOtpAuth, useUser } from '@openfort/react/core'
const otp = useEmailOtpAuth()        // uniform { data, status, isLoading, isError, error, reset } + verb actions
try {
  if (otp.isAwaitingInput) await otp.signInWithEmailOtp({ email, otp: code })  // throws on failure (opt-in)
  else await otp.requestEmailOtp({ email })
} catch (e) { /* OpenfortError with .code / .suggestion / .docsUrl — one place */ }
```

---

## 2. Bugs found en route (fix now, independent of DX work)

| # | Bug | Evidence | Fix |
|---|-----|----------|-----|
| **B1** | **`'use client'` stripped from build** — 115 src files carry it, **0** survive in `build/`. Breaks Next.js App Router / RSC out of the box; the SSR docs are a workaround, not a fix. | `rollup.config.prod.js` has no directive-preserving plugin; verified 115 → 0. | Add `rollup-plugin-preserve-directives` (devDep, pinned) + `onwarn` swallowing only `MODULE_LEVEL_DIRECTIVE` (zero-warnings policy). |
| **B2** | **Gas sponsorship is a silent no-op at provider init** — configured `ethereumFeeSponsorshipId` is dropped; "sponsored" txs pay gas. | `resolveEthereumFeeSponsorship` returns `{ policy: id }` (strategyUtils.ts:26-31); strategies spread it into `getEthereumProvider({...})`; openfort-js expects `feeSponsorship?: string` (index.d.ts:11772). Key never matches. | Return `{ feeSponsorship: <idString> }`. Gas-positive only — no consumer relied on the broken path. Add an integration test asserting the string reaches the SDK. |

Both are in **Phase 0/1** below but could be hotfixed immediately.

---

## 3. Design principles (the "one X" rules)

1. **One config, surfaced at the top** — `publishableKey` + `shieldPublishableKey` + `appName` + `ethereum` + `solana` + `recovery` as optional top-level props. `walletConfig`/`uiConfig` stay valid and **win** when both are passed → byte-for-byte for existing callers, but the primary signature now shows the required Shield key (kills "compiles feature-less, fails late").
2. **One action-hook return contract** — every auth + tx hook returns `{ data, isLoading, isError, isSuccess, error, status, reset }` + verb actions. `data` holds the last success and survives re-renders. Keys are **added**, never renamed/retyped.
3. **One error channel, opt-in** — errors are returned as `{ error }` by default (unchanged). `defaultThrowOnError` on the provider (or `throwOnError` per hook/call) makes a single `try/catch` work. Precedence: call > hook > provider > false.
4. **One readiness signal** — `useOpenfortStatus()` → `'initializing' | 'unauthenticated' | 'authenticating' | 'connecting' | 'ready'`; `isReady === true` **guarantees** `user != null` AND an active wallet address. `useUser().isConnected` and `selectIsAuthenticated` stay byte-for-byte. *(Red-team correction: do NOT add a second `status` to `useUser` — one canonical enum only.)*
5. **One balance answer per chain** — export the existing dual-chain `useBalance`; `/ethereum` adds `useEthereumBalance` (native + single ERC-20); `useEthereumWalletAssets` remains the separate full-inventory (ERC-7811) answer (documented as such).
6. **One transaction primitive per chain; sponsorship declarative + visible** — `useSendTransaction`/`useWriteContract` (EVM, no wagmi) + `useSolanaTransaction`. Sponsorship configured once on the provider; every tx hook exposes `isSponsored`.
7. **Tree-shakeable by construction** — chain code (`viem`, `@solana/kit`, `@solana/kora`, `@solana-program/*`) reached only via subpaths and/or dynamic import; `/core` never statically imports the modal. New optional peers only.
8. **No premature abstraction** — sponsor config is exactly `{ kora }` (no generic relayer registry until a second relayer exists); shared `useEvmSend` extracted only after both EVM hooks exist.

---

## 4. Phased roadmap

Each phase is independently shippable. Red-team corrections are folded in and marked **⚠**.

### Phase 0 — Zero-risk quick wins
*Cheapest, highest-trust; unblocks everything. No new runtime code paths.*

| Item | Effort | Non-breaking rationale |
|------|--------|------------------------|
| **B1** Preserve `'use client'` in build (rollup-plugin-preserve-directives + onwarn) **⚠ declare/pin the devDep** | S | Build-only; emits a directive that should already be there. ESM/CJS ignore it; RSC stops being forced to wrap every import. |
| Export `useOpenfortStore` from root (closes the dead half-API) | S | Adds one already-implemented, already-tested symbol; the 7 selectors are exported but unusable without it. |
| Export `useBalance` from root + re-export from `/ethereum` & `/solana` | S | Existing internal; only `invalidateBalance` is exported today. (Still imports `viem` statically — made dynamic in Phase 5.) |
| Kill phantom `createTransactionSigner` JSDoc; fix "which hook" table; add `useWalletAuth`/`useConnectWithSiwe` to it | S | Comment/JSDoc text only. |
| `OpenfortError` + `code` / `suggestion` / `docsUrl` + `ERROR_CODES` registry + `createOpenfortError` **⚠ copy new fields inside the `data.error` unwrap early-return (types.ts:39-46); drop the no-op `core/errors.ts` edit** | L | Adds optional readonly fields + optional ctor options arg; 3-arg ctor + `type`/`data`/`message` unchanged. |
| `.env.example` (incl. `VITE_FEE_SPONSORSHIP_ID`) in all 4 CLI templates; envVars writes it | M | Scaffolding files only; published package untouched. |
| Remove dead `--noInstall` flag; standardize `.env` (not `.env.local`); fix `/react/quickstart` 404 (redirect to `/react`) | S | `--noInstall` is never read; CLI never auto-installs. Text edits only. |
| Document mandatory `OpenfortWagmiBridge` ordering + headless story in `@packageDocumentation` | M | Docs only. |

### Phase 1 — Sponsorship correctness + config plumbing *(deps: Phase 0 errors)*
| Item | Effort | Non-breaking rationale |
|------|--------|------------------------|
| **B2** Fix `feeSponsorship` key mismatch **⚠ return `{ feeSponsorship: <idString> }`, not nested `policy`** | S | Turns a broken feature ON; gas-positive only. |
| Add first-class Kora `sponsor` config to `SolanaConfig` + thread through `SolanaContext` **⚠ keep exactly `{ kora }`** | M | Optional field; configs without `sponsor` behave as before (`isSponsored=false`). |
| Add `@solana/kora` + `@solana-program/system` + `@solana-program/compute-budget` as **optional** peers | S | Mirrors the existing optional `@solana/kit`; reached only via dynamic import; missing optional peers don't error. |

### Phase 2 — Transaction parity hooks *(deps: Phase 1)* — the headline win
| Item | Effort | Non-breaking rationale |
|------|--------|------------------------|
| `useSendTransaction` (EVM, no wagmi) + internal `useEvmSend` core | M | New file/export; reads active embedded wallet + resolved sponsorship; passes `{ feeSponsorship }` itself; acquires provider lazily inside the action fn. |
| `useWriteContract` (EVM, no wagmi) sharing the send core (viem `encodeFunctionData`) | M | New file/export; extract `useEvmSend` **after** both exist. |
| `useEthereumBalance` (native + single ERC-20) wrapping `useBalance` **⚠ align result keys/semantics with `useEthereumWalletAssets` (incl. `isIdle`); document single-token vs inventory vs raw** | S | New file/export; subscribes to balance-invalidate event to refetch after sends. |
| Solana ops: `buildAndSendSolanaTransaction` / `sendSponsoredSolanaTransaction` (Kora) / `buildTransferSolInstruction` + `createSolanaSigner` **⚠ these helpers + `deriveWssUrl`/`toSmallestUnit`/`validateEd25519Signature` must be IMPLEMENTED (don't exist yet); derive wss from cluster/rpcUrl, not hardcoded devnet** | L | Adds exported pure fns to existing `operations.ts`; all `@solana/*` imports DYNAMIC so `/solana` stays lean. |
| `useSolanaTransaction` (build+sign+send+confirm) with `sendSol`/`sendTransaction` + `isSponsored` | L | Brand-new hook/file; `useSolanaEmbeddedWallet` shape unchanged; fail fast if called before `status==='connected'`. |
| `signTransactionWire()` **optional** provider method (wire-ready); keep detached `signTransaction` | M | New optional interface member (external structural implementers don't break) + new `request()` branch. |
| Export tx option/result types from `/ethereum` & `/solana`; colocated tests | M | Additive types + tests. |
| Update "which hook" docs to point at the new tx hooks | S | Doc text only. |

### Phase 3 — Provider & config consolidation *(deps: Phase 1)*
| Item | Effort | Non-breaking rationale |
|------|--------|------------------------|
| Top-level `shieldPublishableKey`/`appName`/`ethereum`/`solana`/`chainType`/`recovery` passthrough on `OpenfortProvider` **⚠ map `recovery` into the correct XOR branch of `OpenfortWalletConfig` (not flat optional siblings); spread `{...derived, ...walletConfig}`; fill `uiConfig.appName` only when unset (preserve `'Openfort'` default)** | M | All new props optional; explicit `walletConfig`/`uiConfig` win → byte-for-byte for existing callers. |
| Composed `OpenfortWagmiProvider` in `/wagmi` (`chains` XOR `wagmiConfig`, auto QueryClient+bridge) **⚠ `never` on off-branch union keys (+ expectTypeOf test); memo wagmi config by chain ids; module-scoped chains; optional `queryClient`** | M | New export in existing subpath; nothing added to root, so Solana-only/headless never resolve wagmi. Manual nest + `getDefaultConfig` stay functional. |
| `createOpenfortConfig` builder (pure; validates shield+publishable; normalizes appName) | S | Pure additive export; throws `CONFIGURATION_ERROR`; does not deprecate `walletConfig`/`uiConfig`. |
| Update examples to the one-provider golden path; keep one manual-nest example | S | Examples/JSDoc only. |

### Phase 4 — Hook-contract unification + readiness/auth state *(deps: Phase 0, Phase 2)*
| Item | Effort | Non-breaking rationale |
|------|--------|------------------------|
| Extend `mapStatus` with `{ status, data }`; add `data` slot to auth hooks **⚠ 9 consumers, not 5 — also `useWalletAuth`, `useGrantPermissions`, `useRevokePermissions`, `useSignOut`; explicit `mapStatus<TResult>(...)` generic on all** | M | `mapStatus` is spread into returns; adds keys only; new 2nd arg optional. |
| `useUser` + `{ isError, error, data }` from existing `recoveryError` **⚠ do NOT add `useUser().status` (avoids a 2nd readiness enum)** | S | Adds keys only; no new source of truth; 7 existing keys untouched. |
| Provider `defaultThrowOnError` + per-hook `throwOnError` via a tiny defaults context | M | `onError`'s new defaults arg optional; default false; opt-in only. |
| Uniform action aliases (`signInWith*`/`signUpWith*`/`linkWith*`) keeping originals | S | New keys referencing the same `useCallback` fns. |
| `isAuthenticatedState` shared predicate + `selectAuthStatus` + `selectClient`; route `useUser` through it | M | Predicate reproduces `useUser`'s current expression exactly; legacy `selectIsAuthenticated` kept byte-for-byte (+ legacy JSDoc). |
| `selectStatus` + `useOpenfortStatus` (single readiness; `isReady` guarantees user+address) | M | New selector/hook/type reading existing store fields; `isConnected` & `selectIsAuthenticated` unchanged. |
| Export `AuthFlowStatus`/`AuthHookState` types + document the contract & `defaultThrowOnError` | S | New types + docs. |

### Phase 5 — Headless/UI split + bundle wins *(deps: Phase 0, 3, 4)* — riskiest tree-shaking
| Item | Effort | Non-breaking rationale |
|------|--------|------------------------|
| Make `viem` dynamic in `fetchEvmBalance`, **then** flip `viem` to optional peer **⚠ sequence is load-bearing — flipping the flag first breaks Solana-only installs** | M | Lazy-import inside `fetchEvmBalance` (mirror `fetchSolanaBalance`); return shape unchanged. |
| `headless` prop on `OpenfortProvider` (runtime modal opt-out) | S | New optional prop, default falsy → modal renders as before. *(Prop alone doesn't tree-shake; bundle drop comes from `/core`.)* |
| New `/core` subpath: headless provider that **never statically imports the modal** **⚠ build a modal-free context tree; do NOT re-export `OpenfortProvider` with `headless=true` (leaves the static `LazyConnectKitModal` import → bundlers keep framer/styled/qrcode/phone). Verify with bundle analysis** | L | Brand-new subpath (place at `src/headless` to avoid clashing with internal `src/core`); root `.` keeps the full-UI provider. |
| New `/ui` subpath exposing `<OpenfortUI/>` (opt-in modal mount) | M | New subpath/component reading existing context. |
| Widen `CustomizableRoutes` + **actually merge** `customPageComponents` into the modal pages map **⚠ wider type is a phantom feature unless each route renders standalone & is wired** | M | Widening a union is additive (superset of `typeof routes.CONNECTED`). |

> **⚠ Metric correction:** framer-motion / styled-components / qrcode / react-international-phone are `dependencies`, so they're always *installed*. `/core` reduces the consumer's **bundle** (tree-shaking, verified by analysis), not install size. True zero-install would require making them optional peers — that's **breaking**, deferred to a future major (§6).

### Phase 6 — CLI templates *(deps: Phase 3, 4)* — lowest priority
| Item | Effort | Non-breaking rationale |
|------|--------|------------------------|
| Add both-chains + supabase/betterauth CLI templates; standardize `.env` across READMEs | L | New template ids + dirs; existing selections unchanged. |
| ~~Optional TanStack mutation backing for auth/tx actions~~ **⚠ CUT per red-team — over-engineering, a 2nd execution path no pain point requires** | — | Removed. |
| *(Optional)* Route `CoreOpenfortProvider` fetches through `queryClient.fetchQuery` + `removeQueries` on logout — **only if** the post-READY refetch genuinely needs it, with `staleTime:0` force-fetch + login/logout tests | L | Internal plumbing; store fields & hook outputs byte-identical. Single change with real runtime risk — keep an internal fallback QueryClient. |

---

## 5. Risk register (guards before shipping)

- **Merge order**: spread `{...derived, ...walletConfig}` — test that `effectiveWalletConfig` deep-equals the passed `walletConfig` when no top-level props set.
- **appName**: only fill `uiConfig.appName` when `=== undefined`; preserve the `'Openfort'` default.
- **OpenfortError wrap branch**: copy `code`/`suggestion`/`docsUrl` in the `data.error` early-return — test that a wrapped error keeps its code.
- **mapStatus generic**: explicit `mapStatus<TResult>(...)` on all 9 consumers; `tsc --noEmit` clean.
- **defaultThrowOnError**: opt-in only, default false, documented loudly (opted-in apps reading `result.error` now throw).
- **/core**: bundle-analysis CI asserting the 4 UI deps are absent from a `/core`-only entry.
- **viem optional**: enforce dynamic-import-then-flip sequence; verify a Solana-only install+build.
- **CustomizableRoutes**: test mounting each newly-overridable route with a custom element; each must render with no required parent-route props.
- **OpenfortWagmiProvider**: `never` off-branch keys (expectTypeOf for both-set/neither-set); memo by chain ids; module-scoped chains to avoid per-render config rebuilds dropping connections.
- **rollup subpaths**: post-build assertion that `build/headless/index.js` and `build/ui/index.js` exist (preserveModulesRoot must match `exports` paths).
- **Overall**: every existing import/prop/hook-return key compiles and returns byte-identical values — guarded by `tsc --noEmit` + the existing test suite passing untouched.

---

## 6. Deferred to a future major (consequence of additive-only)

These conflict with *replace-don't-deprecate* but were ruled out by the no-breaking-changes decision; revisit at v2:
- Remove the now-redundant `walletConfig`/`uiConfig` split once top-level props are established.
- Make framer-motion/styled-components/qrcode/react-international-phone **optional peers** for true install-size savings.
- Collapse the duplicated SIWE implementations (`useWalletAuth.runConnectWithSiwe` vs `useConnectWithSiwe`) into one — *can be done additively now as an internal refactor* (public APIs of both stay), so consider pulling it into Phase 5 cleanup.
- Move the deprecated `Connectors` page out of the core (non-wagmi) `ConnectModal` registry.
- Retire `--noInstall` consumers / `useOpenfort()` whole-store subscription in favor of scoped selectors.

---

## 7. Success metrics

- **Lines-to-first-tx (EVM, no wagmi):** ~25 → ~6.
- **Provider depth:** 4 → 1.
- **Required keys visible** at the top level (no "compiles feature-less, fails late").
- **Sponsorship correct** (`ethereumFeeSponsorshipId` actually applied) + visible (`isSponsored` on every tx hook).
- **Headless bundle:** `/core`-only app tree-shakes out all 4 UI deps (bundle analysis); Solana-only app needs no `viem`.
- **Next.js App Router:** works with only the provider wrapper marked `'use client'`.
- **Hook uniformity:** 100% of auth + tx hooks return the same contract; one `try/catch` with `defaultThrowOnError`.
- **Readiness:** `useOpenfortStatus().isReady` guarantees `user != null` + active address.
- **Dead/phantom API removed:** `useOpenfortStore` & `useBalance` exported, `createSolanaSigner` real, `--noInstall` gone.
- **Zero breaking changes:** verified by `tsc --noEmit` + existing tests passing untouched.
