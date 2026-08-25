import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { scaffoldProject } from "~/helpers/scaffoldProject.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(packageRoot, "../..");
const verifyStandalone = process.env.OPENFORT_VERIFY_STANDALONE_SOLANA === "1";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  packageManager?: string;
};

/**
 * Environment for the generated project, with this repository's own pnpm policy
 * removed.
 *
 * Running a workspace script exports every pnpm setting as an `npm_config_*`
 * variable, so a nested `pnpm install` silently inherits this repository's
 * dependency `overrides`, `trustPolicy` and `minimumReleaseAge` even from a
 * temporary directory outside the workspace. That is exactly what this test has
 * to avoid: the point is to resolve the template's declared dependency graph the
 * way a user's machine would.
 */
function standaloneEnv(): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !/^(?:npm|pnpm)_config_/i.test(key),
      ),
    ),
    // A maturity window belongs to whoever runs this, not to the template. Without
    // pinning it the result would depend on the machine's global pnpm settings and
    // on how recently Openfort published, which this repository already exempts.
    npm_config_minimum_release_age: "0",
  };
}

/**
 * Reads a direct dependency's installed version straight from the project's
 * `node_modules` tree. Resolving `<name>/package.json` instead would fail for any
 * package that does not list it in `exports`, which several of these do.
 */
function readInstalledVersion(projectDirectory: string, packageName: string) {
  const manifestPath = path.join(
    projectDirectory,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    version?: string;
  };
  return manifest.version;
}

test.skipIf(!verifyStandalone)(
  "installs and builds the generated Solana template with React 19",
  async () => {
    const sandbox = mkdtempSync(
      path.join(os.tmpdir(), "create-openfort-solana-standalone-"),
    );
    const projectDirectory = path.join(sandbox, "solana-app");

    try {
      execFileSync(
        "pnpm",
        ["--filter", "@openfort/react", "pack", "--pack-destination", sandbox],
        { cwd: repositoryRoot, stdio: "pipe" },
      );
      const sdkTarball = readdirSync(sandbox).find((file) =>
        file.endsWith(".tgz"),
      );
      if (!sdkTarball)
        throw new Error("The SDK package tarball was not created.");

      await scaffoldProject({
        projectName: "solana-app",
        projectDir: projectDirectory,
        template: "solana-headless",
        createBackend: false,
      });

      const manifestPath = path.join(projectDirectory, "package.json");
      const manifest = JSON.parse(
        readFileSync(manifestPath, "utf8"),
      ) as PackageManifest;
      expect(manifest.dependencies?.react).toBe("^19.0.0");
      expect(manifest.dependencies?.["react-dom"]).toBe("^19.0.0");
      expect(manifest.devDependencies?.["@types/react"]).toMatch(/^\^19\./);
      expect(manifest.devDependencies?.["@types/react-dom"]).toMatch(/^\^19\./);

      manifest.name = "standalone-solana-react-19";
      const repositoryManifest = JSON.parse(
        readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
      ) as { packageManager?: string };
      if (!repositoryManifest.packageManager) {
        throw new Error("The repository does not pin pnpm.");
      }
      manifest.packageManager = repositoryManifest.packageManager;
      if (!manifest.dependencies) {
        throw new Error("The generated project has no dependencies.");
      }
      manifest.dependencies["@openfort/react"] = `file:${path.join(
        sandbox,
        sdkTarball,
      )}`;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      execFileSync(
        "pnpm",
        ["install", "--ignore-workspace", "--no-frozen-lockfile"],
        { cwd: projectDirectory, stdio: "inherit", env: standaloneEnv() },
      );

      expect(readInstalledVersion(projectDirectory, "react")).toMatch(/^19\./);
      expect(readInstalledVersion(projectDirectory, "react-dom")).toMatch(
        /^19\./,
      );
      expect(readInstalledVersion(projectDirectory, "@types/react")).toMatch(
        /^19\./,
      );
      expect(
        readInstalledVersion(projectDirectory, "@types/react-dom"),
      ).toMatch(/^19\./);
      expect(readInstalledVersion(projectDirectory, "vite")).toMatch(/^8\./);
      expect(
        readInstalledVersion(projectDirectory, "@vitejs/plugin-react"),
      ).toMatch(/^6\./);

      execFileSync("pnpm", ["run", "build"], {
        cwd: projectDirectory,
        stdio: "inherit",
        env: standaloneEnv(),
      });
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  },
  // Packs the SDK, then installs a full Vite 8 + React 19 graph from the registry.
  420_000,
);
