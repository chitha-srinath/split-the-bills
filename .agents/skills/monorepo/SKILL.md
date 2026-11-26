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
bill-splitter/
├── apps/
│   ├── web/                   # @bill-splitter/web
│   │   ├── src/
│   │   │   ├── routes/        # TanStack Router file-based routes
│   │   │   ├── main.tsx       # App entry point
│   │   │   └── index.css      # Global styles & design tokens
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── api/                   # @bill-splitter/api
│       ├── src/
│       │   ├── routes/        # Fastify route modules
│       │   └── server.ts      # Server entry point
│       └── package.json
├── packages/
│   └── shared/                # @bill-splitter/shared
│       └── src/
│           ├── types.ts       # Shared TypeScript interfaces
│           ├── constants.ts   # Shared constants
│           ├── utils.ts       # Shared utility functions
│           └── index.ts       # Barrel export
├── .agents/                   # Agent skills & rules
│   └── skills/
├── package.json               # Root workspace config
├── pnpm-workspace.yaml        # Workspace definition
├── tsconfig.base.json         # Shared TS config
├── oxlint.config.ts           # Linter config
└── .oxfmtrc.json              # Formatter config
```

## Workspace Packages

| Package                    | Path              | Description                                  |
| -------------------------- | ----------------- | -------------------------------------------- |
| `@bill-splitter/web`       | `apps/web`        | Vite 8 + React 19.3 + TanStack Router 1.170 |
| `@bill-splitter/api`       | `apps/api`        | Fastify 5.12 API server                     |
| `@bill-splitter/shared`    | `packages/shared` | Shared types, constants, utils               |

## Key Commands

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm install`   | Install all workspace dependencies   |
| `pnpm dev`       | Start web & api in parallel          |
| `pnpm dev:web`   | Start only the web app               |
| `pnpm dev:api`   | Start only the API server            |
| `pnpm build`     | Build all packages                   |
| `pnpm lint`      | Lint with oxlint                     |
| `pnpm fmt`       | Format with oxfmt                    |
| `pnpm typecheck` | Type-check all packages              |

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
    "@bill-splitter/shared": "workspace:*"
  }
  ```
- Import directly from the package name:
  ```ts
  import type { Bill } from "@bill-splitter/shared";
  import { formatCurrency } from "@bill-splitter/shared";
  ```

## Tooling

- **Linter:** oxlint — config at [`oxlint.config.ts`](file:///c:/sai/code%20practice/AI/Bill-splitter/oxlint.config.ts)
- **Formatter:** oxfmt — config at [`.oxfmtrc.json`](file:///c:/sai/code%20practice/AI/Bill-splitter/.oxfmtrc.json)
- **TypeScript:** Shared base config at [`tsconfig.base.json`](file:///c:/sai/code%20practice/AI/Bill-splitter/tsconfig.base.json)

## Validation Steps

After structural changes:

1. `pnpm install` — ensure dependencies resolve.
2. `pnpm typecheck` — verify all packages compile.
3. `pnpm build` — confirm production builds succeed.
