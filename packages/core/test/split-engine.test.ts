import { describe, it, expect } from "vitest";
import {
  roundToCurrency,
  calculateSplit,
  computeBillSplits,
  normalizeLegacyBill,
  calculateNetBalances,
  formatSplitForChat,
  Bill,
} from "../src/index.js";

describe("ST-002 Split Engine & Utilities", () => {
  describe("roundToCurrency & calculateSplit", () => {
    it("rounds 2-decimal USD/EUR amounts and 0-decimal JPY amounts", () => {
      expect(roundToCurrency(1.005, "USD")).toBe(1.01);
      expect(roundToCurrency(10 / 3, "USD")).toBe(3.33);
      expect(roundToCurrency(-0, "USD")).toBe(0);

      expect(roundToCurrency(333.6, "JPY")).toBe(334);
      expect(roundToCurrency(333.4, "JPY")).toBe(333);
      expect(roundToCurrency(NaN, "USD")).toBe(0);
      expect(roundToCurrency(Infinity, "USD")).toBe(0);
    });

    it("preserves backward-compatible 2-arg and 3-arg calculateSplit", () => {
      expect(calculateSplit(100, 3)).toBe(33.33);
      expect(calculateSplit(50, 0)).toBe(0);
      expect(calculateSplit(1000, 3, "JPY")).toBe(333);
    });
  });

  describe("computeBillSplits", () => {
    it("computes equal splits in USD distributing remainder from index 0", () => {
      const splits = computeBillSplits({
        totalAmount: 100,
        currency: "USD",
        participants: ["Alex", "Sam", "Jordan"],
        paidBy: "Alex",
        splitMode: "equal",
      });
      expect(splits).toHaveLength(3);
      expect(splits.map((s) => s.amount)).toEqual([33.34, 33.33, 33.33]);
      expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(100);
      expect(splits.every((s) => s.settled === false)).toBe(true);
    });

    it("distributes sub-dollar minor units deterministically", () => {
      const splits = computeBillSplits({
        totalAmount: 0.05,
        currency: "USD",
        participants: ["A", "B", "C"],
        paidBy: "A",
        splitMode: "equal",
      });
      expect(splits.map((s) => s.amount)).toEqual([0.02, 0.02, 0.01]);
      expect(
        roundToCurrency(
          splits.reduce((sum, s) => sum + s.amount, 0),
          "USD",
        ),
      ).toBe(0.05);
    });

    it("computes equal splits in JPY without fractional yen", () => {
      const splits = computeBillSplits({
        totalAmount: 1000,
        currency: "JPY",
        participants: ["Alex", "Sam", "Jordan"],
        paidBy: "Alex",
        splitMode: "equal",
      });
      expect(splits.map((s) => s.amount)).toEqual([334, 333, 333]);
      expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(1000);
    });

    it("handles exact splits and reconciles minor boundary differences", () => {
      const splits = computeBillSplits({
        totalAmount: 100,
        currency: "USD",
        participants: ["Alex", "Sam"],
        paidBy: "Alex",
        splitMode: "exact",
        customAmounts: { Alex: 45.5, Sam: 54.5 },
      });
      expect(splits.map((s) => s.amount)).toEqual([45.5, 54.5]);
      expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(100);
    });

    it("computes percentage splits via largest-remainder allocation", () => {
      const splits = computeBillSplits({
        totalAmount: 10,
        currency: "USD",
        participants: ["A", "B", "C"],
        paidBy: "A",
        splitMode: "percentage",
        customPercentages: { A: 33.33, B: 33.33, C: 33.34 },
      });
      expect(splits.map((s) => s.amount)).toEqual([3.33, 3.33, 3.34]);
      expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(10);
    });

    it("returns empty array when participants are empty", () => {
      const splits = computeBillSplits({
        totalAmount: 100,
        currency: "USD",
        participants: [],
        paidBy: "A",
        splitMode: "equal",
      });
      expect(splits).toEqual([]);
    });
  });

  describe("normalizeLegacyBill", () => {
    it("normalizes a legacy document missing currency, paidBy, splitMode, splits, group, shareToken", () => {
      const legacyRaw = {
        _id: "6745ef1234567890abcdef12",
        title: "Dinner",
        totalAmount: 100,
        participants: ["Alice", "Bob", "Charlie"],
        createdAt: new Date("2026-11-20T12:00:00Z"),
      };
      const bill = normalizeLegacyBill(legacyRaw);
      expect(bill.id).toBe("6745ef1234567890abcdef12");
      expect(bill.currency).toBe("USD");
      expect(bill.paidBy).toBe("Alice");
      expect(bill.splitMode).toBe("equal");
      expect(bill.splitAmount).toBe(33.33);
      expect(bill.splits).toHaveLength(3);
      expect(bill.splits[0]).toEqual({
        participant: "Alice",
        amount: 33.34,
        settled: false,
      });
      expect(bill.group).toBeNull();
      expect(bill.shareToken).toBeNull();
      expect(bill.createdAt).toBe("2026-11-20T12:00:00.000Z");
    });
  });

  describe("calculateNetBalances", () => {
    it("nets reciprocal debts into a single simplified transfer", () => {
      const bill1: Bill = {
        id: "1",
        title: "Dinner",
        totalAmount: 60,
        currency: "USD",
        paidBy: "Alex",
        splitMode: "equal",
        splitAmount: 30,
        participants: ["Alex", "Bob"],
        splits: [
          { participant: "Alex", amount: 30, settled: false },
          { participant: "Bob", amount: 30, settled: false },
        ],
        createdAt: "2026-11-20T12:00:00Z",
      };
      const bill2: Bill = {
        id: "2",
        title: "Coffee",
        totalAmount: 20,
        currency: "USD",
        paidBy: "Bob",
        splitMode: "equal",
        splitAmount: 10,
        participants: ["Alex", "Bob"],
        splits: [
          { participant: "Alex", amount: 10, settled: false },
          { participant: "Bob", amount: 10, settled: false },
        ],
        createdAt: "2026-11-20T13:00:00Z",
      };

      const transfers = calculateNetBalances([bill1, bill2]);
      expect(transfers).toEqual([{ currency: "USD", from: "Bob", to: "Alex", amount: 20 }]);
    });

    it("separates transfers by currency", () => {
      const billUSD: Bill = {
        id: "1",
        title: "Lunch",
        totalAmount: 20,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        splitAmount: 10,
        participants: ["Alice", "Bob"],
        splits: [
          { participant: "Alice", amount: 10, settled: false },
          { participant: "Bob", amount: 10, settled: false },
        ],
        createdAt: "2026-11-20T12:00:00Z",
      };
      const billJPY: Bill = {
        id: "2",
        title: "Metro",
        totalAmount: 600,
        currency: "JPY",
        paidBy: "Bob",
        splitMode: "equal",
        splitAmount: 300,
        participants: ["Alice", "Bob"],
        splits: [
          { participant: "Alice", amount: 300, settled: false },
          { participant: "Bob", amount: 300, settled: false },
        ],
        createdAt: "2026-11-20T13:00:00Z",
      };

      const transfers = calculateNetBalances([billUSD, billJPY]);
      expect(transfers).toHaveLength(2);
      expect(transfers).toContainEqual({
        currency: "USD",
        from: "Bob",
        to: "Alice",
        amount: 10,
      });
      expect(transfers).toContainEqual({
        currency: "JPY",
        from: "Alice",
        to: "Bob",
        amount: 300,
      });
    });
  });

  describe("formatSplitForChat", () => {
    it("formats split details for clipboard copy", () => {
      const bill: Bill = {
        id: "1",
        title: "Weekend Trip",
        totalAmount: 90,
        currency: "USD",
        paidBy: "Alex",
        splitMode: "equal",
        splitAmount: 30,
        participants: ["Alex", "Sam", "Jordan"],
        splits: [
          { participant: "Alex", amount: 30, settled: true },
          { participant: "Sam", amount: 30, settled: false },
          { participant: "Jordan", amount: 30, settled: false },
        ],
        group: "Vacation",
        createdAt: "2026-11-20T12:00:00Z",
      };

      const text = formatSplitForChat(bill);
      expect(text).toContain("Weekend Trip");
      expect(text).toContain("Paid by: Alex");
      expect(text).toContain("Group: Vacation");
      expect(text).toContain("- Alex: $30.00 (Settled)");
      expect(text).toContain("- Sam: $30.00 (Unsettled)");
      expect(text).toContain("- Jordan: $30.00 (Unsettled)");
    });
  });
});
