// Surfaces the internal modal "Pages" (Send, Receive, funding, etc.) on
// window.OpenfortReact for the design-sync bundle. These are NOT part of
// @openfort/react's public API; they normally render inside the connect modal,
// routed by OpenfortProvider. Re-exported here from the built dist so the
// design system can show the screens that live behind OpenfortButton.
// Wired via cfg.extraEntries; each name is also pinned in cfg.componentSrcMap.

// ── Connect / auth ──────────────────────────────────────────────────────────
export { default as ProvidersScreen } from '../packages/openfort-react/build/components/Pages/Providers/index.js'
export { default as EmailLoginScreen } from '../packages/openfort-react/build/components/Pages/EmailLogin/index.js'
export { default as EmailOtpScreen } from '../packages/openfort-react/build/components/Pages/EmailOTP/index.js'
export { default as PhoneOtpScreen } from '../packages/openfort-react/build/components/Pages/PhoneOTP/index.js'
export { default as ForgotPasswordScreen } from '../packages/openfort-react/build/components/Pages/ForgotPassword/index.js'
export { default as OnboardingScreen } from '../packages/openfort-react/build/components/Pages/Onboarding/index.js'

// ── Wallet actions ──────────────────────────────────────────────────────────
export { default as SendScreen } from '../packages/openfort-react/build/components/Pages/Send/index.js'
export { default as ReceiveScreen } from '../packages/openfort-react/build/components/Pages/Receive/index.js'
export { default as SelectTokenScreen } from '../packages/openfort-react/build/components/Pages/SelectToken/index.js'

// ── Funding ─────────────────────────────────────────────────────────────────
export { default as DepositScreen } from '../packages/openfort-react/build/components/Pages/Deposit/index.js'
export { default as BuyScreen } from '../packages/openfort-react/build/components/Pages/Buy/index.js'
export { default as BuySelectProviderScreen } from '../packages/openfort-react/build/components/Pages/BuySelectProvider/index.js'
export { default as DepositCexScreen } from '../packages/openfort-react/build/components/Pages/DepositCex/index.js'
export { default as DepositCryptoScreen } from '../packages/openfort-react/build/components/Pages/DepositCrypto/index.js'
export { default as DepositWalletScreen } from '../packages/openfort-react/build/components/Pages/DepositWallet/index.js'

// ── Account / security ──────────────────────────────────────────────────────
export { default as ProfileScreen } from '../packages/openfort-react/build/components/Pages/Profile/index.js'
export { default as AboutScreen } from '../packages/openfort-react/build/components/Pages/About/index.js'
export { default as ExportKeyScreen } from '../packages/openfort-react/build/components/Pages/ExportKey/index.js'
