---
"@openfort/react": patch
---

Fixed the one-time-code screen shown while creating or recovering an embedded wallet with automatic recovery. Initial and repeated code requests now start the 10-second resend cooldown immediately, pressing "Resend Code" requests a new code instead of only relabelling the button, and a code that could not be sent reports "Failed to send recovery code" before the input reopens. A failed Solana wallet creation now offers the same Retry affordance as Ethereum instead of leaving the user on a dead-end error screen.
