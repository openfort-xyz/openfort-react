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
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "pnpm-workspace.yaml";
const INSTALLED = "packages/openfort-react/node_modules";

const reactVersion = process.env.REACT_VERSION;
const viemVersion = process.env.VIEM_VERSION;
const tanstackVersion = process.env.TANSTACK_VERSION;
assert.ok(reactVersion, "REACT_VERSION is required.");
assert.ok(viemVersion, "VIEM_VERSION is required.");
assert.ok(tanstackVersion, "TANSTACK_VERSION is required.");

/** Override keys exactly as they appear in the manifest, quotes included. */
const selected = new Map([
  ["react", reactVersion],
  ["react-dom", reactVersion],
  ["'@types/react'", reactVersion],
  ["'@types/react-dom'", reactVersion],
  ["viem", viemVersion],
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
    `Pinned React ${reactVersion}, viem ${viemVersion}, TanStack Query ${tanstackVersion}.`,
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
