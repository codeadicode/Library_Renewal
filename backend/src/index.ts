import express from 'express';
import cors from 'cors';
import { config } from './config';
import { createApiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { createDataStore } from './repositories';
import { DataStore } from './repositories/interfaces';
import { createServices, Services } from './services';

export function createApp(store: DataStore = createDataStore()): express.Application & { services: Services } {
  const services = createServices(store);
  const app = Object.assign(express(), { services });

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', createApiRouter(services));
  app.use(errorHandler);

  return app;
}

export async function startServer() {
  const store = createDataStore();
  try {
    await store.ping();
  } catch (err) {
    console.error(
      `[LibTrack] Cannot reach the ${store.driver} data store. Is PostgreSQL running and DATABASE_URL correct?`,
    );
    throw err;
  }

  const app = createApp(store);
  app.services.scheduler.start(config.schedulerIntervalMs);

  const server = app.listen(config.port, () => {
    console.log(
      `[LibTrack Backend] Listening on port ${config.port} (${config.nodeEnv}, data store: ${store.driver}` +
        `${config.demoNow ? `, demo clock: ${config.demoNow.toISOString()}` : ''})`,
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`[LibTrack Backend] ${signal} received, shutting down.`);
    app.services.scheduler.stop();
    server.close(async () => {
      await store.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
