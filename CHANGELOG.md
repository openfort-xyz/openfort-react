# Changelog

## 1.6.4

### Patch Changes

- [#312](https://github.com/openfort-xyz/openfort-react/pull/312) [`ebc3d3d`](https://github.com/openfort-xyz/openfort-react/commit/ebc3d3dc7ad4ef9cbad997df34241f11852dd959) Thanks [@joalavedra](https://github.com/joalavedra)! - Fix modal content shifting sideways on every page change. During page transitions both pages stay mounted while the modal height animates, transiently overflowing the scrollable page area; wherever scrollbars consume layout width (Windows, macOS with a mouse connected, or host apps that style `::-webkit-scrollbar` globally) the flashing scrollbar shrank the width the centered pages resolve against, nudging all content left and back right on each route change. The page area no longer renders a scrollbar; pages taller than the viewport cap remain wheel/touch-scrollable.

- [#323](https://github.com/openfort-xyz/openfort-react/pull/323) [`284a0b0`](https://github.com/openfort-xyz/openfort-react/commit/284a0b0aba13976a25f1226f2a18d4d40536334b) Thanks [@condor-agent](https://github.com/condor-agent)! - Fix "Failed to create payment session" when buying with card on Safari. The onramp popup was opened after the session request resolved, by which point the browser's transient user activation had expired — Safari blocks `window.open` after ~0.5s — so a successfully created session was reported as a payment failure. The provider window is now reserved synchronously inside the Continue click and navigated once the session resolves. If the browser still refuses the window, a "Popup blocked" screen offers a click-through instead of a false error.

- [#319](https://github.com/openfort-xyz/openfort-react/pull/319) [`10a7ce8`](https://github.com/openfort-xyz/openfort-react/commit/10a7ce851c3fa4e06b613927a42be85514c1b4c9) Thanks [@joalavedra](https://github.com/joalavedra)! - Fix modal page text reflowing during page transitions, most visible in Safari. Pages sat in a fit-content wrapper inside the width-animating modal container, so every transition frame re-resolved their width and re-wrapped their text — button labels vanished mid-transition and lines jumped. The page wrapper now keeps each page at its natural width for the whole transition (the animating rounded box clips instead of reflowing), and is promoted to its own compositing layer to stop Safari's font-smoothing shimmer during the opacity cross-fade. Mobile keeps its explicit full-width layout.

  Fix a re-render loop that made modal transitions stutter for as long as the modal stayed open. The page-measuring callback ref depended on the `inTransition` state it sets itself, so React re-attached it after every flip; each re-attach re-measured, re-observed, and scheduled another `inTransition(false)` timeout that recreated the callback again — a permanent 360ms re-render cycle of the whole modal tree, plus stacked timeouts that were never cleared (the timeout handle lived in a per-render local). The ref is now identity-stable, the timeout handle lives in a ref, dimension updates bail out when the size is unchanged, and only the active page drives the modal size (previously the exiting page could overwrite the measurement, mis-sizing the modal). Frame-time measurements in WebKit across 16 page transitions: dropped frames went from 25 to 5 and the worst frame from 95ms to 47ms. The card background also stops transitioning `box-shadow`/`border-radius` (both constants) and gets its own compositing layer, so Safari no longer re-rasterizes the shadow blur every frame of the resize.

- [#319](https://github.com/openfort-xyz/openfort-react/pull/319) [`10a7ce8`](https://github.com/openfort-xyz/openfort-react/commit/10a7ce851c3fa4e06b613927a42be85514c1b4c9) Thanks [@joalavedra](https://github.com/joalavedra)! - Fix modal page transitions playing the backwards animation on forward navigation. The transition direction is chosen from a route depth, but the depth table only knew about two routes, so nearly every forward step (wallet list → connecting, Connected → Add funds → Buy, Send) played the pop pair — the incoming page shrank down from 1.1× instead of rising from 0.85×. Depth now derives from the route-history stack: forward pushes play the push animation, back steps play the pop, including pages whose back buttons navigate directly instead of popping history. Also for Safari frame delivery: the modal overlay no longer applies a backdrop blur by default (upstream parity — a full-viewport backdrop-filter forces Safari to re-composite the backdrop on every animation frame; opt in via the `blur` prop or `--ck-overlay-backdrop-filter`), and the animating page container is promoted to a compositor layer with upstream's `ease` timing so the cross-fade keeps rendering while the incoming page mounts.

- [#320](https://github.com/openfort-xyz/openfort-react/pull/320) [`ecd021c`](https://github.com/openfort-xyz/openfort-react/commit/ecd021c57fa03ed0dd7c0fd69eeb4d6ffdd03616) Thanks [@condor-agent](https://github.com/condor-agent)! - Pass `walletConfig.ethereum.rpcUrls` when the embedded Ethereum provider is built during wallet creation. The SDK memoizes the provider on its first caller, and during `create()` that caller is `useEthereumEmbeddedWallet` — `EthereumEmbeddedStrategy.initProvider`, the only path that supplied the endpoints, is gated on `EmbeddedState.READY`, which a wallet still being created hasn't reached. The session was therefore pinned to the SDK's public default endpoints, whose chain fallback is Base mainnet regardless of the configured chain, which showed up as intermittent `could not detect network` failures during wallet creation.

- [#313](https://github.com/openfort-xyz/openfort-react/pull/313) [`c928f67`](https://github.com/openfort-xyz/openfort-react/commit/c928f6704769b3cc3e1ed803b6ecbf2257f0a97a) Thanks [@joalavedra](https://github.com/joalavedra)! - Fall back to viem's public default RPCs for common mainnet chains (Ethereum, Base, Polygon, Optimism, Arbitrum, BNB, Beam) instead of throwing "No RPC URL configured". A one-time warning still nudges production apps toward `walletConfig.ethereum.rpcUrls`. Unknown chains without an explicit RPC keep throwing.

## 1.6.3

### Patch Changes

- [#308](https://github.com/openfort-xyz/openfort-react/pull/308) [`df7f782`](https://github.com/openfort-xyz/openfort-react/commit/df7f782047b3023a1459770bc95c47efc1635128) Thanks [@jamalavedra](https://github.com/jamalavedra)! - Fix `personal_sign` failing with "personal_sign requires the signer to be the from address" when a user has multiple embedded smart accounts. The Sign Message modal now derives the `from` address from the provider's active account (via `eth_accounts`) instead of the hook's cached address, and `useEthereumEmbeddedWallet` reconciles its active wallet to the provider's real signing account so the displayed wallet and the actual signer always agree.

- [#307](https://github.com/openfort-xyz/openfort-react/pull/307) [`31ac00f`](https://github.com/openfort-xyz/openfort-react/commit/31ac00f8a21fecc05aeeed342893c7adf67483ec) Thanks [@joalavedra](https://github.com/joalavedra)! - Polish modal and button motion. The connect button and the in-modal primary buttons now scale on press; press feedback is unified behind a `--ck-press-scale` token (was an inconsistent mix of `scale(0.9)`/`0.95`/`0.98`, with the main CTA giving none). Easing is stronger (`--ck-ease-out` replaces the default-strength `ease` on the modal resize and page transitions), `transition: all` is replaced with explicit properties across inputs/buttons/copy controls, the connect-button text swap is faster (400ms → 220ms), the modal exit is snappier than its enter, the backdrop gets a subtle blur, and `prefers-reduced-motion` now swaps the modal's scale/slide for opacity-only fades.

## 1.6.2

### Patch Changes

- [#304](https://github.com/openfort-xyz/openfort-react/pull/304) [`6bc6394`](https://github.com/openfort-xyz/openfort-react/commit/6bc63948fa7664993c2403b00d58077db7394d0a) Thanks [@joalavedra](https://github.com/joalavedra)! - The asset inventory now shows default tokens at zero balance so it's never empty: the active chain's native token (ETH / POL / SOL / …) plus the documented default ERC-20s for that chain (USDC / USDT / DAI / wrapped native — see the [default assets](https://www.openfort.io/docs/configuration/default-assets) reference), and Solana USDC + USDT (cluster-aware). Held tokens are listed first. Tapping the connected balance opens the inventory directly instead of routing through the intermediate "No assets available" screen.

## 1.6.1

### Patch Changes

- [#301](https://github.com/openfort-xyz/openfort-react/pull/301) [`0512904`](https://github.com/openfort-xyz/openfort-react/commit/051290497a8bfaa1931b532e21dfde521b03b194) Thanks [@joalavedra](https://github.com/joalavedra)! - Wallet UI improvements:

  - Send: redesigned to two fields — recipient and an amount field with an inline token selector showing the asset and chain logos; renamed "Send assets" → "Send money".
  - Receive: renamed "Receive funds" → "Receive money" and removed the redundant description.
  - Token pickers (EVM + Solana) and the Solana asset inventory now show the token logo with a chain badge.
  - Sign message screen: the body scrolls within the modal with the action pinned (mobile), no longer rejects spuriously under React StrictMode, and now works on Solana (signs via the Solana embedded wallet).
  - Export private key: revealing now requires a 5s press-and-hold and shows the full key in a copy field.
  - Transfer-from-wallet: the wallet list collapses to three with a "Show more" toggle.
  - The modal now auto-fits its content on every page via a ResizeObserver, so screens size correctly without manual resize calls.
  - `useUI`: `openSend`/`openReceive` route to the Solana screens when on Solana.
  - Confirm transfer preview (EVM + Solana): Network shows the chain logo + name (not the chain id); the EVM estimated fee reads from the RPC and, when sponsored, shows the would-be fee struck through next to "Sponsored"; "Pay with" shows the wallet address and its current balance; the action buttons sit in two columns.

## 1.6.0

### Minor Changes

- [#298](https://github.com/openfort-xyz/openfort-react/pull/298) [`234cfc8`](https://github.com/openfort-xyz/openfort-react/commit/234cfc83b8580b7d1bee6c09d0c787d774275d6c) Thanks [@joalavedra](https://github.com/joalavedra)! - Standardize the send confirmation screen across EVM and Solana with a shared approval-style preview (Total / To / Network / Estimated fee + a "Pay with" card; sponsored sends show a gasless fee). `useUI().openSend(tx)` now accepts a prepared transaction (`{ to, amount, asset? }`) and jumps straight to that preview, skipping asset/amount/recipient entry; `openSend()` with no arguments still opens the full send flow.

- [#294](https://github.com/openfort-xyz/openfort-react/pull/294) [`ca1e352`](https://github.com/openfort-xyz/openfort-react/commit/ca1e352f937c7b7949965ddda510d4c676cad090) Thanks [@joalavedra](https://github.com/joalavedra)! - Add `useSignMessage` and a Sign message modal screen (EVM). `signMessage` and `signTypedData` open a confirmation screen showing the message or EIP-712 typed data, then resolve with the signature once the user confirms (reject on dismiss). Also re-measure the connected screen when balances load so the modal opens at full height instead of briefly clipping the actions.

### Patch Changes

- [#291](https://github.com/openfort-xyz/openfort-react/pull/291) [`31ba77b`](https://github.com/openfort-xyz/openfort-react/commit/31ba77b236cc9ad702dbc699d139d41147b4065e) Thanks [@joalavedra](https://github.com/joalavedra)! - Solana connected header: render the network indicator with the same pill button and tooltip as the EVM chain selector (single-network state) instead of a bespoke badge, so EVM and Solana headers stay visually consistent. The EVM `SwitchChainButton` is now a shared component. The cluster remains fixed by `walletConfig.solana`, so the Solana indicator stays read-only (no chevron or dropdown).

## 1.5.1

### Patch Changes

- [#295](https://github.com/openfort-xyz/openfort-react/pull/295) [`c062bdd`](https://github.com/openfort-xyz/openfort-react/commit/c062bddde1eac937201e1c65f995a795269ef1a8) Thanks [@isardmart](https://github.com/isardmart)! - Improve Funding UI

## 1.5.0

### Minor Changes

- [#292](https://github.com/openfort-xyz/openfort-react/pull/292) [`d07e006`](https://github.com/openfort-xyz/openfort-react/commit/d07e006c8793b7e9a5b2f7ba82f246797c4471b3) Thanks [@joalavedra](https://github.com/joalavedra)! - useUI: add deep-link navigation helpers (openSend, openReceive, openFunding, openBuy, openExportKey, openSettings) so callers can open a specific wallet screen directly. Each targets a connected-only screen and falls back to the login screen when the user is not connected.

## 1.4.0

### Minor Changes

- [#290](https://github.com/openfort-xyz/openfort-react/pull/290) [`4287ef5`](https://github.com/openfort-xyz/openfort-react/commit/4287ef5fe45693c5293a937f43ee2048015935a9) Thanks [@isardmart](https://github.com/isardmart)! - Add testnet funding support: the deposit flow now uses Relay's testnet rail for
  `pk_test_…` keys (native ETH on Base Sepolia / Sepolia), explains testnet limits,
  disables unsupported rails, detects same-chain arrivals, and shows testnet native
  balances. Also fixes chain/currency logos and the explorer link.

### Patch Changes

- [#288](https://github.com/openfort-xyz/openfort-react/pull/288) [`041a2f4`](https://github.com/openfort-xyz/openfort-react/commit/041a2f4b7b2765e69fb3a05ca9ed7e6d9d5e7da9) Thanks [@isardmart](https://github.com/isardmart)! - ui funding modal improvements + chain filter by live mode

- [#287](https://github.com/openfort-xyz/openfort-react/pull/287) [`1aa20e7`](https://github.com/openfort-xyz/openfort-react/commit/1aa20e75b4a2b8a157f9c367a592920daa3bd71e) Thanks [@joalavedra](https://github.com/joalavedra)! - Fix the empty wallet list in "Transfer from wallet" for EVM sources when the active wallet is Solana-only. In Solana mode there's no wagmi bridge, so the desktop browser-extension send (`DepositWalletDesktop`) renders nothing — no wallet was offered for an EVM source. The hub now falls back to the open-dApp deeplinks (MetaMask, Phantom, …) whenever the wagmi bridge is absent, matching the mobile and same-chain Solana paths.

## 1.3.0

### Minor Changes

- [#285](https://github.com/openfort-xyz/openfort-react/pull/285) [`590185a`](https://github.com/openfort-xyz/openfort-react/commit/590185a44883dcd0a0e7cadbe06183a38fe9a3e7) Thanks [@joalavedra](https://github.com/joalavedra)! - Bring the Solana send flow to parity with EVM:

  - **Config-driven fee sponsorship.** Added `walletConfig.solana.sponsorFees`, the SVM counterpart of `ethereum.ethereumFeeSponsorshipId`. When set, Solana sends are routed gaslessly through the Openfort paymaster and the confirm screen shows a "Sponsored" network-fee row. This replaces the per-transaction gasless toggle, which has been removed.
  - **Token selection.** The Solana send screen now has a token picker (native SOL + SPL tokens such as USDC), matching the EVM ERC-20 send. SPL transfers are supported in both fee modes; the non-sponsored path creates the recipient's associated token account when needed.

### Patch Changes

- [#282](https://github.com/openfort-xyz/openfort-react/pull/282) [`9a0a4ba`](https://github.com/openfort-xyz/openfort-react/commit/9a0a4ba384571173fb70e7420327980a7786c2c4) Thanks [@joalavedra](https://github.com/joalavedra)! - Fix white screen when sending a native token (e.g. ETH) from the wallet balance. The gas-estimate query keyed on the bigint send amount, and `useAsyncData` serialized its key with `JSON.stringify`, which throws on a BigInt and crashed the confirm modal. Query keys are now serialized bigint-safely.

- [#286](https://github.com/openfort-xyz/openfort-react/pull/286) [`09fb729`](https://github.com/openfort-xyz/openfort-react/commit/09fb729f8ac866bebf5ddfacd976ae3e9633fb73) Thanks [@joalavedra](https://github.com/joalavedra)! - Default `uiConfig.fundingBaseUrl` to the SDK's backend URL (`api.openfort.io`). The Deposit hub's crypto rails (`useFunding`, `useFundingChains`) previously required `fundingBaseUrl` to be set or they stayed hidden, while the CEX rail already fell back to the backend — an inconsistency. Both now resolve to `uiConfig.fundingBaseUrl || backendUrl`, so the funding rails work out of the box; set `fundingBaseUrl` only to point at a custom funding service.

- [#286](https://github.com/openfort-xyz/openfort-react/pull/286) [`09fb729`](https://github.com/openfort-xyz/openfort-react/commit/09fb729f8ac866bebf5ddfacd976ae3e9633fb73) Thanks [@joalavedra](https://github.com/joalavedra)! - Deposit hub fixes:

  - Resolve the deposit recipient by the funding target's chain family, not the active chain type. A target/wallet family mismatch (e.g. an EVM session whose funding target is still Solana) previously sent an EVM address as the recipient for a Solana destination, which Relay rejected.
  - Offer the destination chain itself as a source, so same-chain deposits (e.g. Solana → Solana) show as a plain transfer to the wallet address alongside the cross-chain bridge routes.
  - Default the card / Apple Pay buy to USDC on EVM (matching Solana). The picker now lists buyable currencies (USDC, native) instead of the wallet's indexed balances, so a freshly created wallet no longer shows "No supported tokens found".
  - Update Deposit method subtitles: "Bridge fee" (was "No fee") for the wallet/address rails, and a $5 minimum for the exchange rail.

- [#286](https://github.com/openfort-xyz/openfort-react/pull/286) [`09fb729`](https://github.com/openfort-xyz/openfort-react/commit/09fb729f8ac866bebf5ddfacd976ae3e9633fb73) Thanks [@joalavedra](https://github.com/joalavedra)! - Drop the `uiConfig.funding.targetAddress` override. Deposits always settle into the user's active embedded wallet (the address the SDK already resolves and sends to Relay as the recipient), so the override was a no-op on the deposit-address and CEX rails. `useFundingTarget` now returns `{ chain, currency }` and `FundingUIOptions` no longer accepts `targetAddress`.

- [#279](https://github.com/openfort-xyz/openfort-react/pull/279) [`92ce0d2`](https://github.com/openfort-xyz/openfort-react/commit/92ce0d205ee16c40486eb97f3ce495054138d453) Thanks [@joalavedra](https://github.com/joalavedra)! - Show a "Powered by Openfort" footer on the deposit screens (the Add funds hub, deposit progress, deposit success, and the CEX deposit page).

- [#286](https://github.com/openfort-xyz/openfort-react/pull/286) [`09fb729`](https://github.com/openfort-xyz/openfort-react/commit/09fb729f8ac866bebf5ddfacd976ae3e9633fb73) Thanks [@joalavedra](https://github.com/joalavedra)! - Show Phantom in "Transfer from wallet" for Solana sources. Solana sources have no numeric chain id and no desktop EVM-extension send, so they previously rendered no wallets at all. The deposit deeplink is now VM-aware (`buildDepositPageUrl` emits `vm=svm` with the SPL mint and base58 recipient instead of a numeric `chainId`), and Solana sources route through the deeplink (Phantom) on every platform. Pairs with the deposit page's new Solana Pay path.

- [#286](https://github.com/openfort-xyz/openfort-react/pull/286) [`09fb729`](https://github.com/openfort-xyz/openfort-react/commit/09fb729f8ac866bebf5ddfacd976ae3e9633fb73) Thanks [@joalavedra](https://github.com/joalavedra)! - Add an amount input with preset buttons to the Deposit hub's "Transfer from wallet" rail, matching the exchange rail. Pick a source chain and token, enter (or tap a preset for) an amount, then choose the wallet — the amount prefills the wallet deeplink (mobile) and the direct send (desktop). The amount is owned by the page and shared across both paths, replacing the two separate per-path inputs.

- [#286](https://github.com/openfort-xyz/openfort-react/pull/286) [`09fb729`](https://github.com/openfort-xyz/openfort-react/commit/09fb729f8ac866bebf5ddfacd976ae3e9633fb73) Thanks [@joalavedra](https://github.com/joalavedra)! - Reveal the desktop "Transfer from wallet" send feedback. `DepositWalletDesktop` never triggered a modal resize, so the "Confirm in your wallet…" status and the insufficient-balance message ("Not enough X — you have Y") were clipped below the fold — a click on a wallet with too little balance read as "nothing happened". The modal now resizes when that feedback toggles.

- [#283](https://github.com/openfort-xyz/openfort-react/pull/283) [`fd94a93`](https://github.com/openfort-xyz/openfort-react/commit/fd94a93f1192a4d5131506521085acd08ea90fa9) Thanks [@joalavedra](https://github.com/joalavedra)! - Adapt the Add funds → Card (fiat onramp) flow for Solana wallets: buy USDC (default) or SOL, resolve the onramp `destinationNetwork` to `solana`, seed the Solana card-buy with USDC, and link the Solana explorer on completion. EVM card-buy is unchanged.

- [#281](https://github.com/openfort-xyz/openfort-react/pull/281) [`f0fddba`](https://github.com/openfort-xyz/openfort-react/commit/f0fddbab7fa85236dacb0bc62700046c9fb39840) Thanks [@joalavedra](https://github.com/joalavedra)! - Show a Solana network indicator in the Connected modal, mirroring the EVM chain badge. The cluster is fixed by `walletConfig.solana` and the indicator is read-only — switching between Solana and EVM is not offered.

## 1.2.0

### Minor Changes

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`18b883d`](https://github.com/openfort-xyz/openfort-react/commit/18b883d300e0a31b6bed75d33813c41f3e3060dc) Thanks [@joalavedra](https://github.com/joalavedra)! - Source the Deposit chain/token pickers live from Relay instead of a hardcoded list.

  `useFundingChains` fetches `GET /v1/funding/chains` (a passthrough of Relay's `/chains`) so the source chains and tokens always track what the rail actually supports — no more curated `sources.ts` registry. The CEX tab filters to EVM chains; selectors and the QR badge read logos straight from the chain/token data.

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`081b6fd`](https://github.com/openfort-xyz/openfort-react/commit/081b6fdd81418b9077878d3d141e8b7315706c51) Thanks [@joalavedra](https://github.com/joalavedra)! - Make Deposit funding methods configurable, like `authProviders`.

  New `uiConfig.funding.methods` (a `FundingMethod[]`) chooses which methods the Deposit hub shows and in what order — `APPLE_PAY`, `CARD`, `WALLET`, `ADDRESS`, `EXCHANGE`. Omit it for the current default (all available, Apple Pay first on mobile). Device, region, and backend-availability gating still apply. `FundingMethod` is exported from the package root.

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`3807946`](https://github.com/openfort-xyz/openfort-react/commit/38079464054f088f1dce291bc88a37850ae2f4bc) Thanks [@joalavedra](https://github.com/joalavedra)! - Restructure the Deposit hub into three source-led tabs and add a destination-address override.

  - **Transfer from wallet** (new) leads with prefilled wallet deeplinks; the deposit-address / QR path sits behind an off-by-default toggle.
  - **Transfer from address** (renamed from "Transfer crypto") shows the cross-chain deposit address and QR.
  - **Transfer from Exchange** leads with Coinbase / Binance pay links; the deposit-address path is behind the same toggle.
  - `uiConfig.funding.targetAddress` overrides where deposits land (defaults to the active embedded wallet) — e.g. to fund a deployed smart account instead of its owner EOA.

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`8a010bc`](https://github.com/openfort-xyz/openfort-react/commit/8a010bc7476440a9152b839a8c4e347a764a26e0) Thanks [@joalavedra](https://github.com/joalavedra)! - Add one-tap mobile wallet deeplinks to the Deposit hub's "Transfer from wallet" step.

  - Open-dApp universal links (MetaMask, Coinbase, Trust, Rainbow, Rabby, Phantom) open a hosted deposit send page in the wallet's in-app browser with the address, chain, token and amount prefilled.
  - `uiConfig.funding.depositPageUrl` configures the send page; defaults to the Openfort-hosted `https://deposit.openfort.io`. Set it to self-host, or to an empty string to hide the deeplinks.
  - Trust is hidden on iOS (no in-app dApp browser there).
  - Replaces the raw `ethereum:` send-URI fallback, which only resolved for MetaMask.

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`c427d73`](https://github.com/openfort-xyz/openfort-react/commit/c427d7307224b3c41cf3f2fb1cf3dfaf8faea18e) Thanks [@joalavedra](https://github.com/joalavedra)! - Curate Deposit source chains/currencies, and standardize on "currency".

  The Deposit pickers now show a curated subset of the rail's chains/currencies instead of everything. Defaults: a common set of source chains (Arbitrum, Base, BNB, Ethereum, Monad, Optimism, Polygon, Solana) and currencies (`['native', 'USDC', 'USDT']`, where `'native'` matches each chain's native asset). Override via `uiConfig.funding.sourceChains` (CAIP-2 allowlist + order) and `uiConfig.funding.sourceCurrencies` (symbol allowlist; `'native'` sentinel). Selections the rail doesn't route are skipped.

  Vocabulary is now "currency" throughout (`FundingCurrency`, `chain.currencies`, the picker label) to match the rail and the destination shape, replacing "token".

### Patch Changes

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`211c517`](https://github.com/openfort-xyz/openfort-react/commit/211c517815030583f28f9f365c94daa1e5278fe8) Thanks [@joalavedra](https://github.com/joalavedra)! - Polish the Deposit hub and pages: per-method left icons and right brand/currency logo clusters (wallets, Coinbase/Binance, Visa/Mastercard, token logos), logo-aware chain/currency dropdowns, tighter rows with consistent `min · fee · time` subtitles, skeleton loading states, content-fit modal sizing, a "Your deposit address" label with a single-line address and a compact copy button. The Card flow's Back returns to the Add funds hub, "Asset" is relabeled "Currency", and the provider/quote screen now carries the preselected amount/currency forward.

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`8727a63`](https://github.com/openfort-xyz/openfort-react/commit/8727a6328692123ab6f0c8ac9469ee2eee34992f) Thanks [@joalavedra](https://github.com/joalavedra)! - Align the funding client to the canonical `/v2/funding` contract: `/v2` paths, snake_case segments (`payment_methods`, `pay_link`), the chains endpoint at `/v2/funding/chains`, and `clientSecret` sent as a query param on the session GET (matching the API). Fixes the version/casing/transport drift between the SDK and the API.

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`d379f6a`](https://github.com/openfort-xyz/openfort-react/commit/d379f6aade1c26ae27a879df1794da3c3c3046ed) Thanks [@joalavedra](https://github.com/joalavedra)! - Show Phantom in the Deposit "transfer from wallet" mobile deeplinks for EVM chains, not just Solana. Phantom is multichain, and its open-dApp universal link is chain-agnostic, so it is now offered for both EVM and SVM source chains.

- [#272](https://github.com/openfort-xyz/openfort-react/pull/272) [`fbe1629`](https://github.com/openfort-xyz/openfort-react/commit/fbe16293d90cc5c385f3b6f2ee53218549a01b13) Thanks [@joalavedra](https://github.com/joalavedra)! - Restore targeted injected connectors in the default wagmi connectors so browser-extension wallets surface individually.

  `getDefaultConnectors` now adds `injected({ target: 'metaMask' })` and `injected({ target: 'phantom' })` instead of relying on a single generic injected provider. Phantom reappears in the Deposit hub's "Transfer from wallet" extension list (regressed in an earlier merge).

## 1.1.4

### Patch Changes

- [#275](https://github.com/openfort-xyz/openfort-react/pull/275) [`bd90b66`](https://github.com/openfort-xyz/openfort-react/commit/bd90b6660cfdd9c4921af6607573884b3ed5ee1b) Thanks [@isardmart](https://github.com/isardmart)! - fix iframe timeout error on strict origin

## 1.1.3

### Patch Changes

- [#273](https://github.com/openfort-xyz/openfort-react/pull/273) [`eab044c`](https://github.com/openfort-xyz/openfort-react/commit/eab044cec690dd714ab1dde1d1600777a7b60bb7) Thanks [@isardmart](https://github.com/isardmart)! - Prevent SendConfirmation from submitting a duplicate transaction: the confirm button is now disabled and `handleConfirm` is guarded once a transaction is in flight, and a provider error is reliably shown in the error UI.

## 1.1.2

### Patch Changes

- [#265](https://github.com/openfort-xyz/openfort-react/pull/265) [`f593ad5`](https://github.com/openfort-xyz/openfort-react/commit/f593ad5967667e8335753bafa7618cac530e1cbc) Thanks [@joalavedra](https://github.com/joalavedra)! - Update @openfort/openfort-js to 1.3.6

## 1.1.1

### Patch Changes

- [#261](https://github.com/openfort-xyz/openfort-react/pull/261) [`91eaa8b`](https://github.com/openfort-xyz/openfort-react/commit/91eaa8b307fd30cead8fdb13cd11b34c530e8837) Thanks [@joalavedra](https://github.com/joalavedra)! - Fix blank screen in Vite apps. The `OpenfortProvider` lazy imports carried a `@vite-ignore` hint, which made Vite's dependency pre-bundler keep the relative dynamic imports external — so they resolved against `node_modules/.vite/deps` instead of the package and the provider failed to load in dev ("Failed to resolve import ../../solana/SolanaContext.js"). Removing the hint lets Vite (and Rollup/webpack) resolve and code-split the chunks correctly.

## 1.1.0

### Minor Changes

- [#259](https://github.com/openfort-xyz/openfort-react/pull/259) [`cb65c6f`](https://github.com/openfort-xyz/openfort-react/commit/cb65c6f1fcbdff882059472a19b9e4db5fff0b93) Thanks [@isardmart](https://github.com/isardmart)! - feat: upgrade wagmi to v3

  Also fixes `useSwitchChain` for the embedded wallet (connector now implements `switchChain`).

## 1.0.16

### Patch Changes

- [#248](https://github.com/openfort-xyz/openfort-react/pull/248) [`7a0b70c`](https://github.com/openfort-xyz/openfort-react/commit/7a0b70c5986a1f1d1dbb5956b24a4bc45f608c56) Thanks [@n00m4d](https://github.com/n00m4d)! - Import wallet feature

## 1.0.15

### Patch Changes

- [#246](https://github.com/openfort-xyz/openfort-react/pull/246) [`d3508ad`](https://github.com/openfort-xyz/openfort-react/commit/d3508ad0fb71acb9f362269305acf841101f135c) Thanks [@isardmart](https://github.com/isardmart)! - Stops `POST /v2/accounts/switch-chain` 4xx errors logging in console on signup and reload

## 1.0.14

### Patch Changes

- [`919b5b2`](https://github.com/openfort-xyz/openfort-react/commit/919b5b240242e6c6ddde64c781c9b30dd453c49c) Thanks [@isardmart](https://github.com/isardmart)! - Fixes `POST /v2/accounts/switch-chain` 422 errors logged in console on signup and page reload with embedded wallets.

## 1.0.13

### Patch Changes

- [#242](https://github.com/openfort-xyz/openfort-react/pull/242) [`7351b1a`](https://github.com/openfort-xyz/openfort-react/commit/7351b1a8051a77f508321616afbbdc756434a556) Thanks [@isardmart](https://github.com/isardmart)! - Fixes repeated `POST /v2/accounts/switch-chain` 422 errors during initial mount with an external (wagmi) wallet.

## 1.0.12

### Patch Changes

- [#237](https://github.com/openfort-xyz/openfort-react/pull/237) [`54fc075`](https://github.com/openfort-xyz/openfort-react/commit/54fc075b13e13688260d72b1ef750739bb60b202) Thanks [@isardmart](https://github.com/isardmart)! - Fixes provider not re-initializing when fee sponsorship policy changes, causing stale sponsorship state.

## 1.0.11

### Patch Changes

- [#235](https://github.com/openfort-xyz/openfort-react/pull/235) [`cf02ea9`](https://github.com/openfort-xyz/openfort-react/commit/cf02ea95aa80eff8fb6d970000b0b8df6ca68a7a) Thanks [@isardmart](https://github.com/isardmart)! - race condition on openfort button loading state

## 1.0.10

### Patch Changes

- [#232](https://github.com/openfort-xyz/openfort-react/pull/232) [`a691016`](https://github.com/openfort-xyz/openfort-react/commit/a6910161a7b363dec4d156bb44e3ee39a5d0ece2) Thanks [@isardmart](https://github.com/isardmart)! - sync external wallet when no embedded in openfort button

## 1.0.9

### Patch Changes

- [#229](https://github.com/openfort-xyz/openfort-react/pull/229) [`a526020`](https://github.com/openfort-xyz/openfort-react/commit/a526020d5bf1b0a46a0fbd3bd020489a167dc872) Thanks [@isardmart](https://github.com/isardmart)! - fixed wallet connect bug when no walletconnect env var set

## 1.0.8

### Patch Changes

- [#218](https://github.com/openfort-xyz/openfort-react/pull/218) [`a887d13`](https://github.com/openfort-xyz/openfort-react/commit/a887d13f04f09abbced010765af5b648eb9c8410) Thanks [@isardmart](https://github.com/isardmart)! - Respect connectOnLogin flag in manage wallets flow

- [#223](https://github.com/openfort-xyz/openfort-react/pull/223) [`b14401c`](https://github.com/openfort-xyz/openfort-react/commit/b14401c0318206701203dd6e70b9697c2c25631f) Thanks [@isardmart](https://github.com/isardmart)! - fixed bug on chainselector import depending on wagmi

## 1.0.7

### Patch Changes

- [#217](https://github.com/openfort-xyz/openfort-react/pull/217) [`707b47b`](https://github.com/openfort-xyz/openfort-react/commit/707b47b80ec80f296c2d6fc38d3e6d8243cf0ff2) Thanks [@isardmart](https://github.com/isardmart)! - wallet recover page improved, better autoconnect choosing

- [#209](https://github.com/openfort-xyz/openfort-react/pull/209) [`4976218`](https://github.com/openfort-xyz/openfort-react/commit/4976218660cb9e6a19f7572bb5efe81dbd166c48) Thanks [@isardmart](https://github.com/isardmart)! - fixed external connector error on already connected account and delete account + oauth callback url improved

## 1.0.6

### Patch Changes

- [#208](https://github.com/openfort-xyz/openfort-react/pull/208) [`1033670`](https://github.com/openfort-xyz/openfort-react/commit/10336701d4d68f003b75e273b9791f728c137a48) Thanks [@isardmart](https://github.com/isardmart)! - solved error on processing buy tokens, added check on chainId and address

## 1.0.5

### Patch Changes

- [#212](https://github.com/openfort-xyz/openfort-react/pull/212) [`331f3b6`](https://github.com/openfort-xyz/openfort-react/commit/331f3b6c60f20c8c1c997a00bfeb83c3d467eedc) Thanks [@isardmart](https://github.com/isardmart)! - Social Login race condition, create evm wallet button when session but no wallet

## 1.0.4

### Patch Changes

- [#210](https://github.com/openfort-xyz/openfort-react/pull/210) [`84a3961`](https://github.com/openfort-xyz/openfort-react/commit/84a3961d9e465ff5da1a4dfa8ce4e42c1448500b) Thanks [@isardmart](https://github.com/isardmart)! - added multichainassets in useEthereumWalletAssets

## 1.0.3

### Patch Changes

- [#206](https://github.com/openfort-xyz/openfort-react/pull/206) [`d29c3d8`](https://github.com/openfort-xyz/openfort-react/commit/d29c3d8c6c7876a58428894fa2ea9590af9bddae) Thanks [@isardmart](https://github.com/isardmart)! - create solana wallet opf button fixed, isloading in useUser

## 1.0.2

### Patch Changes

- [#201](https://github.com/openfort-xyz/openfort-react/pull/201) [`2c23537`](https://github.com/openfort-xyz/openfort-react/commit/2c235373b7879584c26e70951d3839b3157bd4b0) Thanks [@isardmart](https://github.com/isardmart)! - added google as default auth provider, EOA as default accountType

- [#204](https://github.com/openfort-xyz/openfort-react/pull/204) [`68c497a`](https://github.com/openfort-xyz/openfort-react/commit/68c497a0df2848dcba91e3ca23c12fd309fae418) Thanks [@isardmart](https://github.com/isardmart)! - openfortbutton, re create wallet bug on login solved

- [#205](https://github.com/openfort-xyz/openfort-react/pull/205) [`a002d56`](https://github.com/openfort-xyz/openfort-react/commit/a002d56f18dfc1a670892ea153f632dcacbcc6e1) Thanks [@isardmart](https://github.com/isardmart)! - wagmi been imported without dynamic guard, fixed

## 1.0.1

### Patch Changes

- [#198](https://github.com/openfort-xyz/openfort-react/pull/198) [`33aea2a`](https://github.com/openfort-xyz/openfort-react/commit/33aea2ace4de11ed182e9e5994827048e7a9c1ba) Thanks [@isardmart](https://github.com/isardmart)! - solana kit treeshakeable bug

## 1.0.0

### Major Changes

- [#172](https://github.com/openfort-xyz/openfort-react/pull/172) [`62359d1`](https://github.com/openfort-xyz/openfort-react/commit/62359d14d16ab3923eecc43595d52517ba63d83b) Thanks [@isardmart](https://github.com/isardmart)! - added svm, tree shakeable, wagmi subpath

## 0.3.3

### Patch Changes

- [#193](https://github.com/openfort-xyz/openfort-react/pull/193) [`becf0c9`](https://github.com/openfort-xyz/openfort-react/commit/becf0c9bdc12f691a9bef7c6fc0991e8db39f228) Thanks [@isardmart](https://github.com/isardmart)! - added tests for account types, improved wallet-auth code

## 0.3.2

### Patch Changes

- [#191](https://github.com/openfort-xyz/openfort-react/pull/191) [`44f2f1f`](https://github.com/openfort-xyz/openfort-react/commit/44f2f1f8e39f4e806a9c8357b381bd0f0dc767ad) Thanks [@isardmart](https://github.com/isardmart)! - updated fallback when no chainId on wallet, fallback to eoa check, added export key in headless example

## 0.3.1

### Patch Changes

- [#186](https://github.com/openfort-xyz/openfort-react/pull/186) [`fdb39df`](https://github.com/openfort-xyz/openfort-react/commit/fdb39dffbfc52fd015ddb17a43cff321461047d1) Thanks [@isardmart](https://github.com/isardmart)! - added retries on connector of useWallets, fixed error on headless social login

## 0.3.0

### Minor Changes

- [#180](https://github.com/openfort-xyz/openfort-react/pull/180) [`f031ee7`](https://github.com/openfort-xyz/openfort-react/commit/f031ee7c9c443f88991ec28f5aab74549136775f) Thanks [@n00m4d](https://github.com/n00m4d)! - Update openfort js sdk version

### Patch Changes

- [#184](https://github.com/openfort-xyz/openfort-react/pull/184) [`f47222c`](https://github.com/openfort-xyz/openfort-react/commit/f47222cc0632d7871d3f7c3c73214ca0433844b5) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update oauth redirect

## 0.2.9

### Patch Changes

- [#176](https://github.com/openfort-xyz/openfort-react/pull/176) [`cc25528`](https://github.com/openfort-xyz/openfort-react/commit/cc25528fcf496892560ab3f8db788f76536ac4d6) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update openfort-js

## 0.2.8

### Patch Changes

- [#174](https://github.com/openfort-xyz/openfort-react/pull/174) [`13b3fe9`](https://github.com/openfort-xyz/openfort-react/commit/13b3fe928d9145f713e3463fba30de304d961711) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update SDK version

## 0.2.7

### Patch Changes

- [#169](https://github.com/openfort-xyz/openfort-react/pull/169) [`936887a`](https://github.com/openfort-xyz/openfort-react/commit/936887a316f76d3dfe9c96149e75079051b74f51) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update sdk openfort-js

## 0.2.6

### Patch Changes

- [#167](https://github.com/openfort-xyz/openfort-react/pull/167) [`46007e2`](https://github.com/openfort-xyz/openfort-react/commit/46007e273ca98891482e6a46586fcbcc7f3aa084) Thanks [@martimayoral](https://github.com/martimayoral)! - get assets always uses openfort rpc

- [#163](https://github.com/openfort-xyz/openfort-react/pull/163) [`988611a`](https://github.com/openfort-xyz/openfort-react/commit/988611a4d04b18ddcf9f8b2f5a4722262c12f95c) Thanks [@martimayoral](https://github.com/martimayoral)! - add shield otp

- [#168](https://github.com/openfort-xyz/openfort-react/pull/168) [`e4439ba`](https://github.com/openfort-xyz/openfort-react/commit/e4439bab5a89fe22effae29af2e2963921cc5c54) Thanks [@martimayoral](https://github.com/martimayoral)! - feat/add custom page views

- [#166](https://github.com/openfort-xyz/openfort-react/pull/166) [`747f5a8`](https://github.com/openfort-xyz/openfort-react/commit/747f5a8dc5bb57b8b8090e0667d62bcb1099eb77) Thanks [@martimayoral](https://github.com/martimayoral)! - fix error text overflow

## 0.2.5

### Patch Changes

- [#161](https://github.com/openfort-xyz/openfort-react/pull/161) [`4321094`](https://github.com/openfort-xyz/openfort-react/commit/432109415bd326a4713dbbf56fce9979b66886e3) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update version js'

## 0.2.4

### Patch Changes

- [#158](https://github.com/openfort-xyz/openfort-react/pull/158) [`3e2d1fc`](https://github.com/openfort-xyz/openfort-react/commit/3e2d1fc98d9c0973397547e9b0042cf3bb8c035b) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update js sdk

## 0.2.3

### Patch Changes

- [#156](https://github.com/openfort-xyz/openfort-react/pull/156) [`ca84326`](https://github.com/openfort-xyz/openfort-react/commit/ca84326b49c07f8b3548dbf545784f8f3b2afe03) Thanks [@jamalavedra](https://github.com/jamalavedra)! - export otp methods

## 0.2.2

### Patch Changes

- [#153](https://github.com/openfort-xyz/openfort-react/pull/153) [`52f8e6a`](https://github.com/openfort-xyz/openfort-react/commit/52f8e6a3d80f8d5ffd724628561e4478dc875f51) Thanks [@martimayoral](https://github.com/martimayoral)! - fix ESM builds

## 0.2.1

### Patch Changes

- [#150](https://github.com/openfort-xyz/openfort-react/pull/150) [`e8dc78f`](https://github.com/openfort-xyz/openfort-react/commit/e8dc78f8667dfc470f2a0c6aadba826687b018bf) Thanks [@martimayoral](https://github.com/martimayoral)! - Fix: nextjs build for phone provider users

## 0.2.0

### Minor Changes

- [#131](https://github.com/openfort-xyz/openfort-react/pull/131) [`af3e98d`](https://github.com/openfort-xyz/openfort-react/commit/af3e98db84bb7cd89e0722301322ea45b20d538c) Thanks [@martimayoral](https://github.com/martimayoral)! - Update openfort-js version (v1.0.0). Using AuthV2.

## 0.1.14

### Patch Changes

- [#142](https://github.com/openfort-xyz/openfort-react/pull/142) [`e0a691c`](https://github.com/openfort-xyz/openfort-react/commit/e0a691cf9ae3d0c13c8110414efa3c84964ff829) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update deps

## 0.1.13

### Patch Changes

- [#140](https://github.com/openfort-xyz/openfort-react/pull/140) [`63834fb`](https://github.com/openfort-xyz/openfort-react/commit/63834fb03e1933ea93fae14d748180b27115db3b) Thanks [@jamalavedra](https://github.com/jamalavedra)! - fix localstorage debugger

- [#141](https://github.com/openfort-xyz/openfort-react/pull/141) [`23ac165`](https://github.com/openfort-xyz/openfort-react/commit/23ac165943e9edfc632ac6a0ec423b6205fd6467) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update core-js

- [#134](https://github.com/openfort-xyz/openfort-react/pull/134) [`e4891d0`](https://github.com/openfort-xyz/openfort-react/commit/e4891d0a374afde892f9c86411df1f9ebf346078) Thanks [@Huguet57](https://github.com/Huguet57)! - fix: exclude chainId parameter when creating EOA accounts

## 0.1.12

### Patch Changes

- [#137](https://github.com/openfort-xyz/openfort-react/pull/137) [`1c7e913`](https://github.com/openfort-xyz/openfort-react/commit/1c7e9133d0972aafdb31a3c55af38c0fa199e4a7) Thanks [@martimayoral](https://github.com/martimayoral)! - fix logs issue

## 0.1.11

### Patch Changes

- [#135](https://github.com/openfort-xyz/openfort-react/pull/135) [`53a89c7`](https://github.com/openfort-xyz/openfort-react/commit/53a89c7e408663f1dc8087b15bcd7fabbc30b548) Thanks [@martimayoral](https://github.com/martimayoral)! - improved profile UI

- [#135](https://github.com/openfort-xyz/openfort-react/pull/135) [`53a89c7`](https://github.com/openfort-xyz/openfort-react/commit/53a89c7e408663f1dc8087b15bcd7fabbc30b548) Thanks [@martimayoral](https://github.com/martimayoral)! - fix bug for linking wallet

## 0.1.10

### Patch Changes

- [#132](https://github.com/openfort-xyz/openfort-react/pull/132) [`b0e67fd`](https://github.com/openfort-xyz/openfort-react/commit/b0e67fdc0334b855d447803eb1ba5c9a45c8d011) Thanks [@martimayoral](https://github.com/martimayoral)! - added types for custom themes

## 0.1.9

### Patch Changes

- [#128](https://github.com/openfort-xyz/openfort-react/pull/128) [`5fc88fb`](https://github.com/openfort-xyz/openfort-react/commit/5fc88fb4c724f218000bfac445ead5a27ecb9d03) Thanks [@jamalavedra](https://github.com/jamalavedra)! - chore: release

## 0.1.8

### Patch Changes

- [#124](https://github.com/openfort-xyz/openfort-react/pull/124) [`e745594`](https://github.com/openfort-xyz/openfort-react/commit/e745594d2fe4ca5cbff9451085c5ec31b19e38d6) Thanks [@martimayoral](https://github.com/martimayoral)! - improve create guest on dev mode

- [#123](https://github.com/openfort-xyz/openfort-react/pull/123) [`ef49f5c`](https://github.com/openfort-xyz/openfort-react/commit/ef49f5ced930a9ea4b4ab7b9f41d8d623b780adf) Thanks [@martimayoral](https://github.com/martimayoral)! - update openfort-js version

## 0.1.7

### Patch Changes

- [#104](https://github.com/openfort-xyz/openfort-react/pull/104) [`a24dc93`](https://github.com/openfort-xyz/openfort-react/commit/a24dc93da6207d6a9715d827355d9967ec9ed63f) Thanks [@martimayoral](https://github.com/martimayoral)! - wallet config only needs address

- [#102](https://github.com/openfort-xyz/openfort-react/pull/102) [`0f7d8dd`](https://github.com/openfort-xyz/openfort-react/commit/0f7d8dd59c55dfa97ad791b0716090e7426dbe40) Thanks [@martimayoral](https://github.com/martimayoral)! - improve asset types

## 0.1.6

### Patch Changes

- [#98](https://github.com/openfort-xyz/openfort-react/pull/98) [`09aec4f`](https://github.com/openfort-xyz/openfort-react/commit/09aec4f49608ae630700a66cab8ce021128744e9) Thanks [@martimayoral](https://github.com/martimayoral)! - send recieve buy buttons in profile

## 0.1.5

### Patch Changes

- [#94](https://github.com/openfort-xyz/openfort-react/pull/94) [`1c97b06`](https://github.com/openfort-xyz/openfort-react/commit/1c97b06c258ae77921710d53b1d1ded723ed6de6) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update deps

## 0.1.4

### Patch Changes

- [#85](https://github.com/openfort-xyz/openfort-react/pull/85) [`54b6c90`](https://github.com/openfort-xyz/openfort-react/commit/54b6c90686011265b15b8dd18996bb738d8ded16) Thanks [@martimayoral](https://github.com/martimayoral)! - add useRevokePermissions

- [#83](https://github.com/openfort-xyz/openfort-react/pull/83) [`61e81de`](https://github.com/openfort-xyz/openfort-react/commit/61e81de575f0c8b90c89a0059b3668e1f2f73e76) Thanks [@martimayoral](https://github.com/martimayoral)! - control how many providers are shown in the main page

## 0.1.3

### Patch Changes

- [#81](https://github.com/openfort-xyz/openfort-react/pull/81) [`36b26fd`](https://github.com/openfort-xyz/openfort-react/commit/36b26fd7032727f1814a7a88e21ebb8e04fedbbb) Thanks [@martimayoral](https://github.com/martimayoral)! - fix walletConnect bug when opening app in mobile and nextjs

## 0.1.2

### Patch Changes

- [#75](https://github.com/openfort-xyz/openfort-react/pull/75) [`c2acaac`](https://github.com/openfort-xyz/openfort-react/commit/c2acaac543f58a9426490b2ae10b559e146b4545) Thanks [@martimayoral](https://github.com/martimayoral)! - granular logging

- [#77](https://github.com/openfort-xyz/openfort-react/pull/77) [`2e8f80a`](https://github.com/openfort-xyz/openfort-react/commit/2e8f80acd6f6292cf895cd0ba2a9786d425c1311) Thanks [@martimayoral](https://github.com/martimayoral)! - fix set active wallet when wallet didnt have the same chain

## 0.1.1

### Patch Changes

- [#73](https://github.com/openfort-xyz/openfort-react/pull/73) [`5185652`](https://github.com/openfort-xyz/openfort-react/commit/51856529c8b95e95013a0aa88394c0c195499e09) Thanks [@martimayoral](https://github.com/martimayoral)! - updated logs

## 0.1.0

### Minor Changes

- [#69](https://github.com/openfort-xyz/openfort-react/pull/69) [`89d5ce2`](https://github.com/openfort-xyz/openfort-react/commit/89d5ce2b73a99d8a5ccc6f4770a167bbd466b5ec) Thanks [@martimayoral](https://github.com/martimayoral)! - Refactor internal routes

- [#69](https://github.com/openfort-xyz/openfort-react/pull/69) [`89d5ce2`](https://github.com/openfort-xyz/openfort-react/commit/89d5ce2b73a99d8a5ccc6f4770a167bbd466b5ec) Thanks [@martimayoral](https://github.com/martimayoral)! - update walletOnSignUp option

## 0.0.34

### Patch Changes

- [#61](https://github.com/openfort-xyz/openfort-react/pull/61) [`544a631`](https://github.com/openfort-xyz/openfort-react/commit/544a63199c11c48c151191e981ee838b61f4eece) Thanks [@Huguet57](https://github.com/Huguet57)! - fix chain custom rpc error

- [#61](https://github.com/openfort-xyz/openfort-react/pull/61) [`544a631`](https://github.com/openfort-xyz/openfort-react/commit/544a63199c11c48c151191e981ee838b61f4eece) Thanks [@Huguet57](https://github.com/Huguet57)! - add grant permissions hook

## 0.0.33

### Patch Changes

- [#64](https://github.com/openfort-xyz/openfort-react/pull/64) [`2d6cf3d`](https://github.com/openfort-xyz/openfort-react/commit/2d6cf3d132bda960424990bed1d1fedc87703d99) Thanks [@martimayoral](https://github.com/martimayoral)! - fix create wallet not returning wallet id

- [#57](https://github.com/openfort-xyz/openfort-react/pull/57) [`fc11344`](https://github.com/openfort-xyz/openfort-react/commit/fc11344eef008245b9f32ee2511f93c6aa397853) Thanks [@martimayoral](https://github.com/martimayoral)! - fix resize ui error when multiple wallets

- [#57](https://github.com/openfort-xyz/openfort-react/pull/57) [`e165961`](https://github.com/openfort-xyz/openfort-react/commit/e165961d2ea9d9095b782e8d889d834229ec163d) Thanks [@martimayoral](https://github.com/martimayoral)! - remove initialChainId

- [#57](https://github.com/openfort-xyz/openfort-react/pull/57) [`fc11344`](https://github.com/openfort-xyz/openfort-react/commit/fc11344eef008245b9f32ee2511f93c6aa397853) Thanks [@martimayoral](https://github.com/martimayoral)! - fix initial chain not working in some cases

## 0.0.32

### Patch Changes

- [#55](https://github.com/openfort-xyz/openfort-react/pull/55) [`c0af75c`](https://github.com/openfort-xyz/openfort-react/commit/c0af75c83e3d3c1578048ffd7297d976c224edbb) Thanks [@martimayoral](https://github.com/martimayoral)! - fix email callback

## 0.0.31

### Patch Changes

- [#53](https://github.com/openfort-xyz/openfort-react/pull/53) [`6b6eb0e`](https://github.com/openfort-xyz/openfort-react/commit/6b6eb0ef1fda9b63437bd7d5238e67aa08fae630) Thanks [@martimayoral](https://github.com/martimayoral)! - email validation

- [#53](https://github.com/openfort-xyz/openfort-react/pull/53) [`3069fe6`](https://github.com/openfort-xyz/openfort-react/commit/3069fe615b5bac791346b5d7920b41927d954b7a) Thanks [@martimayoral](https://github.com/martimayoral)! - fix email callback

- [#53](https://github.com/openfort-xyz/openfort-react/pull/53) [`6b6eb0e`](https://github.com/openfort-xyz/openfort-react/commit/6b6eb0ef1fda9b63437bd7d5238e67aa08fae630) Thanks [@martimayoral](https://github.com/martimayoral)! - logger only shows logs when debugMode is on

## 0.0.30

### Patch Changes

- [#50](https://github.com/openfort-xyz/openfort-react/pull/50) [`c477d8b`](https://github.com/openfort-xyz/openfort-react/commit/c477d8b4903aa9a5370646409c8ddbd953d55dc4) Thanks [@martimayoral](https://github.com/martimayoral)! - add contributing and update internal configuration

## [0.0.29] - 2025-10-22

### Feat

- update useWallets to include accounts when returning a wallet

## [0.0.28] - 2025-10-21

### Chore

- change internal configuration

## [0.0.27] - 2025-10-20

### Fix

- Fix wallet connect

## [0.0.26] - 2025-10-17

### Feat

- Fix bug in recover wallet

## [0.0.25] - 2025-10-16

### Feat

- Update Deps

## [0.0.24] - 2025-10-15

### Feat

- SDK events

## [0.0.23] - 2025-10-15

### Fix

- EOA wallet auto recovery

## [0.0.22] - 2025-10-14

### Chore

- Update deps

## [0.0.21] - 2025-10-03

### Feat

- UI: Fix wording in mobile connect modal
- UI: Fix loading text position in loading component

## [0.0.20] - 2025-10-03

### Feat

- UI: When there are more than 4 providers, show remaining + "More" button instead of just "More"

## [0.0.19] - 2025-10-03

### Fix

- Fix get EOA accounts

## [0.0.18] - 2025-10-03

### Fix

- Fix export key

## [0.0.17] - 2025-09-30

### Feat

- Update openfort-js
- Add recoverWalletAutomaticallyAfterAuth to provider
- Fix onsuccess create wallet callback

## [0.0.16] - 2025-09-30

### Fix

- Prevent syntax error in strict regex runtimes

## [0.0.15] - 2025-09-30

### Feat

- Improve mobile dApp experience
- Tooltip color gets text color from variable
- Link email flow improved

## [0.0.14] - 2025-09-29

### Fix

- Fixed email provider if it's not the first one
- Get wallets no longer has limit of 10 wallets

## [0.0.13] - 2025-09-26

### Feat

- Improve email login flow
- Add APPLE Auth provider
- Add type descriptions

## [0.0.12] - 2025-09-25

### Feat

- Add DISCORD auth provider
- Fix logout handling to properly reset modal state and reload customTheme if changes
- Fix connectors on mobile
- Improve error handling

## [0.0.11] - 2025-09-22

### Feat

- Make walletConnectProjectId optional in defaultConfig

## [0.0.10] - 2025-09-15

### Feat

- Openfort wallet return connector

## [0.0.9] - 2025-09-11

### Chore

- Update deps

## [0.0.8] - 2025-09-09

### Improvements

- Add passkeys

## [0.0.7] - 2025-09-08

### Feat

- Add access token on getEncryptionSession

## [0.0.6] - 2025-09-04

### Improvements

- Removed unnecessary shield keys
- Updated password flow
- Policy per chain instead

## [0.0.5] - 2025-08-29

### Improvements

- Update openfort-js
- Third party auth

## [0.0.4] - 2025-08-18

### Improvements

- Internal naming
- Fix active wallet issue

## [0.0.3] - 2025-08-13

### Hooks and update

- Update some auth hooks
- Update openfort-js version

## [0.0.2] - 2025-08-11

### Multi account

- Adding multi account

## [0.0.1] - 2025-08-11

### Hooks

- Add headless hooks
- Configuration and API Updates
- Rename @openfort/openfort-react to @openfort/react

## [0.0.15] - 2025-05-29

### Fix

- save get access token

## [0.0.14] - 2025-05-26

### Feat

- useUser refreshes auth token

## [0.0.13] - 2025-05-26

### Feat

- Update dependencies

## [0.0.12] - 2025-05-14

### Feat

- Update dependencies

## [0.0.11] - 2025-04-24

### Feat

- Update @openfort/openfort-js

## [0.0.10] - 2025-04-22

### Fix

- Fix password input for safari users

## [0.0.9] - 2025-02-31

### Chore

-Update type exports

## [0.0.8] - 2025-02-19

### Update UI

- Updated password ui
- Updated powered by openfort
- Fixed a issue with loading screen

## [0.0.7] - 2025-02-19

### Improvement

- Update package versions
- Show password input option
- Fix circular dependencies

## [0.0.5] - 2025-02-19

### Chore

- Update openfort-js

## [0.0.4] - 2025-02-11

### Separated Hooks

- Separated hooks instead of having a general useOpenfort. This hook is no longer available.
  To learn more about the available hooks go to the [openfort documentation](https://www.openfort.io/docs/guides/react/hooks).

## [0.0.3] - 2025-02-11

### Fix issues

- Added openfort-js as direct dependency, button href issue solved

## [0.0.2] - 2025-02-11

### Exported methods and types

- Exported methods and types have been updated.

## [0.0.1] - 2025-02-11

### Initial release

This release marks the first stable version of the project, featuring built-in authentication, seamless wallet connectivity, and a customizable user interface.
