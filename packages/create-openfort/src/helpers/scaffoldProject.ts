import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";

import { PKG_ROOT } from "~/consts.js";
import { logger } from "~/utils/logger.js";

interface ScaffoldOptions {
  projectName: string;
  projectDir: string;
  template: string;
  createBackend: boolean;
}

// This copies the selected Openfort template
export const scaffoldProject = async ({
  projectName,
  projectDir,
  template,
  createBackend,
}: ScaffoldOptions) => {
  logger.info("");

  const spinner = ora(`Scaffolding in: ${projectDir}...\n`).start();

  // Handle existing directory
  if (existsSync(projectDir)) {
    if (readdirSync(projectDir).length === 0) {
      if (projectName !== ".")
        spinner.info(
          `${chalk.cyan.bold(projectName)} exists but is empty, continuing...\n`,
        );
    } else {
      spinner.stopAndPersist();
      const overwriteDir = await p.select({
        message: `${chalk.redBright.bold("Warning:")} ${chalk.cyan.bold(
          projectName,
        )} already exists and isn't empty. How would you like to proceed?`,
        options: [
          {
            label: "Abort installation (recommended)",
            value: "abort",
          },
          {
            label: "Clear the directory and continue installation",
            value: "clear",
          },
          {
            label: "Continue installation and overwrite conflicting files",
            value: "overwrite",
          },
        ],
        initialValue: "abort",
      });

      if (p.isCancel(overwriteDir) || overwriteDir === "abort") {
        spinner.fail("Aborting installation...");
        process.exit(1);
      }

      const confirmOverwriteDir = await p.confirm({
        message: `Are you sure you want to ${
          overwriteDir === "clear"
            ? "clear the directory"
            : "overwrite conflicting files"
        }?`,
        initialValue: false,
      });

      if (p.isCancel(confirmOverwriteDir) || !confirmOverwriteDir) {
        spinner.fail("Aborting installation...");
        process.exit(1);
      }

      if (overwriteDir === "clear") {
        spinner.info(
          `Emptying ${chalk.cyan.bold(projectName)} and creating Openfort app..\n`,
        );
        rmSync(projectDir, { recursive: true, force: true });
        mkdirSync(projectDir, { recursive: true });
      }
    }
  }

  spinner.start();

  // Create project directory
  mkdirSync(projectDir, { recursive: true });

  // Copy the selected template
  const templateSrcDir = path.join(
    PKG_ROOT,
    "template/openfort-templates",
    template,
  );

  // If creating backend, copy to frontend subfolder, otherwise copy to root
  const targetDir = createBackend
    ? path.join(projectDir, "frontend")
    : projectDir;

  cpSync(templateSrcDir, targetDir, { recursive: true });

  const npmSafeGitignore = path.join(targetDir, "gitignore");
  if (existsSync(npmSafeGitignore)) {
    renameSync(npmSafeGitignore, path.join(targetDir, ".gitignore"));
  }

  const pkgPath = path.join(targetDir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<
      string,
      unknown
    >;
    const deps = pkg.dependencies as Record<string, string> | undefined;
    if (deps?.["@openfort/react"]) {
      const ref = deps["@openfort/react"];
      if (ref.startsWith("workspace:")) {
        deps["@openfort/react"] = "latest";
        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      }
    }
  }

  const scaffoldedName =
    projectName === "." ? "App" : chalk.cyan.bold(projectName);

  await new Promise((resolve) => setTimeout(resolve, 250)); // UX

  spinner.succeed(
    `${scaffoldedName} ${chalk.green("scaffolded successfully!")}\n`,
  );
};
