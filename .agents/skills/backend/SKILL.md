---
name: backend
description: >-
  Use this skill when building, modifying, or debugging the Fastify backend API
  for the Bill Splitter application. Covers route creation, request validation,
  Zod compilation, error handling, guard clauses, and server configuration.
  The backend lives at apps/api/.
---

# Backend Skill — Bill Splitter

Guidelines and architecture patterns for developing the Fastify REST API backend.

## Project Context

- **Framework:** Fastify 5.12 with TypeScript 7
- **Runtime:** Node.js (ESM)
- **Dev Runner:** tsx (watch mode)
- **Backend Path:** `apps/api/`
- **Entry Point:** `apps/api/src/server.ts`
- **Config & Env:** `apps/api/src/config.ts` (validated with Zod)
- **Routes Directory:** `apps/api/src/routes/`
- **Shared Types:** `@bill-splitter/core` workspace package
- **Default Port:** 3000

---

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

---

## Error Handling & Guard Clauses: Fail-Fast Pattern

Always write flat, readable route handlers by returning or throwing early on invalid conditions rather than nesting `if/else` ladders (Pyramid of Doom).

- **Fail fast:** Check error conditions, missing parameters, unauthorized states, and validation errors at the very top of the function.
- **Avoid the Pyramid of Doom:** Do not wrap the happy path inside nested `if` statements. Keep the happy path flat, unindented, and at the end of the handler.
- **Read top to bottom:** Each guard clause eliminates an invalid state so subsequent code can safely assume valid preconditions.

```ts
// ✅ Fail fast. Read top to bottom. Happy path is flat with no nesting.
app.get<{ Params: { id: string } }>("/bills/:id", async (request, reply) => {
  if (!isValidObjectId(request.params.id)) {
    return reply.status(404).send({ error: "Bill not found" });
  }

  const document = await BillModel.findOne({
    _id: request.params.id,
    userId: request.userId,
  }).lean();

  if (!document) {
    return reply.status(404).send({ error: "Bill not found" });
  }

  return toBill(document);
});
```

---

## Zod Schema Patterns & Performance

### 1. High-Throughput Schema Compilation (`z.compile`)

For hot-path request schemas or frequently called validations, compile the Zod schema with `z.compile()` for up to ~9x faster validation performance:

```ts
import * as z from "zod";

export const billInputSchema = z.object({
  title: z.string().trim().min(1),
  totalAmount: z.number().positive(),
  participants: z.array(z.string()).min(1),
});

// Compile for fast repeated execution in request handlers
export const compiledBillInputSchema = z.compile ? z.compile(billInputSchema) : billInputSchema;
```

### 2. Schema Metadata & Standardized Error IDs

Attach identifier metadata using `.meta({ id: "..." })` to allow global error formatters to produce branded, traceable error messages:

```ts
import * as z from "zod";

export const EmailSchema = z.string().email().meta({ id: "Email" });
export const BillSchema = z
  .object({
    title: z.string().min(1),
    email: EmailSchema,
  })
  .meta({ id: "Bill" });
```

### 3. Non-Empty String & Invariant Types

Combine compile-time template literal types with runtime Zod refinements:

```ts
export type NonEmptyString = `${string & {}}${string}`;

export const nonEmptyStringSchema = z
  .string()
  .refine((s): s is NonEmptyString => s.length > 0, "String must contain at least one character");
```

---

## Modern Stream Handling

When streaming responses or consuming upstream HTTP streams, always use `for await` on `ReadableStream` instead of manual reader loops:

```ts
// ✅ Native async iteration on body streams
for await (const chunk of response.body) {
  reply.raw.write(chunk);
}
reply.raw.end();
```

---

## Import Shared Types

```ts
import type { Bill, CreateBillInput } from "@bill-splitter/core";
```

## Development Commands

```bash
pnpm dev:api          # Start with hot reload (tsx watch)
pnpm build:api        # Compile TypeScript
```

## Validation Steps

After backend changes:

1. `pnpm dev:api` — confirm server starts without errors.
2. `pnpm --filter @bill-splitter/api typecheck` — verify types.
3. `pnpm lint` — verify zero lint errors.
