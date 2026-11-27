import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  SPLIT_MODES,
  detectDefaultCurrency,
  formatCurrency,
  createBillSchema,
  updateBillSchema,
  settleBillSchema,
  shareBillSchema,
} from "../src/index.js";

describe("ST-002 Currency & Schemas", () => {
  it("exports correct branding and currency constants", () => {
    expect(APP_NAME).toBe("Splitly");
    expect(DEFAULT_CURRENCY).toBe("USD");
    expect(SPLIT_MODES).toEqual(["equal", "exact", "percentage"]);
    expect(Object.keys(SUPPORTED_CURRENCIES)).toEqual(
      expect.arrayContaining(["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD"]),
    );
    expect(SUPPORTED_CURRENCIES.JPY.decimals).toBe(0);
    expect(SUPPORTED_CURRENCIES.USD.decimals).toBe(2);
  });

  it("detectDefaultCurrency resolves ISO code from locale region", () => {
    expect(detectDefaultCurrency("en-US")).toBe("USD");
    expect(detectDefaultCurrency("en-GB")).toBe("GBP");
    expect(detectDefaultCurrency("ja-JP")).toBe("JPY");
    expect(detectDefaultCurrency("en-IN")).toBe("INR");
    expect(detectDefaultCurrency("de-DE")).toBe("EUR");
    expect(detectDefaultCurrency("unknown-LOCALE")).toBe("USD");
  });

  it("formatCurrency formats with correct currency decimals and symbol", () => {
    expect(formatCurrency(1234.5, "USD", "en-US")).toBe("$1,234.50");
    expect(formatCurrency(1234, "JPY", "ja-JP")).toBe("￥1,234");
    expect(formatCurrency(0, "USD", "en-US")).toBe("$0.00");
  });

  describe("createBillSchema", () => {
    it("validates valid equal split input", () => {
      const result = createBillSchema.safeParse({
        title: "Dinner",
        totalAmount: 60,
        currency: "USD",
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "equal",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-positive total amount", () => {
      const result = createBillSchema.safeParse({
        title: "Zero",
        totalAmount: 0,
        participants: ["Alex"],
        paidBy: "Alex",
      });
      expect(result.success).toBe(false);
    });

    it("rejects when paidBy is not in participants", () => {
      const result = createBillSchema.safeParse({
        title: "Lunch",
        totalAmount: 50,
        participants: ["Alex", "Sam"],
        paidBy: "Charlie",
      });
      expect(result.success).toBe(false);
    });

    it("validates exact splits summing to totalAmount within 0.01 tolerance", () => {
      const valid = createBillSchema.safeParse({
        title: "Drinks",
        totalAmount: 100,
        currency: "USD",
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "exact",
        splits: [
          { participant: "Alex", amount: 40 },
          { participant: "Sam", amount: 60 },
        ],
      });
      expect(valid.success).toBe(true);

      const invalid = createBillSchema.safeParse({
        title: "Drinks",
        totalAmount: 100,
        currency: "USD",
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "exact",
        splits: [
          { participant: "Alex", amount: 40 },
          { participant: "Sam", amount: 50 },
        ],
      });
      expect(invalid.success).toBe(false);
    });

    it("validates percentage splits summing to 100 within 0.01 tolerance", () => {
      const valid = createBillSchema.safeParse({
        title: "Groceries",
        totalAmount: 80,
        currency: "USD",
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "percentage",
        splits: [
          { participant: "Alex", percentage: 50 },
          { participant: "Sam", percentage: 50 },
        ],
      });
      expect(valid.success).toBe(true);

      const invalid = createBillSchema.safeParse({
        title: "Groceries",
        totalAmount: 80,
        currency: "USD",
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "percentage",
        splits: [
          { participant: "Alex", percentage: 40 },
          { participant: "Sam", percentage: 50 },
        ],
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("settleBillSchema & shareBillSchema", () => {
    it("validates settleBillSchema", () => {
      expect(settleBillSchema.safeParse({ participant: "Sam", settled: true }).success).toBe(true);
      expect(settleBillSchema.safeParse({ participant: "", settled: true }).success).toBe(false);
    });

    it("validates shareBillSchema", () => {
      expect(shareBillSchema.safeParse({ enabled: true, rotate: true }).success).toBe(true);
      expect(shareBillSchema.safeParse({ enabled: false }).success).toBe(true);
    });
  });
});
