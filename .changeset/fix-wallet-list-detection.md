---
"@openfort/react": patch
---

External wallet list: add Rabby as a targeted injected connector (extension detection on desktop, WalletConnect on mobile), and hide injected wallets whose provider isn't actually present when WalletConnect isn't configured. MetaMask and Phantom are registered as targeted injected connectors whether or not the extension exists, and without WalletConnect there is no QR/modal fallback — clicking them dead-ended on "Wallet connections unavailable". The list now probes each connector's provider and only shows undetected injected wallets when WalletConnect can take over. Also: the Phantom row now renders its logo (the wallet config was keyed on the EIP-6963 rdns only, never matching the targeted connector id, and had no icon), and the recently-used wallet is hoisted to the top of the list again (the sorted list was computed but never rendered).
