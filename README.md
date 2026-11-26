# Bill Splitter

A monorepo application for splitting bills among friends and groups.

## Tech Stack

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Web        | Vite + React + TanStack Router    |
| API        | Fastify + TypeScript              |
| Shared     | Shared types & utilities package  |
| Linter     | oxlint                            |
| Formatter  | oxfmt                             |
| Package Mgr | pnpm (workspaces)                |

## Project Structure

```
bill-splitter/
├── apps/
│   ├── web/               # Vite + React + TanStack Router
│   └── api/               # Fastify API server
├── packages/
│   └── shared/            # Shared types, constants, utilities
├── package.json           # Root workspace config
├── pnpm-workspace.yaml    # pnpm workspace definition
├── tsconfig.base.json     # Shared TypeScript config
├── oxlint.config.ts       # Linter config
└── .oxfmtrc.json          # Formatter config
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10

### Install

```bash
pnpm install
```

### Development

```bash
# Start both web and api in parallel
pnpm dev

# Start only the web app
pnpm dev:web

# Start only the API server
pnpm dev:api
```

### Build

```bash
pnpm build
```

### Lint & Format

```bash
# Lint
pnpm lint
pnpm lint:fix

# Format
pnpm fmt
pnpm fmt:check
```

## Packages

### `@bill-splitter/web`
React SPA powered by Vite and TanStack Router for file-based routing.

### `@bill-splitter/api`
Fastify REST API server with TypeScript.

### `@bill-splitter/shared`
Shared TypeScript types, constants, and utility functions used by both apps.
