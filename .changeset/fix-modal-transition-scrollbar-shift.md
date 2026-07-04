---
"@openfort/react": patch
---

Fix modal content shifting sideways on every page change. During page transitions both pages stay mounted while the modal height animates, transiently overflowing the scrollable page area; wherever scrollbars consume layout width (Windows, macOS with a mouse connected, or host apps that style `::-webkit-scrollbar` globally) the flashing scrollbar shrank the width the centered pages resolve against, nudging all content left and back right on each route change. The page area no longer renders a scrollbar; pages taller than the viewport cap remain wheel/touch-scrollable.
