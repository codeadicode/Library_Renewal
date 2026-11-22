import { config, DataStoreDriver } from '../config';
import { DataStore } from './interfaces';
import { MemoryDataStore } from './memoryStore';
import { PrismaDataStore } from './prismaRepositories';

export * from './interfaces';
export { MemoryDataStore, MemoryStore } from './memoryStore';
export { PrismaDataStore } from './prismaRepositories';

/**
 * Builds the data store the API runs on. PostgreSQL (via Prisma) is the
 * default; DATA_STORE=memory is only for tests and offline demos.
 */
export function createDataStore(driver: DataStoreDriver = config.dataStore): DataStore {
  if (driver === 'memory') return new MemoryDataStore();
  if (!config.databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env, start PostgreSQL ' +
        '(docker compose up -d db) and run `npm run db:setup`. Use DATA_STORE=memory only for offline demos.',
    );
  }
  return new PrismaDataStore();
}
