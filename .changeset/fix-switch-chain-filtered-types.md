---
'@openfort/react': patch
---

Fixed the package build against viem 2.57 and later. The internal `useSwitchChainFiltered` hook now declares its return type, so declaration emit no longer needs to name types that viem keeps private. Runtime behaviour is unchanged.
