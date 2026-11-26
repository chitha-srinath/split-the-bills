import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    "dist",
    "node_modules",
    "build",
    "*.gen.ts",
    "routeTree.gen.ts",
  ],

  rules: {
    // TypeScript
    "typescript/no-explicit-any": "warn",
    "typescript/no-unused-vars": "warn",

    // General
    "no-console": "warn",
    "no-debugger": "error",
    "no-duplicate-imports": "error",

    // React
    "react/jsx-no-duplicate-props": "error",
    "react/no-unknown-property": "error",
  },
});
