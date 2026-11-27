import type { SPLIT_MODES, SUPPORTED_CURRENCIES } from "./constants.js";

/** Supported split modes: equal, exact, or percentage */
export type SplitMode = (typeof SPLIT_MODES)[number];

/** Supported ISO currency codes */
export type SupportedCurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

/** Currency metadata record */
export interface CurrencyMetadata {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

/** Individual participant's split share in a bill */
export interface BillSplit {
  participant: string;
  amount: number;
  percentage?: number;
  settled: boolean;
}

/** A single bill with full split information and metadata */
export interface Bill {
  id: string;
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
  createdAt: string;
}

/** Public bill summary omitting user identifiers and secret tokens */
export interface PublicBillSummary {
  id: string;
  title: string;
  totalAmount: number;
  currency?: string;
  paidBy?: string;
  splitMode?: SplitMode;
  splits?: BillSplit[];
  participants: string[];
  splitAmount: number;
  group?: string | null;
  createdAt: string;
}

/** Simplified net transfer between two participants in a specific currency */
export interface NetTransfer {
  currency: string;
  from: string;
  to: string;
  amount: number;
}

/** Legacy database bill document shape for schema normalization */
export interface LegacyBillRecord {
  id?: string;
  _id?: unknown;
  title: string;
  totalAmount: number;
  participants: string[];
  splitAmount?: number;
  currency?: string | null;
  paidBy?: string | null;
  splitMode?: SplitMode | string | null;
  splits?: Array<{
    participant: string;
    amount: number;
    percentage?: number;
    settled?: boolean;
  }> | null;
  group?: string | null;
  shareToken?: string | null;
  createdAt: string | Date;
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
