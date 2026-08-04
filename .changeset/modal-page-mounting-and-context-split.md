---
'@openfort/react': patch
---

Reduced the work performed by an open connect modal.

The modal now mounts only the active page plus, for the length of the exit animation, the outgoing page. The outgoing page is absolutely positioned and fades out while the incoming page sets the modal's height.

The buy, deposit, send, export-key and about screens were moved behind `React.lazy`, with a spinner sized to the standard page width while each screen loads.

`OpenfortProvider` was split into theme, routing, form, signature-request and configuration contexts. `useOpenfort` preserves the combined shape, while the modal shell subscribes only to routing, configuration and signature-request state. Form input changes therefore update the page that owns the field without rerendering the modal shell.

The email, password-reset, email-verification and sign-message page titles were made translatable.

Recovery pages now ignore stale asynchronous completions after navigation, keep failed OTP verification on the recovery screen, always release password-form loading state, and disconnect modal size observers as soon as their page is removed. OTP verification and resend operations were serialized so they cannot supersede one another, resolved failures reopen the input after displaying their message, and password and passkey completions no longer navigate after their page unmounts. Passkey creation reuses its in-flight operation across React Strict Mode effect replay, preventing duplicate wallet creation prompts. Invalid or empty recovery-method configuration now falls back to an allowed password method.
