---
name: architecture
description: >-
  Use this skill when designing, reviewing, or modifying the system architecture,
  monorepo layout, module boundaries, package relationships, or control-flow patterns
  (e.g., guard clauses, type-satisfaction, strategy pattern) in the Bill Splitter application.
---

# Architecture Skill — Bill Splitter

System architecture, monorepo layout, and engineering design patterns for the Bill Splitter application.

## 1. Monorepo Architecture Layout

```
repo/
|-- apps/                          # Independently deployable applications
|   |-- web/                       # Frontend application (Vite + React + TanStack Router)
|   |   |-- src/
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   |-- turbo.json             # App-specific outputs and pipeline overrides
|   |   `-- .env.example           # App-specific frontend environment variables
|   `-- api/                       # Backend REST API (Fastify + BetterAuth + MongoDB)
|       |-- src/
|       |-- test/                  # API test suites
|       |-- package.json
|       |-- tsconfig.json
|       `-- .env.example           # App-specific backend environment variables
|-- packages/                      # Shared code with explicit public exports
|   |-- core/                      # Shared business domain logic, schemas, and types
|   |   |-- src/
|   |   |   `-- index.ts           # Explicit barrel export
|   |   |-- package.json           # @bill-splitter/core
|   |   `-- tsconfig.json
|   `-- ui/                        # Reusable UI component library & design tokens
|       |-- src/
|       |-- package.json           # @bill-splitter/ui
|       `-- tsconfig.json
|-- .github/
|   `-- workflows/
|       `-- ci.yml                 # Automated CI quality and build pipeline
|-- .gitignore
|-- oxlint.config.ts / .oxfmtrc.json # Fast Rust-based linter and formatter
|-- package.json                   # Tool pins, workspace globs, root scripts
|-- tsconfig.base.json             # Shared compiler rules
|-- turbo.json                     # Task graph and cache defaults
`-- README.md
```

## 2. Layering & Module Boundaries

- **`apps/web`**: Single Page Application for user interaction. Consumes `@bill-splitter/core` for domain types and `@bill-splitter/ui` for components. Communicates with `apps/api` via HTTP/JSON.
- **`apps/api`**: REST API microservice. Owns database connections, authentication sessions, and business transactions. Consumes `@bill-splitter/core` for input schemas and types.
- **`packages/core` (`@bill-splitter/core`)**: Zero framework dependencies. Contains Zod validation schemas, pure TypeScript interfaces, constants, and math/formatting utilities.
- **`packages/ui` (`@bill-splitter/ui`)**: Headless and styled UI component primitives, icons, and theme tokens.

### Rules of Dependency

1. Apps may import packages (`@bill-splitter/core`, `@bill-splitter/ui`).
2. Packages may **never** import apps.
3. Cross-package dependencies use `workspace:*` in `package.json`.
4. Shared code must have explicit public exports defined in `src/index.ts` and `package.json#exports`.

---

## 3. Core Architectural Patterns

### Pattern A: Type Safety — Prefer `satisfies` Over `as`

Avoid type assertions (`as Type`) because they suppress type checking and widen literal types to `unknown` or broad primitives. Use `satisfies` to validate types while keeping exact literal values intact.

```ts
type Colors = "red" | "green";

// ❌ BEFORE — USING AS (unsafe, hides errors, loses literal types)
const favoriteColorsBad = {
  red: "yes",
  green: false,
  platypus: false, // No error caught! "platypus" is invalid.
} as Record<Colors, unknown>; // favoriteColorsBad.red is typed as unknown

// ✅ AFTER — USING SATISFIES (safe, catches invalid keys, preserves literals)
const favoriteColorsGood = {
  red: "yes",
  green: false,
  // "platypus": false, // ❌ Compile error: "platypus" was never listed in 'Colors'
} satisfies Record<Colors, unknown>;
// favoriteColorsGood.red -> "yes"
// favoriteColorsGood.green -> false
```

---

### Pattern B: Control Flow — Guard Clauses & Fail Fast (Avoid Pyramid of Doom)

Always write flat, readable functions by validating preconditions and returning or throwing early rather than nesting `if/else` ladders.

```ts
// ❌ Anti-pattern: Nested if/else (Pyramid of doom)
function processOrder(order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.isPaid) {
        return ship(order);
      } else {
        throw new Error("Not paid");
      }
    } else {
      throw new Error("No items");
    }
  } else {
    throw new Error("No order");
  }
}

// ✅ Recommended: Guard clauses (Flat & readable, fail fast)
function processOrder(order) {
  if (!order) {
    throw new Error("No order");
  }
  if (order.items.length === 0) {
    throw new Error("No items");
  }
  if (!order.isPaid) {
    throw new Error("Not paid");
  }

  // Happy path — flat, no nesting
  return ship(order);
}
```

---

### Pattern C: Strategy Pattern for Extensible Business Rules

Replace large `switch` statements or conditional chains with the Strategy Pattern using an abstract base strategy and private collection registry (`#strategies = new Map()`).

```ts
abstract class SplitStrategy {
  abstract calculate(totalAmount: number, participants: string[]): Record<string, number>;
}

class EqualSplitStrategy extends SplitStrategy {
  calculate(totalAmount: number, participants: string[]) {
    const split = totalAmount / participants.length;
    return Object.fromEntries(participants.map((p) => [p, split]));
  }
}

class SplitEngine {
  readonly #strategies = new Map<string, SplitStrategy>();

  constructor() {
    this.register("equal", new EqualSplitStrategy());
    Object.freeze(this);
  }

  calculate(type: string, amount: number, participants: string[]) {
    if (amount <= 0 || !Number.isFinite(amount)) {
      throw new Error("Amount must be a non-negative finite number");
    }
    const strategy = this.#strategies.get(type);
    if (!strategy) {
      throw new Error(`Invalid split strategy: ${type}`);
    }
    return strategy.calculate(amount, participants);
  }

  register(type: string, strategy: SplitStrategy): this {
    if (!(strategy instanceof SplitStrategy)) {
      throw new Error("Strategy must extend SplitStrategy class");
    }
    if (this.#strategies.has(type)) {
      throw new Error(`Cannot override existing strategy type: ${type}`);
    }
    this.#strategies.set(type, strategy);
    return this;
  }
}
```

---

### Pattern D: Environment Configuration with Discriminated Conditional Types

Enforce production-only and environment-specific requirements at compile-time using TypeScript conditional types.

```ts
type Environment = "development" | "staging" | "production";

type AppConfig<T extends Environment> = {
  apiUrl: string;
  logLevel: "debug" | "info" | "error";
} & (T extends "production"
  ? { ssl: true; redisUrl: string } // Required in production
  : { ssl?: boolean; mockApi?: boolean }); // Optional in dev/staging

function createConfig<T extends Environment>(env: T, config: AppConfig<T>): AppConfig<T> {
  return config;
}

// Development allows mockApi
export const devConfig = createConfig("development", {
  apiUrl: "http://localhost:3000",
  logLevel: "debug",
  mockApi: true,
});

// Production forbids mockApi and enforces ssl + redisUrl
export const prodConfig = createConfig("production", {
  apiUrl: "https://api.domain.com",
  logLevel: "error",
  ssl: true,
  redisUrl: "redis://prod-cluster",
  // mockApi: true, // ❌ Compile error: not allowed in production
});
```

---

### Pattern E: Type-Level Non-Empty Strings & Refinement Types

Enforce non-empty string and numeric constraints at both compile time and runtime.

```ts
// Compile-time non-empty string:
export type NonEmptyString = `${string & {}}${string}`;

// Zod runtime refinement with type predicate:
export const NonEmptyStringSchema = z
  .string()
  .refine((s): s is NonEmptyString => s.length > 0, "String must contain at least one character");

// Mathematical invariants:
export type PositiveNumber = number & { readonly __brand: "Positive" };
export function toPositiveNumber(n: number): PositiveNumber {
  if (n <= 0 || !Number.isFinite(n)) {
    throw new Error("Number must be strictly positive");
  }
  return n as PositiveNumber;
}
```

---

### Pattern F: Collection Cache Optimization (`getOrInsert`)

Avoid duplicate map lookups (`has` followed by `set` and `get`) with atomic check-and-insert helpers:

```ts
export function getOrInsert<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
  if (!map.has(key)) {
    map.set(key, defaultValue);
  }
  return map.get(key)!;
}

export function getOrInsertComputed<K, V>(map: Map<K, V>, key: K, compute: () => V): V {
  if (!map.has(key)) {
    map.set(key, compute());
  }
  return map.get(key)!;
}
```

---

### Pattern G: Modern Stream Consumption

Always consume `ReadableStream` instances via native `for await` loops instead of manual `getReader()` while-loops:

```ts
// ❌ BEFORE (verbose, manual reader management)
const reader = res.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  use(value);
}

// ✅ NOW (clean, native async iteration)
for await (const chunk of res.body) {
  use(chunk);
}
```

---

## 4. Verification Commands

```bash
pnpm lint        # Run fast oxlint across all workspaces
pnpm fmt         # Format with oxfmt
pnpm typecheck   # Typecheck all packages and apps with tsc
pnpm build       # Build all apps and packages via Turborepo
```
