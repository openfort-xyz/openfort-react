/**
 * The two version comparisons the release scripts need, without a dependency.
 *
 * Only release versions (`x.y.z`) and the range prefixes this repository's
 * manifests actually use are supported; anything else throws rather than
 * comparing wrong.
 */

/** Lowest version a `^x.y.z`, `~x.y.z`, `>=x.y.z` or exact range accepts. */
export function minimumVersion(range) {
  const match = /^(?:\^|>=|~)?(\d+)\.(\d+)\.(\d+)/.exec(String(range).trim())
  if (!match) throw new Error(`Unsupported version range "${range}" — teach semver-lite about it.`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Ascending comparison of two `[major, minor, patch]` tuples. */
export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}
