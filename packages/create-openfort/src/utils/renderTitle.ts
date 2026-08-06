import chalk from "chalk";

import { TITLE_TEXT } from "~/consts.js";
import { getUserPkgManager } from "~/utils/getUserPkgManager.js";

// Openfort brand red
const openfortRed = chalk.hex("#ff3b30");

export const renderTitle = async () => {
  // resolves weird behavior where the ascii is offset
  const pkgManager = getUserPkgManager();
  if (pkgManager === "yarn" || pkgManager === "pnpm") {
    // biome-ignore lint/suspicious/noConsole: CLI tool needs console output
    console.log("");
  }

  // biome-ignore lint/suspicious/noConsole: CLI tool needs console output for title
  console.log(openfortRed(TITLE_TEXT));
};
