/**
 * Every workspace package that renders React has to stay inside the peer range the
 * SDK publishes, and has to type React with the major it actually installs.
 *
 * Neither holds automatically: `sherif` skips the examples, and the compatibility
 * matrix pins React through workspace overrides, so a manifest can declare a range
 * the SDK rejects — or React 18 with React 19 types — and every gate still passes.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { compareVersions, minimumVersion } from "./semver-lite.mjs";

/** Directories whose immediate children are workspace packages. */
const PACKAGE_PARENTS = [
  "environments",
  "examples/quickstarts",
  "examples/quickstarts/betterauth/apps",
  "packages/create-openfort/template/openfort-templates",
];
const EXTRA_PACKAGES = ["examples/playground"];

function collectManifests() {
  const found = [];
  for (const parent of PACKAGE_PARENTS) {
    if (!existsSync(parent)) continue;
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = path.join(parent, entry.name, "package.json");
      if (existsSync(manifest)) found.push(manifest);
    }
  }
  for (const directory of EXTRA_PACKAGES) {
    const manifest = path.join(directory, "package.json");
    if (existsSync(manifest)) found.push(manifest);
  }
  return found.sort();
}

const sdkManifest = JSON.parse(
  readFileSync("packages/openfort-react/package.json", "utf8"),
);
const peerRange = sdkManifest.peerDependencies?.react;
assert.ok(peerRange, "The SDK must declare a React peer range.");

const peerFloor = minimumVersion(peerRange);
const manifests = collectManifests();
assert.ok(manifests.length > 0, "No workspace manifests were found to check.");

let checked = 0;
for (const manifestPath of manifests) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  const react = declared.react;
  if (!react) continue;
  checked++;
  const where = path.relative(process.cwd(), manifestPath);

  assert.ok(
    compareVersions(minimumVersion(react), peerFloor) >= 0,
    `${where} accepts React ${react}, which is below the SDK peer range ${peerRange}.`,
  );

  for (const paired of ["react-dom", "@types/react", "@types/react-dom"]) {
    const range = declared[paired];
    if (!range) continue;
    assert.equal(
      minimumVersion(range)[0],
      minimumVersion(react)[0],
      `${where} declares ${paired} ${range} against React ${react}; the majors must match.`,
    );
  }
}

assert.ok(checked >= 10, `Only ${checked} manifests declared React — the package discovery looks wrong.`);
console.log(`React peer alignment holds across ${checked} workspace packages.`);
