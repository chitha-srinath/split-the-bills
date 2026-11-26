---
name: ui
description: >-
  Use this skill when building, designing, or modifying user interface components
  for the Bill Splitter application. Covers layout, styling, accessibility,
  responsiveness, component structure, theming, and UI best practices.
  The frontend lives at apps/web/ and uses Vite + React + TanStack Router.
---

# UI Skill — Bill Splitter

Guidelines and procedures for building the user interface of the Bill Splitter app.

## Project Context

- **Framework:** React 19.3 with TypeScript 7
- **Build Tool:** Vite 8 (Rolldown-based)
- **Routing:** TanStack Router 1.170+ (file-based routing)
- **Frontend Path:** `apps/web/`
- **Routes Directory:** `apps/web/src/routes/`
- **Shared Types:** `@bill-splitter/shared` workspace package

## TanStack Router Conventions

- Route files live in `apps/web/src/routes/`.
- The root layout is `__root.tsx`.
- Index routes use `index.tsx` inside the route directory.
- The router plugin auto-generates `src/routeTree.gen.ts` — **never edit this file manually**.
- Always import `createFileRoute` for file-based routes:
  ```tsx
  import { createFileRoute } from "@tanstack/react-router";

  export const Route = createFileRoute("/my-route")({
    component: MyRouteComponent,
  });
  ```

## Design Principles

1. **Clean & Minimal** — Keep the interface uncluttered. Each screen should serve
   a single purpose (add bill, split summary, settlement view).
2. **Mobile-First** — Design for small screens first, then scale up. Use
   responsive units (`rem`, `%`, `vw/vh`) and CSS Grid / Flexbox.
3. **Accessible** — All interactive elements must be keyboard-navigable, have
   visible focus indicators, and use semantic HTML (`<button>`, `<label>`,
   `<fieldset>`). Maintain a minimum contrast ratio of 4.5:1.
4. **Consistent** — Reuse design tokens defined in `apps/web/src/index.css`.

## Component Guidelines

### Structure
- Keep components small and single-responsibility.
- Separate presentational (UI-only) components from container (data-fetching /
  state-managing) components.
- Co-locate styles with their component.

### Naming
- Use PascalCase for component file names (`BillCard.tsx`, `SplitSummary.tsx`).
- Use kebab-case for CSS class names and design tokens (`--color-primary`,
  `.bill-card`).

### Forms & Inputs
- Always pair `<input>` with a `<label>`.
- Show inline validation messages next to the relevant field.
- Use `inputmode="decimal"` for currency fields.

## Design Tokens

Tokens are defined in [`apps/web/src/index.css`](file:///c:/sai/code%20practice/AI/Bill-splitter/apps/web/src/index.css):

| Token                   | Value       |
| ----------------------- | ----------- |
| `--color-primary`       | `#4f46e5`   |
| `--color-primary-hover` | `#4338ca`   |
| `--color-surface`       | `#ffffff`   |
| `--color-background`    | `#f9fafb`   |
| `--color-text`          | `#111827`   |
| `--color-text-muted`    | `#6b7280`   |
| `--color-error`         | `#dc2626`   |
| `--color-success`       | `#16a34a`   |

## Responsive Breakpoints

| Name | Min Width | Typical Device |
| ---- | --------- | -------------- |
| `sm` | 640px     | Large phone    |
| `md` | 768px     | Tablet         |
| `lg` | 1024px    | Small laptop   |
| `xl` | 1280px    | Desktop        |

## Accessibility Checklist

- [ ] All images have meaningful `alt` text (or `alt=""` for decorative).
- [ ] Color is never the sole indicator of state — pair with icons or text.
- [ ] Interactive elements have `:focus-visible` styles.
- [ ] Currency amounts are announced correctly by screen readers.
- [ ] Touch targets are at least 44 × 44 px.

## Validation Steps

After making UI changes:

1. `pnpm dev:web` — verify the component renders correctly.
2. Check responsive behavior at `sm`, `md`, and `lg` breakpoints.
3. Tab through all interactive elements; confirm focus order is logical.
