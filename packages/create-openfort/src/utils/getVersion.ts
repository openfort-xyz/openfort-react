import { readFileSync } from "node:fs";
import path from "node:path";
import type { PackageJson } from "type-fest";

import { PKG_ROOT } from "~/consts.js";

export const getVersion = () => {
  const packageJsonPath = path.join(PKG_ROOT, "package.json");

  const packageJsonContent = JSON.parse(
    readFileSync(packageJsonPath, "utf8"),
  ) as PackageJson;

  return packageJsonContent.version ?? "unknown";
};
