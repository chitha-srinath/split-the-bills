---
name: backend
description: >-
  Use this skill when building, modifying, or debugging the Fastify backend API
  for the Bill Splitter application. Covers route creation, request validation,
  error handling, and server configuration. The backend lives at apps/api/.
---

# Backend Skill — Bill Splitter

Guidelines for developing the Fastify REST API backend.

## Project Context

- **Framework:** Fastify 5.12 with TypeScript 7
- **Runtime:** Node.js (ESM)
- **Dev Runner:** tsx (watch mode)
- **Backend Path:** `apps/api/`
- **Entry Point:** `apps/api/src/server.ts`
- **Routes Directory:** `apps/api/src/routes/`
- **Shared Types:** `@bill-splitter/shared` workspace package
- **Default Port:** 3000

## Route Conventions

- Each route module exports an async function that receives a `FastifyInstance`.
- Group related endpoints into a single route file (e.g., `bills.ts`).
- Register routes with a prefix in `server.ts`:
  ```ts
  app.register(billsRoute, { prefix: "/api" });
  ```
- Use Fastify generics for typed request params/body:
  ```ts
  app.get<{ Params: { id: string } }>("/bills/:id", async (request, reply) => {
    // request.params.id is typed
  });
  ```

## Adding a New Route

1. Create a file in `apps/api/src/routes/` (e.g., `groups.ts`).
2. Export an async plugin function:
   ```ts
   import type { FastifyInstance } from "fastify";

   export async function groupsRoute(app: FastifyInstance) {
     app.get("/groups", async () => { /* ... */ });
   }
   ```
3. Register it in `apps/api/src/server.ts`:
   ```ts
   import { groupsRoute } from "./routes/groups.js";
   app.register(groupsRoute, { prefix: "/api" });
   ```

## Error Handling

- Use `reply.status(4xx).send({ error: "message" })` for client errors.
- Let Fastify handle 500s via its built-in error handler.
- Always validate required fields before processing.

## Import Shared Types

```ts
import type { Bill, CreateBillInput } from "@bill-splitter/shared";
```

## Development Commands

```bash
pnpm dev:api          # Start with hot reload (tsx watch)
pnpm build:api        # Compile TypeScript
```

## Validation Steps

After backend changes:

1. `pnpm dev:api` — confirm server starts without errors.
2. Test the endpoint with curl or the frontend proxy.
3. `pnpm --filter @bill-splitter/api typecheck` — verify types.
