import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  // The sources address themselves through the `~/*` path mapping declared in
  // `tsconfig.json`; vitest needs the same mapping to resolve them.
  resolve: {
    alias: { "~": src },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
