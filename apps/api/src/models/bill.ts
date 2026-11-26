import { model, models, Schema } from "mongoose";

export interface BillDocument {
  userId: string;
  title: string;
  totalAmount: number;
  participants: string[];
  splitAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const billSchema = new Schema<BillDocument>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    participants: { type: [String], required: true },
    splitAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export const BillModel = models.Bill ?? model<BillDocument>("Bill", billSchema);
