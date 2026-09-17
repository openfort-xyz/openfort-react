---
'@openfort/react': patch
---

Fixed the modal's export-key page reading the Ethereum wallet on a Solana project, which refused every Solana export with "You cannot export the private key for this wallet." The page now follows the configured chain and reports the underlying reason when an export does fail.
