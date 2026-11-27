import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

describe("ST-003 Turborepo Pipeline & Cache Verification", () => {
  const rootDir = path.resolve(import.meta.dirname, "..");

  it("1. root package.json delegates all primary lifecycle tasks to turbo run", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
    const scripts = pkg.scripts || {};

    expect(scripts.build).toContain("turbo run build");
    expect(scripts.dev).toContain("turbo run dev");
    expect(scripts.lint).toContain("turbo run lint");
    expect(scripts.typecheck).toContain("turbo run typecheck");
    expect(scripts.test).toContain("turbo run test");
    expect(scripts["test:coverage"]).toContain("turbo run test:coverage");
    expect(scripts.clean).toContain("turbo run clean");
    expect(scripts.verify).toContain("turbo run");
  });

  it("2. turbo.json defines full task pipeline with topological dependsOn and caching", () => {
    const turbo = JSON.parse(fs.readFileSync(path.join(rootDir, "turbo.json"), "utf-8"));
    const tasks = turbo.tasks || {};

    expect(tasks.build).toBeDefined();
    expect(tasks.build.dependsOn).toContain("^build");
    expect(tasks.build.outputs).toContain("dist/**");

    expect(tasks.typecheck).toBeDefined();
    expect(tasks.typecheck.dependsOn).toContain("^build");

    expect(tasks.test).toBeDefined();
    expect(tasks.test.dependsOn).toContain("^build");

    expect(tasks.dev).toBeDefined();
    expect(tasks.dev.cache).toBe(false);
    expect(tasks.dev.persistent).toBe(true);

    expect(tasks.lint).toBeDefined();
    expect(tasks.clean).toBeDefined();
    expect(tasks.clean.cache).toBe(false);
  });

  it("3. all workspace package manifests define standard lifecycle scripts", () => {
    const packages = ["apps/api", "apps/web", "packages/core", "packages/ui"];

    for (const pkgRel of packages) {
      const pkgPath = path.join(rootDir, pkgRel, "package.json");
      expect(fs.existsSync(pkgPath), `${pkgRel} exists`).toBe(true);

      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};

      expect(scripts.build, `${pkgRel} has build`).toBeDefined();
      expect(scripts.typecheck, `${pkgRel} has typecheck`).toBeDefined();
      expect(scripts.test, `${pkgRel} has test`).toBeDefined();
      expect(scripts.lint, `${pkgRel} has lint`).toBeDefined();
      expect(scripts.clean, `${pkgRel} has clean`).toBeDefined();
    }
  });

  it("4. turbo run build completes successfully with dry-run dependency graph", () => {
    const output = execFileSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "turbo", "run", "build", "--dry=json"],
      {
        cwd: rootDir,
        encoding: "utf-8",
        env: {
          ...process.env,
          APPDATA: path.resolve(rootDir, ".turbo"),
        },
        shell: true,
      },
    );

    const dryJson = JSON.parse(output);
    expect(dryJson.tasks).toBeDefined();
    expect(dryJson.packages).toContain("@bill-splitter/api");
    expect(dryJson.packages).toContain("@bill-splitter/core");
    expect(dryJson.packages).toContain("@bill-splitter/ui");
    expect(dryJson.packages).toContain("@bill-splitter/web");
  });
});
