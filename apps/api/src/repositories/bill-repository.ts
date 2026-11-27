import { randomBytes } from "node:crypto";
import { isValidObjectId, type Model } from "mongoose";
import {
  DEFAULT_CURRENCY,
  computeBillSplits,
  normalizeLegacyBill,
  roundToCurrency,
  type Bill,
  type BillSplit,
  type CreateBillInput,
  type PublicBillSummary,
  type SettleBillInput,
  type ShareBillInput,
  type SplitMode,
  type UpdateBillInput,
} from "@bill-splitter/core";
import { BillModel, type BillDocument } from "../models/bill.js";

export interface BillListFilters {
  q?: string;
  group?: string;
  status?: "settled" | "unsettled" | "all";
  currency?: string;
}

export class RepositoryValidationError extends Error {
  readonly issues?: Array<{ path: string; message: string }>;

  constructor(message: string, issues?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = "RepositoryValidationError";
    this.issues = issues;
  }
}

export function toBill(document: BillDocument & { _id: unknown; id?: string }): Bill {
  const rawSplits = document.splits
    ? (Array.isArray(document.splits) ? document.splits : []).map((s: BillSplit) => ({
        participant: String(s.participant ?? ""),
        amount: Number(s.amount ?? 0),
        ...(s.percentage !== undefined && s.percentage !== null
          ? { percentage: Number(s.percentage) }
          : {}),
        settled: Boolean(s.settled),
      }))
    : undefined;

  const id =
    document.id ??
    (document._id !== undefined && document._id !== null ? String(document._id) : "");

  return normalizeLegacyBill({
    id,
    _id: document._id,
    title: document.title,
    totalAmount: document.totalAmount,
    participants: document.participants,
    splitAmount: document.splitAmount,
    currency: document.currency,
    paidBy: document.paidBy,
    splitMode: document.splitMode,
    splits: rawSplits,
    group: document.group,
    shareToken: document.shareToken,
    createdAt:
      document.createdAt instanceof Date
        ? document.createdAt.toISOString()
        : (document.createdAt ?? new Date().toISOString()),
  });
}

export function toPublicBillSummary(bill: Bill): PublicBillSummary {
  return {
    id: bill.id,
    title: bill.title,
    totalAmount: bill.totalAmount,
    currency: bill.currency,
    paidBy: bill.paidBy,
    splitMode: bill.splitMode,
    splits: bill.splits ? bill.splits.map((s) => ({ ...s })) : undefined,
    participants: [...bill.participants],
    splitAmount: bill.splitAmount,
    group: bill.group ?? null,
    createdAt: bill.createdAt,
  };
}

export interface BillRepository {
  listByUser(userId: string, filters?: BillListFilters): Promise<Bill[]>;
  findOwnedById(id: string, userId: string): Promise<Bill | null>;
  create(userId: string, input: CreateBillInput): Promise<Bill>;
  updateOwned(id: string, userId: string, input: UpdateBillInput): Promise<Bill | null>;
  toggleSettle(id: string, userId: string, input: SettleBillInput): Promise<Bill | null>;
  setShareToken(id: string, userId: string, input: ShareBillInput): Promise<Bill | null>;
  deleteOwned(id: string, userId: string): Promise<boolean>;
  findByShareToken(token: string): Promise<PublicBillSummary | null>;
}

export class MongooseBillRepository implements BillRepository {
  constructor(private readonly billModel: Model<BillDocument> = BillModel) {}

  async listByUser(userId: string, filters?: BillListFilters): Promise<Bill[]> {
    const query: Record<string, unknown> = { userId };
    if (filters?.group !== undefined) {
      query.group = filters.group;
    }

    const documents = await this.billModel.find(query).sort({ createdAt: -1 }).lean();
    let bills = documents.map((doc) => toBill(doc as unknown as BillDocument & { _id: unknown }));

    if (filters?.currency) {
      const cur = filters.currency.trim().toUpperCase();
      bills = bills.filter((b) => b.currency?.toUpperCase() === cur);
    }

    if (filters?.status === "settled") {
      bills = bills.filter(
        (b) => b.splits && b.splits.length > 0 && b.splits.every((s) => s.settled),
      );
    } else if (filters?.status === "unsettled") {
      bills = bills.filter(
        (b) => !b.splits || b.splits.length === 0 || b.splits.some((s) => !s.settled),
      );
    }

    if (filters?.q) {
      const q = filters.q.trim().toLowerCase();
      if (q.length > 0) {
        bills = bills.filter((b) => {
          if (b.title.toLowerCase().includes(q)) return true;
          if (b.paidBy && b.paidBy.toLowerCase().includes(q)) return true;
          if (b.group && b.group.toLowerCase().includes(q)) return true;
          if (b.participants.some((p) => p.toLowerCase().includes(q))) return true;
          return false;
        });
      }
    }

    return bills;
  }

  async findOwnedById(id: string, userId: string): Promise<Bill | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    const doc = await this.billModel.findOne({ _id: id, userId }).lean();
    return doc ? toBill(doc as unknown as BillDocument & { _id: unknown }) : null;
  }

  async create(userId: string, input: CreateBillInput): Promise<Bill> {
    const currency = input.currency ?? DEFAULT_CURRENCY;
    const splitMode = input.splitMode ?? "equal";
    const splits = computeBillSplits({
      totalAmount: input.totalAmount,
      currency,
      participants: input.participants,
      paidBy: input.paidBy,
      splitMode,
      splits: input.splits,
    });
    const splitAmount = roundToCurrency(
      input.totalAmount / Math.max(input.participants.length, 1),
      currency,
    );
    const group = input.group ?? null;
    const shareToken = null;

    const doc = await this.billModel.create({
      userId,
      title: input.title,
      totalAmount: input.totalAmount,
      participants: input.participants,
      splitAmount,
      currency,
      paidBy: input.paidBy,
      splitMode,
      splits,
      group,
      shareToken,
    });

    return toBill(doc as unknown as BillDocument & { _id: unknown });
  }

  async updateOwned(id: string, userId: string, input: UpdateBillInput): Promise<Bill | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    const doc = await this.billModel.findOne({ _id: id, userId });
    if (!doc) {
      return null;
    }

    const current = toBill(doc as unknown as BillDocument & { _id: unknown });
    const mergedTitle = input.title ?? current.title;
    const mergedTotal = input.totalAmount ?? current.totalAmount;
    const mergedCurrency = input.currency ?? current.currency ?? DEFAULT_CURRENCY;
    const mergedParticipants = input.participants
      ? [...input.participants]
      : [...current.participants];
    const mergedPaidBy = input.paidBy ?? current.paidBy ?? mergedParticipants[0];
    const mergedSplitMode = input.splitMode ?? current.splitMode ?? "equal";
    const mergedGroup = input.group !== undefined ? input.group : (current.group ?? null);

    if (mergedTotal <= 0 || !Number.isFinite(mergedTotal)) {
      throw new RepositoryValidationError("Total amount must be greater than zero", [
        { path: "totalAmount", message: "Total amount must be greater than zero" },
      ]);
    }
    if (!mergedParticipants || mergedParticipants.length === 0) {
      throw new RepositoryValidationError("At least one participant is required", [
        { path: "participants", message: "At least one participant is required" },
      ]);
    }
    const uniqueParticipants = new Set(mergedParticipants);
    if (uniqueParticipants.size !== mergedParticipants.length) {
      throw new RepositoryValidationError("Participants must be unique", [
        { path: "participants", message: "Participants must be unique" },
      ]);
    }
    if (!uniqueParticipants.has(mergedPaidBy)) {
      throw new RepositoryValidationError("Payer must be one of the participants", [
        { path: "paidBy", message: "Payer must be one of the participants" },
      ]);
    }

    if (mergedSplitMode === "exact") {
      const splitsToCheck = input.splits ?? current.splits;
      if (!splitsToCheck || splitsToCheck.length === 0) {
        throw new RepositoryValidationError("Splits are required for exact split mode", [
          { path: "splits", message: "Splits are required for exact split mode" },
        ]);
      }
      const splitParts = new Set(splitsToCheck.map((s) => s.participant));
      if (
        splitParts.size !== splitsToCheck.length ||
        !mergedParticipants.every((p) => splitParts.has(p))
      ) {
        throw new RepositoryValidationError(
          "Splits must cover all participants without duplicates",
          [{ path: "splits", message: "Splits must cover all participants without duplicates" }],
        );
      }
      const sum = splitsToCheck.reduce((acc, s) => acc + (s.amount ?? 0), 0);
      if (Math.abs(sum - mergedTotal) > 0.01) {
        throw new RepositoryValidationError("Sum of exact splits must equal total amount", [
          { path: "splits", message: "Sum of exact splits must equal total amount" },
        ]);
      }
    }

    if (mergedSplitMode === "percentage") {
      const splitsToCheck = input.splits ?? current.splits;
      if (!splitsToCheck || splitsToCheck.length === 0) {
        throw new RepositoryValidationError("Splits are required for percentage split mode", [
          { path: "splits", message: "Splits are required for percentage split mode" },
        ]);
      }
      const splitParts = new Set(splitsToCheck.map((s) => s.participant));
      if (
        splitParts.size !== splitsToCheck.length ||
        !mergedParticipants.every((p) => splitParts.has(p))
      ) {
        throw new RepositoryValidationError(
          "Splits must cover all participants without duplicates",
          [{ path: "splits", message: "Splits must cover all participants without duplicates" }],
        );
      }
      const sumPct = splitsToCheck.reduce((acc, s) => acc + (s.percentage ?? 0), 0);
      if (Math.abs(sumPct - 100) > 0.01) {
        throw new RepositoryValidationError("Sum of percentage splits must equal 100%", [
          { path: "splits", message: "Sum of percentage splits must equal 100%" },
        ]);
      }
    }

    const settledMap = new Map<string, boolean>();
    for (const s of current.splits ?? []) {
      settledMap.set(s.participant, s.settled);
    }

    const splitsInput = (
      input.splits ?? (mergedSplitMode === current.splitMode ? current.splits : undefined)
    )?.map((s) => ({
      participant: s.participant,
      amount: s.amount,
      percentage: s.percentage,
      settled: s.settled !== undefined ? s.settled : (settledMap.get(s.participant) ?? false),
    }));

    const recomputedSplits = computeBillSplits({
      totalAmount: mergedTotal,
      currency: mergedCurrency,
      participants: mergedParticipants,
      paidBy: mergedPaidBy,
      splitMode: mergedSplitMode,
      splits: splitsInput,
    });

    for (const split of recomputedSplits) {
      if (split.settled === undefined) {
        split.settled = settledMap.get(split.participant) ?? false;
      }
    }

    const splitAmount = roundToCurrency(
      mergedTotal / Math.max(mergedParticipants.length, 1),
      mergedCurrency,
    );

    doc.title = mergedTitle;
    doc.totalAmount = mergedTotal;
    doc.currency = mergedCurrency;
    doc.participants = mergedParticipants;
    doc.paidBy = mergedPaidBy;
    doc.splitMode = mergedSplitMode;
    doc.splits = recomputedSplits;
    doc.splitAmount = splitAmount;
    doc.group = mergedGroup;

    await doc.save();
    return toBill(doc as unknown as BillDocument & { _id: unknown });
  }

  async toggleSettle(id: string, userId: string, input: SettleBillInput): Promise<Bill | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    const doc = await this.billModel.findOne({ _id: id, userId });
    if (!doc) {
      return null;
    }

    const current = toBill(doc as unknown as BillDocument & { _id: unknown });
    const participantName = input.participant.trim();
    const splits = current.splits ? current.splits.map((s) => ({ ...s })) : [];
    const targetSplit = splits.find((s) => s.participant === participantName);

    if (!targetSplit) {
      throw new RepositoryValidationError("Participant not found in bill", [
        { path: "participant", message: "Participant is not part of this bill" },
      ]);
    }

    targetSplit.settled = input.settled;

    doc.currency = current.currency;
    doc.paidBy = current.paidBy;
    doc.splitMode = current.splitMode;
    doc.splits = splits;
    doc.splitAmount = current.splitAmount;
    doc.group = current.group;
    doc.shareToken = current.shareToken;

    await doc.save();
    return toBill(doc as unknown as BillDocument & { _id: unknown });
  }

  async setShareToken(id: string, userId: string, input: ShareBillInput): Promise<Bill | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    const doc = await this.billModel.findOne({ _id: id, userId });
    if (!doc) {
      return null;
    }

    const current = toBill(doc as unknown as BillDocument & { _id: unknown });
    doc.currency = current.currency;
    doc.paidBy = current.paidBy;
    doc.splitMode = current.splitMode;
    doc.splits = current.splits;
    doc.splitAmount = current.splitAmount;
    doc.group = current.group;

    if (!input.enabled) {
      doc.shareToken = null;
    } else {
      if (doc.shareToken && !input.rotate) {
        // preserve existing
      } else {
        doc.shareToken = randomBytes(24).toString("base64url");
      }
    }

    await doc.save();
    return toBill(doc as unknown as BillDocument & { _id: unknown });
  }

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    if (!isValidObjectId(id)) {
      return false;
    }
    const deleted = await this.billModel.findOneAndDelete({ _id: id, userId });
    return Boolean(deleted);
  }

  async findByShareToken(token: string): Promise<PublicBillSummary | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
      return null;
    }
    const doc = await this.billModel.findOne({ shareToken: token }).lean();
    return doc
      ? toPublicBillSummary(toBill(doc as unknown as BillDocument & { _id: unknown }))
      : null;
  }
}

interface StoredBillRecord {
  _id: string;
  userId: string;
  title: string;
  totalAmount: number;
  participants: string[];
  splitAmount: number;
  currency?: string;
  paidBy?: string;
  splitMode?: SplitMode;
  splits?: BillSplit[];
  group?: string | null;
  shareToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class InMemoryBillRepository implements BillRepository {
  private readonly storage = new Map<string, StoredBillRecord>();

  private isValidId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  private cloneBill(bill: Bill): Bill {
    return {
      ...bill,
      participants: [...bill.participants],
      splits: bill.splits ? bill.splits.map((s) => ({ ...s })) : undefined,
    };
  }

  seedLegacy(
    records: Array<
      Partial<StoredBillRecord> & {
        id?: string;
        _id?: unknown;
        userId: string;
        title: string;
        totalAmount: number;
        participants: string[];
        splitAmount?: number;
      }
    >,
  ): void {
    for (const raw of records) {
      const id = String(raw.id ?? raw._id ?? randomBytes(12).toString("hex"));
      const record: StoredBillRecord = {
        _id: id,
        userId: raw.userId,
        title: raw.title,
        totalAmount: raw.totalAmount,
        participants: [...raw.participants],
        splitAmount:
          raw.splitAmount ??
          roundToCurrency(raw.totalAmount / Math.max(raw.participants.length, 1), "USD"),
        currency: raw.currency ?? undefined,
        paidBy: raw.paidBy ?? undefined,
        splitMode: raw.splitMode ?? undefined,
        splits: raw.splits ? raw.splits.map((s) => ({ ...s })) : undefined,
        group: raw.group ?? null,
        shareToken: raw.shareToken ?? null,
        createdAt:
          raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt ?? Date.now()),
        updatedAt:
          raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt ?? Date.now()),
      };
      this.storage.set(id, record);
    }
  }

  async listByUser(userId: string, filters?: BillListFilters): Promise<Bill[]> {
    let records = Array.from(this.storage.values()).filter((r) => r.userId === userId);
    if (filters?.group !== undefined) {
      records = records.filter((r) => (r.group ?? null) === filters.group);
    }
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let bills = records.map((r) =>
      this.cloneBill(toBill(r as unknown as BillDocument & { _id: unknown })),
    );

    if (filters?.currency) {
      const cur = filters.currency.trim().toUpperCase();
      bills = bills.filter((b) => b.currency?.toUpperCase() === cur);
    }

    if (filters?.status === "settled") {
      bills = bills.filter(
        (b) => b.splits && b.splits.length > 0 && b.splits.every((s) => s.settled),
      );
    } else if (filters?.status === "unsettled") {
      bills = bills.filter(
        (b) => !b.splits || b.splits.length === 0 || b.splits.some((s) => !s.settled),
      );
    }

    if (filters?.q) {
      const q = filters.q.trim().toLowerCase();
      if (q.length > 0) {
        bills = bills.filter((b) => {
          if (b.title.toLowerCase().includes(q)) return true;
          if (b.paidBy && b.paidBy.toLowerCase().includes(q)) return true;
          if (b.group && b.group.toLowerCase().includes(q)) return true;
          if (b.participants.some((p) => p.toLowerCase().includes(q))) return true;
          return false;
        });
      }
    }

    return bills;
  }

  async findOwnedById(id: string, userId: string): Promise<Bill | null> {
    if (!this.isValidId(id)) return null;
    const record = this.storage.get(id);
    if (!record || record.userId !== userId) return null;
    return this.cloneBill(toBill(record as unknown as BillDocument & { _id: unknown }));
  }

  async create(userId: string, input: CreateBillInput): Promise<Bill> {
    const id = randomBytes(12).toString("hex");
    const currency = input.currency ?? DEFAULT_CURRENCY;
    const splitMode = input.splitMode ?? "equal";
    const splits = computeBillSplits({
      totalAmount: input.totalAmount,
      currency,
      participants: input.participants,
      paidBy: input.paidBy,
      splitMode,
      splits: input.splits,
    });
    const splitAmount = roundToCurrency(
      input.totalAmount / Math.max(input.participants.length, 1),
      currency,
    );
    const now = new Date();
    const record: StoredBillRecord = {
      _id: id,
      userId,
      title: input.title,
      totalAmount: input.totalAmount,
      participants: [...input.participants],
      splitAmount,
      currency,
      paidBy: input.paidBy,
      splitMode,
      splits,
      group: input.group ?? null,
      shareToken: null,
      createdAt: now,
      updatedAt: now,
    };
    this.storage.set(id, record);
    return this.cloneBill(toBill(record as unknown as BillDocument & { _id: unknown }));
  }

  async updateOwned(id: string, userId: string, input: UpdateBillInput): Promise<Bill | null> {
    if (!this.isValidId(id)) return null;
    const record = this.storage.get(id);
    if (!record || record.userId !== userId) return null;

    const current = toBill(record as unknown as BillDocument & { _id: unknown });
    const mergedTitle = input.title ?? current.title;
    const mergedTotal = input.totalAmount ?? current.totalAmount;
    const mergedCurrency = input.currency ?? current.currency ?? DEFAULT_CURRENCY;
    const mergedParticipants = input.participants
      ? [...input.participants]
      : [...current.participants];
    const mergedPaidBy = input.paidBy ?? current.paidBy ?? mergedParticipants[0];
    const mergedSplitMode = input.splitMode ?? current.splitMode ?? "equal";
    const mergedGroup = input.group !== undefined ? input.group : (current.group ?? null);

    if (mergedTotal <= 0 || !Number.isFinite(mergedTotal)) {
      throw new RepositoryValidationError("Total amount must be greater than zero", [
        { path: "totalAmount", message: "Total amount must be greater than zero" },
      ]);
    }
    if (!mergedParticipants || mergedParticipants.length === 0) {
      throw new RepositoryValidationError("At least one participant is required", [
        { path: "participants", message: "At least one participant is required" },
      ]);
    }
    const uniqueParticipants = new Set(mergedParticipants);
    if (uniqueParticipants.size !== mergedParticipants.length) {
      throw new RepositoryValidationError("Participants must be unique", [
        { path: "participants", message: "Participants must be unique" },
      ]);
    }
    if (!uniqueParticipants.has(mergedPaidBy)) {
      throw new RepositoryValidationError("Payer must be one of the participants", [
        { path: "paidBy", message: "Payer must be one of the participants" },
      ]);
    }

    if (mergedSplitMode === "exact") {
      const splitsToCheck = input.splits ?? current.splits;
      if (!splitsToCheck || splitsToCheck.length === 0) {
        throw new RepositoryValidationError("Splits are required for exact split mode", [
          { path: "splits", message: "Splits are required for exact split mode" },
        ]);
      }
      const splitParts = new Set(splitsToCheck.map((s) => s.participant));
      if (
        splitParts.size !== splitsToCheck.length ||
        !mergedParticipants.every((p) => splitParts.has(p))
      ) {
        throw new RepositoryValidationError(
          "Splits must cover all participants without duplicates",
          [{ path: "splits", message: "Splits must cover all participants without duplicates" }],
        );
      }
      const sum = splitsToCheck.reduce((acc, s) => acc + (s.amount ?? 0), 0);
      if (Math.abs(sum - mergedTotal) > 0.01) {
        throw new RepositoryValidationError("Sum of exact splits must equal total amount", [
          { path: "splits", message: "Sum of exact splits must equal total amount" },
        ]);
      }
    }

    if (mergedSplitMode === "percentage") {
      const splitsToCheck = input.splits ?? current.splits;
      if (!splitsToCheck || splitsToCheck.length === 0) {
        throw new RepositoryValidationError("Splits are required for percentage split mode", [
          { path: "splits", message: "Splits are required for percentage split mode" },
        ]);
      }
      const splitParts = new Set(splitsToCheck.map((s) => s.participant));
      if (
        splitParts.size !== splitsToCheck.length ||
        !mergedParticipants.every((p) => splitParts.has(p))
      ) {
        throw new RepositoryValidationError(
          "Splits must cover all participants without duplicates",
          [{ path: "splits", message: "Splits must cover all participants without duplicates" }],
        );
      }
      const sumPct = splitsToCheck.reduce((acc, s) => acc + (s.percentage ?? 0), 0);
      if (Math.abs(sumPct - 100) > 0.01) {
        throw new RepositoryValidationError("Sum of percentage splits must equal 100%", [
          { path: "splits", message: "Sum of percentage splits must equal 100%" },
        ]);
      }
    }

    const settledMap = new Map<string, boolean>();
    for (const s of current.splits ?? []) {
      settledMap.set(s.participant, s.settled);
    }
    const splitsInput = (
      input.splits ?? (mergedSplitMode === current.splitMode ? current.splits : undefined)
    )?.map((s) => ({
      participant: s.participant,
      amount: s.amount,
      percentage: s.percentage,
      settled: s.settled !== undefined ? s.settled : (settledMap.get(s.participant) ?? false),
    }));

    const recomputedSplits = computeBillSplits({
      totalAmount: mergedTotal,
      currency: mergedCurrency,
      participants: mergedParticipants,
      paidBy: mergedPaidBy,
      splitMode: mergedSplitMode,
      splits: splitsInput,
    });

    for (const split of recomputedSplits) {
      if (split.settled === undefined) {
        split.settled = settledMap.get(split.participant) ?? false;
      }
    }

    const splitAmount = roundToCurrency(
      mergedTotal / Math.max(mergedParticipants.length, 1),
      mergedCurrency,
    );

    record.title = mergedTitle;
    record.totalAmount = mergedTotal;
    record.currency = mergedCurrency;
    record.participants = mergedParticipants;
    record.paidBy = mergedPaidBy;
    record.splitMode = mergedSplitMode;
    record.splits = recomputedSplits;
    record.splitAmount = splitAmount;
    record.group = mergedGroup;
    record.updatedAt = new Date();

    return this.cloneBill(toBill(record as unknown as BillDocument & { _id: unknown }));
  }

  async toggleSettle(id: string, userId: string, input: SettleBillInput): Promise<Bill | null> {
    if (!this.isValidId(id)) return null;
    const record = this.storage.get(id);
    if (!record || record.userId !== userId) return null;

    const current = toBill(record as unknown as BillDocument & { _id: unknown });
    const participantName = input.participant.trim();
    const splits = current.splits ? current.splits.map((s) => ({ ...s })) : [];
    const targetSplit = splits.find((s) => s.participant === participantName);

    if (!targetSplit) {
      throw new RepositoryValidationError("Participant not found in bill", [
        { path: "participant", message: "Participant is not part of this bill" },
      ]);
    }

    targetSplit.settled = input.settled;

    record.currency = current.currency;
    record.paidBy = current.paidBy;
    record.splitMode = current.splitMode;
    record.splits = splits;
    record.splitAmount = current.splitAmount;
    record.group = current.group;
    record.shareToken = current.shareToken;
    record.updatedAt = new Date();

    return this.cloneBill(toBill(record as unknown as BillDocument & { _id: unknown }));
  }

  async setShareToken(id: string, userId: string, input: ShareBillInput): Promise<Bill | null> {
    if (!this.isValidId(id)) return null;
    const record = this.storage.get(id);
    if (!record || record.userId !== userId) return null;

    const current = toBill(record as unknown as BillDocument & { _id: unknown });
    record.currency = current.currency;
    record.paidBy = current.paidBy;
    record.splitMode = current.splitMode;
    record.splits = current.splits;
    record.splitAmount = current.splitAmount;
    record.group = current.group;

    if (!input.enabled) {
      record.shareToken = null;
    } else {
      if (record.shareToken && !input.rotate) {
        // preserve existing
      } else {
        let token: string;
        do {
          token = randomBytes(24).toString("base64url");
        } while (
          Array.from(this.storage.values()).some((r) => r.shareToken === token && r._id !== id)
        );
        record.shareToken = token;
      }
    }
    record.updatedAt = new Date();

    return this.cloneBill(toBill(record as unknown as BillDocument & { _id: unknown }));
  }

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    if (!this.isValidId(id)) return false;
    const record = this.storage.get(id);
    if (!record || record.userId !== userId) return false;
    this.storage.delete(id);
    return true;
  }

  async findByShareToken(token: string): Promise<PublicBillSummary | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
    const record = Array.from(this.storage.values()).find((r) => r.shareToken === token);
    return record
      ? toPublicBillSummary(toBill(record as unknown as BillDocument & { _id: unknown }))
      : null;
  }
}
