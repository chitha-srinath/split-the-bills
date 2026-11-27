import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { envSchema } from "../apps/api/src/config.js";

describe("ST-001 — Port Configuration across Web, API, and Monorepo", () => {
  const rootDir = path.resolve(import.meta.dirname, "..");

  describe("AC-001: Web Dev Server Configuration (apps/web/vite.config.ts)", () => {
    it("configures port 3000 and proxies /api to http://localhost:4000", async () => {
      const viteConfigPath = path.join(rootDir, "apps/web/vite.config.ts");
      const content = fs.readFileSync(viteConfigPath, "utf-8");

      expect(content).toMatch(/port:\s*3000/);
      expect(content).toMatch(/target:\s*["']http:\/\/localhost:4000["']/);
    });
  });

  describe("AC-002: API Server Configuration Defaults (apps/api/src/config.ts)", () => {
    it("defaults PORT to 4000, BETTER_AUTH_URL to port 4000, and CLIENT_ORIGIN to port 3000", () => {
      const parsed = envSchema.parse({
        NODE_ENV: "test",
        MONGODB_URI: "mongodb://localhost:27017/test",
        BETTER_AUTH_SECRET: "12345678901234567890123456789012",
        GOOGLE_CLIENT_ID: "test-client-id",
        GOOGLE_CLIENT_SECRET: "test-client-secret",
      });

      expect(parsed.PORT).toBe(4000);
      expect(parsed.BETTER_AUTH_URL).toBe("http://localhost:4000");
      expect(parsed.CLIENT_ORIGIN).toBe("http://localhost:3000");
    });
  });

  describe("AC-003: Environment Example Templates", () => {
    it("specifies port 3000 for client and port 4000 for API in root .env.example", () => {
      const rootEnv = fs.readFileSync(path.join(rootDir, ".env.example"), "utf-8");
      expect(rootEnv).toContain("BETTER_AUTH_URL=http://localhost:4000");
      expect(rootEnv).toContain("CLIENT_ORIGIN=http://localhost:3000");
    });

    it("specifies PORT=4000 and aligned URLs in apps/api/.env.example", () => {
      const apiEnv = fs.readFileSync(path.join(rootDir, "apps/api/.env.example"), "utf-8");
      expect(apiEnv).toContain("PORT=4000");
      expect(apiEnv).toContain("BETTER_AUTH_URL=http://localhost:4000");
      expect(apiEnv).toContain("CLIENT_ORIGIN=http://localhost:3000");
    });

    it("specifies VITE_API_URL=http://localhost:4000 in apps/web/.env.example", () => {
      const webEnv = fs.readFileSync(path.join(rootDir, "apps/web/.env.example"), "utf-8");
      expect(webEnv).toContain("VITE_API_URL=http://localhost:4000");
    });
  });

  describe("AC-004: Setup and OAuth Callback Documentation", () => {
    it("documents Google OAuth callback URL with port 4000 in README.md", () => {
      const readme = fs.readFileSync(path.join(rootDir, "README.md"), "utf-8");
      expect(readme).toContain("http://localhost:4000/api/auth/callback/google");
    });
  });
});
