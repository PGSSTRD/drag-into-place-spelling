import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  publicDir: "content",
  build: {
    sourcemap: false,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
