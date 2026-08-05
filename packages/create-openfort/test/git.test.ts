import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as p from "@clack/prompts";
import { afterEach, describe, expect, test, vi } from "vitest";

import { initializeGit } from "~/helpers/git.js";

vi.mock("@clack/prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clack/prompts")>();
  return {
    ...actual,
    cancel: vi.fn(),
    confirm: vi.fn(),
    isCancel: (value: unknown) => typeof value === "symbol",
  };
});

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("initializeGit", () => {
  test("preserves an existing repository when confirmation is cancelled", async () => {
    const projectDir = mkdtempSync(path.join(os.tmpdir(), "openfort-git-"));
    temporaryDirectories.push(projectDir);
    execFileSync("git", ["init"], { cwd: projectDir });
    const sentinel = path.join(projectDir, ".git", "openfort-sentinel");
    writeFileSync(sentinel, "preserve me");
    vi.mocked(p.confirm).mockResolvedValue(Symbol("cancel"));

    await initializeGit(projectDir);

    expect(readFileSync(sentinel, "utf8")).toBe("preserve me");
  });

  test("refuses to stage an unignored environment variant", async () => {
    const projectDir = mkdtempSync(path.join(os.tmpdir(), "openfort-git-"));
    temporaryDirectories.push(projectDir);
    writeFileSync(path.join(projectDir, ".env.production"), "SECRET=fake");

    await expect(initializeGit(projectDir)).rejects.toThrow(
      "Refusing to stage generated credentials",
    );
  });

  test("stages a scaffold when environment variants are ignored and the example is retained", async () => {
    const projectDir = mkdtempSync(path.join(os.tmpdir(), "openfort-git-"));
    temporaryDirectories.push(projectDir);
    writeFileSync(
      path.join(projectDir, ".gitignore"),
      ".env*\n!.env.example\n",
    );
    writeFileSync(path.join(projectDir, ".env.production"), "SECRET=fake");
    writeFileSync(
      path.join(projectDir, ".env.example"),
      "PUBLISHABLE_KEY=example",
    );

    await initializeGit(projectDir);

    expect(
      execFileSync("git", ["check-ignore", ".env.production"], {
        cwd: projectDir,
        encoding: "utf8",
      }).trim(),
    ).toBe(".env.production");
    expect(
      execFileSync("git", ["ls-files", "--error-unmatch", ".env.example"], {
        cwd: projectDir,
        encoding: "utf8",
      }).trim(),
    ).toBe(".env.example");
  });
});
