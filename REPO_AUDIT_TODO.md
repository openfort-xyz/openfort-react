# Repository audit and remediation TODO

Audit target: `improvements/sdk-hardening` at `6a4ea86a` (2026-07-31).

## Executive summary

The supplied audit is directionally accurate and its highest-risk findings still reproduce on this revision. The repository has a solid package boundary and validation baseline, but those checks miss several integration failures: destructive prompt cancellation, npm packaging omissions, incomplete template configuration, recovery-flow state drift, and promises that report success before their work completes.

The concentration of risk matters more than the raw finding count:

- `packages/openfort-react/src/actions`, `errors`, and `query` follow clear boundaries and are comparatively well tested.
- `packages/create-openfort` and copied templates are the highest-risk area because filesystem mutation, credential generation, npm packaging rules, and drift meet in one workflow.
- Recovery and SIWE code have duplicated control flow that has already diverged into observable bugs.
- The public API and docs contain promises that the runtime does not honor, increasing upgrade and support risk.
- Green lint, type, and unit results do not cover the failing paths below. The audit is therefore not contradicted by the green baseline.

### Review ratings

| Dimension | Rating | Assessment |
| --- | --- | --- |
| Security | High risk | A scaffold can stage generated secrets because `.gitignore` is absent from the npm payload; documentation repeatedly labels a secret-shaped `sk_` value as publishable. |
| Correctness | High risk | Git cancellation can delete history; recovery resend and endpoint OTP flows fail; async hooks report false success; Solana conversion and backend routing have edge-case/configuration defects. |
| Maintainability | High risk | Copied state machines, template forks, phantom docs, dead API surface, and silent catches make behavior drift difficult to detect. |
| Performance | Moderate risk | Global mutable styling is unsafe for SSR, provider context work is rebuilt for an unused consumer surface, and E2E sleeps inflate feedback time. No broad algorithmic bottleneck was found. |
| Test quality | Moderate risk | The unit suite is substantial and green, but packaging, cancellation, promise rejection, and several E2E specs are not meaningfully covered. |

## Comparison with the supplied audit

### Critical claims

| # | Status | Current evidence and qualification |
| --- | --- | --- |
| 1 | Confirmed | [`git.ts`](packages/create-openfort/src/helpers/git.ts) does not call `p.isCancel` after either confirmation. A cancel symbol is truthy, so the root-repository branch reaches `fs.removeSync(.git)`. The TTY fallback in [`cli/index.ts`](packages/create-openfort/src/cli/index.ts) has the same cancellation mistake without the deletion. |
| 2 | Confirmed | `npm pack --dry-run --json` lists 145 files and no `.gitignore`. [`createBackend.ts`](packages/create-openfort/src/helpers/createBackend.ts) writes secret values to `backend/.env`; [`git.ts`](packages/create-openfort/src/helpers/git.ts) then stages the tree. The source templates do contain `.gitignore`, proving this is a package-payload problem. |
| 3 | Confirmed, count differs | Nine current tracked occurrences show `VITE_SHIELD_PUBLISHABLE_KEY=sk_test_...`: five quickstart `AGENTS.md` files, BetterAuth README and env example, and three shipped template guides. The exact count in the supplied prose is inconsistent, but the security/documentation defect is real. The Solana example uses the distinct `shld_` form. |
| 4 | Confirmed | [`sync-templates.js`](scripts/sync-templates.js) excludes `.env*`, omits `solana-headless` from `TEMPLATES_TO_SYNC`, and leaves env replacement logic in [`envVars.ts`](packages/create-openfort/src/installers/envVars.ts) with no shipped source file to transform. The npm payload contains the backend `.env.example` but none for the four frontend templates. |
| 5 | Confirmed | The Firebase client reads six `VITE_*` values in [`client.ts`](packages/create-openfort/template/openfort-templates/firebase/src/integrations/firebase/client.ts), while the CLI neither asks for nor writes them and the package lacks the example env file. |
| 6 | Confirmed | [`Recover/index.tsx`](packages/openfort-react/src/components/Pages/Recover/index.tsx) sets `otpStatus` to `send-otp`; no effect consumes that value, and the same value disables the resend button. |
| 7 | Confirmed | [`recovery.ts`](packages/openfort-react/src/shared/utils/recovery.ts) translates `OTP_REQUIRED` into the message `OTP verification required.`; [`otpError.ts`](packages/openfort-react/src/shared/utils/otpError.ts) recognizes only the `OTP_REQUIRED` sentinel in a message/cause. |
| 8 | Confirmed | [`useSignOut.ts`](packages/openfort-react/src/hooks/openfort/auth/useSignOut.ts), [`useEmailAuth.ts`](packages/openfort-react/src/hooks/openfort/auth/useEmailAuth.ts), and [`useCopyToClipboard.ts`](packages/openfort-react/src/hooks/useCopyToClipboard.ts) do not await the operation whose success they report. |
| 9 | Confirmed | [`transfer.ts`](packages/openfort-react/src/solana/transfer.ts) parses `Number#toString` as fixed decimal and therefore fails for exponent notation. Its Kora URL is hard-coded to `https://api.openfort.io` and cannot honor provider `backendUrl`. |
| 10 | Confirmed | [`useConnectWithSiwe.ts`](packages/openfort-react/src/wagmi/useConnectWithSiwe.ts) imports `OpenfortError` from `@openfort/openfort-js`, while SDK actions throw the local error hierarchy, so the second `onError` argument is lost for local errors. |
| 11 | Confirmed | [`styles/index.ts`](packages/openfort-react/src/styles/index.ts) mutates module-level `mode` from styled-component interpolation and reads it later. This is evaluation-order dependent and shared across component instances and SSR requests. |
| 12 | Confirmed, partial cleanup exists | [`useGrantPermissions.ts`](packages/openfort-react/src/hooks/openfort/useGrantPermissions.ts) still requires and documents `sessionKey` without reading it, and its example promises `result.privateKey`. The previously duplicated embedded-client helper has already been extracted to `ethereum/hooks/getEmbeddedWalletClient.ts`, so that sub-claim is stale. |

### Systemic claims

- **Confirmed:** duplicated SIWE orchestration; three recovery variants plus a separate automatic-recovery hook; drifted quickstart/template UI; duplicate Talisman identifiers; two divider implementations; phantom `explorerUrls`; nonexistent Solana example helper; `setDefaultClient` no-op; planned funding namespace hidden behind `unknown`; wrong revoke/grant docs; silent catches; unstable default hook options; inert or contradictory expressions; module-level theme state; and hard-coded E2E waits.
- **Confirmed with qualification:** `UIContext` has no direct `useContext(UIContext)` consumer. `useOpenfortUIContext` is only an alias of the config/routing hook, not a UIContext consumer. The provider memo and context wrapper are therefore dead at present.
- **Confirmed with qualification:** `getConnectRoutes()` is absent from production call sites, but tests mock it. Removing it requires updating the strategy contract and fixtures.
- **Confirmed with qualification:** several Playwright specs are excluded from both live browser projects, but comments say some were replaced by `evm-integration.spec.ts`. They are dead as configured, though the right action may be deletion rather than re-enablement. `refresh-persistence.spec.ts` is excluded everywhere. The unauthenticated project references `wallet-entry.spec.ts`, which is absent.
- **No longer true as written:** store-level `recoveryError` is not write-only. `useAutoRecovery` sets it, production code documents consumption through `useOpenfortCore`, and store tests cover clearing it. Local variables with the same name also have UI consumers.
- **Not accepted without a narrower proof:** `isAwaitingInput` is returned from three public auth hooks and is therefore consumer-facing state. Its underlying state may be unreachable in particular flows, but repo-wide non-consumption does not by itself make a public return field dead.
- **Not exhaustively re-counted:** the claimed 41 unused locale keys / roughly 530 replicated lines need an AST-aware key-usage check before deletion. The claim is plausible, but string search alone is insufficient for dynamic locale access.

## Prioritized TODO

### P0 — prevent data loss and secret exposure

- [ ] **Make every Clack prompt cancellation explicit.** Add `p.isCancel` guards in `helpers/git.ts` and the TTY fallback in `cli/index.ts`; stop gracefully before filesystem mutation. Add tests where confirm returns the cancel symbol and assert an existing `.git` sentinel remains intact.
- [ ] **Ship ignore files under npm-safe names and restore them during scaffold.** Store template ignore files as `gitignore` (and any npm-stripped files similarly), rename after copy, and verify both root and backend `.env` are ignored before `git add .`.
- [ ] **Add a packed-artifact integration test.** Pack `create-openfort`, inspect the tarball, scaffold each template from that artifact, and assert `.gitignore`, frontend env example/config, backend ignore rules, and all declared template files exist. Do not validate only the source tree.
- [ ] **Correct all Shield publishable-key examples.** Replace secret-shaped `sk_test_...` placeholders with the canonical publishable format in all nine current occurrences. Add a repository test that rejects `VITE_SHIELD_PUBLISHABLE_KEY=sk_` in tracked documentation and templates.
- [ ] **Prevent secret staging by construction.** Before Git initialization, verify generated secret-bearing files are ignored with `git check-ignore`; fail closed with a typed/actionable CLI error if they are not.

### P1 — restore broken user flows

- [ ] **Fix recovery resend.** Move resend behavior into a shared recovery/OTP hook or invoke the actual OTP request from the current state transition. Cover success, rejection, cooldown, repeated resend, and unmount timer cleanup.
- [ ] **Preserve the OTP sentinel across encrypted-session endpoints.** Throw/classify `OtpRequiredError` directly or retain `OTP_REQUIRED` as a typed cause that `handleOtpRecoveryError` recognizes. Add endpoint-response tests for OTP required, malformed JSON, non-OTP failure, missing session, and success.
- [ ] **Await sign-out and verification delivery.** Await `logout()` and `requestEmailVerification()` at the hook boundary; ensure hooks still resolve rather than throw, set error state, and call `onError` exactly once on rejection.
- [ ] **Make clipboard status truthful.** Return/await the clipboard promise, set `copied` only after success, expose or handle permission/API failure, and cover unavailable clipboard and rejected writes.
- [ ] **Harden SOL-to-lamports conversion.** Reject non-finite, negative, over-precision, and unsafe values with a typed validation error; support exponent notation without floating-point string assumptions. Test boundary values including `1e-7`, `1e-9`, `1e-10`, zero, and very large amounts.
- [ ] **Honor configured Kora backend URLs.** Thread the provider/client `backendUrl` into the Solana sponsorship path; test default, staging, and custom endpoints.
- [ ] **Use the local `OpenfortError` hierarchy in SIWE.** Align `useConnectWithSiwe` with `useWalletAuth` and test that `onError(message, error)` receives local typed errors.
- [ ] **Remove module-global theme mode.** Derive theme globals entirely from the current component props in one pure interpolation. Add concurrent-instance and SSR render tests with different themes.
- [ ] **Repair the Firebase scaffold contract.** Either prompt/write all six Firebase values or make Firebase setup an explicit post-scaffold step backed by a shipped env example. Add a clean-directory build/smoke test for the chosen contract.

### P2 — eliminate drift and misleading API surface

- [ ] **Make template sync authoritative.** Include `solana-headless`, preserve example env files, define intentional exclusions in one manifest, and add a drift check that compares normalized quickstarts with packaged templates in CI.
- [ ] **Remove or implement `--noInstall`, `flags.template`, and `flags.theme`.** Tests must assert behavior, not only parsing. Audit telemetry delivery so completion/error events flush without unconditional early `process.exit`.
- [ ] **Remove the unused `sessionKey` input from `useGrantPermissions` or use it for the documented behavior.** Because this is public API, choose a compatible deprecation path and add a changeset. Correct the import package and remove the nonexistent `result.privateKey` example immediately.
- [ ] **Consolidate recovery orchestration.** Reuse one tested OTP/passkey/automatic state machine for Ethereum and Solana rather than maintaining page-local copies. Preserve chain-specific adapters, not chain-specific control flow.
- [ ] **Consolidate SIWE orchestration.** Extract message preparation, signing, chain switching, authentication, user refresh, and error normalization shared by `useWalletAuth` and `useConnectWithSiwe`; remove the cast-supported probe if it is truly unreachable.
- [ ] **Resolve `UIContext`.** Delete it and `connectUIValue` if it is intentionally internal and unused, or expose a real consumer with stable memo dependencies. Measure provider rerenders before and after.
- [ ] **Remove `ConnectionStrategy.getConnectRoutes()` if no product path needs it.** Update implementations and test fixtures together; otherwise add the missing production consumer and tests.
- [ ] **Correct phantom/dead documentation.** Address `setDefaultClient`, `createTransactionSigner`, `explorerUrls`, grant/revoke examples, internal/public stability wording, and funding namespace commentary. Runnable examples should type-check in CI.
- [ ] **Audit public/internal exports before deletion.** Update the five export snapshots deliberately and add a changeset for any published entry-point change.

### P3 — error handling, dead code, and test quality

- [ ] **Classify every silent catch.** For each empty catch or `.catch(() => {})`, choose one of: expected fallback with a narrow caught error and explanatory comment; logged/typed failure; or propagated failure. Start with wallet assets, provider account refresh, embedded-wallet synchronization, ENS actions, deposit routing, and CLI Git initialization.
- [ ] **Stabilize auth hook callbacks.** Avoid a fresh `{}` default object becoming a callback dependency; normalize options once or depend on individual fields. Add referential-stability tests across unchanged rerenders.
- [ ] **Delete or justify unreachable expressions and widened-type fallbacks.** Cover exhaustive state transitions with compile-time `never`, remove total-record fallbacks, fix `mobile ? 160 : 160`, remove inert state, and replace self-coalescing theme expressions with the intended fallback.
- [ ] **Inventory locale use with an AST-aware script.** Delete only keys proven unused across static and dynamic access, regenerate all locale types/data, and test fallback behavior. Memoize locale assembly if it remains material.
- [ ] **Reconcile Playwright configuration with files.** Delete superseded specs or give each an owning project; remove the nonexistent `wallet-entry` reference unless adding that suite; ensure `refresh-persistence` runs in at least one CI job if retained. Add a CI assertion that every spec is selected by a project.
- [ ] **Replace fixed E2E sleeps with state-based waits.** Start with `dashboard.page.ts` and `evm-integration.spec.ts`; reserve bounded polling for external-chain settlement only.
- [ ] **Repair weak tests.** Make `regression/phase0.test.ts` exercise production behavior, correct the impossible `encryptionKey` mock shape, reset implementations between tests, narrow console spies, and collapse duplicate factory-skin suites where they do not add contract coverage.
- [ ] **Remove genuinely dead catalog/config entries.** Validate chain support policy, then remove retired testnets, duplicate chain `31337`, duplicate/drifted wallet definitions, redundant dividers, and unused address formatters.

## Recommended execution sequence

1. Land P0 as a focused CLI security patch with packed-artifact tests.
2. Land recovery fixes (resend plus endpoint OTP) with regression tests.
3. Land async truthfulness, SIWE error typing, and Solana conversion/routing fixes.
4. Make template sync deterministic and repair Firebase from a packed tarball.
5. Refactor recovery and SIWE only after regressions pin current intended behavior.
6. Perform mechanical dead-code/docs/error-handling cleanup in small changesets so public export changes remain reviewable.

## Validation baseline and required gates

Checks run during this audit:

- `pnpm check` — passed (615 files).
- `pnpm check:types` — passed.
- `pnpm test:unit` — passed (56 files, 412 tests). Expected error-path tests print stack traces despite passing.
- `pnpm test:cli` — passed (3 files, 19 tests).
- `npm_config_cache=/private/tmp/fortkit-npm-cache npm pack --dry-run --json` in `packages/create-openfort` — succeeded; 145 packed entries, zero frontend `.env.example` files, and zero `.gitignore` files.

Each published-package fix needs a changeset. Before PR handoff, run the full `pnpm verify`; for CLI/template work, additionally scaffold every packed template into a temporary directory and build it from the packed artifact.
