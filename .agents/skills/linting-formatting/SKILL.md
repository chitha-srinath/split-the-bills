---
name: linting-formatting
description: >-
  Use this skill when configuring, running, or troubleshooting the linter (oxlint)
  or formatter (oxfmt) for the Bill Splitter project. Covers rule configuration,
  ignore patterns, and CI integration.
---

# Linting & Formatting Skill — Bill Splitter

Guidelines for using oxlint and oxfmt in the project.

## Tools

| Tool     | Purpose    | Config File        | Command          |
| -------- | ---------- | ------------------ | ---------------- |
| oxlint   | Linter     | `oxlint.config.ts` | `pnpm lint`      |
| oxfmt    | Formatter  | `.oxfmtrc.json`    | `pnpm fmt`       |

## Running

```bash
# Lint
pnpm lint          # Check for issues
pnpm lint:fix      # Auto-fix what can be fixed

# Format
pnpm fmt           # Format all files
pnpm fmt:check     # Check formatting without writing
```

## oxlint Configuration

Config file: [`oxlint.config.ts`](file:///c:/sai/code%20practice/AI/Bill-splitter/oxlint.config.ts)

### Current Rules

| Rule                              | Level   |
| --------------------------------- | ------- |
| `typescript/no-explicit-any`      | `warn`  |
| `typescript/no-unused-vars`       | `warn`  |
| `no-console`                      | `warn`  |
| `no-debugger`                     | `error` |
| `no-duplicate-imports`            | `error` |
| `react/jsx-no-duplicate-props`    | `error` |
| `react/no-unknown-property`       | `error` |

### Ignored Patterns

- `dist`, `node_modules`, `build`, `*.gen.ts`, `routeTree.gen.ts`

### Adding a Rule

Edit `oxlint.config.ts` and add to the `rules` object:
```ts
rules: {
  "rule-category/rule-name": "warn" | "error" | "off",
}
```

## oxfmt Configuration

Config file: [`.oxfmtrc.json`](file:///c:/sai/code%20practice/AI/Bill-splitter/.oxfmtrc.json)

### Current Settings

| Setting        | Value  |
| -------------- | ------ |
| `semi`         | `true` |
| `singleQuote`  | `false`|
| `tabWidth`     | `2`    |
| `trailingComma`| `"all"`|
| `printWidth`   | `100`  |

## Editor Integration

VS Code extension recommended: `oxc.oxc-vscode` (configured in `.vscode/extensions.json`).

Format-on-save is enabled in `.vscode/settings.json`.
