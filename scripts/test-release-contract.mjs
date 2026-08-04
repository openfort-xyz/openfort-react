import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const changesetConfig = JSON.parse(
  readFileSync(".changeset/config.json", "utf8"),
);
const scripts = packageJson.scripts ?? {};
const prepublish = scripts["changeset:prepublish"];

assert.equal(
  prepublish,
  "pnpm check:templates && pnpm build && pnpm build:cli",
  "The shared prepublish path must reject stale templates before building.",
);
assert.match(
  scripts["changeset:version"] ?? "",
  /^pnpm check:templates && /,
  "Version pull requests must reject stale templates.",
);
assert.match(
  scripts["changeset:publish"] ?? "",
  /(?:^|&& )pnpm changeset:prepublish(?: &&|$)/,
  "Stable publishing must use the shared prepublish path.",
);

const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
const canaryMarker = "\n  canary:\n";
const canaryOffset = releaseWorkflow.indexOf(canaryMarker);
assert.notEqual(
  canaryOffset,
  -1,
  "The release workflow must define a canary job.",
);

const stableJob = releaseWorkflow.slice(0, canaryOffset);
const canaryJob = releaseWorkflow.slice(canaryOffset);
assert.match(
  stableJob,
  /publish: pnpm changeset:publish/,
  "The stable release job must use the guarded publish script.",
);
assert.match(
  canaryJob,
  /^\s+pnpm changeset:prepublish$/m,
  "The canary release job must use the shared prepublish path.",
);
assert.match(
  canaryJob,
  /^\s+GITHUB_TOKEN: \$\{\{ github\.token \}\}$/m,
  "Snapshot versioning must authenticate its GitHub changelog lookup.",
);

assert.deepEqual(
  changesetConfig.privatePackages,
  { version: false, tag: false },
  "Private templates and examples must stay outside release version plans.",
);

const statusDirectory = mkdtempSync(join(tmpdir(), "fortkit-changeset-status-"));
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

console.log("Stable and canary releases share the template parity gate.");
