---
"@openfort/react": minor
---

Add `useSignMessage` and a Sign message modal screen (EVM). `signMessage` and `signTypedData` open a confirmation screen showing the message or EIP-712 typed data, then resolve with the signature once the user confirms (reject on dismiss). Also re-measure the connected screen when balances load so the modal opens at full height instead of briefly clipping the actions.
