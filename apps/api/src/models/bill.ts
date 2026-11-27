import mongoose, { type Model, Schema } from "mongoose";
import { type BillSplit, type SplitMode, SPLIT_MODES } from "@bill-splitter/core";

export interface BillDocument {
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

const billSplitSchema = new Schema<BillSplit>(
  {
    participant: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: false, min: 0, max: 100 },
    settled: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

export const billSchema = new Schema<BillDocument>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    participants: { type: [String], required: true },
    splitAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "USD" },
    paidBy: { type: String, trim: true },
    splitMode: { type: String, enum: [...SPLIT_MODES], default: "equal" },
    splits: { type: [billSplitSchema], default: undefined },
    group: { type: String, trim: true, default: null },
    shareToken: { type: String, default: null },
  },
  { timestamps: true },
);

billSchema.index({ userId: 1, createdAt: -1 });
billSchema.index({ userId: 1, group: 1, createdAt: -1 });
billSchema.index(
  { shareToken: 1 },
  { unique: true, partialFilterExpression: { shareToken: { $type: "string" } } },
);

export const BillModel: Model<BillDocument> =
  (mongoose.models.Bill as Model<BillDocument> | undefined) ??
  mongoose.model<BillDocument>("Bill", billSchema);
