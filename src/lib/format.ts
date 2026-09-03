/**
 * One place for money formatting. Balances reached five figures once the
 * treasury and the bigger loan desks landed, and "$12345.60" is genuinely
 * hard to read at a glance.
 */
export function formatMoney(amount: number, options?: { cents?: boolean }): string {
  const cents = options?.cents ?? true;
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;
}

/** Whole-dollar form, for prices and targets that are never fractional. */
export function formatWhole(amount: number): string {
  return formatMoney(amount, { cents: false });
}
