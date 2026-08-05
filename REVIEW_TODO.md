# SDK hardening review — remediation TODO

Review target: `improvements/sdk-hardening` at `578181dd` (2026-08-05), reviewed against `main`.
Scope: 146 commits, 787 files, one major-version changeset declaring ~20 breaking changes.

## How to read this

Every item carries a **Verify** step — the command or assertion that decides whether it is done.
Nothing here is fixed. Evidence levels:

| Mark | Meaning |
| --- | --- |
| **E2E** | Proven by a failing test in `examples/playground/tests/specs/offline.review.spec.ts` |
| **VER** | Verified by hand against the source during this review |
| **RPT** | Reported by a reviewer agent with file:line; spot-checked, not independently re-derived |

## Remediation status (2026-08-05)

**Fixed and verified green** (`pnpm check`, `check:types`, 785 unit + 804 type tests, 18 e2e, build):

P0-1, P0-2, P0-3, P0-5, P0-6, P0-8, P0-9 · P1-1..P1-16 (error classification, message hygiene, auth
callbacks) · P1-7, P1-9, P1-10 (data layer) · P2-5, P2-24 · D-1..D-9 (changeset).

Three fixes are mutation-verified — the guard was removed and the test confirmed to fail, then restored:
the sponsored-Solana recipient guard (P0-1), the auth-transition barrier (P0-2) and the timed-out-operation
publication block (P0-3).

**Deliberately not landed:** P0-4 (OAuth nonce). Implemented, then reverted — it is a breaking change to the
credential-storage path that broke 17 tests, and shipping it half-verified risked breaking OAuth for real
users. The design and the decisions it needs are recorded in its task.

Also fixed in a second pass: **P1-13** (Kora instructions validated before signing), **P1-23/P1-24**
(a failed chunk now offers a reload, and *every* page sits behind the error boundary, not only the
code-split ones), **P1-33..P1-36** (`hookOptions` moved into refs across five hooks, so an inline options
object no longer gives every action a new identity each render), **P1-37..P1-42** (Solana recipient guard on
`sendSol`, signature preserved through a confirmation timeout, commitment threaded to every read; funding
deeplinks restricted to https; popup state cleared on teardown), **P1-44/P1-45** (shipped JSDoc example, and
the CLI key validator now treats a 401 from a hardened endpoint as healthy), and **P2-1, P2-4, P2-15..P2-18,
P2-20, P2-23**.

A third pass closed the rest: **P1-17..P1-22** (`ethereumRpcUrls` memoised by value so an inline
`walletConfig` stops churning `getProvider`; a rejected recovery OTP now shows an error and clears; the
recovery-failure screen gained a "Try again") and **P1-26..P1-32** (7702 accepts `address` as well as
`contractAddress` and refuses `chainId: 0` unless `allowAllChains` is set; an empty `permissions` array and a
timestamp-shaped `expiry` are both rejected; typed-data signing pins the chain to `domain.chainId`; grant and
revoke have re-entry guards). Plus **P2-6, P2-7, P2-19**.

**A second independent fable-5 pass reviewed that batch** and caught one genuine break: the new Kora
instruction guard accepted only the recipient *wallet*, but an SPL `transferChecked` names the destination
*token account* — the wallet appears only when Kora also has to create the ATA. As written it would have
rejected every sponsored SPL send to a recipient who already held the token, which is the common case. The
guard now accepts either spelling, and four tests cover it; removing the fix fails one of them. The reviewer
also correctly noted the timeout comment overclaimed — the signature is now genuinely attached to a typed
`WalletError` instead of being lost in a bare `AbortError` — and flagged four history-narrating comments,
since rewritten to describe the code as it stands.

**A third review round put six adversarial agents over the uncommitted diff itself**, each running the gates
and writing throwaway tests. They found seven real defects in the remediation — all since fixed:

- Every failed Solana send was relabelled "broadcast but not confirmed in time", including preflight failures
  that never broadcast. The timeout wrapper caught everything; it now only relabels a genuine abort.
- The 7702 `chainId: 0` gate was bypassable — viem hashes an *absent* chainId identically to `0`, proven by
  the reviewer, so a payload omitting it signed an every-chain delegation. Now `!chainId`.
- The typed-data chain pin was inert: `domain.chainId` arrives as `number | bigint | string`, and matching
  only `number` skipped every real case. Now normalised.
- The CLI path guard was cosmetic. `validateAppName` only tests the final path segment, so `../../escaped`
  still scaffolded two levels above cwd — the reviewer ran it. Traversal and absolute paths are now rejected
  in the validator, which both the prompt and the positional argument share.
- Sponsored native SOL had no recipient guard while the changeset claimed it did.
- The auth-transition barrier released without re-invalidating, letting work queued after the hold run
  against a live credential change.
- The page error fallback rendered outside `PageActivityProvider`, so a throw during a page exit could
  overwrite the incoming page's back handler.

Two residuals were assessed and knowingly accepted rather than fixed: `useBalance` now reports `success` with
a stale figure when a query fails permanently but has cached data (still better than blanking a known balance
and disabling the send screen's amount check — adding `isStale` to the success arm would close it), and
`resolveRpcUrl` can throw `ChainNotConfiguredError` for a chain absent from the wagmi config, which predates
this work.

**Discovered while fixing, not previously known:** the package does not tree-shake. Importing a single leaf
export (`formatAddress`) pulls **240.92 kB**. A `.size-limit.json` entry now pins that as a ratchet at 245 kB
so it cannot get worse silently, but the underlying barrel-file problem is unfixed and deserves its own work.

**P1-43 needs a product decision, not a code change.** The CEX deposit input is labelled in dollars but its
value is sent as the asset amount. Which side is wrong depends on the funding API contract — relabelling the
input and changing the units are both one-line changes with opposite meanings, so it should not be guessed.

Two corrections found while fixing, both reverted:

- Bumping the publication generation on session invalidation (a signer-queue suggestion) also silences the
  caller's own `onError`, because the publication token gates error reporting as well as state writes.
  Keeping a stale success out of a later session belongs in the state layer, not the queue.
- Matching `token` as a key *substring* redacts `tokenMint`, `tokenAddress`, `tokenProgram` and `tokenId` —
  public identifiers this SDK logs constantly. Changed to a suffix match, then checked both ways: 21
  credential names redacted, 0 of 14 public identifiers over-redacted.

**Reviewed by an independent fable-5 pass**, which ran the gates itself and found no broken fix. It caught
four real problems, all since fixed: three "Known issues" entries in the changeset described bugs this same
batch had fixed (a release-notes lie), the `confirmed` API addition had no changeset line, `buildCallbackUrl`
carried a `nonce` parameter no caller used (dead code from the reverted P0-4), and `ForgotPassword` kept its
own three-parameter strip list instead of the shared one — the exact drift the shared list exists to prevent.
It also flagged two stale comments, now corrected.

Known limitation it identified and I accepted: `redactSensitiveText` rewrites URLs inside a stack trace, so
browser stack frames lose file and line while keeping function names. Node stacks are unaffected.

## Verification pass (2026-08-05)

Every finding was re-checked by a second, independent set of agents whose brief was to **refute**, not confirm.
Coverage: P0-1..P0-9, P1-1..P1-45, D-1..D-13. **P2-1..P2-26 and the "Confirmed sound" list are NOT yet
re-verified** — treat those as single-pass.

Result: **47 confirmed, 10 partly true, 0 refuted.** No finding was fabricated, but ten overstated scope,
severity or mechanism. Those ten are marked ⚠ inline and corrected in place. Two are severity changes:

- **P0-1** — the missing guard and its reachability are confirmed, but the *token-burn consequence* depends on
  Kora's server-side ATA handling and could not be executed. The defect stands; the stated harm is unproven.
- **P0-7** — **downgraded out of P0.** The exploit needs a compromised `backendUrl`, which defaults to
  Openfort's own first-party paymaster. Real as defence-in-depth (blind signing), not a standalone attacker path.

Corrections worth reading even if you skip the rest: **P0-5** (what actually survives), **P1-2** (the obvious
fix does not work), **P1-25** and **P1-35** (mechanism was wrong), **D-10** (corrects a claim the changeset
never makes).

Baseline at time of review: `pnpm check`, `pnpm check:types`, `pnpm test:unit` (781), `pnpm test:types` (800),
`pnpm test:build`, `pnpm test:env`, `pnpm size` all pass. The defects below are invisible to that baseline —
which is the main lesson of this review, not an argument that the baseline is wrong.

Run the review suite with:

```
pnpm --filter playground test:smoke      # 7 pass, 11 fail — each failure is an item below
```

---

## P0 — Blockers (fund loss, credential exposure, permanent breakage)

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P0-1** ⚠ **VER** | `solana/transfer.ts:539` → `sendViaKora`; routed from `Pages/SendConfirmation/SolanaSendConfirmation.tsx:116` | `assertTransferableRecipient` is called only from `sendSplToken` (`:261`). `sendSplTokenGasless` forwards the recipient to Kora unchecked, and `sponsorFees` routes every SPL send there. **Verified:** missing guard and reachability both confirmed. **Corrected:** the "tokens burned / unrecoverable" consequence is *asserted, not proven* — it depends on Kora deriving an ATA for a token-account owner rather than rejecting, which needs live Kora to settle. Fix the guard regardless; do not cite the burn as established. | Unit test: call `sendSplTokenGasless` with a recipient whose account owner is a token program; assert it rejects before any network call. Then delete `transfer.ts:261` and confirm a test fails (today none does). Separately, settle Kora's behaviour against a live endpoint. |
| **P0-2** **RPT** | `shared/utils/embeddedSignerOperationQueue.ts:92-110,137` | The auth-transition barrier is unbounded: `withOperationTimeout` is armed *inside* the `.then`, so if the held promise never settles the timer is never set. An unanswered wallet prompt during `startAuthTransition` wedges every later signer operation for the session — no rejection, no error. | Fake-timer test: `holdEmbeddedSignerOperationsDuringAuthTransition(client, new Promise(() => {}))`, then `runEmbeddedSignerOperation`; advance 10 min; assert it settles. |
| **P0-3** **RPT** | `shared/utils/embeddedSignerOperationQueue.ts:13-47` | `OPERATION_TIMEOUT_MS = 120_000` releases the queue slot without cancelling the underlying work. Two operations then talk to the signer at once, and the abandoned one can still publish state (generation is unchanged on timeout). Also below the real `eth_sendTransaction` worst case (~240s), and it bounds WebAuthn ceremonies. | Fake-timer test: time out op A, then resolve A's underlying promise; assert no state setter fires and no second op starts before A is cancelled. Separately, document/raise the bound for send paths. |
| **P0-4** **RPT** | `hooks/openfort/auth/useAuthCallback.ts:235-260`, `components/ConnectModal/ConnectWithOAuth.tsx:95-127` | Login CSRF / account fixation. URL-supplied `user_id` + `access_token` go straight to `client.auth.storeCredentials` with no `state`/PKCE nonce anywhere client-side. An attacker completes OAuth in their own browser and mails the callback URL to the victim. | Add a nonce generated with `crypto.getRandomValues`, stored before redirect and verified on return. E2E: navigate to `?openfortAuthProviderUI=google&user_id=usr_foreign&access_token=forged`; assert `storeCredentials` is never reached and no authed UI renders. |
| **P0-5** ⚠ **E2E** | `utils/logger.ts:118-128` | V8 makes `stack` an own *accessor* and the serializer replaces accessors with the literal `'[ACCESSOR]'`. **Corrected after measuring the built module:** `stack` is genuinely destroyed and irrecoverable; `message` *survives as a property* (`o.message === 'boom'`) — the original "destroys message and stack" was imprecise. The practical harm stands: Node and browser consoles render an Error via its `stack`, so a developer sees `[ACCESSOR]` and never sees the message, and `JSON.stringify` yields `{}`, so serializing error reporters get nothing. 57 `logger.error` sites (not ~60), and `warn`/`error` always emit. | `pnpm --filter playground test:smoke` — the logger Error test must pass. Assert on rendered/serialized output, not just `.message`. Special-case `Error` before the generic object walk. |
| **P0-6** **E2E** | `utils/logger.ts:8-34` | Redaction is exact key-name match against 22 names, and the value-shape regex fires only on serialized `key: value` text, never on object values. Independently reproduced: `share`, `sessionToken`, `authToken`, `jwt`, `bearer`, `code_verifier`, `mnemonic`, `seedPhrase` and object-key `X-API-Key` all print raw. Violates AGENTS.md. *Minor caveat:* that Shield returns the recovery share under the key `share` specifically is unconfirmed — the redaction hole itself is proven either way. | `test:smoke` — the two logger redaction tests must pass. Prefer value-shape detection (JWT, 0x-hex-64, base58) plus a substring key match over an exact-match set. |
| **P0-7** ⚠ **DOWNGRADED → P1** | `solana/transfer.ts:384-409` | Code claim confirmed: Kora's returned instructions are appended verbatim and signed with no check of destination, amount or mint; Kora is fee payer via a noop signer, so the user's signature is the transaction's only authority — blind signing. **Corrected:** the threat model was inflated. The exploit requires a spoofed or compromised `backendUrl`, which defaults to Openfort's own first-party paymaster — outside this SDK's normal trust boundary. Worth fixing as defence-in-depth, not as a standalone attacker-controlled path. | Assert the returned instructions match the requested destination/mint/amount before signing; test with a Kora stub that returns a substituted destination. |
| **P0-8** **RPT** | `packages/create-openfort/template/backend/src/app.ts:15` + `template/backend/.env.example:13` | `??` does not fall back on empty string and the template ships `ALLOWED_ORIGINS=`, so `allowedOrigins === []` and no `Access-Control-Allow-Origin` is sent. Every scaffolded project with a backend has automatic recovery dead on arrival. | Scaffold a project, run backend + frontend, confirm the encryption-session POST succeeds. Change `??` to `||` or add a default in `createBackend.ts:48-65`. |
| **P0-9** **RPT** | `packages/create-openfort/template/*/package.json` | `npm install` on a fresh scaffold fails with `ERESOLVE`: templates pin `typescript ~5.8.3`, `@wagmi/core@3.6.4` requires `>=5.9.3`. Hard-fails on npm, which is what the CLI recommends. | `pnpm build:cli && node dist/index.js tmpapp --CI && cd tmpapp && npm install && npm run build` — must exit 0. |

---

## P1 — Major (wrong behaviour a consumer will hit)

### Error classification

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-1** **E2E** | `utils/errorHandling.ts:363-392` | Of the four reasons openfort-js writes before wrapping in `-32603`, only `Insufficient funds` classifies correctly. `Transaction reverted`, `Nonce conflict` and `Gas error` all report **"Network error"**. `errorHandling.test.ts:116` asserts on a pre-normalisation string the provider never emits, which is why the suite is green. | `test:smoke` — the three failing `-32603` tests must pass. Pin the four strings from openfort-js `normalizeRpcError.ts` as a contract test. |
| **P1-2** ⚠ **E2E** | `utils/errorHandling.ts:291-300,353` | `-32000` (geth's generic code) is absent from `AMBIGUOUS_PROVIDER_CODES`, so it short-circuits the text rules. All three strings regress from specific copy on `main` to a generic "Transaction would fail". **Correction to the fix, not the finding:** adding `-32000` to the ambiguous set is *not sufficient* — `TEXT_RULES` has no nonce pattern, so `nonce too low` and `replacement transaction underpriced` would still land on the same generic fallback. New text rules are needed too. | `test:smoke` — the three `-32000` tests must pass. Add `-32000` to the ambiguous set **and** add the missing text rules. |
| **P1-3** **RPT** | `utils/errorHandling.ts:394-403` | `providerErrorCode` returns the first *mapped* code rather than the first *unambiguous* one, and never walks `.data`. Reproduced: `-32603` wrapping `{code:4001}` → "Network error"; `{code:-32603, data:{code:3}}` → "Network error". *Mitigation the report omitted:* if the wrapped `4001` is an `Error` **instance** carrying the canonical "User rejected the request." text, the text rule rescues it. Misclassification therefore needs a non-`Error` cause or non-canonical wording — narrower than stated, still real. | Test both payload shapes; assert cancellation reports as cancellation. |
| **P1-4** **RPT** | `errors/base.ts:44-60,107-117`, `errors/operation.ts:54-57` | Credentials land in `error.message` and so bypass logger redaction entirely: `toError()` JSON-stringifies rejected objects with no key filter, and wrapping a viem `HttpRequestError` embeds the RPC URL including its API key. | Construct each shape; assert no credential substring appears in `error.message`. |
| **P1-5** **RPT** | `errors/base.ts` (composed message) | The version footer lands in `error.message`, so every consumer's Sentry fingerprint changes per SDK release and `error.message === '...'` checks break. `shortMessage` is the intended comparison target but is undocumented as such. | Decide: move the footer out of `message`, or document `shortMessage` as the comparison field in the changeset and JSDoc. |
| **P1-6** **RPT** | `errors/base.ts:62` | `this.cause = options.cause` makes `cause` own-enumerable (native `super(msg,{cause})` is not), so `JSON.stringify(error)` throws on a cyclic chain. `walk()` is correctly cycle-guarded; serialization is not. | Assert `JSON.stringify` survives a cyclic cause chain. |

### Data layer / RPC

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-7** **VER** | `ethereum/hooks/useEthereumWalletAssets.ts:277-306` | `resolveRpcUrl` implements correct 3-tier precedence (walletConfig → wagmi transport → public) but feeds **only** the query key. All five real reads (`:347,:419,:543,:555,:567`) recompute `walletConfig ?? public default`, skipping the transport — each site re-checked individually, none consults the bridge. The comment at `:270-274` describes a fix the code does not implement; the changeset "Fixed" line is false. *Scope nuance:* primary reads go through the Openfort proxy, so the wagmi transport only ever mattered for the fallback/testnet reads — which are exactly the ones that skip it. | Configure a wagmi transport with no `walletConfig.ethereum.rpcUrls`; assert balance requests hit that endpoint. No test currently references `rpcUrl`/`bridge`/`transport` in this file. |
| **P1-8** **RPT** | `utils/rpc.ts:89-102`, consumed at `hooks/useBalance.ts:64-69` | An unknown chain id falls back to the **Sepolia** endpoint and `ETH`. **Stronger than originally stated:** `fetchEvmBalance` creates the client with *no chain object at all*, so there is nothing for viem to validate against — a live `getBalance` against a Sepolia endpoint with a chainless client was executed and succeeded. Only a `logger.warn`. Compounds with P1-7. | Configure a chain absent from `KNOWN_CHAINS` with a working transport; assert balances are correct, not zero-from-Sepolia. Prefer failing closed. |
| **P1-9** **RPT** | `query/queryKeys.ts:143`, used at `Pages/SendConfirmation/EstimatedFees.tsx:71-79` | A raw `bigint` in the `gasEstimate` key makes the **host app's** cache unserializable — and the SDK deliberately reuses the host's `QueryClient`. Reproduced: `JSON.stringify(key)` throws `TypeError ... BigInt`. The SDK's own `hashQueryKey` stringifies bigints, so internal caching is fine; the break is host persistence. *Manifestation nuance:* typically a silent app-wide persistence failure (the persister catches and gives up), not a visible crash — which makes it harder to notice, not less severe. | Wrap the playground in `PersistQueryClientProvider`, open the send modal on a native transfer, assert the cache persists. Fix: `value?.toString()`. |
| **P1-10** **RPT** | `hooks/useBalance.ts:127-136` | `error` is checked before `data`, so a failed *background* refetch discards known-good cached data. `SendConfirmation/index.tsx:133-138` then computes `insufficientBalance === false` and `:318` stops blocking — the balance vanishes **and** an over-balance send becomes submittable. | Fund an account, let the query succeed, then fail the RPC 3×; assert the insufficient-balance guard still blocks. |
| **P1-11** ⚠ **RPT** | `ethereum/hooks/useEthereumWalletAssets.ts:565-574` | A bare `catch` falls back to `readEvmAssetsViaRpc`, which itself swallows the native read and multicall, so total failure resolves `[]` cached as success. `useSolanaWalletAssets` *does* propagate — the families genuinely disagree. **Corrected:** "the error branch is unreachable" holds only for the **single-chain** path. On the multiChain path the proxy `fetch`es (`:317-339`) sit outside any try, so a network-level rejection there *does* surface as `error`. | Fail every RPC on the single-chain path; assert the hook reports `error`, not `data: []`. |

### Auth

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-12** **E2E** | `components/Pages/EmailVerification/index.tsx:71`, `useAuthCallback.ts:37` | `MAP[errorCode] ?? fallback` — `??` does not catch inherited properties, so `?error=__proto__` returns `Object.prototype` and React throws *"Objects are not valid as a React child"* into the host tree (no boundary above it). `error=constructor\|toString` yield a blank error body. | `test:smoke` — the `__proto__` test must pass. Use `Object.hasOwn` or a `Map`. |
| **P1-13** **E2E** | `ConnectWithOAuth.tsx:100` | The cleanup list omits `refresh_token` and `player_id`, though `:158` explicitly whitelists both as params that occur. The refresh token persists in the address bar, history and later `Referer`. `useAuthCallback.ts:161-170` does strip them. Violates AGENTS.md. | `test:smoke` — the `refresh_token` test must pass. |
| **P1-14** **RPT** | `useAuthCallback.ts:216-227` | Verification success is inferred from *absence of `error` + presence of `email`*, with no receipt. Verified against better-auth 1.6.20: success is a bare redirect. So `?openfortAuthProvider=email&email=victim@example.com` with no token fires `onSuccess({type:'verifyEmail'})`. | Navigate with no token; assert no success callback and no "Email verified". |
| **P1-15** **RPT** | `hooks/openfort/auth/useEmailAuth.ts:251-258` → `requestEmailVerification.ts:29-31` | Emits `openfortAuthProvider=password` + `openfortEmailVerificationUI=true`; `ConnectModal/index.tsx:110-118` routes that to EMAIL_VERIFICATION, never FORGOT_PASSWORD, so `useAuthCallback.ts:205-214` submits the reset token to `verifyEmail`. **Scope clarified:** the modal's own ForgotPassword page bypasses the hook (calls the client directly with `openfortForgotPasswordUI`) and has a passing test — so the break is the **public `requestResetPassword` hook flow**, not the modal UI. | Complete a password reset end to end *via the hook*, not the modal. |
| **P1-16** **RPT** | `utils/urlSecurity.ts:59-68` | `parseCallbackUrl` rewrites the second `?` anywhere in the string, including inside the fragment, then `useAuthCallback.ts:173` `replaceState`s the mangled URL — breaks any HashRouter host app. | Navigate with `#/dashboard?tab=1` present; assert the fragment survives. |

### Wallet lifecycle / recovery

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-17** ⚠ **RPT** | `shared/hooks/createEmbeddedWalletHook.ts:228-231` | `exposedState` rewrites a locally-connected wallet to `status:'reconnecting'` and strips `provider` whenever store `embeddedState !== READY`. `embeddedState` comes from openfort-js `watchEmbeddedState` (event refresh + 2s poll), so post-`create()` renders downgrade until it catches up; `create`/`import` never publish READY while `setActive` (`:468`) does. `activeWallet.getProvider()` still works, so the two disagree. Not in the changeset. **Corrected:** "neither pre-merge hook consulted `embeddedState`" is literally false — `main`'s hooks used it to gate the sync effect (`main:useEthereumEmbeddedWallet.ts:485`) — but neither derived the *exposed status* from it, so the substance holds. | After `create()` with async `CREATING_ACCOUNT → READY`, assert the next render is `connected` with a defined `provider`. Then document it or make `create`/`import` publish `READY` too. |
| **P1-18** ⚠ **RPT** | `shared/hooks/createEmbeddedWalletHook.ts:239-243` | Mechanism confirmed: `getProvider` is memoised on `[client, ethereumRpcUrls]` derived from `walletConfig`, and is a dep of the sync effect whose cleanup cancels the in-flight sync. `main` memoised on `[client]` alone, so this is a real regression. **Corrected — much narrower than stated:** no shipped template triggers it. openfort-ui/headless/firebase hoist `walletConfig` to module scope (stable identity), and solana-headless's inline literal has no `ethereum.rpcUrls`, so the dep is stably `undefined`. It bites only a consumer passing a fresh `walletConfig` **containing `ethereum.rpcUrls`** on every render. | Render `OpenfortProvider` under a parent re-rendering every 100 ms *with `ethereum.rpcUrls` set inline*; assert the hook reaches `connected` and provider calls stay bounded. |
| **P1-19** **RPT** | `components/Pages/ExportKey/index.tsx:19` | With a Solana active wallet the identity assert fails on `chainType` and the user gets "You cannot export the private key for this wallet". *Attribution clarified:* the hardcoded Ethereum hook is **not new** (`main` had it too); the regression is the **new assert** — `main`'s `exportPrivateKey` was a bare client call with no identity check, so it worked chain-agnostically. Reachable via Profile → Export key and `useUI().openExportKey()`. No test covers the page. | Open export on a Solana-only app; assert the key renders. |
| **P1-20** **RPT** | `components/Pages/Recover/index.tsx:542-549` | A rejected OTP re-classified `OTP_REQUIRED` returns outcome `'otp-required'`, so status goes `loading → idle`, `isError` never fires, and OTPInput's clearing effect never runs — the boxes stay filled and nothing happens. This is the exact bug the changeset claims fixed; fixed on the CreateWallet path, **not** here. | Enter a wrong code on Recover; assert an error is visible and the input clears within 2s. |
| **P1-21** **RPT** | `components/Pages/Recover/index.tsx:335-723` | `RecoverAutomaticWallet` is still a ~390-line second copy of the OTP flow (6-value status enum vs 4, own cooldown, own resend observer). Root cause of P1-20 and will keep diverging from `useAutomaticRecovery.ts`. | Both paths driven by one shared hook; assert the Recover dead-ends below are gone. |
| **P1-22** ⚠ **RPT** | `Recover/index.tsx:442`, `:454-459`, `:708-716` | **Two live dead-ends, not three.** `:442` — EVM with `embeddedState !== EMBEDDED_SIGNER_NOT_CONFIGURED` returns silently while `shouldRecoverWalletRef` stays true → permanent spinner; reachable (e.g. recovering a second wallet while READY). `:708-716` — recovery failed offers back only, **no retry** (the affordance `2952b975` added to create was never added to recover). **Corrected:** the `'needs-recovery'` branch at `:454-459` is **unreachable today** — `automaticEntry` passes `recoveryMethod: AUTOMATIC`, so `resolveSetActiveRecovery.ts:35-45,66-75` always returns `needsRecovery:false`. A defensive gap, not a live dead-end. | The two live branches offer a retry or a route out; assert no reachable state leaves the user with only "back". |

### Modal

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-23** **RPT** | `components/ConnectModal/pageLoading.tsx:36-58` | `React.lazy` caches a chunk rejection and never re-invokes the ctor, so a failed chunk breaks that route for the whole session — the boundary resets on navigation but re-catches the cached rejection. No retry control. Realistic trigger: deploy while a tab is open. | Abort a page chunk, open it, go back, open it again; assert the second attempt recovers. |
| **P1-24** **RPT** | `pageLoading.tsx:61-65` + `ConnectModal/pageRegistry.tsx:72-119` | `withPageLoading` couples "is code-split" to "is error-protected", so only the 19 lazy pages have a boundary. `Providers`, `EmailLogin`, `EmailOTP`, `CreateWallet`, `Recover`, `SignMessage` have nothing above them until `OpenfortProvider` — a render throw there blanks the host app. The changeset claim holds for a *load*, not a *render*. | Force a render throw in `EmailLogin`; assert it is contained in the modal. Fix: wrap the page slot in `Modal.renderPage`. |
| **P1-25** ⚠ **RPT** | `ConnectModal/index.tsx:75` | Unclosable half **confirmed**: with `enforceSupportedChains` on an unsupported chain, `closeable` is false — no CloseButton, Escape no-op, overlay `onClick` undefined. **Mechanism corrected — the stated reversal is wrong:** the effect at `OpenfortProvider.tsx:292-297` has deps `[hasWagmi, isConnected, isChainSupported, enforceSupportedChains, setOpen]`; `route` is *not* a dep, so "Go back" lands on PROVIDERS and is **not** immediately reversed. The trap conclusion still broadly holds (the modal stays unclosable while the chain is unsupported, and a dead SwitchNetworks chunk leaves no working switch path), but do not cite the reversal. | Assert the modal is always dismissable, or that this path always offers a working exit. |

### Signing / permissions

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-26** **RPT** | `hooks/openfort/use7702Authorization.ts:133-135` | Reads only `contractAddress`, but the param type is `OneOf<{address}\|{contractAddress}>`. The canonical viem flow `signAuthorization(await prepareAuthorization(...))` — and `main`'s own documented example — type-checks then throws `MissingParameterError`. | Call with `{address}`; assert it succeeds. |
| **P1-27** **RPT** | `use7702Authorization.ts` | `chainId: 0` (valid on **every** chain, forever) is reachable and unvalidated, and the `nonce` is wholly consumer-supplied with the self-sponsored (+1) vs sponsored distinction unhandled. JSDoc hardcodes `nonce: 1`. | Reject `chainId: 0` unless explicitly opted into; fetch/validate nonce against the account. |
| **P1-28** **RPT** | `hooks/openfort/useGrantPermissions.ts`, openfort-js `registerSession.ts:116-117` | `expiry` is treated as a **duration** (`floor((Date.now() + expiry*1000)/1000)`, passed as `validUntil`) while the re-exported viem type documents a **timestamp** with a millisecond example, visible on hover. `expiry: now+3600` yields `validUntil ≈ 2082`. *Wording fix:* this is computed in the **openfort-js client SDK**, not server-side as originally written. Routing verified: embedded grant → `wallet_grantPermissions` → `evmProvider.ts:453` → `registerSession`. | Grant with a 1h intent; read back `validUntil`; assert ~1h. Fix the type or the units, and document. |
| **P1-29** **RPT** | `useGrantPermissions.ts:85` (JSDoc example) | The SDK's own example uses `permissions: []`, which the backend treats as "skip the whitelist check entirely" — a session key callable on any contract. `main`'s example was scoped; this branch regressed it. | Change the example to a scoped permission; add a warning or refuse an empty list. |
| **P1-30** **RPT** | `components/Pages/SignMessage/index.tsx:120,124-128` | `assertEmbeddedEthereumAccount` is called **without** the chainId argument (grant/revoke do pass `chain.id`), so EIP-712 `domain.chainId: 1` is signed while connected to Base. Separately `primaryType` is declared required but dropped, leaving ethers to infer the root — payloads with any unused type throw "ambiguous primary types". | Sign typed data with a mismatched `domain.chainId`; assert it is rejected. Sign a viem/wagmi-shaped payload carrying an unused type; assert it succeeds. |
| **P1-31** **RPT** | `hooks/openfort/useRevokePermissions.ts` | Grant returns `permissionsContext` (a session id `ses_…`), but revoke sends `permissionContext` as `RevokeSessionRequest.address` — the session key *address*. The branch's new docs say "using its permission context", which is wrong; only a `string`/`Hex` mismatch stops the miscall compiling. | Grant then revoke using the documented round-trip; assert the session is actually revoked. |
| **P1-32** **RPT** | grant / revoke / 7702 | No re-entry guard (cf. `SendConfirmation/index.tsx:317-321`, which has one), so a double-click grants two sessions. | Double-click each; assert one request. |

### Action-hook protocol

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-33** **RPT** | ~16 sites (not 18): `useOAuth.ts:141/184/243`, `useEmailAuth.ts:227/285/338/444/517/571`, `useGuestAuth.ts:141`, `useGrantPermissions.ts:243`, `useRevokePermissions.ts:153`, `usePhoneOtpAuth.ts:173/245`, `useEmailOtpAuth.ts:200`, `useSignOut.ts:74` | `hookOptions` sits in the `useCallback` dep arrays, so "stable action identities" holds only when the consumer passes **nothing**. `useSignMessage.ts:75-76` and `use7702Authorization.ts:112-115` already solve this with a ref; these were not converted. | `useGuestAuth({onError})` + `useEffect(..., [signUpGuest])`; assert the effect runs once. |
| **P1-34** **RPT** | `useConnectToWalletPostAuth.ts:231-241` | `tryUseWallet` depends on `embeddedState`, `activeEmbeddedAddress` and `walletConfig`, all of which change mid-login, and it is a dep of the guest/email/phone actions — so those churn identity even with zero options passed. | Same assertion as P1-33 with no options. |
| **P1-35** ⚠ **RPT** | `useGrantPermissions.ts:46-48`, `useRevokePermissions.ts:28-30`, `useGuestAuth.ts:17-21`, `useOAuth.ts:25-34` | Type claim **exact**: these are `{error?} & Partial<Result>` optional-field bags, so `if (result.address) {…}` with no else compiles and silently swallows every failure. `shared/types.ts:54-75` **is** a genuine `error?: never` union that narrows correctly. **Corrected:** "the hook's own JSDoc example is written that way" is **false on this branch** — the grant (`:87`) and guest (`:44`) examples check `result.error` first. That was `main`'s example, and it was already fixed. | Convert to the `shared/types.ts` union shape; assert ignoring `error` is a type error. |
| **P1-36** **RPT** | `shared/types.ts:55-74` vs `useSignMessage.ts:25` vs `use7702Authorization.ts:34` vs grant/revoke | Four incompatible result idioms under "one protocol": `if (result.error)` compiles for two of them, is a type error for `signMessage`/`useFunding` (needs `'error' in result`) and for `signAuthorization` (needs `result.status === 'error'`). | One idiom across all action hooks; update the changeset to describe it. |

### Solana (beyond P0)

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-37** **RPT** | `solana/transfer.ts:112-160` | `sendSol` (and `sendSolGasless`) call no recipient check at all. Scoping confirmed correct: SOL sent into a *closable* token account IS recoverable via `closeAccount` by that account's owner, so "unrecoverable" rightly applies only to mints and non-closable program accounts. The changeset scopes its claim to SPL, so this is a gap rather than a false claim. | Assert a mint/program recipient is rejected. |
| **P1-38** **RPT** | `solana/transfer.ts:149-157,311-320,466-476` + `SolanaSendConfirmation.tsx:159-161` | The 60s abort throws and the UI shows "Transaction failed" while **discarding the signature**. Retry fetches a fresh blockhash, so it is a different transaction — `transferChecked` is not idempotent and the user can send twice. | Stall `getSignatureStatuses`; assert the signature is surfaced so the user can check an explorer instead of blind-retrying. |
| **P1-39** ⚠ **RPT** | `solana/transfer.ts:455` | `confirmSignature` no-ops when `rpcUrl` is undefined and the page guard (`:105`) requires an RPC only when *not* sponsored, so a sponsored send can report success on mere broadcast. **Narrower than stated:** `useSolanaEmbeddedWallet.ts:118-124` falls back to `getDefaultSolanaRpcUrl(cluster)`, so reaching an undefined `rpcUrl` requires an app with no cluster and no SolanaContext at all — reachable, but an edge case. | Sponsored send with no RPC; assert it does not report success unconfirmed. |
| **P1-40** **RPT** | `solana/transfer.ts:195,218,128,276,587` | `walletConfig.solana.commitment` is not threaded to `getAccountInfo` or `getLatestBlockhash`; those default to `finalized`. A not-yet-finalized Token-2022 mint reads null, falls back to the classic program and the send fails. | Assert the configured commitment reaches every RPC call. |

### Funding

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-41** **RPT** | `components/Pages/DepositWallet/index.tsx:150-151,247` | Server-supplied `route.pm.deeplinks[].url` takes precedence over the safe locally-built links and lands in `href` with no scheme check — the one funding link the "restricted to expected HTTPS origins" claim does not cover. Bounded by `target="_blank"` dropping `javascript:`, so realistically an arbitrary-destination phishing link. | Stub `setPaymentMethod` to return `deeplinks:[{url:'javascript:alert(1)'}]`; assert the anchor has no `href`. |
| **P1-42** ⚠ **RPT** | `Pages/BuyProcessing/index.tsx:211-218` | **"On *any* popup close" is overstated** — `:214-216` gates on `popupNavigatedRef` **and** `providerId === 'coinbase'`, so a Stripe close never auto-advances. The whole item is Coinbase-only. The address-flap half is real and verified: the cleanup at `:181-185` closes the popup without clearing `popupWindow`/`popupNavigatedRef`, so a re-run with an undefined `address` lets the monitor see `.closed` and advance to "Provider Finished" mid-purchase. | Navigate the Coinbase popup then close it; assert the route stays on `BUY_PROCESSING`. |
| **P1-43** **RPT** | `Pages/DepositCex/index.tsx:274-275,348` | Sends `amount: String(fiatAmount)` + `asset: destAssetLabel`, which the backend maps to Coinbase's `presetCryptoAmount` — a `$10` input under a `$` sign presets **10 ETH**. Pre-existing on `main`. | Assert the pay-link body carries a fiat amount, or relabel the input. |

### Packaging / docs

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| **P1-44** **RPT** | `openfort/useOpenfort.tsx:16` | The JSDoc example uses `useOpenfortCore`. Precisely: `src/index.ts:150` exports it **only under the alias** (`useOpenfortCore as useOpenfort`), and `3b5c1acd` removed the un-aliased name — so the identifier in the example does not resolve for a consumer. It ships in `build/openfort/useOpenfort.d.ts:10` and is the only example on the public TypeDoc page. | `rg useOpenfortCore` over `src/**/*.tsx` JSDoc and `docs/`; rebuild docs; assert clean. |
| **P1-45** **RPT** | `packages/create-openfort/src/utils/validateOpenfortKeys.ts:78-89` (path corrected — `src/utils/`, not `helpers/`) | The CLI's own validator POSTs to the encryption-session endpoint with content-type only and no `Authorization`, so the hardened template 401s and validation can never succeed. `f781270a` updated the SDK and template but not the validator. `template/backend/README.md` still documents an anonymous POST and its docs link returns a curl-verified 404. *Nuance:* it exits 1 only after the user declines the retry prompt — but since validation can never pass, the path is effectively dead either way. | Run the CLI against a hardened endpoint; assert it validates. |

---

## P2 — Minor / quality

| ID | Where | Defect | Verify |
| --- | --- | --- | --- |
| P2-1 **RPT** | `wagmi/components/ChainSelectList/index.tsx:78-82` | `switchFailed = !!bridgeError && !isUnsupported` also catches EIP-1193 `4001`, so cancelling a wallet prompt paints a red failure alert. 4902 handling is correctly preserved. | Cancel a switch; assert no error alert. |
| P2-2 **RPT** | `wagmi/components/ChainSelectDropdown/index.tsx:110-114` | No viewport clamp or flip; with 4+ chains near the bottom of a short window the list renders below the fold, unscrollable (body scroll is locked). | Assert the dropdown stays in view at 600px height. |
| P2-3 **RPT** | `ConnectModal/pageLoading.tsx:51-54` | Error-page strings are hardcoded English in a fully localized modal (the same commit added `warnings_walletSwitchingFailed` to all 14 locales). RTL locales get LTR English. | Move to locales. |
| P2-4 **RPT** | `hooks/useFocusTrap.tsx:15-25` + `Modal/index.tsx:425-426` | `querySelectorAll` has no inert filter, so during the 240 ms exit window `focusableEls[0]` is in the inert subtree: `.focus()` no-ops while `preventDefault()` still runs, swallowing Tab. (Separately `el.focus()` on a bare div at `:50` never moves focus into the modal — pre-existing.) | Tab within 240 ms of a page change; assert focus moves. |
| P2-5 **RPT** | `utils/logger.ts:8-29` | `SENSITIVE_KEYS` omits `otpCode`/`otp_code`; the recovery request body is `{user_id, otp_code}`, so a thrown error carrying the payload prints the live code that mints the encryption session. One-line fix. | Add the key; assert redaction. |
| P2-6 **RPT** | `ConnectWithInjector/index.tsx:245`, `shared/utils/explorer.ts:87`, `PhoneOTP:46,76`, `EmailOTP:47`, `useEmailAuth.ts:562`, `ForgotPassword:163,170`, `fundingClient.ts:190` | Always-on `warn`/`error` on normal user outcomes (cancelled prompt, mistyped OTP, wrong reset code) and one unlatched warn in a render path. Now that these always emit they land in consumers' error pipelines. | Count `console.error` in the playground for one wrong OTP + one cancelled prompt; assert zero. |
| P2-7 **RPT** | `CreateWallet/index.tsx:275`, `Recover/index.tsx:62` | `recoveryPhrase` is never cleared after submit; it stays in state and the DOM until unmount, indefinitely after a failure. | Assert the field is cleared on submit. |
| P2-8 **RPT** | `CreateWallet/useAutomaticRecovery.ts:290-294`, `Recover/index.tsx:453` | Remount unconditionally re-runs `setCanSendOtp(false)`, so navigating back/forward faster than the 10s cooldown means resend never re-enables. | Navigate away and back; assert resend re-enables. |
| P2-9 **RPT** | `actions/setRecoveryMethod.ts:26-27` | The post-change accounts refetch is inside the same `try`, so a refresh blip reports a *successful* recovery change as `RecoveryError`; the user retries with a now-stale `previousRecovery`, which fails for real. `activateEmbeddedAccount.ts:36-40` makes the same refetch best-effort. | Fail only the refetch; assert success is reported. |
| P2-10 **RPT** | `useGuestAuth.ts:97…`, `useOAuth.ts:105…` | Superseded auth returns `authTransitionSupersededResult()` directly, bypassing `onError` — contradicts `06c28a43`'s "failures always run the callbacks". | Assert `onError` fires on supersession. |
| P2-11 **RPT** | `createEmbeddedWalletHook.ts:296,349,405` | `reserveEmbeddedSignerPublication(client)` is called *before* the `try`; its `WeakMap.set` would reject with a bare `TypeError` outside the catch. Unreachable today (`store.ts:42` types `client` non-nullable) — free insurance to move inside. | Move inside the `try`. |
| P2-12 **RPT** | `createEmbeddedWalletHook.ts:95,182-184,614,624` | `TResult` appears only in the return type and the body ends in `as TResult`, with `resultProps` as `Record<string, unknown>` — nothing checks the assembled object against `EthereumWalletState`/`SolanaWalletState`. No `*.test-d.ts` for either hook. | Add type tests for both hook return shapes. |
| P2-13 **RPT** | `createEmbeddedWalletHook.ts:154-157`, `shared/utils/assertActiveEmbeddedAccount.ts:20` | `captureActiveAccountIdentity` returns null for a not-yet-seeded `activeEmbeddedAddress` and the assert treats null as "no identity", so `exportPrivateKey()` fails with "the active wallet changed" when nothing changed. | Assert export works immediately after connect. |
| P2-14 **RPT** | `createEmbeddedWalletHook.ts:267-268` | Wallet status publishes only while the hook's chain is the routed chain, so a Solana-only app left at the EVM routing default never publishes `creating`/`connecting` and `ConnectButton`'s spinner stays idle. | Assert the spinner runs during Solana wallet creation. |
| P2-15 **RPT** | `packages/create-openfort/src/cli/index.ts:152`, `helpers/createProject.ts:36` | `validateAppName` is wired only to the interactive prompt, skipped when a positional arg exists, so `create-openfort ../../escaped --CI` writes outside cwd. Absolute paths accepted too. Same-user, no privilege boundary. | Assert traversal is rejected. |
| P2-16 **RPT** | `packages/create-openfort/src/helpers/scaffoldProject.ts:92` | Unvalidated `--template` joins into a path; `--template '../../src'` scaffolds the CLI's own source into the project. | Assert the template name is allowlisted. |
| P2-17 **RPT** | `packages/create-openfort/src/index.ts:120` | An unsupported-Node abort still calls `telemetry.send()`, so it POSTs after claiming to exit before touching the network. | Assert no network call on the unsupported-Node path. |
| P2-18 **RPT** | `examples/playground/.gitignore:13` | Uses `*.local` rather than `.env*`, so `.env.production` there is not ignored. | `git check-ignore examples/playground/.env.production`. |
| P2-19 **RPT** | `.size-limit.json` (all 5 entries) | Every budget uses `"import": "*"`, so nothing in CI verifies tree-shaking — `import { formatAddress }` could silently start pulling the modal. | Add a named-import budget for at least one leaf export. |
| P2-20 **RPT** | `Pages/Deposit/useDepositRoute.ts:66` | The `kind === 'cex'` branch is dead (both call sites pass `'crypto'`); Rollup folds it away. Dead source plus a dead `'cex'` arm of `DepositRouteKind`. knip misses it. | Delete; assert the build output is unchanged. |
| P2-21 **RPT** | `src/index.ts` | Root exports without a runnable `@example`, contrary to AGENTS.md: `useEmailOtpAuth`, `usePhoneOtpAuth`, `useOpenfort`, `formatAddress`, `getDefaultSolanaRpcUrl`, `embeddedWalletId`, `OpenfortError`. Pre-existing debt. | `pnpm build:docs` warning-free plus a manual pass. |
| P2-22 **RPT** | `hooks/openfort/fundingClient.ts:222-225` | `clientSecret` rides in a query string on session reads, so it lands in proxy/CDN/APM logs. `setPaymentMethod` and `payLink` already use the body. Pre-existing. | Move to the body. |
| P2-23 **RPT** | `Pages/BuySelectProvider/index.tsx:169-178` | `step2Disabled` ignores provider state and `providerId` defaults to `'coinbase'`, so Continue proceeds with a disabled provider → `assertSupported` throws an untrue, unretryable "Failed to create payment session." | Assert Continue is disabled for an unsupported provider. |
| P2-24 **RPT** | `errors/base.ts:44-49` | An explicit `details` is silently dropped whenever the cause is an `OpenfortError`. | Assert `details` survives. |
| P2-25 **RPT** | `solana/transfer.ts:261` | The rejection message hardcodes the classic program id, so a Token-2022 account is reported as owned by `Tokenkeg…`. | Assert the message names the actual owning program. |
| P2-26 **RPT** | `solana/transfer.ts` (`estimateSolanaTransferFeeLamports`) | Prices only the 5,000-lamport signature and asserts native/SPL are identical, but a first-time SPL send also pays ~2,039,280 lamports of ATA rent — understated ~400×. | Assert the fee row includes ATA rent when the ATA does not exist. |

---

## Changeset / documentation corrections

These are wrong or missing in `.changeset/openfort-react-v2.md` and must change before release.

| ID | Correction |
| --- | --- |
| D-1 | "Solana SPL transfers refuse a recipient that is a token account" — true only on the **unsponsored** path (P0-1). |
| D-2 | "Wallet-asset reads use the RPC endpoint the application configured in wagmi" — false (P1-7). |
| D-3 | "A transaction error now reports its real cause" — true for 1 of 4 openfort-js messages; `-32000` regressed (P1-1, P1-2). |
| D-4 | "Bounded every embedded-signer operation" — false: the bound covers the body, not the queue wait (P0-2). |
| D-5 | "A stale session can no longer publish wallet, user or callback state" — partly false: the publication token survives logout. |
| D-6 ⚠ | "A rejected wallet-recovery OTP can be retried immediately" — **partly**. The *replay* half IS fixed on Recover (`index.tsx:543-548` clears the cached attempt on non-success). What fails is feedback and retriability: an `OTP_REQUIRED`-classified rejection yields `otpStatus: 'idle'`, and both the error copy (`:690`) and OTPInput's `isError` (`:695`) gate on `'error'` — so no message appears and the boxes stay filled. Correct the claim to be about feedback, not replay. |
| D-7 | "`useFundingChains` returns the full TanStack query result" — overstated (a hand-picked 7-field object), and the hook is exported from **no** entry point, so it does not belong in a consumer-facing breaking list. |
| D-8 | "`openfortKeys` factories take a single parameters object" — false for `user(scope?)` and `embeddedAccounts(scope?)` (`queryKeys.ts:170-173`). |
| D-9 | "28 exported error classes" — there are 29. |
| D-10 ⚠ | **Drop this item — it has no target.** The technical residual is real (`assertNavigableRedirect`, `urlSecurity.ts:78-92`, is https-scheme-only with no host allowlist), but the changeset contains **no OAuth-redirect "validated" claim to correct** — it never mentions the redirect check, and `e25f6cc3`'s commit message describes it accurately. Keep the fact; remove the correction. |
| D-11 | Undocumented breaking change: `exposedState` now reports `reconnecting` and strips `provider` on any transient signer state (P1-17). |
| D-12 | Missing escape hatch: `getDefaultConfig({ ssr: false })` works and is tested (`defaultConfig.test.ts:18-20`) — it is the right advice for client-only apps and should lead the `ssr: true` note. |
| D-13 | `AGENTS.md:15` says `./internal` "exists for the playground and the example apps"; its only importers are the two `environments/` tests. Either delete the entry this major or fix the sentence. |

---

## Confirmed sound — do not re-litigate

Attacked during review and held up. **Four were re-attacked in the 2026-08-05 verification pass and are marked ✅✅ (two independent passes); the rest are still single-pass** — see the caveat at the end of this section.

- ✅✅ **Funding origin allowlist** (`utils/fundingProviderUrl.ts:6-31`) — exact `Set.has` on hostname, https-only, empty userinfo/port. Re-attacked with 15 concrete bypass strings: suffix host `pay.coinbase.com.evil.com`, param smuggling, userinfo both ways (`user:pass@`, `pay.coinbase.com@evil.com`), trailing-dot host, non-standard port, http downgrade, `javascript:`, IDN homograph, percent-encoded host, protocol-relative, backslash variants. **12 of 15 rejected; the 3 accepted all normalise to the genuine `pay.coinbase.com` origin** (uppercase host, and a backslash the WHATWG parser folds to `/`). No bypass found.
- ✅✅ **No `postMessage` or `<iframe>` surface anywhere in the SDK** — re-confirmed by search across `src`, including `createElement('iframe')`. The forged-completion bug class is structurally absent.
- ✅✅ **`create-openfort` backend template genuinely verifies the bearer token** — `requireOpenfortUser` (`template/backend/src/app.ts:36-49`) rejects a missing or invalid token, and `createEncryptionSession:56` calls it and returns **before** reading `SHIELD_SECRET_KEY`. There is exactly one route (`app.post('/api/protected-create-encryption-session')`), so nothing bypasses the guard.
- ✅✅ **`.js` extensions** — re-confirmed complete across `src`; zero relative imports missing one.
- **`"use client"`** preserved at line 1 in 185 of 370 built modules.
- **Store selectors** — 137 call sites, none returning a fresh object/array; the one multi-field selector uses `useShallow`.
- **SSR** — `getServerSnapshot` present via zustand v5; no crash.
- **`instanceof` narrowing** — ES2021 target, no downlevelling, `name` is an explicit literal so minification is irrelevant. (Residual: no brand symbol, so two package copies break consumer `catch` branches.)
- **Peer-range lower bounds** — no React/viem/TanStack API newer than the declared floors.
- **`.js` extensions** — complete across `src`.
- **Packaging gates** — `publint --strict`, `attw`, `test:env`, `size` all green; exports map correct.
- **Provider dedup (`3709c681`)** and the **fee-sponsorship rename (`9dc88acb`)** lost no behaviour.
- **Sensitive material in recovery** — no key material persisted, logged, or put in query keys (except P2-5).
- **No bare `Error`** thrown from `src/actions/`; no reachable synchronous throw out of any action hook.

> **Caveat on the unticked entries.** Everything above without ✅✅ has had exactly one pass. These are the
> claims most likely to be wrong, because they assert that something was checked and found fine — and nobody
> has pushed back since. A false "sound" is more costly than a false defect: it tells you to stop looking.
> Treat them as unconfirmed until re-attacked. Tracked as a task alongside the P2 sweep.
