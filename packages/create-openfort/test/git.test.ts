import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import * as p from "@clack/prompts";
import fs from "fs-extra";
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
    fs.removeSync(directory);
  }
});

describe("initializeGit", () => {
  test("preserves an existing repository when confirmation is cancelled", async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "openfort-git-"));
    temporaryDirectories.push(projectDir);
    execFileSync("git", ["init"], { cwd: projectDir });
    const sentinel = path.join(projectDir, ".git", "openfort-sentinel");
    fs.writeFileSync(sentinel, "preserve me");
    vi.mocked(p.confirm).mockResolvedValue(Symbol("cancel"));

    await initializeGit(projectDir);

    expect(fs.readFileSync(sentinel, "utf8")).toBe("preserve me");
  });
});
