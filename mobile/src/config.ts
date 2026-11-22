/**
 * Runtime configuration.
 *
 *  EXPO_PUBLIC_API_URL   – set → API mode: every screen talks to the LibTrack
 *                          backend and errors are shown (no silent mock fallback).
 *                          unset → offline mock mode with the bundled demo data.
 *  EXPO_PUBLIC_DEMO_NOW  – optional ISO date/time that pins the app clock. Keep
 *                          it equal to the backend's DEMO_NOW when both are set.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || undefined;

export const isApiMode = Boolean(API_URL);

/** The bundled mock data is dated around this moment. */
export const MOCK_DATA_ANCHOR = '2026-11-21T09:00:00+05:30';

function parseDemoNow(): Date | null {
  const raw = process.env.EXPO_PUBLIC_DEMO_NOW?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const demoNow = parseDemoNow();

/**
 * The app clock. In API mode it follows the real time unless pinned; in mock
 * mode it defaults to the mock data's anchor so the demo loans look right.
 */
export function now(): Date {
  if (demoNow) return new Date(demoNow.getTime());
  if (!isApiMode) return new Date(MOCK_DATA_ANCHOR);
  return new Date();
}
