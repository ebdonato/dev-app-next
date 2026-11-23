import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests cover backend modules only (schemas, repository, router), so a Node
// environment is enough. The "@" alias mirrors the tsconfig `@/*` path.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
