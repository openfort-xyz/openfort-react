/**
 * `fast-password-entropy` ships plain JavaScript with no bundled types and has no
 * `@types` package, so the single function it exports is declared here.
 */
declare module 'fast-password-entropy' {
  /** Shannon entropy of `password`, in bits. */
  export default function calculateEntropy(password: string): number
}
