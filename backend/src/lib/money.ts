/**
 * Money helpers. Amounts are stored as DECIMAL(10,2) in PostgreSQL and all
 * arithmetic is done in integer minor units (paise) so totals never pick up
 * binary floating-point drift such as 0.1 + 0.2 = 0.30000000000000004.
 */
export function toMinor(amount: number | string | { toString(): string }): number {
  const value = typeof amount === 'number' ? amount : Number(amount.toString());
  if (!Number.isFinite(value)) throw new Error(`Invalid monetary amount: ${String(amount)}`);
  return Math.round(value * 100);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

export function sumMoney(amounts: Array<number | string | { toString(): string }>): number {
  return fromMinor(amounts.reduce<number>((total, a) => total + toMinor(a), 0));
}

export function multiplyMoney(rate: number | string | { toString(): string }, units: number): number {
  return fromMinor(toMinor(rate) * units);
}

export function formatRupees(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}
