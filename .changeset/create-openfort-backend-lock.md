---
'create-openfort': patch
---

Ship the updated backend template lockfile. New projects now resolve axios 1.20.0, proxy-addr 2.0.8 and patched express transitive dependencies instead of axios 1.12.2 and proxy-addr 2.0.7 (GHSA advisories for axios, proxy-addr, body-parser, path-to-regexp, qs, ws, form-data and follow-redirects).
