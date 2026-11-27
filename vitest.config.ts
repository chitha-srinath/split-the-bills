import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary", "html"],
      include: [
        "packages/core/src/**/*.{ts,tsx}",
        "packages/shared/src/**/*.{ts,tsx}",
        "apps/api/src/**/*.ts",
        "apps/web/src/**/*.{ts,tsx}",
        "packages/ui/src/components/{adaptive-sheet,button,dialog,sheet,toast}.tsx",
      ],
      exclude: [
        "**/*.d.ts",
        "**/routeTree.gen.ts",
        "**/test/**",
        "**/__tests__/**",
        "apps/web/src/main.tsx",
        "apps/web/src/vite-env.d.ts",
        "apps/api/src/server.ts",
      ],
    },
    projects: [
      {
        name: "shared",
        test: {
          name: "shared",
          environment: "node",
          include: [
            "packages/core/test/**/*.{test,spec}.ts",
            "packages/shared/test/**/*.{test,spec}.ts",
            "tests/**/*.{test,spec}.ts",
          ],
        },
      },
      {
        name: "api",
        test: {
          name: "api",
          environment: "node",
          include: ["apps/api/test/**/*.{test,spec}.ts"],
        },
      },
      {
        name: "web",
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "./apps/web/src"),
          },
        },
        test: {
          name: "web",
          environment: "jsdom",
          setupFiles: ["./apps/web/src/test/setup.ts"],
          include: [
            "apps/web/src/**/*.{test,spec}.{ts,tsx}",
            "packages/ui/test/**/*.{test,spec}.{ts,tsx}",
          ],
        },
      },
    ],
  },
});
