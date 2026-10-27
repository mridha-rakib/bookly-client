import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Isolated component tests must not load operational application .env files.
  envDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
