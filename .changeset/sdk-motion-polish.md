---
"@openfort/react": patch
---

Polish modal and button motion. The connect button and the in-modal primary buttons now scale on press; press feedback is unified behind a `--ck-press-scale` token (was an inconsistent mix of `scale(0.9)`/`0.95`/`0.98`, with the main CTA giving none). Easing is stronger (`--ck-ease-out` replaces the default-strength `ease` on the modal resize and page transitions), `transition: all` is replaced with explicit properties across inputs/buttons/copy controls, the connect-button text swap is faster (400ms → 220ms), the modal exit is snappier than its enter, the backdrop gets a subtle blur, and `prefers-reduced-motion` now swaps the modal's scale/slide for opacity-only fades.
