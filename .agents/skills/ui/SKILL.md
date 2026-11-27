---
name: ui
description: >-
  Use this skill when building, designing, or modifying user interface components
  for the Bill Splitter application. Covers layout, styling, React 19 compiler,
  TanStack Query skipToken, Intl formatting factory, guard clauses, and UI best practices.
  The frontend lives at apps/web/ and uses Vite + React + TanStack Router.
---

# UI Skill — Bill Splitter

Guidelines and architecture patterns for building the user interface of the Bill Splitter app.

## Project Context

- **Framework:** React 19.3 with TypeScript 7
- **Build Tool:** Vite 8 (Rolldown-based)
- **React Compiler:** `@vitejs/plugin-react` with `compiler: true`
- **Routing:** TanStack Router 1.170+ (file-based routing)
- **Frontend Path:** `apps/web/`
- **Routes Directory:** `apps/web/src/routes/`
- **Shared Types:** `@bill-splitter/core` workspace package
- **Shared Components:** `@bill-splitter/ui` workspace package

---

## 1. Vite & React 19 Compiler Integration

To eliminate manual `useMemo` and `useCallback` boilerplate, the project uses the React 19 compiler in Vite:

```ts
// apps/web/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({ compiler: true }), // Enables React 19 compiler
  ],
});
```

---

## 2. TanStack Query: Use `skipToken` for Conditional Queries

**Never use `enabled: !!param` for required query keys.** `enabled: !!param` fails to narrow the parameter type inside `queryFn` and still permits manual `refetch()` invocations.

Use `skipToken` instead, which acts as a type-safe contract:

```ts
import { useQuery, skipToken } from "@tanstack/react-query";

// ❌ ANTI-PATTERN: Looks protected, isn't (userId remains string | undefined)
const queryBad = useQuery({
  queryKey: ["user", userId],
  queryFn: () => fetchUser(userId), // userId is not narrowed!
  enabled: !!userId,
});

// ✅ RECOMMENDED: skipToken provides compile-time type narrowing
const queryGood = useQuery({
  queryKey: ["user", userId],
  queryFn: userId ? () => fetchUser(userId) : skipToken,
  // userId is guaranteed 'string' inside fetchUser
  // query cannot accidentally be executed manually when skipped
});
```

---

## 3. Native `Intl` Formatter Factory

Avoid external formatting libraries. Use the native `Intl` API factory pattern for locale-aware numbers, dates, lists, durations, and currencies:

```ts
export const createLocaleFormatter = (locale = "en-IN") => {
  const currency = (cur: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: cur });

  const compact = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const list = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  });

  const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const duration = new Intl.DurationFormat(locale, { style: "short" });

  return {
    formatCurrency: (n: number, cur = "INR") => currency(cur).format(n),
    formatCompact: (n: number) => compact.format(n),
    formatDate: (d: Date | string | number) => date.format(new Date(d)),
    formatList: (items: string[]) => list.format(items),
    formatRelativeTime: (n: number, unit: Intl.RelativeTimeFormatUnit) =>
      relativeTime.format(n, unit),
    formatDuration: (d: Record<string, number>) => duration.format(d),
  };
};

export const formatters = createLocaleFormatter("en-IN");
```

---

## 4. Control Flow: Guard Clauses & Fail-Fast (Avoid Pyramid of Doom)

- **Early returns for view states:** Return early for `sessionPending`, `!session`, empty lists, or errors instead of nesting ternary operators inside JSX.
- **Fail fast in event handlers:** Check preconditions, validation, and API errors immediately at the top of handlers (`if (result.error) { setError(...); return; }`).
- **Flat structure:** Keep the primary component render tree flat and unnested.

---

## 5. Streaming UI Responses

When consuming backend response streams (e.g. AI bill scanning or real-time event updates), use native async iteration:

```ts
const response = await fetch("/api/stream", { method: "POST" });
if (!response.ok || !response.body) {
  throw new Error("Failed to start stream");
}

for await (const chunk of response.body) {
  handleStreamChunk(chunk);
}
```

---

## Development Commands

```bash
pnpm dev:web          # Start Vite dev server
pnpm build:web        # Build for production (tsc -b && vite build)
pnpm --filter @bill-splitter/web typecheck # Type check
```
