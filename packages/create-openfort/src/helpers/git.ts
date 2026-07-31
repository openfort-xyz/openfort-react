import { execSync } from "node:child_process";
import path from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";
import fs from "fs-extra";
import ora from "ora";

import { logger } from "~/utils/logger.js";

const isGitInstalled = (dir: string): boolean => {
  try {
    execSync("git --version", { cwd: dir });
    return true;
  } catch {
    return false;
  }
};

/** @returns Whether or not the provided directory has a `.git` subdirectory in it. */
export const isRootGitRepo = (dir: string): boolean => {
  return fs.existsSync(path.join(dir, ".git"));
};

/** @returns Whether or not this directory or a parent directory has a `.git` directory. */
export const isInsideGitRepo = async (dir: string): Promise<boolean> => {
  try {
    // If this command succeeds, we're inside a git repo
    await execa("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: dir,
      stdout: "ignore",
    });
    return true;
  } catch {
    // Else, it will throw a git-error and we return false
    return false;
  }
};

const getGitVersion = () => {
  const stdout = execSync("git --version").toString().trim();
  const gitVersionTag = stdout.split(" ")[2];
  const major = gitVersionTag?.split(".")[0];
  const minor = gitVersionTag?.split(".")[1];
  return { major: Number(major), minor: Number(minor) };
};

/** @returns The git config value of "init.defaultBranch". If it is not set, returns "main". */
const getDefaultBranch = () => {
  const stdout = execSync("git config --global init.defaultBranch || echo main")
    .toString()
    .trim();

  return stdout;
};

// This initializes the Git-repository for the project
export const initializeGit = async (projectDir: string) => {
  logger.info("Initializing Git...");

  if (!isGitInstalled(projectDir)) {
    logger.warn("Git is not installed. Skipping Git initialization.");
    return;
  }

  const spinner = ora("Creating a new git repo...\n").start();

  const isRoot = isRootGitRepo(projectDir);
  const isInside = await isInsideGitRepo(projectDir);
  const dirName = path.parse(projectDir).name; // skip full path for logging

  if (isInside && isRoot) {
    // Dir is a root git repo
    spinner.stop();
    const overwriteGit = await p.confirm({
      message: `${chalk.redBright.bold(
        "Warning:",
      )} Git is already initialized in "${dirName}". Initializing a new git repository would delete the previous history. Would you like to continue anyways?`,
      initialValue: false,
    });

    if (p.isCancel(overwriteGit)) {
      p.cancel("Git initialization cancelled.");
      return;
    }
    if (!overwriteGit) {
      spinner.info("Skipping Git initialization.");
      return;
    }
    // Deleting the .git folder
    fs.removeSync(path.join(projectDir, ".git"));
  } else if (isInside && !isRoot) {
    // Dir is inside a git worktree
    spinner.stop();
    const initializeChildGitRepo = await p.confirm({
      message: `${chalk.redBright.bold(
        "Warning:",
      )} "${dirName}" is already in a git worktree. Would you still like to initialize a new git repository in this directory?`,
      initialValue: false,
    });
    if (p.isCancel(initializeChildGitRepo)) {
      p.cancel("Git initialization cancelled.");
      return;
    }
    if (!initializeChildGitRepo) {
      spinner.info("Skipping Git initialization.");
      return;
    }
  }

  // We're good to go, initializing the git repo
  try {
    const branchName = getDefaultBranch();

    // --initial-branch flag was added in git v2.28.0
    const { major, minor } = getGitVersion();
    if (major < 2 || (major === 2 && minor < 28)) {
      await execa("git", ["init"], { cwd: projectDir });
      // symbolic-ref is used here due to refs/heads/master not existing
      // It is only created after the first commit
      // https://superuser.com/a/1419674
      await execa("git", ["symbolic-ref", "HEAD", `refs/heads/${branchName}`], {
        cwd: projectDir,
      });
    } else {
      await execa("git", ["init", `--initial-branch=${branchName}`], {
        cwd: projectDir,
      });
    }
    const secretFiles: string[] = [];
    const collectSecretFiles = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          collectSecretFiles(absolutePath);
        } else if (
          entry.name.startsWith(".env") &&
          entry.name !== ".env.example"
        ) {
          secretFiles.push(path.relative(projectDir, absolutePath));
        }
      }
    };
    collectSecretFiles(projectDir);
    if (secretFiles.length > 0) {
      try {
        await Promise.all(
          secretFiles.map((file) =>
            execa("git", ["check-ignore", "--quiet", "--", file], {
              cwd: projectDir,
            }),
          ),
        );
      } catch {
        throw new Error(
          `Refusing to stage generated credentials: ensure ${secretFiles.join(", ")} are covered by .gitignore.`,
        );
      }
    }
    await execa("git", ["add", "."], { cwd: projectDir });
    spinner.succeed(
      `${chalk.green("Successfully initialized and staged")} ${chalk.green.bold(
        "git",
      )}\n`,
    );
  } catch (error) {
    spinner.fail(
      `${chalk.bold.red(
        "Failed:",
      )} could not initialize git. Update git to the latest version!\n`,
    );
    throw error;
  }
};
