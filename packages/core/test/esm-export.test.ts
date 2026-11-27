import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

describe("ST-002 ESM Export & Package Contract", () => {
  it("built package exports all public symbols and type definitions", async () => {
    const distPath = path.resolve(import.meta.dirname, "../dist/index.js");
    const dtsPath = path.resolve(import.meta.dirname, "../dist/index.d.ts");
    expect(fs.existsSync(distPath)).toBe(true);
    expect(fs.existsSync(dtsPath)).toBe(true);

    const coreModule = await import(distPath);
    expect(coreModule.APP_NAME).toBe("Splitly");
    expect(coreModule.DEFAULT_CURRENCY).toBe("USD");
    expect(typeof coreModule.computeBillSplits).toBe("function");
    expect(typeof coreModule.calculateNetBalances).toBe("function");
    expect(typeof coreModule.formatCurrency).toBe("function");
    expect(coreModule.createBillSchema).toBeDefined();
    expect(coreModule.updateBillSchema).toBeDefined();
    expect(coreModule.settleBillSchema).toBeDefined();
    expect(coreModule.shareBillSchema).toBeDefined();
    expect(coreModule.SPLIT_MODES).toEqual(["equal", "exact", "percentage"]);
  });

  it("resolves via Node native ESM import('@bill-splitter/core')", () => {
    const script = `
      import('@bill-splitter/core').then((m) => {
        if (m.APP_NAME !== 'Splitly') process.exit(1);
        if (m.DEFAULT_CURRENCY !== 'USD') process.exit(2);
        if (typeof m.computeBillSplits !== 'function') process.exit(3);
        console.log('OK');
      }).catch((e) => {
        console.error(e);
        process.exit(1);
      });
    `;
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf-8",
    });
    expect(result.trim()).toBe("OK");
  });
});
