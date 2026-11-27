import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

describe("ST-001 Workspace Configuration & Tooling", () => {
  const rootDir = path.resolve(import.meta.dirname, "..");

  it("1. root package.json enables ESM and delegates scripts to Turborepo orchestration", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
    expect(pkg.type).toBe("module");
    expect(pkg.scripts?.build).toBe("turbo run build");
    expect(pkg.scripts?.["build:turbo"]).toBe("turbo run build");
    expect(pkg.scripts?.typecheck).toBe("turbo run typecheck");
    expect(pkg.scripts?.["typecheck:turbo"]).toBe("turbo run typecheck");
    expect(pkg.scripts?.test).toBe("turbo run test");
    expect(pkg.scripts?.["test:coverage"]).toBe("turbo run test:coverage");
    expect(pkg.scripts?.e2e).toBe("playwright test");

    const devDeps = pkg.devDependencies || {};
    expect(devDeps.vitest).toBeDefined();
    expect(devDeps["@vitest/coverage-v8"]).toBeDefined();
    expect(devDeps.jsdom).toBeDefined();
    expect(devDeps["@testing-library/react"]).toBeDefined();
    expect(devDeps["@testing-library/jest-dom"]).toBeDefined();
    expect(devDeps["@testing-library/user-event"]).toBeDefined();
    expect(devDeps["@playwright/test"]).toBeDefined();
  });

  it("2. apps/web/tsconfig.node.json configures composite declaration-only build with cache paths", () => {
    const nodeTsConfig = JSON.parse(
      fs.readFileSync(path.join(rootDir, "apps/web/tsconfig.node.json"), "utf-8"),
    );
    const co = nodeTsConfig.compilerOptions || {};
    expect(co.composite).toBe(true);
    expect(co.noEmit).toBe(false);
    expect(co.declaration).toBe(true);
    expect(co.emitDeclarationOnly).toBe(true);
    expect(co.allowImportingTsExtensions).toBe(true);
    expect(co.outDir).toBe("./node_modules/.cache/tsc-node/out");
    expect(co.tsBuildInfoFile).toBe("./node_modules/.cache/tsc-node/tsconfig.node.tsbuildinfo");
    expect(nodeTsConfig.include).toContain("vite.config.ts");
  });

  it("3. apps/web/tsconfig.json extends tsconfig.base.json, references tsconfig.node.json, and caches tsBuildInfoFile", () => {
    const tsConfig = JSON.parse(
      fs.readFileSync(path.join(rootDir, "apps/web/tsconfig.json"), "utf-8"),
    );
    expect(tsConfig.extends).toBe("../../tsconfig.base.json");
    const co = tsConfig.compilerOptions || {};
    expect(co.noEmit).toBe(true);
    expect(co.jsx).toBe("react-jsx");
    expect(co.tsBuildInfoFile).toBe("./node_modules/.cache/tsc/tsconfig.tsbuildinfo");
    expect(co.paths?.["@/*"]).toEqual(["./src/*"]);
    expect(tsConfig.references).toContainEqual({ path: "./tsconfig.node.json" });
  });

  it("4. apps/web/package.json typecheck script builds project references before tsc --noEmit", () => {
    const webPkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, "apps/web/package.json"), "utf-8"),
    );
    expect(webPkg.scripts?.typecheck).toBe("tsc -b && tsc --noEmit");
    expect(webPkg.scripts?.build).toBe("tsc -b && vite build");
  });

  it("5. .gitignore ignores build artifacts and zero .tsbuildinfo files are tracked in git", () => {
    const gitignore = fs.readFileSync(path.join(rootDir, ".gitignore"), "utf-8");
    expect(gitignore).toContain("*.tsbuildinfo");
    expect(gitignore).toContain("coverage/");
    expect(gitignore).toContain("playwright-report/");
    expect(gitignore).toContain("test-results/");

    const tracked = execFileSync("git", ["ls-files", "*tsbuildinfo*"], {
      cwd: rootDir,
      encoding: "utf-8",
    }).trim();
    expect(tracked).toBe("");
  });

  it("6. vitest.config.ts configures shared, api, and web projects, passWithNoTests, and v8 coverage settings", async () => {
    const configPath = path.join(rootDir, "vitest.config.ts");
    expect(fs.existsSync(configPath)).toBe(true);

    const vitestModule = await import(/* @vite-ignore */ path.join(rootDir, "vitest.config.ts"));
    const config = vitestModule.default?.test || vitestModule.default;
    expect(config.passWithNoTests).toBe(true);

    const projectNames =
      config.workspace ||
      (config.projects || []).map((p: { name?: string } | string) =>
        typeof p === "string" ? p : p.name,
      );
    expect(projectNames).toEqual(expect.arrayContaining(["shared", "api", "web"]));
    expect(config.coverage?.provider).toBe("v8");
    expect(config.coverage?.reportsDirectory).toBe("./coverage");
    expect(config.coverage?.exclude).toContain("**/routeTree.gen.ts");
  });

  it("7. apps/web/src/test/setup.ts exists and registers RTL cleanup and browser API stubs", () => {
    const setupPath = path.join(rootDir, "apps/web/src/test/setup.ts");
    expect(fs.existsSync(setupPath)).toBe(true);

    const content = fs.readFileSync(setupPath, "utf-8");
    expect(content).toContain("@testing-library/jest-dom/vitest");
    expect(content).toContain("cleanup");
    expect(content).toContain("matchMedia");
    expect(content).toContain("ResizeObserver");
    expect(content).toContain("clipboard");
  });
});
