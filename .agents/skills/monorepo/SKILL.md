---
name: monorepo
description: >-
  Use this skill when managing the monorepo structure, adding new packages or apps,
  configuring workspaces, or resolving dependency issues in the Bill Splitter project.
  Covers pnpm workspaces, shared packages, and cross-package imports.
---

# Monorepo Skill — Bill Splitter

Guidelines for managing the pnpm workspace monorepo.

## Project Structure

```
repo/
|-- apps/                          # Independently deployable applications
|   |-- web/                       # @bill-splitter/web (Vite + React + TanStack Router)
|   |   |-- src/
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   |-- turbo.json             # App-specific pipeline overrides
|   |   `-- .env.example           # Frontend environment template
|   `-- api/                       # @bill-splitter/api (Fastify 5.12 API server)
|       |-- src/
|       |-- test/                  # API test suites
|       |-- package.json
|       |-- tsconfig.json
|       `-- .env.example           # Backend environment template
|-- packages/                      # Shared code with explicit public exports
|   |-- core/                      # @bill-splitter/core (Shared types, schemas, utils)
|   |   |-- src/
|   |   |   `-- index.ts           # Barrel exports
|   |   |-- package.json
|   |   `-- tsconfig.json
|   `-- ui/                        # @bill-splitter/ui (Shared UI components)
|       |-- src/
|       |-- package.json
|       `-- tsconfig.json
|-- .github/
|   `-- workflows/
|       `-- ci.yml                 # GitHub Actions CI workflow
|-- .gitignore
|-- oxlint.config.ts               # Linter config
|-- .oxfmtrc.json                  # Formatter config
|-- package.json                   # Root workspace config
|-- pnpm-workspace.yaml            # Workspace definition
|-- tsconfig.base.json             # Shared TS config
|-- turbo.json                     # Task graph and cache defaults
`-- README.md
```

## Workspace Packages

| Package               | Path            | Description                                 |
| --------------------- | --------------- | ------------------------------------------- |
| `@bill-splitter/web`  | `apps/web`      | Vite 8 + React 19.3 + TanStack Router 1.170 |
| `@bill-splitter/api`  | `apps/api`      | Fastify 5.12 API server                     |
| `@bill-splitter/core` | `packages/core` | Shared types, Zod schemas, constants, utils |
| `@bill-splitter/ui`   | `packages/ui`   | Reusable UI components & design system      |

## Key Commands

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `pnpm install`   | Install all workspace dependencies |
| `pnpm dev`       | Start web & api in parallel        |
| `pnpm dev:web`   | Start only the web app             |
| `pnpm dev:api`   | Start only the API server          |
| `pnpm build`     | Build all packages and apps        |
| `pnpm lint`      | Lint with oxlint                   |
| `pnpm fmt`       | Format with oxfmt                  |
| `pnpm typecheck` | Type-check all packages            |

## Adding a New Package

1. Create the directory under `apps/` or `packages/`.
2. Add a `package.json` with name `@bill-splitter/<name>`.
3. The workspace is auto-discovered via `pnpm-workspace.yaml` globs:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
4. Run `pnpm install` to link it.

## Cross-Package Imports

- Use `workspace:*` protocol in `package.json` dependencies:
  ```json
  "dependencies": {
    "@bill-splitter/core": "workspace:*",
    "@bill-splitter/ui": "workspace:*"
  }
  ```
- Import directly from the package name:
  ```ts
  import type { Bill } from "@bill-splitter/core";
  import { formatCurrency } from "@bill-splitter/core";
  ```

## Tooling

- **Task Orchestrator:** Turborepo — config at [`turbo.json`](file:///c:/sai/code%20practice/AI/Bill-splitter/turbo.json)
- **Linter:** oxlint — config at [`oxlint.config.ts`](file:///c:/sai/code%20practice/AI/Bill-splitter/oxlint.config.ts)
- **Formatter:** oxfmt — config at [`.oxfmtrc.json`](file:///c:/sai/code%20practice/AI/Bill-splitter/.oxfmtrc.json)
- **TypeScript:** Shared base config at [`tsconfig.base.json`](file:///c:/sai/code%20practice/AI/Bill-splitter/tsconfig.base.json)

## Validation Steps

After structural changes:

1. `pnpm install` — ensure dependencies resolve.
2. `pnpm typecheck` — verify all packages compile.
3. `pnpm build` — confirm production builds succeed.
