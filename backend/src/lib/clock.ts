import { config } from '../config';

/**
 * Application clock. Every "what time is it?" question in the backend goes
 * through here so the demo can be pinned to a fixed date with DEMO_NOW, and
 * tests can move time with `setClockOverride`.
 */
let override: Date | null = null;

export function now(): Date {
  if (override) return new Date(override.getTime());
  if (config.demoNow) return new Date(config.demoNow.getTime());
  return new Date();
}

/** Test/demo helper: pin the clock (pass null to restore). */
export function setClockOverride(date: Date | null): void {
  override = date ? new Date(date.getTime()) : null;
}
