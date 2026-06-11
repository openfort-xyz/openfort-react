import chalk from "chalk";

import { DEFAULT_APP_NAME } from "~/consts.js";
import { getUserPkgManager } from "~/utils/getUserPkgManager.js";
import { logger } from "~/utils/logger.js";
import { isInsideGitRepo, isRootGitRepo } from "./git.js";

interface LogNextStepsOptions {
  projectName?: string;
  projectDir: string;
  createBackend: boolean;
}

// This logs the next steps that the user should take in order to advance the project
export const logNextSteps = async ({
  projectName = DEFAULT_APP_NAME,
  projectDir,
  createBackend,
}: LogNextStepsOptions) => {
  const pkgManager = getUserPkgManager();

  logger.info(`\n${chalk.green("Success! Your Openfort project is ready.")}`);
  logger.info("\nNext steps:");

  if (projectName !== ".") {
    logger.info(`  ${chalk.cyan(`cd ${projectName}`)}`);
  }

  const installCmd =
    pkgManager === "yarn" ? pkgManager : `${pkgManager} install`;
  const devCmd = ["npm", "bun"].includes(pkgManager)
    ? `${pkgManager} run dev`
    : `${pkgManager} dev`;

  if (createBackend) {
    logger.info(`\n${chalk.yellow("For the backend:")}`);
    logger.info(`  ${chalk.cyan("cd backend")}`);
    logger.info(`  ${chalk.cyan(installCmd)}`);
    logger.info(`  ${chalk.cyan(devCmd)}`);

    logger.info(`\n${chalk.yellow("For the frontend (in a new terminal):")}`);
    logger.info(`  ${chalk.cyan("cd frontend")}`);
    logger.info(`  ${chalk.cyan(installCmd)}`);
    logger.info(`  ${chalk.cyan(devCmd)}`);
  } else {
    logger.info(`  ${chalk.cyan(installCmd)}`);
    logger.info(`  ${chalk.cyan(devCmd)}`);
  }

  if (!(await isInsideGitRepo(projectDir)) && !isRootGitRepo(projectDir)) {
    logger.info(`\n  ${chalk.cyan("git init")}`);
    logger.info(`  ${chalk.cyan('git commit -m "initial commit"')}`);
  }

  logger.info(`\n${chalk.blue("Learn more at https://www.openfort.xyz/docs")}`);
};
