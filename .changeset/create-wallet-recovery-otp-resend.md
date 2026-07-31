---
"@openfort/react": patch
---

Fix the one-time-code screen shown while creating an embedded wallet with automatic recovery. Pressing "Resend Code" now requests a new code instead of only relabelling the button, the button unlocks again 10 seconds after it was pressed so a code that never arrives can be re-requested, and a code that could not be sent reports "Failed to send recovery code" before the input reopens. A failed Solana wallet creation now offers the same Retry affordance as Ethereum instead of leaving the user on a dead-end error screen.
