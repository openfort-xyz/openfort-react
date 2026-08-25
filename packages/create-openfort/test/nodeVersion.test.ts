import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  assertSupportedNode,
  MINIMUM_NODE_VERSION,
  SUPPORTED_NODE_RANGE,
} from "~/utils/nodeVersion.js";

type PackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
};

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const templatesRoot = path.join(packageRoot, "template/openfort-templates");

function readManifest(manifestPath: string): PackageManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
}

function readResolvedToolManifest(
  toolName: string,
  templateRoot: string,
): PackageManifest {
  const require = createRequire(path.join(templateRoot, "package.json"));
  let directory = path.dirname(require.resolve(toolName));

  while (directory !== path.dirname(directory)) {
    const manifestPath = path.join(directory, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = readManifest(manifestPath);
      if (manifest.name === toolName) return manifest;
    }
    directory = path.dirname(directory);
  }

  throw new Error(`Could not find the installed ${toolName} manifest.`);
}

describe("assertSupportedNode", () => {
  test("accepts each supported runtime boundary", () => {
    expect(() => assertSupportedNode("20.19.0")).not.toThrow();
    expect(() => assertSupportedNode("20.19.1")).not.toThrow();
    expect(() => assertSupportedNode("20.99.0")).not.toThrow();
    expect(() => assertSupportedNode("22.12.0")).not.toThrow();
    expect(() => assertSupportedNode("23.0.0")).not.toThrow();
  });

  test.each([
    "18.20.8",
    "20.18.99",
    "21.0.0",
    "21.99.99",
    "22.0.0",
    "22.11.99",
    "20.19.0-rc.1",
    "22.12.0-rc.1",
    "23.0.0-nightly.1",
  ])("rejects unsupported runtime %s before scaffolding", (version) => {
    expect(() => assertSupportedNode(version)).toThrow(
      `create-openfort requires Node.js ${SUPPORTED_NODE_RANGE}. Current version: ${version}.`,
    );
  });

  test.each([
    "20",
    "20.19",
    "020.19.0",
    "20.19.0-01",
    "unknown",
  ])("rejects malformed semantic version %s", (version) => {
    expect(() => assertSupportedNode(version)).toThrow(
      `create-openfort requires Node.js ${SUPPORTED_NODE_RANGE}. Current version: ${version}.`,
    );
  });

  test("matches the engine required by every shipped Vite 8 toolchain", () => {
    const cliManifest = readManifest(path.join(packageRoot, "package.json"));
    expect(cliManifest.engines?.node).toBe(SUPPORTED_NODE_RANGE);

    const toolEngines = new Set<string>();
    for (const templateName of [
      "firebase",
      "headless",
      "openfort-ui",
      "solana-headless",
    ]) {
      const templateRoot = path.join(templatesRoot, templateName);
      const templateManifest = readManifest(
        path.join(templateRoot, "package.json"),
      );
      expect(templateManifest.devDependencies?.vite).toMatch(/^\^8\./);
      expect(
        templateManifest.devDependencies?.["@vitejs/plugin-react"],
      ).toMatch(/^\^6\./);

      for (const toolName of ["vite", "@vitejs/plugin-react"]) {
        const toolManifest = readResolvedToolManifest(toolName, templateRoot);
        const engine = toolManifest.engines?.node;
        expect(engine).toBeTruthy();
        if (engine) toolEngines.add(engine);
      }
    }

    expect(toolEngines).toEqual(new Set([SUPPORTED_NODE_RANGE]));
    expect(() => assertSupportedNode(MINIMUM_NODE_VERSION)).not.toThrow();
  });
});
