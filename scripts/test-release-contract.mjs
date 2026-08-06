/**
 * Asserts the two release invariants nothing else enforces: every publish path
 * rejects stale CLI templates first, and the release plan never versions a
 * private workspace.
 *
 * The templates are published as scaffolding inside `create-openfort` rather
 * than as packages of their own, so a bump on one would tag a release with no
 * npm presence, and a publish that skipped `check:templates` would ship
 * scaffolding that no longer matches the SDK.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts ?? {};
const changesetConfig = JSON.parse(
  readFileSync(".changeset/config.json", "utf8"),
);

assert.match(
  scripts["changeset:prepublish"] ?? "",
  /\bcheck:templates\b/,
  "The shared prepublish path must reject stale templates before building.",
);
assert.match(
  scripts["changeset:version"] ?? "",
  /\bcheck:templates\b/,
  "Version pull requests must reject stale templates.",
);

const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
for (const [job, marker] of [
  ["stable", "changeset:publish"],
  ["canary", "changeset:prepublish"],
]) {
  assert.ok(
    releaseWorkflow.includes(marker),
    `The ${job} release job must publish through the shared prepublish path (${marker}).`,
  );
}
assert.match(
  scripts["changeset:publish"] ?? "",
  /\bchangeset:prepublish\b/,
  "Stable publishing must use the shared prepublish path.",
);

assert.deepEqual(
  changesetConfig.privatePackages,
  { version: false, tag: false },
  "Private templates and examples must stay outside release version plans.",
);

// The backend template depends on no released package, so it never appears in
// the release plan below — `private` is the only thing keeping publish away
// from it. Without it the canary publish fails on the versionless manifest.
const backendTemplate = JSON.parse(
  readFileSync("packages/create-openfort/template/backend/package.json", "utf8"),
);
assert.equal(
  backendTemplate.private,
  true,
  "The backend template must stay private or changeset publish will try to release it.",
);

const statusDirectory = mkdtempSync(join(tmpdir(), "openfort-react-changeset-status-"));
const statusPath = join(statusDirectory, "status.json");
try {
  execFileSync("pnpm", ["exec", "changeset", "status", "--output", statusPath], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  // `changeset status` lists every workspace, so the invariant is not absence
  // from the plan: it is that these workspaces never take a version bump.
  const privateWorkspaces = [
    "create-openfort-template-firebase",
    "create-openfort-template-headless",
    "create-openfort-template-openfort-ui",
    "create-openfort-template-solana-headless",
    "quickstart-solana-headless",
  ];
  for (const name of privateWorkspaces) {
    const release = status.releases.find((entry) => entry.name === name);
    assert.ok(
      release,
      `${name} is missing from the release plan, so this gate no longer covers it.`,
    );
    assert.equal(
      release.type,
      "none",
      `Changesets must not version the private workspace ${name}.`,
    );
    assert.equal(
      release.newVersion,
      release.oldVersion,
      `Changesets must not bump the private workspace ${name}.`,
    );
  }
} finally {
  rmSync(statusDirectory, { recursive: true, force: true });
}

console.log("Every publish path gates on template parity, and no private workspace takes a version bump.");
