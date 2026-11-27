# Bill Splitter

A monorepo application for splitting bills among friends and groups.

## Tech Stack

| Layer       | Technology                       |
| ----------- | -------------------------------- |
| Web         | Vite + React + TanStack Router   |
| API         | Fastify + TypeScript + Mongoose  |
| Database    | MongoDB                          |
| Shared      | Shared types & utilities package |
| Linter      | oxlint                           |
| Formatter   | oxfmt                            |
| Package Mgr | pnpm (workspaces)                |

## Project Structure

```
bill-splitter/
├── apps/
│   ├── web/               # Vite + React + TanStack Router
│   └── api/               # Fastify API server
├── packages/
│   └── core/              # Shared types, constants, utilities
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
- [MongoDB](https://www.mongodb.com/) (local or Atlas)

### Install

```bash
pnpm install
```

Copy `.env.example` to `.env` and set `MONGODB_URI` for your MongoDB instance.
Set `BETTER_AUTH_SECRET` to a securely generated value of at least 32 characters.
For Google sign-in, create a Web OAuth client and set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`. Register `http://localhost:3000/api/auth/callback/google`
as an authorized redirect URI for local development.

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

### `@bill-splitter/core`

Shared TypeScript types, constants, and utility functions used by both apps.
