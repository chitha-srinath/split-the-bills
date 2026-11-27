import { DEFAULT_CURRENCY } from "./constants.js";

/**
 * Format a number as currency.
 * @param amount - The amount to format
 * @param currency - The currency symbol (defaults to $)
 */
export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return `${currency}${amount.toFixed(2)}`;
}

/**
 * Calculate how much each participant owes.
 * @param total - Total bill amount
 * @param numParticipants - Number of people splitting the bill
 */
export function calculateSplit(total: number, numParticipants: number): number {
  if (numParticipants <= 0) return 0;
  return Math.round((total / numParticipants) * 100) / 100;
}
