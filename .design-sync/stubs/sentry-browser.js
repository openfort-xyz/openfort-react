// No-op stub for @sentry/browser, swapped in only for the design-sync preview
// bundle via .design-sync/preview-tsconfig.json (cfg.tsconfig). @openfort/openfort-js
// imports @sentry/browser purely for error telemetry; it is never needed to RENDER
// a component, and shipping it pushes the bundle over claude.ai/design's 5 MB cap.
//
// @openfort/openfort-js does `const a = await import('@sentry/browser')` then
//   new a.BrowserClient({ dsn, stackParser: a.defaultStackParser, transport: a.makeFetchTransport })
// and validates `client.getDsn()` against its own hardcoded DSN. We therefore
// expose those exact named exports as no-ops, and return a getDsn() whose parts
// match the SDK's DSN so init() completes silently instead of throwing.
// (Re-sync risk: if the SDK changes its DSN, init throws harmless async noise —
// update DSN below. It never blocks render.)
const DSN = {
  projectId: '4509292415287296',
  host: 'o4504593015242752.ingest.us.sentry.io',
  publicKey: '64a03e4967fb4dad3ecb914918c777b6',
}

export class BrowserClient {
  getDsn() {
    return DSN
  }
  captureException() {}
  captureMessage() {}
  captureEvent() {}
  getOptions() {
    return {}
  }
  flush() {
    return Promise.resolve(true)
  }
  close() {
    return Promise.resolve(true)
  }
}

export const defaultStackParser = () => []
export function makeFetchTransport() {
  return { send: () => Promise.resolve({}), flush: () => Promise.resolve(true) }
}

// Generic no-ops in case other Sentry surface is touched.
export const init = () => {}
export const captureException = () => {}
export const getCurrentScope = () => ({ setTag() {}, setUser() {}, setExtra() {} })

export default {
  BrowserClient,
  defaultStackParser,
  makeFetchTransport,
  init,
  captureException,
  getCurrentScope,
}
