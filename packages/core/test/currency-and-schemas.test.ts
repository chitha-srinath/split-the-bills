import { describe, it, expect, vi, afterEach } from "vitest";
import {
  APP_NAME,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  LOCALE_CURRENCY_MAP,
  SPLIT_MODES,
  detectDefaultCurrency,
  formatCurrency,
  createBillSchema,
  updateBillSchema,
  settleBillSchema,
  shareBillSchema,
} from "../src/index.js";

describe("ST-002 Currency & Schemas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports correct branding and currency constants", () => {
    expect(APP_NAME).toBe("Splitly");
    expect(DEFAULT_CURRENCY).toBe("USD");
    expect(SPLIT_MODES).toEqual(["equal", "exact", "percentage"]);
    expect(Object.keys(SUPPORTED_CURRENCIES)).toEqual(
      expect.arrayContaining(["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD"]),
    );
    expect(SUPPORTED_CURRENCIES.JPY.decimals).toBe(0);
    expect(SUPPORTED_CURRENCIES.USD.decimals).toBe(2);
    expect(LOCALE_CURRENCY_MAP.US).toBe("USD");
    expect(LOCALE_CURRENCY_MAP.DE).toBe("EUR");
    expect(LOCALE_CURRENCY_MAP.IN).toBe("INR");
  });

  it("detectDefaultCurrency resolves ISO code from locale region", () => {
    expect(detectDefaultCurrency("en-US")).toBe("USD");
    expect(detectDefaultCurrency("en-GB")).toBe("GBP");
    expect(detectDefaultCurrency("ja-JP")).toBe("JPY");
    expect(detectDefaultCurrency("en-IN")).toBe("INR");
    expect(detectDefaultCurrency("de-DE")).toBe("EUR");
    expect(detectDefaultCurrency("fr-FR")).toBe("EUR");
    expect(detectDefaultCurrency("de-AT")).toBe("EUR");
    expect(detectDefaultCurrency("en-CA")).toBe("CAD");
    expect(detectDefaultCurrency("en-AU")).toBe("AUD");
    expect(detectDefaultCurrency("en_GB")).toBe("GBP");
    expect(detectDefaultCurrency("zh-Latn-IN")).toBe("INR");
    expect(detectDefaultCurrency("unknown-LOCALE")).toBe("USD");
    expect(detectDefaultCurrency("xx-ZZ")).toBe("USD");
    expect(detectDefaultCurrency("")).toBe("USD");
    expect(detectDefaultCurrency([])).toBe("USD");
  });

  it("detectDefaultCurrency reads navigator when called without arguments", () => {
    if (typeof globalThis.navigator !== "undefined") {
      const spy = vi.spyOn(globalThis.navigator, "languages", "get").mockReturnValue(["ja-JP"]);
      expect(detectDefaultCurrency()).toBe("JPY");
      spy.mockRestore();
    }
  });

  it("formatCurrency formats with correct currency decimals and symbol", () => {
    expect(formatCurrency(1234.5, "USD", "en-US")).toBe("$1,234.50");
    expect(formatCurrency(1234, "JPY", "ja-JP")).toBe("￥1,234");
    expect(formatCurrency(0, "USD", "en-US")).toBe("$0.00");

    // Normalizes lowercase currency
    expect(formatCurrency(50, "usd", "en-US")).toBe("$50.00");

    // Falls back gracefully on invalid currency codes
    expect(formatCurrency(50, "$", "en-US")).toBe("$50.00");
    expect(formatCurrency(50, "", "en-US")).toBe("$50.00");
  });

  it("formatCurrency caches Intl.NumberFormat instances", () => {
    const spy = vi.spyOn(Intl, "NumberFormat");
    formatCurrency(10, "EUR", "fr-FR");
    const countAfterFirst = spy.mock.calls.length;
    formatCurrency(20, "EUR", "fr-FR");
    expect(spy.mock.calls.length).toBe(countAfterFirst);
  });

  describe("createBillSchema", () => {
    it("validates valid equal split input and applies defaults", () => {
      const result = createBillSchema.safeParse({
        title: "Dinner",
        totalAmount: 60,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe("USD");
        expect(result.data.splitMode).toBe("equal");
        expect(result.data.group).toBeNull();
      }
    });

    it("normalizes non-empty group string", () => {
      const result = createBillSchema.safeParse({
        title: "Dinner",
        totalAmount: 60,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        group: "  Trip 2026  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.group).toBe("Trip 2026");
      }
    });

    it("rejects duplicate participants and missing payer", () => {
      const dup = createBillSchema.safeParse({
        title: "Dinner",
        totalAmount: 60,
        participants: ["Alex", "Alex"],
        paidBy: "Alex",
      });
      expect(dup.success).toBe(false);

      const notInList = createBillSchema.safeParse({
        title: "Dinner",
        totalAmount: 60,
        participants: ["Alex", "Sam"],
        paidBy: "Charlie",
      });
      expect(notInList.success).toBe(false);
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

    it("rejects non-finite or negative split amounts in exact mode", () => {
      const negative = createBillSchema.safeParse({
        title: "Drinks",
        totalAmount: 100,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "exact",
        splits: [
          { participant: "Alex", amount: -10 },
          { participant: "Sam", amount: 110 },
        ],
      });
      expect(negative.success).toBe(false);
    });

    it("rejects missing splits or mismatched participants in exact mode", () => {
      const missingSplits = createBillSchema.safeParse({
        title: "Drinks",
        totalAmount: 100,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "exact",
      });
      expect(missingSplits.success).toBe(false);

      const mismatchedSplits = createBillSchema.safeParse({
        title: "Drinks",
        totalAmount: 100,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "exact",
        splits: [{ participant: "Alex", amount: 100 }],
      });
      expect(mismatchedSplits.success).toBe(false);
    });

    it("rejects missing splits or mismatched participants in percentage mode", () => {
      const missingSplits = createBillSchema.safeParse({
        title: "Drinks",
        totalAmount: 100,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "percentage",
      });
      expect(missingSplits.success).toBe(false);

      const mismatchedSplits = createBillSchema.safeParse({
        title: "Drinks",
        totalAmount: 100,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "percentage",
        splits: [{ participant: "Alex", percentage: 100 }],
      });
      expect(mismatchedSplits.success).toBe(false);
    });

    it("rejects non-finite or out-of-bound percentages in percentage mode", () => {
      const overHundred = createBillSchema.safeParse({
        title: "Drinks",
        totalAmount: 100,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "percentage",
        splits: [
          { participant: "Alex", percentage: 110 },
          { participant: "Sam", percentage: -10 },
        ],
      });
      expect(overHundred.success).toBe(false);
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

    it("validates equal split with matching or mismatched splits provided", () => {
      const valid = createBillSchema.safeParse({
        title: "Groceries",
        totalAmount: 80,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "equal",
        splits: [{ participant: "Alex" }, { participant: "Sam" }],
      });
      expect(valid.success).toBe(true);

      const mismatched = createBillSchema.safeParse({
        title: "Groceries",
        totalAmount: 80,
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "equal",
        splits: [{ participant: "Alex" }],
      });
      expect(mismatched.success).toBe(false);
    });
  });

  describe("updateBillSchema", () => {
    it("validates valid partial updates", () => {
      expect(updateBillSchema.safeParse({ title: "Updated Title" }).success).toBe(true);
      expect(updateBillSchema.safeParse({ totalAmount: 50 }).success).toBe(true);
    });

    it("rejects invalid exact splits on update", () => {
      const invalid = updateBillSchema.safeParse({
        splitMode: "exact",
        totalAmount: 100,
        participants: ["Alex", "Sam"],
        splits: [
          { participant: "Alex", amount: 40 },
          { participant: "Sam", amount: 40 },
        ],
      });
      expect(invalid.success).toBe(false);
    });

    it("validates and rejects percentage splits on update", () => {
      const valid = updateBillSchema.safeParse({
        splitMode: "percentage",
        participants: ["Alex", "Sam"],
        splits: [
          { participant: "Alex", percentage: 50 },
          { participant: "Sam", percentage: 50 },
        ],
      });
      expect(valid.success).toBe(true);

      const invalid = updateBillSchema.safeParse({
        splitMode: "percentage",
        participants: ["Alex", "Sam"],
        splits: [
          { participant: "Alex", percentage: 60 },
          { participant: "Sam", percentage: 50 },
        ],
      });
      expect(invalid.success).toBe(false);
    });

    it("rejects mismatched participants or missing splits on update", () => {
      const missingSplits = updateBillSchema.safeParse({
        splitMode: "exact",
      });
      expect(missingSplits.success).toBe(false);

      const mismatched = updateBillSchema.safeParse({
        participants: ["Alex", "Sam"],
        splits: [{ participant: "Charlie", amount: 50 }],
      });
      expect(mismatched.success).toBe(false);

      const dupParticipants = updateBillSchema.safeParse({
        participants: ["Alex", "Alex"],
      });
      expect(dupParticipants.success).toBe(false);

      const badPayer = updateBillSchema.safeParse({
        participants: ["Alex"],
        paidBy: "Sam",
      });
      expect(badPayer.success).toBe(false);
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
