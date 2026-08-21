import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { runCli } from "~/cli/index.js";
import { DEFAULT_APP_NAME } from "~/consts.js";

const originalArgv = process.argv;

/** Runs the CLI as if invoked with `create-openfort <args>`. */
const run = (...args: string[]) => {
  // `--CI` skips every interactive prompt, and `--noTelemetry` keeps the run
  // from reaching the network.
  process.argv = ["node", "create-openfort", ...args, "--CI", "--noTelemetry"];
  return runCli();
};

describe("runCli", () => {
  beforeEach(() => {
    process.argv = originalArgv;
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  test("takes the app name from the positional argument", async () => {
    const results = await run("my-app");

    expect(results.appName).toBe("my-app");
  });

  test("falls back to the default app name", async () => {
    const results = await run();

    expect(results.appName).toBe(DEFAULT_APP_NAME);
  });

  test("strips control characters from the app name", async () => {
    const results = await run("my-app\n--rm");

    expect(results.appName).toBe("my-app--rm");
  });

  test("honours the requested template and theme", async () => {
    const results = await run("my-app", "--template", "headless");

    expect(results.template).toBe("headless");
    expect(results.theme).toBeUndefined();

    const themed = await run(
      "my-app",
      "--template",
      "openfort-ui",
      "--theme",
      "retro",
    );

    expect(themed.template).toBe("openfort-ui");
    expect(themed.theme).toBe("retro");
    expect(themed.flags).not.toHaveProperty("template");
    expect(themed.flags).not.toHaveProperty("theme");
  });

  test("defaults to the openfort-ui template with no backend", async () => {
    const results = await run("my-app");

    expect(results.template).toBe("openfort-ui");
    expect(results.createBackend).toBe(false);
  });

  test("passes through the git opt-out", async () => {
    const results = await run("my-app", "--noGit");

    expect(results.flags.noGit).toBe(true);
  });

  test("rejects an unknown theme", async () => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    await expect(
      run("my-app", "--template", "openfort-ui", "--theme", "nonexistent"),
    ).rejects.toThrow("process.exit(1)");
  });

  test("rejects the removed install opt-out", async () => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    await expect(run("my-app", "--noInstall")).rejects.toThrow(
      "process.exit(1)",
    );
  });
});
