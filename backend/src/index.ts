import express from 'express';
import cors from 'cors';
import { config } from './config';
import { createApiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Mount API router
  app.use('/api', createApiRouter());

  // Error handler middleware
  app.use(errorHandler);

  return app;
}

export function startServer() {
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[LibTrack Backend] Server listening on port ${config.port} (${config.nodeEnv})`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

