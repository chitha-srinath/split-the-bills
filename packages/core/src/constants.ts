import type { CurrencyMetadata } from "./types.js";

/** Default currency symbol */
export const DEFAULT_CURRENCY = "USD";

/** API base path */
export const API_BASE = "/api";

/** Application name */
export const APP_NAME = "Splitly";

/** Supported split modes */
export const SPLIT_MODES = ["equal", "exact", "percentage"] as const;

/** Supported currency metadata with decimal precision */
export const SUPPORTED_CURRENCIES = {
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0 },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimals: 2 },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
} as const satisfies Record<string, CurrencyMetadata>;

/**
 * Mapping from ISO 3166-1 alpha-2 region codes to default ISO 4217 currency codes.
 */
export const LOCALE_CURRENCY_MAP: Readonly<Record<string, string>> = {
  US: "USD",
  IN: "INR",
  GB: "GBP",
  JP: "JPY",
  CA: "CAD",
  AU: "AUD",
  AT: "EUR",
  BE: "EUR",
  CY: "EUR",
  DE: "EUR",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GR: "EUR",
  HR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SI: "EUR",
  SK: "EUR",
};
