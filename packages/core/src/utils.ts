import { DEFAULT_CURRENCY, LOCALE_CURRENCY_MAP, SUPPORTED_CURRENCIES } from "./constants.js";
import type { Bill, BillSplit, LegacyBillRecord, NetTransfer, SplitMode } from "./types.js";
import type { BillSplitInput } from "./schemas.js";

/**
 * Retrieve decimal precision for an ISO currency code.
 * Defaults to 2 for unknown currencies, 0 for JPY.
 */
export function getCurrencyDecimals(currencyCode?: string): number {
  if (!currencyCode) return 2;
  const code = currencyCode.toUpperCase();
  if (code in SUPPORTED_CURRENCIES) {
    return SUPPORTED_CURRENCIES[code as keyof typeof SUPPORTED_CURRENCIES].decimals;
  }
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Round an amount according to currency decimal rules.
 * Safely handles NaN, Infinity, and normalizes -0 to 0.
 */
export function roundToCurrency(amount: number, currencyCode: string = DEFAULT_CURRENCY): number {
  if (!Number.isFinite(amount)) return 0;
  const decimals = getCurrencyDecimals(currencyCode);
  const factor = 10 ** decimals;
  const rounded = Math.round((amount + Math.sign(amount) * 1e-12) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Backward-compatible split calculation.
 * Preserves 2-argument and 3-argument call signatures.
 */
export function calculateSplit(
  total: number,
  numParticipants: number,
  currencyCode: string = DEFAULT_CURRENCY,
): number {
  if (numParticipants <= 0) return 0;
  return roundToCurrency(total / numParticipants, currencyCode);
}

/** Parameters for computing bill splits */
export interface ComputeBillSplitsParams {
  totalAmount: number;
  currency?: string;
  participants: string[];
  paidBy: string;
  splitMode?: SplitMode;
  splits?: BillSplitInput[];
  customAmounts?: Record<string, number>;
  customPercentages?: Record<string, number>;
}

/**
 * Strategy interface for split calculation.
 * Adheres to open-closed design and guard-clause pattern.
 */
interface SplitStrategy {
  calculate(params: ComputeBillSplitsParams, totalMinor: number, factor: number): BillSplit[];
}

class EqualSplitStrategy implements SplitStrategy {
  calculate(params: ComputeBillSplitsParams, totalMinor: number, factor: number): BillSplit[] {
    const count = params.participants.length;
    const baseMinor = Math.floor(totalMinor / count);
    const remainder = totalMinor - baseMinor * count;

    return params.participants.map((participant, index) => {
      const minor = baseMinor + (index < remainder ? 1 : 0);
      const inputSplit = params.splits?.find((s) => s.participant === participant);
      return {
        participant,
        amount: minor / factor,
        settled: Boolean(inputSplit?.settled),
      };
    });
  }
}

class ExactSplitStrategy implements SplitStrategy {
  calculate(params: ComputeBillSplitsParams, totalMinor: number, factor: number): BillSplit[] {
    const splits = params.participants.map((participant) => {
      const inputSplit = params.splits?.find((s) => s.participant === participant);
      const rawAmount = params.customAmounts?.[participant] ?? inputSplit?.amount ?? 0;
      const minor = Math.round(rawAmount * factor);
      return {
        participant,
        minor,
        settled: Boolean(inputSplit?.settled),
      };
    });

    const sumMinor = splits.reduce((acc, s) => acc + s.minor, 0);
    let diff = totalMinor - sumMinor;

    if (diff !== 0) {
      for (let i = 0; i < splits.length && diff !== 0; i++) {
        const step = Math.sign(diff);
        if (splits[i].minor + step >= 0) {
          splits[i].minor += step;
          diff -= step;
        }
      }
    }

    return splits.map((s) => ({
      participant: s.participant,
      amount: s.minor / factor,
      settled: s.settled,
    }));
  }
}

class PercentageSplitStrategy implements SplitStrategy {
  calculate(params: ComputeBillSplitsParams, totalMinor: number, factor: number): BillSplit[] {
    const count = params.participants.length;
    const allocations = params.participants.map((participant, idx) => {
      const inputSplit = params.splits?.find((s) => s.participant === participant);
      const pct = params.customPercentages?.[participant] ?? inputSplit?.percentage ?? 100 / count;
      const exactMinor = (totalMinor * pct) / 100;
      const floorMinor = Math.floor(exactMinor);
      const fraction = exactMinor - floorMinor;
      return {
        participant,
        idx,
        pct,
        floorMinor,
        fraction,
        settled: Boolean(inputSplit?.settled),
      };
    });

    const sumFloor = allocations.reduce((acc, a) => acc + a.floorMinor, 0);
    const remainder = totalMinor - sumFloor;

    const sortedByFraction = [...allocations].sort((a, b) => {
      const diff = b.fraction - a.fraction;
      if (Math.abs(diff) > 1e-9) return diff;
      return a.idx - b.idx;
    });

    const minorMap = new Map<string, number>();
    for (const a of allocations) {
      minorMap.set(a.participant, a.floorMinor);
    }

    if (remainder > 0) {
      for (let i = 0; i < remainder && i < sortedByFraction.length; i++) {
        const p = sortedByFraction[i].participant;
        minorMap.set(p, (minorMap.get(p) ?? 0) + 1);
      }
    } else if (remainder < 0) {
      let deficit = Math.abs(remainder);
      for (let i = sortedByFraction.length - 1; i >= 0 && deficit > 0; i--) {
        const p = sortedByFraction[i].participant;
        const cur = minorMap.get(p) ?? 0;
        if (cur > 0) {
          minorMap.set(p, cur - 1);
          deficit--;
        }
      }
    }

    return allocations.map((a) => ({
      participant: a.participant,
      amount: (minorMap.get(a.participant) ?? 0) / factor,
      percentage: a.pct,
      settled: a.settled,
    }));
  }
}

const splitStrategies: Record<SplitMode, SplitStrategy> = {
  equal: new EqualSplitStrategy(),
  exact: new ExactSplitStrategy(),
  percentage: new PercentageSplitStrategy(),
};

/**
 * Pure split engine computing per-participant amounts with minor unit precision.
 */
export function computeBillSplits(params: ComputeBillSplitsParams): BillSplit[] {
  if (!params.participants || params.participants.length === 0) {
    return [];
  }

  const currency = params.currency || DEFAULT_CURRENCY;
  const splitMode = params.splitMode || "equal";
  const decimals = getCurrencyDecimals(currency);
  const factor = 10 ** decimals;
  const totalRounded = roundToCurrency(params.totalAmount, currency);
  const totalMinor = Math.round(totalRounded * factor);

  const strategy = splitStrategies[splitMode] ?? splitStrategies.equal;
  return strategy.calculate(params, totalMinor, factor);
}

/**
 * Normalizes legacy database records or partial inputs to strict Bill schema.
 */
export function normalizeLegacyBill(raw: LegacyBillRecord): Bill {
  const id = raw.id ?? (raw._id !== undefined && raw._id !== null ? String(raw._id) : "");
  const rawCurrency = typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : "";
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : DEFAULT_CURRENCY;
  const participants = Array.isArray(raw.participants)
    ? raw.participants.map((p) => String(p).trim()).filter(Boolean)
    : [];
  const paidBy =
    typeof raw.paidBy === "string" && raw.paidBy.trim().length > 0
      ? raw.paidBy.trim()
      : (participants[0] ?? "Unknown");
  const splitMode: SplitMode =
    raw.splitMode === "exact" || raw.splitMode === "percentage" || raw.splitMode === "equal"
      ? raw.splitMode
      : "equal";
  const totalAmount =
    typeof raw.totalAmount === "number" && !isNaN(raw.totalAmount) ? raw.totalAmount : 0;
  const splitAmount =
    participants.length > 0 ? roundToCurrency(totalAmount / participants.length, currency) : 0;

  let splits: BillSplit[];
  if (raw.splits && raw.splits.length > 0) {
    splits = raw.splits.map((s) => ({
      participant: s.participant,
      amount: roundToCurrency(s.amount, currency),
      ...(s.percentage !== undefined ? { percentage: s.percentage } : {}),
      settled: Boolean(s.settled),
    }));
  } else {
    splits = computeBillSplits({
      totalAmount,
      currency,
      participants,
      paidBy,
      splitMode,
    });
  }

  const group =
    typeof raw.group === "string" && raw.group.trim().length > 0 ? raw.group.trim() : null;
  const shareToken =
    typeof raw.shareToken === "string" && raw.shareToken.trim().length > 0
      ? raw.shareToken.trim()
      : null;

  let createdAt: string;
  if (raw.createdAt instanceof Date) {
    createdAt = raw.createdAt.toISOString();
  } else if (typeof raw.createdAt === "string" && !isNaN(Date.parse(raw.createdAt))) {
    createdAt = new Date(raw.createdAt).toISOString();
  } else {
    createdAt = String(raw.createdAt || new Date().toISOString());
  }

  return {
    id,
    title: raw.title ?? "",
    totalAmount,
    participants,
    splitAmount,
    currency,
    paidBy,
    splitMode,
    splits,
    group,
    shareToken,
    createdAt,
  };
}

/**
 * Detect the user's default currency ISO code from locale.
 */
export function detectDefaultCurrency(locales?: string | readonly string[]): string {
  const tags: string[] = [];
  if (locales) {
    if (Array.isArray(locales)) {
      tags.push(...locales);
    } else if (typeof locales === "string") {
      tags.push(locales);
    }
  } else if (typeof navigator !== "undefined") {
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
      tags.push(...navigator.languages);
    } else if (navigator.language) {
      tags.push(navigator.language);
    }
  }

  if (tags.length === 0) {
    try {
      const resolved = Intl.NumberFormat().resolvedOptions().locale;
      if (resolved) tags.push(resolved);
    } catch {
      // fallback
    }
  }

  for (const rawTag of tags) {
    if (!rawTag || typeof rawTag !== "string") continue;
    try {
      const normalized = rawTag.replace(/_/g, "-");
      const loc = new Intl.Locale(normalized);
      const region = loc.region?.toUpperCase();
      if (region && region in LOCALE_CURRENCY_MAP) {
        return LOCALE_CURRENCY_MAP[region];
      }
    } catch {
      // invalid locale tag, proceed to next
    }
  }

  return DEFAULT_CURRENCY;
}

/** Module-level formatters cache */
const numberFormatCache = new Map<string, Intl.NumberFormat>();

/**
 * Format a number as currency using Intl.NumberFormat with module-level caching.
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = DEFAULT_CURRENCY,
  locale?: string,
): string {
  const safeAmount = Number.isFinite(amount) ? (Object.is(amount, -0) ? 0 : amount) : 0;
  const rawCode = typeof currencyCode === "string" ? currencyCode.trim().toUpperCase() : "";
  const code = /^[A-Z]{3}$/.test(rawCode) ? rawCode : DEFAULT_CURRENCY;
  const decimals = getCurrencyDecimals(code);
  const loc = locale?.trim() || "en-US";
  const cacheKey = `${loc}|${code}|${decimals}`;

  let formatter = numberFormatCache.get(cacheKey);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(loc, {
        style: "currency",
        currency: code,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    } catch {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: DEFAULT_CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    numberFormatCache.set(cacheKey, formatter);
  }

  return formatter.format(safeAmount);
}

/**
 * Calculate simplified net balance transfers grouped by currency.
 */
export function calculateNetBalances(bills: readonly Bill[]): NetTransfer[] {
  const currencyBalances = new Map<string, Map<string, number>>();

  for (const bill of bills) {
    const currency = bill.currency || DEFAULT_CURRENCY;
    const decimals = getCurrencyDecimals(currency);
    const factor = 10 ** decimals;

    let balanceMap = currencyBalances.get(currency);
    if (!balanceMap) {
      balanceMap = new Map<string, number>();
      currencyBalances.set(currency, balanceMap);
    }

    for (const split of bill.splits) {
      if (split.settled) continue;
      if (split.participant === bill.paidBy) continue;
      if (split.amount <= 0) continue;

      const minor = Math.round(split.amount * factor);
      balanceMap.set(bill.paidBy, (balanceMap.get(bill.paidBy) ?? 0) + minor);
      balanceMap.set(split.participant, (balanceMap.get(split.participant) ?? 0) - minor);
    }
  }

  const transfers: NetTransfer[] = [];
  const sortedCurrencies = [...currencyBalances.keys()].sort();

  for (const currency of sortedCurrencies) {
    const balanceMap = currencyBalances.get(currency)!;
    const decimals = getCurrencyDecimals(currency);
    const factor = 10 ** decimals;

    const creditors: { name: string; amount: number }[] = [];
    const debtors: { name: string; amount: number }[] = [];

    for (const [name, balance] of balanceMap.entries()) {
      if (balance > 0) {
        creditors.push({ name, amount: balance });
      } else if (balance < 0) {
        debtors.push({ name, amount: -balance });
      }
    }

    creditors.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    debtors.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

    let c = 0;
    let d = 0;

    while (c < creditors.length && d < debtors.length) {
      const creditor = creditors[c];
      const debtor = debtors[d];
      const settledMinor = Math.min(creditor.amount, debtor.amount);

      if (settledMinor > 0) {
        transfers.push({
          currency,
          from: debtor.name,
          to: creditor.name,
          amount: settledMinor / factor,
        });
      }

      creditor.amount -= settledMinor;
      debtor.amount -= settledMinor;

      if (creditor.amount === 0) c++;
      if (debtor.amount === 0) d++;
    }
  }

  return transfers;
}

/**
 * Format split details for clipboard copy / chat sharing.
 */
export function formatSplitForChat(
  bill: Pick<Bill, "title" | "totalAmount" | "currency" | "paidBy" | "splits"> & {
    group?: string | null;
  },
  locale?: string,
): string {
  const formattedTotal = formatCurrency(bill.totalAmount, bill.currency, locale);
  const lines = [`${bill.title} (${formattedTotal})`, `Paid by: ${bill.paidBy}`];

  if (bill.group) {
    lines.push(`Group: ${bill.group}`);
  }

  lines.push("");
  for (const split of bill.splits) {
    const status = split.settled ? "Settled" : "Unsettled";
    const share = formatCurrency(split.amount, bill.currency, locale);
    lines.push(`- ${split.participant}: ${share} (${status})`);
  }

  return lines.join("\n");
}
