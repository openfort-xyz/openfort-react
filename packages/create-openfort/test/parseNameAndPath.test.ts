import path from "node:path";
import { describe, expect, test } from "vitest";

import { parseNameAndPath } from "~/utils/parseNameAndPath.js";

describe("parseNameAndPath", () => {
  test("uses the last path segment as the app name", () => {
    expect(parseNameAndPath("app")).toEqual(["app", "app"]);
    expect(parseNameAndPath("dir/app")).toEqual(["app", "dir/app"]);
  });

  test("keeps the scope in the name but drops it from the path", () => {
    expect(parseNameAndPath("dir/@mono/app")).toEqual(["@mono/app", "dir/app"]);
    expect(parseNameAndPath("@mono/app")).toEqual(["@mono/app", "app"]);
  });

  test("ignores a trailing slash", () => {
    expect(parseNameAndPath("dir/app/")).toEqual(["app", "dir/app"]);
  });

  test("resolves '.' to the current directory name", () => {
    const [appName, targetPath] = parseNameAndPath(".");

    expect(appName).toBe(path.basename(path.resolve(process.cwd())));
    expect(targetPath).toBe(".");
  });
});
