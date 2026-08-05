/**
 * Drives the React/viem compatibility matrix.
 *
 *   node scripts/matrix-versions.mjs apply    # pin the overrides for one cell
 *   node scripts/matrix-versions.mjs verify   # assert what actually resolved
 *
 * The cell is read from REACT_VERSION, VIEM_VERSION and TANSTACK_VERSION.
 *
 * This lives in a file rather than inline in the workflow because the versions
 * are keyed by quoted names (`'@types/react'`) and the workflow ran it through
 * `node -e "…"`, where the shell strips the inner quotes. That silently turned
 * the map keys into syntax errors and failed every cell before it installed
 * anything.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "pnpm-workspace.yaml";
const INSTALLED = "packages/openfort-react/node_modules";

const reactVersion = process.env.REACT_VERSION;
const viemVersion = process.env.VIEM_VERSION;
const tanstackVersion = process.env.TANSTACK_VERSION;
assert.ok(reactVersion, "REACT_VERSION is required.");
assert.ok(viemVersion, "VIEM_VERSION is required.");
assert.ok(tanstackVersion, "TANSTACK_VERSION is required.");

/** Ascending semver comparison for release versions. */
function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

/**
 * The publish delay the workspace enforces, in milliseconds.
 *
 * Read from the manifest rather than duplicated, so raising or removing the
 * policy moves this with it.
 */
function minimumReleaseAgeMs() {
  const match = readFileSync(MANIFEST, "utf8").match(/^minimumReleaseAge:\s*(\d+)/m);
  return match ? Number(match[1]) * 60_000 : 0;
}

const MINIMUM_RELEASE_AGE_MS = minimumReleaseAgeMs();

/** Publish timestamp per version, as `npm view <name> time` reports it. */
function publishTimes(name) {
  const output = execFileSync("npm", ["view", name, "time", "--json"], {
    encoding: "utf8",
  });
  return JSON.parse(output);
}

/**
 * Newest published version matching a range, so overrides can be written as exact
 * versions.
 *
 * An open range the committed lockfile already satisfies would otherwise leave the
 * pinned lower bound in place and silently test it twice. Resolving here keeps the
 * re-resolution inside the lockfile: `pnpm update` would do it by rewriting every
 * workspace manifest, including the shipped CLI templates whose declared ranges are
 * part of what the release asserts.
 *
 * Only releases old enough to satisfy `minimumReleaseAge` are considered. Picking
 * the newest regardless would hand pnpm a version its own supply-chain delay then
 * refuses to install, so the cell fails during install and type-checks nothing —
 * which is what happened every time viem published within a day of a CI run. The
 * matrix still tracks the latest release, a publish delay behind it.
 */
function resolveExact(name, range) {
  if (/^\d+\.\d+\.\d+$/.test(range)) return range;
  const output = execFileSync("npm", ["view", `${name}@${range}`, "version", "--json"], {
    encoding: "utf8",
  });
  const parsed = JSON.parse(output);
  // `npm view` lists matches in publish order, and an older line can be patched
  // after a newer one, so pick the highest version rather than the last printed.
  const matches = (Array.isArray(parsed) ? parsed : [parsed]).filter(
    (version) => version && !version.includes("-"),
  );

  const times = MINIMUM_RELEASE_AGE_MS > 0 ? publishTimes(name) : {};
  const cutoff = Date.now() - MINIMUM_RELEASE_AGE_MS;
  const mature = matches.filter((version) => {
    if (MINIMUM_RELEASE_AGE_MS === 0) return true;
    const published = Date.parse(times[version]);
    return Number.isFinite(published) && published <= cutoff;
  });

  const version = mature.sort(compareVersions).at(-1);
  assert.ok(
    version,
    `No published ${name} matches "${range}" and is older than the ${MINIMUM_RELEASE_AGE_MS / 60_000}-minute minimumReleaseAge.`,
  );
  return version;
}

/** Override keys exactly as they appear in the manifest, quotes included. */
const selected = new Map([
  ["react", resolveExact("react", reactVersion)],
  ["react-dom", resolveExact("react-dom", reactVersion)],
  ["'@types/react'", resolveExact("@types/react", reactVersion)],
  ["'@types/react-dom'", resolveExact("@types/react-dom", reactVersion)],
  ["viem", resolveExact("viem", viemVersion)],
  ["'@tanstack/react-query'", tanstackVersion],
  ["'@tanstack/query-core'", tanstackVersion],
]);

function apply() {
  const replaced = new Set();
  const workspace = readFileSync(MANIFEST, "utf8")
    .split("\n")
    .map((line) => {
      const match = line.match(/^ {2}(\S+): /);
      const key = match?.[1];
      if (!key || !selected.has(key)) return line;
      replaced.add(key);
      return `  ${key}: ${JSON.stringify(selected.get(key))}`;
    })
    .join("\n");

  const missing = [...selected.keys()].filter((key) => !replaced.has(key));
  assert.equal(
    missing.length,
    0,
    `These overrides are missing from ${MANIFEST}: ${missing.join(", ")}`,
  );

  writeFileSync(MANIFEST, workspace);
  console.log(
    "Pinned exact versions:",
    JSON.stringify(Object.fromEntries(selected)),
  );
}

function verify() {
  const read = (name) =>
    JSON.parse(readFileSync(`${INSTALLED}/${name}/package.json`, "utf8"))
      .version;
  const resolved = {
    react: read("react"),
    "react-dom": read("react-dom"),
    "@types/react": read("@types/react"),
    viem: read("viem"),
  };
  console.log("Resolved matrix versions:", JSON.stringify(resolved));

  const major = (version) => version.split(".")[0];
  for (const [name, requested] of [
    ["react", reactVersion],
    ["react-dom", reactVersion],
    ["@types/react", reactVersion],
    ["viem", viemVersion],
  ]) {
    assert.equal(
      major(resolved[name]),
      major(requested),
      `${name} resolved to ${resolved[name]}, outside the requested ${requested}.`,
    );
  }
}

const command = process.argv[2];
if (command === "apply") apply();
else if (command === "verify") verify();
else {
  throw new Error(`Unknown command "${command}" — expected "apply" or "verify".`);
}
