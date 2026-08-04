---
'@openfort/react': patch
---

Cut the re-renders every Openfort store write used to cause.

`useOpenfortCore` accepts an optional selector: `useOpenfortCore((s) => s.user)` subscribes to that one slice, and a call with no argument still returns the whole store. A selector that builds an object or a tuple needs `useShallow` from `zustand/react/shallow`. Every hook and component inside the SDK now selects the fields it reads, so a wallet-status or account-loading write no longer re-renders consumers that only care about the user.

`setWalletStatus` drops a write that repeats the current value, and each embedded-wallet hook publishes its status only while its own chain is active, so a mounted Ethereum and Solana hook no longer overwrite each other.

`useUI` derives "connected" from the active chain's connection strategy, the same source the modal uses. It no longer mounts both embedded-wallet hooks — each of which holds a wallet provider — to answer that question.

`useLocales`, `useSignMessage`, `useUI` and the core provider were switched to narrow theme, routing, form, signature-request and configuration contexts. Form updates no longer rerender consumers that only read an in-flight signature request.
