import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { scaffoldProject } from "~/helpers/scaffoldProject.js";
import type { OpenfortTemplate } from "~/installers/index.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(packageRoot, "../..");
const templates: OpenfortTemplate[] = [
  "firebase",
  "headless",
  "openfort-ui",
  "solana-headless",
];

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

      for (const packedPath of packedPaths) {
        expect(packedPath).not.toMatch(
          /^template\/.*\/(node_modules|dist|\.cache|\.turbo)(\/|$)/,
        );
        expect(packedPath).not.toMatch(/(^|\/)\.env$/);
      }

      for (const template of templates) {
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

  test("scaffolds every shipped frontend without repository-only references", async () => {
    const sandbox = mkdtempSync(
      path.join(os.tmpdir(), "create-openfort-smoke-"),
    );

    try {
      for (const template of templates) {
        const projectDir = path.join(sandbox, template);
        await scaffoldProject({
          projectName: template,
          projectDir,
          template,
          createBackend: false,
        });

        expect(existsSync(path.join(projectDir, ".gitignore"))).toBe(true);
        expect(existsSync(path.join(projectDir, "gitignore"))).toBe(false);
        const gitignore = readFileSync(
          path.join(projectDir, ".gitignore"),
          "utf8",
        );
        expect(gitignore).toContain(".env*");
        expect(gitignore).toContain("!.env.example");
        expect(
          readFileSync(path.join(projectDir, ".env.example"), "utf8"),
        ).toContain("VITE_OPENFORT_PUBLISHABLE_KEY=");

        const packageJson = JSON.parse(
          readFileSync(path.join(projectDir, "package.json"), "utf8"),
        ) as {
          scripts?: Record<string, string>;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        expect(packageJson.scripts?.build).toBeTruthy();
        expect(packageJson.dependencies?.["@openfort/react"]).toBe("latest");
        expect(packageJson.dependencies?.["@tanstack/react-query"]).toBe(
          ">=5.99.2 <6",
        );

        const reactRange =
          template === "solana-headless" ? "^19.0.0" : "^18.3.1";
        const reactMajor = template === "solana-headless" ? "19" : "18";
        expect(packageJson.dependencies?.react).toBe(reactRange);
        expect(packageJson.dependencies?.["react-dom"]).toBe(reactRange);
        expect(packageJson.devDependencies?.["@types/react"]).toMatch(
          new RegExp(`^\\^${reactMajor}\\.`),
        );
        expect(packageJson.devDependencies?.["@types/react-dom"]).toMatch(
          new RegExp(`^\\^${reactMajor}\\.`),
        );
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
