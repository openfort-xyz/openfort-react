import { OpenfortButton } from '@openfort/react'

// The primary entry point: a connect button that opens the Openfort auth/wallet
// modal. Shown here in its disconnected state. The `theme` prop restyles it with
// one of the built-in presets.

export const Default = () => <OpenfortButton />

export const CustomLabel = () => <OpenfortButton label="Sign in" />

export const Rounded = () => <OpenfortButton theme="rounded" label="Connect wallet" />

export const Retro = () => <OpenfortButton theme="retro" label="Connect wallet" />

export const Soft = () => <OpenfortButton theme="soft" label="Connect wallet" />

export const Midnight = () => <OpenfortButton theme="midnight" mode="dark" label="Connect wallet" />
