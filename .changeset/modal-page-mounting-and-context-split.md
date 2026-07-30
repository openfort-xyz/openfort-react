---
'@openfort/react': patch
---

Cut the work the connect modal does while it is open.

The modal built a wrapper component for every route in its page map, so an open modal kept around fifty transition state machines and their effects alive to show one page. It now mounts only the active page plus, for the length of the exit animation, the page it replaced — the outgoing page is absolutely positioned and fades out while the incoming page sets the modal's height.

The buy, deposit, send, export-key and about screens load through `React.lazy`, so an app that renders the modal no longer downloads flows the session may never open. A spinner sized to the standard page width covers the wait.

`OpenfortProvider` publishes its theme, routing, form and configuration state on separate contexts instead of one. `useOpenfort` returns the same combined shape, composed from all four, so existing call sites are unchanged; the modal shell now subscribes only to routing and configuration, so typing in an email or amount field re-renders just the page that owns the field.

The modal's page titles for the email, password-reset, email-verification and sign-message screens are translatable instead of hardcoded English.
