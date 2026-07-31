import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("published templates", () => {
  test("ship configuration and npm-safe ignore files for every template", () => {
    const output = execFileSync(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: packageRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          npm_config_cache: "/private/tmp/create-openfort-npm-cache",
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
  });
});
