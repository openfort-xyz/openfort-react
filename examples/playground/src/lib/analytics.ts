import posthog from 'posthog-js'

export function initializeAnalytics() {
  if (location.hostname.includes('localhost')) return // disable analytics on localhost

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    capture_pageview: false, // Disable automatic pageview capture, as we capture manually
  })

  // Set global properties
  posthog.register({
    posthog_project: 'playground',
  })
}
