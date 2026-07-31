import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(packageRoot, "../..");

describe("published templates", () => {
  test("never documents a Shield secret prefix as publishable", () => {
    const result = spawnSync(
      "git",
      [
        "grep",
        "-n",
        `VITE_SHIELD_PUBLISHABLE_KEY=${"sk_"}`,
        "--",
        "examples",
        "packages/create-openfort",
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  test("ship configuration and npm-safe ignore files for every template", () => {
    const npmCache = mkdtempSync(
      path.join(os.tmpdir(), "create-openfort-npm-cache-"),
    );
    try {
      const output = execFileSync(
        "npm",
        ["pack", "--dry-run", "--json", "--ignore-scripts"],
        {
          cwd: packageRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            npm_config_cache: npmCache,
          },
        },
      );
      const [{ files }] = JSON.parse(output) as [
        { files: Array<{ path: string }> },
      ];
      const packedPaths = new Set(files.map((file) => file.path));

      for (const template of [
        "firebase",
        "headless",
        "openfort-ui",
        "solana-headless",
      ]) {
        const root = `template/openfort-templates/${template}`;
        expect(packedPaths.has(`${root}/gitignore`)).toBe(true);
        expect(packedPaths.has(`${root}/.env.example`)).toBe(true);
      }
      expect(packedPaths.has("template/backend/gitignore")).toBe(true);
      expect(packedPaths.has("template/backend/.env.example")).toBe(true);
    } finally {
      rmSync(npmCache, { recursive: true, force: true });
    }
  });
});
