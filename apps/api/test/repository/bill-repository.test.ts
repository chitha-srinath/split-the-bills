import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { type Model } from "mongoose";
import { billSchema, BillModel, type BillDocument } from "../../src/models/bill.js";
import {
  type BillRepository,
  type BillListFilters,
  RepositoryValidationError,
  toBill,
  toPublicBillSummary,
  MongooseBillRepository,
  InMemoryBillRepository,
} from "../../src/repositories/bill-repository.js";
import { DEFAULT_CURRENCY } from "@bill-splitter/core";

const VALID_ID = "507f1f77bcf86cd799439011";
const VALID_ID_2 = "507f1f77bcf86cd799439012";

describe("ST-004 — API data layer & BillRepository", () => {
  describe("1. billSchema fields and index definitions", () => {
    it("has additive schema paths with expected defaults and constraints", () => {
      const currencyPath = billSchema.path("currency");
      expect(currencyPath).toBeDefined();
      expect((currencyPath as any).defaultValue).toBe("USD");

      const paidByPath = billSchema.path("paidBy");
      expect(paidByPath).toBeDefined();

      const splitModePath = billSchema.path("splitMode");
      expect(splitModePath).toBeDefined();
      expect((splitModePath as any).defaultValue).toBe("equal");

      const splitsPath = billSchema.path("splits");
      expect(splitsPath).toBeDefined();

      const groupPath = billSchema.path("group");
      expect(groupPath).toBeDefined();
      expect((groupPath as any).defaultValue).toBe(null);

      const shareTokenPath = billSchema.path("shareToken");
      expect(shareTokenPath).toBeDefined();
      expect((shareTokenPath as any).defaultValue).toBe(null);

      // Verify shareToken does NOT have unique/index at field level
      expect((shareTokenPath as any)._index).toBeFalsy();
    });

    it("registers the 3 required compound and partial-unique indexes", () => {
      const indexes = billSchema.indexes();
      expect(indexes).toBeDefined();

      // Index 1: { userId: 1, createdAt: -1 }
      const hasUserCreatedIndex = indexes.some(
        ([fields]) =>
          fields.userId === 1 && fields.createdAt === -1 && Object.keys(fields).length === 2,
      );
      expect(hasUserCreatedIndex).toBe(true);

      // Index 2: { userId: 1, group: 1, createdAt: -1 }
      const hasUserGroupCreatedIndex = indexes.some(
        ([fields]) =>
          fields.userId === 1 &&
          fields.group === 1 &&
          fields.createdAt === -1 &&
          Object.keys(fields).length === 3,
      );
      expect(hasUserGroupCreatedIndex).toBe(true);

      // Index 3: { shareToken: 1 } with unique: true and partialFilterExpression
      const shareTokenIndex = indexes.find(
        ([fields]) => fields.shareToken === 1 && Object.keys(fields).length === 1,
      );
      expect(shareTokenIndex).toBeDefined();
      const [, options] = shareTokenIndex!;
      expect(options?.unique).toBe(true);
      expect(options?.partialFilterExpression).toEqual({
        shareToken: { $type: "string" },
      });

      // Confirm no non-partial unique index exists on shareToken
      const nonPartialShareIndex = indexes.find(
        ([fields, opts]) =>
          fields.shareToken === 1 && opts?.unique && !opts?.partialFilterExpression,
      );
      expect(nonPartialShareIndex).toBeUndefined();
    });
  });

  describe("2. apps/api/tsconfig.json build-cache isolation", () => {
    it("contains tsBuildInfoFile pointing to node_modules/.cache/tsc/tsconfig.tsbuildinfo", () => {
      const tsconfigPath = path.resolve(import.meta.dirname, "../../tsconfig.json");
      const content = fs.readFileSync(tsconfigPath, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.compilerOptions?.tsBuildInfoFile).toBe(
        "./node_modules/.cache/tsc/tsconfig.tsbuildinfo",
      );
    });
  });

  describe("3. toBill() & toPublicBillSummary() normalization", () => {
    it("normalizes a legacy MongoDB document with complete defaults", () => {
      const legacyDoc = {
        _id: VALID_ID,
        userId: "user-123",
        title: "Team Lunch",
        totalAmount: 90,
        participants: ["Alice", "Bob", "Cara"],
        splitAmount: 30,
        createdAt: new Date("2026-01-15T12:00:00.000Z"),
      };

      const bill = toBill(legacyDoc as any);
      expect(bill.id).toBe(VALID_ID);
      expect(bill.title).toBe("Team Lunch");
      expect(bill.totalAmount).toBe(90);
      expect(bill.currency).toBe("USD");
      expect(bill.paidBy).toBe("Alice");
      expect(bill.splitMode).toBe("equal");
      expect(bill.group).toBeNull();
      expect(bill.shareToken).toBeNull();
      expect(bill.createdAt).toBe("2026-01-15T12:00:00.000Z");
      expect(bill.splits).toEqual([
        { participant: "Alice", amount: 30, settled: false },
        { participant: "Bob", amount: 30, settled: false },
        { participant: "Cara", amount: 30, settled: false },
      ]);
    });

    it("toPublicBillSummary omits userId and shareToken while retaining public fields", () => {
      const bill = {
        id: VALID_ID,
        title: "Team Lunch",
        totalAmount: 90,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal" as const,
        participants: ["Alice", "Bob", "Cara"],
        splitAmount: 30,
        group: "Engineering",
        shareToken: "secret-token-1234567890123456",
        createdAt: "2026-01-15T12:00:00.000Z",
        splits: [
          { participant: "Alice", amount: 30, settled: false },
          { participant: "Bob", amount: 30, settled: false },
          { participant: "Cara", amount: 30, settled: false },
        ],
      };

      const summary = toPublicBillSummary(bill);
      expect(summary.id).toBe(VALID_ID);
      expect(summary.title).toBe("Team Lunch");
      expect(summary.totalAmount).toBe(90);
      expect(summary.currency).toBe("USD");
      expect(summary.paidBy).toBe("Alice");
      expect(summary.splitMode).toBe("equal");
      expect(summary.participants).toEqual(["Alice", "Bob", "Cara"]);
      expect(summary.splitAmount).toBe(30);
      expect(summary.group).toBe("Engineering");
      expect(summary.createdAt).toBe("2026-01-15T12:00:00.000Z");
      expect(summary.splits).toHaveLength(3);

      expect((summary as any).userId).toBeUndefined();
      expect((summary as any).shareToken).toBeUndefined();
    });
  });

  describe("4. MongooseBillRepository (mocked BillModel, zero live mongod)", () => {
    it("findOwnedById returns null for malformed IDs without querying DB", async () => {
      const mockModel = {
        findOne: vi.fn(),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);
      const result = await repo.findOwnedById("not-an-objectid", "user-1");

      expect(result).toBeNull();
      expect(mockModel.findOne).not.toHaveBeenCalled();
    });

    it("findOwnedById returns bill for valid ID", async () => {
      const mockDoc = {
        _id: VALID_ID,
        userId: "user-1",
        title: "Dinner",
        totalAmount: 50,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        participants: ["Alice", "Bob"],
        splitAmount: 25,
        splits: [
          { participant: "Alice", amount: 25, settled: false },
          { participant: "Bob", amount: 25, settled: false },
        ],
        group: null,
        shareToken: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      const mockModel = {
        findOne: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockDoc),
        }),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);
      const result = await repo.findOwnedById(VALID_ID, "user-1");

      expect(mockModel.findOne).toHaveBeenCalledWith({ _id: VALID_ID, userId: "user-1" });
      expect(result?.title).toBe("Dinner");
      expect(result?.id).toBe(VALID_ID);
    });

    it("toggleSettle uses read-hydrate-save on legacy docs and calls doc.save()", async () => {
      const legacyDoc: any = {
        _id: VALID_ID,
        userId: "user-1",
        title: "Coffee",
        totalAmount: 10,
        participants: ["Alice", "Bob"],
        splitAmount: 5,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockModel = {
        findOne: vi.fn().mockResolvedValue(legacyDoc),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);
      const updated = await repo.toggleSettle(VALID_ID, "user-1", {
        participant: "Bob",
        settled: true,
      });

      expect(mockModel.findOne).toHaveBeenCalledWith({ _id: VALID_ID, userId: "user-1" });
      expect(legacyDoc.save).toHaveBeenCalled();
      expect(updated?.splits?.find((s) => s.participant === "Bob")?.settled).toBe(true);
      expect(updated?.splits?.find((s) => s.participant === "Alice")?.settled).toBe(false);
      expect(updated?.currency).toBe("USD");
      expect(updated?.paidBy).toBe("Alice");
    });

    it("toggleSettle throws RepositoryValidationError for non-member participant without saving", async () => {
      const mockDoc: any = {
        _id: VALID_ID,
        userId: "user-1",
        title: "Coffee",
        totalAmount: 10,
        participants: ["Alice", "Bob"],
        splitAmount: 5,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        splits: [
          { participant: "Alice", amount: 5, settled: false },
          { participant: "Bob", amount: 5, settled: false },
        ],
        createdAt: new Date(),
        save: vi.fn(),
      };

      const mockModel = {
        findOne: vi.fn().mockResolvedValue(mockDoc),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);

      await expect(
        repo.toggleSettle(VALID_ID, "user-1", { participant: "Charlie", settled: true }),
      ).rejects.toThrow(RepositoryValidationError);

      expect(mockDoc.save).not.toHaveBeenCalled();
    });

    it("updateOwned validates merged fields, recomputes splits, and calls doc.save()", async () => {
      const legacyDoc: any = {
        _id: VALID_ID,
        userId: "user-1",
        title: "Dinner",
        totalAmount: 60,
        participants: ["Alice", "Bob"],
        splitAmount: 30,
        createdAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockModel = {
        findOne: vi.fn().mockResolvedValue(legacyDoc),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);
      const updated = await repo.updateOwned(VALID_ID, "user-1", {
        title: "Dinner & Drinks",
        totalAmount: 90,
        participants: ["Alice", "Bob", "Charlie"],
        paidBy: "Bob",
      });

      expect(legacyDoc.save).toHaveBeenCalled();
      expect(updated?.title).toBe("Dinner & Drinks");
      expect(updated?.totalAmount).toBe(90);
      expect(updated?.paidBy).toBe("Bob");
      expect(updated?.participants).toEqual(["Alice", "Bob", "Charlie"]);
      expect(updated?.splitAmount).toBe(30);
      expect(updated?.splits).toHaveLength(3);
    });

    it("updateOwned throws RepositoryValidationError when merged invariants are violated", async () => {
      const mockDoc: any = {
        _id: VALID_ID,
        userId: "user-1",
        title: "Dinner",
        totalAmount: 60,
        participants: ["Alice", "Bob"],
        splitAmount: 30,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        splits: [
          { participant: "Alice", amount: 30, settled: false },
          { participant: "Bob", amount: 30, settled: false },
        ],
        createdAt: new Date(),
        save: vi.fn(),
      };

      const mockModel = {
        findOne: vi.fn().mockResolvedValue(mockDoc),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);

      // Violate paidBy invariant: paidBy "Eve" is not in ["Alice", "Bob"]
      await expect(
        repo.updateOwned(VALID_ID, "user-1", {
          paidBy: "Eve",
        }),
      ).rejects.toThrow(RepositoryValidationError);

      expect(mockDoc.save).not.toHaveBeenCalled();
    });

    it("setShareToken manages token enablement, rotation, and revocation", async () => {
      const mockDoc: any = {
        _id: VALID_ID,
        userId: "user-1",
        title: "Trip",
        totalAmount: 100,
        participants: ["Alice"],
        splitAmount: 100,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        splits: [{ participant: "Alice", amount: 100, settled: false }],
        shareToken: null,
        createdAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockModel = {
        findOne: vi.fn().mockResolvedValue(mockDoc),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);

      // Enable token
      const enabled = await repo.setShareToken(VALID_ID, "user-1", { enabled: true });
      expect(enabled?.shareToken).toBeTruthy();
      const firstToken = enabled?.shareToken;

      // Idempotent enable without rotate
      const idempotent = await repo.setShareToken(VALID_ID, "user-1", { enabled: true });
      expect(idempotent?.shareToken).toBe(firstToken);

      // Rotate token
      const rotated = await repo.setShareToken(VALID_ID, "user-1", {
        enabled: true,
        rotate: true,
      });
      expect(rotated?.shareToken).toBeTruthy();
      expect(rotated?.shareToken).not.toBe(firstToken);

      // Revoke token
      const revoked = await repo.setShareToken(VALID_ID, "user-1", { enabled: false });
      expect(revoked?.shareToken).toBeNull();
    });

    it("findByShareToken validates token format and returns public summary", async () => {
      const mockModel = {
        findOne: vi.fn(),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);

      // Malformed / short tokens
      expect(await repo.findByShareToken("short")).toBeNull();
      expect(await repo.findByShareToken("invalid!characters#")).toBeNull();
      expect(mockModel.findOne).not.toHaveBeenCalled();

      // Valid token query
      const validToken = "a".repeat(32);
      const mockDoc = {
        _id: VALID_ID,
        userId: "user-1",
        title: "Shared Bill",
        totalAmount: 100,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        participants: ["Alice", "Bob"],
        splitAmount: 50,
        splits: [
          { participant: "Alice", amount: 50, settled: false },
          { participant: "Bob", amount: 50, settled: false },
        ],
        group: "Trip",
        shareToken: validToken,
        createdAt: new Date(),
      };

      (mockModel.findOne as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockDoc),
      });

      const summary = await repo.findByShareToken(validToken);
      expect(mockModel.findOne).toHaveBeenCalledWith({ shareToken: validToken });
      expect(summary).toBeDefined();
      expect(summary?.title).toBe("Shared Bill");
      expect((summary as any)?.userId).toBeUndefined();
      expect((summary as any)?.shareToken).toBeUndefined();
    });

    it("deleteOwned removes doc and returns boolean", async () => {
      const mockModel = {
        findOneAndDelete: vi.fn().mockResolvedValue({ _id: VALID_ID }),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);

      expect(await repo.deleteOwned("invalid-id", "user-1")).toBe(false);
      expect(mockModel.findOneAndDelete).not.toHaveBeenCalled();

      const deleted = await repo.deleteOwned(VALID_ID, "user-1");
      expect(mockModel.findOneAndDelete).toHaveBeenCalledWith({ _id: VALID_ID, userId: "user-1" });
      expect(deleted).toBe(true);
    });

    it("listByUser queries by userId and applies filters post-normalization", async () => {
      const mockDocs = [
        {
          _id: VALID_ID,
          userId: "user-1",
          title: "Dinner Party",
          totalAmount: 100,
          currency: "USD",
          paidBy: "Alice",
          splitMode: "equal",
          participants: ["Alice", "Bob"],
          splitAmount: 50,
          splits: [
            { participant: "Alice", amount: 50, settled: true },
            { participant: "Bob", amount: 50, settled: true },
          ],
          group: "Weekend",
          shareToken: null,
          createdAt: new Date("2026-01-02"),
        },
        {
          _id: VALID_ID_2,
          userId: "user-1",
          title: "Coffee Break",
          totalAmount: 20,
          currency: "EUR",
          paidBy: "Bob",
          splitMode: "equal",
          participants: ["Alice", "Bob"],
          splitAmount: 10,
          splits: [
            { participant: "Alice", amount: 10, settled: false },
            { participant: "Bob", amount: 10, settled: false },
          ],
          group: null,
          shareToken: null,
          createdAt: new Date("2026-01-01"),
        },
      ];

      const mockModel = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockDocs),
          }),
        }),
      } as unknown as Model<BillDocument>;

      const repo = new MongooseBillRepository(mockModel);

      // Unfiltered
      const all = await repo.listByUser("user-1");
      expect(all).toHaveLength(2);

      // Filter by status: settled
      const settledOnly = await repo.listByUser("user-1", { status: "settled" });
      expect(settledOnly).toHaveLength(1);
      expect(settledOnly[0].title).toBe("Dinner Party");

      // Filter by currency: EUR
      const eurOnly = await repo.listByUser("user-1", { currency: "EUR" });
      expect(eurOnly).toHaveLength(1);
      expect(eurOnly[0].title).toBe("Coffee Break");

      // Filter by query q: "dinner"
      const qMatch = await repo.listByUser("user-1", { q: "dinner" });
      expect(qMatch).toHaveLength(1);
      expect(qMatch[0].title).toBe("Dinner Party");
    });
  });

  describe("5. InMemoryBillRepository CRUD, filtering, isolation, and parity", () => {
    it("rejects malformed IDs and cross-user operations", async () => {
      const repo = new InMemoryBillRepository();
      const created = await repo.create("user-1", {
        title: "Lunch",
        totalAmount: 30,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        participants: ["Alice", "Bob"],
      });

      // Malformed ID
      expect(await repo.findOwnedById("invalid-id", "user-1")).toBeNull();
      expect(await repo.updateOwned("invalid-id", "user-1", { title: "New" })).toBeNull();
      expect(
        await repo.toggleSettle("invalid-id", "user-1", { participant: "Bob", settled: true }),
      ).toBeNull();
      expect(await repo.setShareToken("invalid-id", "user-1", { enabled: true })).toBeNull();
      expect(await repo.deleteOwned("invalid-id", "user-1")).toBe(false);

      // Cross-user access with valid ID
      expect(await repo.findOwnedById(created.id, "user-2")).toBeNull();
      expect(await repo.updateOwned(created.id, "user-2", { title: "New" })).toBeNull();
      expect(
        await repo.toggleSettle(created.id, "user-2", { participant: "Bob", settled: true }),
      ).toBeNull();
      expect(await repo.setShareToken(created.id, "user-2", { enabled: true })).toBeNull();
      expect(await repo.deleteOwned(created.id, "user-2")).toBe(false);
    });

    it("creates bills with equal, exact, and percentage splits accurately", async () => {
      const repo = new InMemoryBillRepository();

      // Equal USD $100 / 3 -> 33.34, 33.33, 33.33
      const equalUsd = await repo.create("user-1", {
        title: "Equal USD",
        totalAmount: 100,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        participants: ["Alice", "Bob", "Charlie"],
      });
      expect(equalUsd.splits?.map((s) => s.amount)).toEqual([33.34, 33.33, 33.33]);
      expect(equalUsd.splitAmount).toBe(33.33);

      // Equal JPY 100 / 3 -> 34, 33, 33
      const equalJpy = await repo.create("user-1", {
        title: "Equal JPY",
        totalAmount: 100,
        currency: "JPY",
        paidBy: "Alice",
        splitMode: "equal",
        participants: ["Alice", "Bob", "Charlie"],
      });
      expect(equalJpy.splits?.map((s) => s.amount)).toEqual([34, 33, 33]);
      expect(equalJpy.splitAmount).toBe(33);

      // Exact splits
      const exactBill = await repo.create("user-1", {
        title: "Exact",
        totalAmount: 100,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "exact",
        participants: ["Alice", "Bob"],
        splits: [
          { participant: "Alice", amount: 60 },
          { participant: "Bob", amount: 40 },
        ],
      });
      expect(exactBill.splits?.map((s) => s.amount)).toEqual([60, 40]);

      // Percentage splits
      const pctBill = await repo.create("user-1", {
        title: "Percentage",
        totalAmount: 200,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "percentage",
        participants: ["Alice", "Bob"],
        splits: [
          { participant: "Alice", percentage: 70 },
          { participant: "Bob", percentage: 30 },
        ],
      });
      expect(pctBill.splits?.map((s) => s.amount)).toEqual([140, 60]);
    });

    it("hydrates seeded legacy records and handles toggleSettle and filtering", async () => {
      const repo = new InMemoryBillRepository();
      repo.seedLegacy([
        {
          id: VALID_ID,
          userId: "user-1",
          title: "Seeded Legacy Dinner",
          totalAmount: 90,
          participants: ["Alice", "Bob", "Cara"],
          splitAmount: 30,
          createdAt: new Date("2026-01-01T10:00:00.000Z"),
        },
      ]);

      // Legacy doc normalizes properly
      const fetched = await repo.findOwnedById(VALID_ID, "user-1");
      expect(fetched?.currency).toBe("USD");
      expect(fetched?.paidBy).toBe("Alice");
      expect(fetched?.splitMode).toBe("equal");
      expect(fetched?.splits).toHaveLength(3);

      // toggleSettle on legacy doc
      const updated = await repo.toggleSettle(VALID_ID, "user-1", {
        participant: "Bob",
        settled: true,
      });
      expect(updated?.splits?.find((s) => s.participant === "Bob")?.settled).toBe(true);

      // Non-member participant throws RepositoryValidationError
      await expect(
        repo.toggleSettle(VALID_ID, "user-1", { participant: "Eve", settled: true }),
      ).rejects.toThrow(RepositoryValidationError);

      // List filtering: unsettled vs settled
      const unsettledList = await repo.listByUser("user-1", { status: "unsettled" });
      expect(unsettledList).toHaveLength(1);

      const settledList = await repo.listByUser("user-1", { status: "settled" });
      expect(settledList).toHaveLength(0);
    });

    it("setShareToken and findByShareToken manage tokens and sanitize public summary", async () => {
      const repo = new InMemoryBillRepository();
      const created = await repo.create("user-1", {
        title: "Trip Share",
        totalAmount: 120,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        participants: ["Alice", "Bob"],
      });

      // Enable share token
      const shared = await repo.setShareToken(created.id, "user-1", { enabled: true });
      const token1 = shared?.shareToken;
      expect(token1).toBeTruthy();

      // Retrieve via findByShareToken
      const summary = await repo.findByShareToken(token1!);
      expect(summary).toBeDefined();
      expect(summary?.title).toBe("Trip Share");
      expect((summary as any)?.userId).toBeUndefined();
      expect((summary as any)?.shareToken).toBeUndefined();

      // Rotate token
      const rotated = await repo.setShareToken(created.id, "user-1", {
        enabled: true,
        rotate: true,
      });
      const token2 = rotated?.shareToken;
      expect(token2).toBeTruthy();
      expect(token2).not.toBe(token1);

      // Old token invalid
      expect(await repo.findByShareToken(token1!)).toBeNull();
      // New token valid
      expect(await repo.findByShareToken(token2!)).toBeDefined();

      // Revoke token
      await repo.setShareToken(created.id, "user-1", { enabled: false });
      expect(await repo.findByShareToken(token2!)).toBeNull();
    });

    it("returns defensive copies to prevent caller mutations from mutating repository", async () => {
      const repo = new InMemoryBillRepository();
      const created = await repo.create("user-1", {
        title: "Immutable Test",
        totalAmount: 50,
        currency: "USD",
        paidBy: "Alice",
        splitMode: "equal",
        participants: ["Alice", "Bob"],
      });

      // Mutate returned object
      created.title = "Hacked Title";
      if (created.splits && created.splits[0]) {
        created.splits[0].amount = 9999;
      }

      // Re-fetch
      const fresh = await repo.findOwnedById(created.id, "user-1");
      expect(fresh?.title).toBe("Immutable Test");
      expect(fresh?.splits?.[0].amount).toBe(25);
    });
  });
});
