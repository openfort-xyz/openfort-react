import {
  cpSync,
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import ora from "ora";

import { PKG_ROOT } from "~/consts.js";
import { logger } from "~/utils/logger.js";

interface CreateBackendOptions {
  projectDir: string;
  openfortSecretKey: string;
  shieldSecretKey: string;
  shieldPublishableKey: string;
  shieldEncryptionShare: string;
  port?: number;
}

export const createBackend = async ({
  projectDir,
  openfortSecretKey,
  shieldSecretKey,
  shieldPublishableKey,
  shieldEncryptionShare,
  port = 3110,
}: CreateBackendOptions) => {
  const spinner = ora("Creating backend...").start();

  try {
    const backendTemplateDir = path.join(PKG_ROOT, "template/backend");
    const backendDir = path.join(projectDir, "backend");

    // Copy backend template
    cpSync(backendTemplateDir, backendDir, { recursive: true });
    const npmSafeGitignore = path.join(backendDir, "gitignore");
    if (existsSync(npmSafeGitignore)) {
      renameSync(npmSafeGitignore, path.join(backendDir, ".gitignore"));
    }

    // Read .env.example
    const envExamplePath = path.join(backendDir, ".env.example");
    const envPath = path.join(backendDir, ".env");

    if (existsSync(envExamplePath)) {
      const envContent = readFileSync(envExamplePath, "utf-8");

      // Replace environment variables
      const updatedEnvContent = envContent
        .replace(
          /OPENFORT_SECRET_KEY=.*/g,
          `OPENFORT_SECRET_KEY=${openfortSecretKey}`,
        )
        .replace(
          /SHIELD_SECRET_KEY=.*/g,
          `SHIELD_SECRET_KEY=${shieldSecretKey}`,
        )
        .replace(
          /SHIELD_PUBLISHABLE_KEY=.*/g,
          `SHIELD_PUBLISHABLE_KEY=${shieldPublishableKey}`,
        )
        .replace(
          /SHIELD_ENCRYPTION_KEY=.*/g,
          `SHIELD_ENCRYPTION_KEY=${shieldEncryptionShare}`,
        )
        .replace(/PORT=.*/g, `PORT=${port}`);

      writeFileSync(envPath, updatedEnvContent);
    }

    await new Promise((resolve) => setTimeout(resolve, 250)); // UX

    spinner.succeed("Backend created successfully!");
  } catch (error) {
    spinner.fail("Failed to create backend");
    logger.error(error instanceof Error ? error.message : String(error));
    throw error;
  }
};
