---
"@openfort/react": patch
---

Fix modal page text reflowing during page transitions, most visible in Safari. Pages sat in a fit-content wrapper inside the width-animating modal container, so every transition frame re-resolved their width and re-wrapped their text — button labels vanished mid-transition and lines jumped. The page wrapper now keeps each page at its natural width for the whole transition (the animating rounded box clips instead of reflowing), and is promoted to its own compositing layer to stop Safari's font-smoothing shimmer during the opacity cross-fade. Mobile keeps its explicit full-width layout.
