import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";

describe("ST-002 ESM Export & Package Contract", () => {
  it("built package exports all public symbols", async () => {
    const distPath = path.resolve(import.meta.dirname, "../dist/index.js");
    if (!fs.existsSync(distPath)) {
      // In RED TDD phase before build, fail cleanly
      expect(fs.existsSync(distPath)).toBe(true);
    }
    const coreModule = await import(distPath);
    expect(coreModule.APP_NAME).toBe("Splitly");
    expect(coreModule.DEFAULT_CURRENCY).toBe("USD");
    expect(typeof coreModule.computeBillSplits).toBe("function");
    expect(typeof coreModule.calculateNetBalances).toBe("function");
    expect(typeof coreModule.formatCurrency).toBe("function");
    expect(coreModule.createBillSchema).toBeDefined();
  });
});
