import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

export type DataStoreDriver = 'postgres' | 'memory';

function resolveDataStore(): DataStoreDriver {
  const raw = (process.env.DATA_STORE || '').trim().toLowerCase();
  if (raw === 'memory') return 'memory';
  if (raw === 'postgres' || raw === 'postgresql' || raw === 'prisma') return 'postgres';
  if (raw) throw new Error(`Unknown DATA_STORE "${raw}". Use "postgres" or "memory".`);
  // The running API uses PostgreSQL by default. Only the Jest suite defaults to memory.
  return nodeEnv === 'test' ? 'memory' : 'postgres';
}

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const placeholder = !secret || secret === 'replace-with-a-long-random-string';

  if (!placeholder && secret!.length >= 32) return secret!;

  if (nodeEnv === 'production') {
    throw new Error(
      'JWT_SECRET must be set to a random string of at least 32 characters when NODE_ENV=production.',
    );
  }
  if (!placeholder) {
    console.warn('[LibTrack] JWT_SECRET is shorter than 32 characters; use a longer value outside local development.');
    return secret!;
  }
  if (nodeEnv !== 'test') {
    console.warn(
      '[LibTrack] JWT_SECRET is not set. Using a random per-process secret: sessions will not survive a restart. ' +
        'Set JWT_SECRET in backend/.env.',
    );
  }
  return crypto.randomBytes(48).toString('hex');
}

function resolveDemoNow(): Date | null {
  const raw = process.env.DEMO_NOW?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`DEMO_NOW="${raw}" is not a valid ISO date/time.`);
  }
  return parsed;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  dataStore: resolveDataStore(),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL,
  /** Fixed "now" for demos and tests. Unset = real wall-clock time. */
  demoNow: resolveDemoNow(),
  /** How often the notification scheduler checks for due reminders (ms). 0 disables it. */
  schedulerIntervalMs: parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10),
  /** Hour of day (server local time) at which DIGEST notifications are delivered. */
  digestHour: parseInt(process.env.DIGEST_HOUR || '9', 10),
};
