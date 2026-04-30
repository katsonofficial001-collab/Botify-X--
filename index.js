'use strict';

const express = require('express');

const config = require('./utils/config');
const logger = require('./utils/logger');
const sessionManager = require('./utils/sessionManager');
const { buildPanel } = require('./dashboard/server');

async function main() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.get('/', (_req, res) => {
    res.type('text/plain').send('Botify X is running 🚀');
  });

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      bot: config.bot.name,
      version: config.bot.version,
      owner: sessionManager.ownerStatus(),
      sessions: sessionManager.listSessions(),
    });
  });

  app.use('/panel', buildPanel());

  app.use((err, _req, res, _next) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'internal_server_error' });
  });

  const server = app.listen(config.server.port, '0.0.0.0', () => {
    logger.info(`HTTP server listening on :${config.server.port}`);
    logger.info(`Admin panel available at /panel`);
  });

  Promise.all(sessionManager.restoreExistingSessions()).catch((err) =>
    logger.error({ err }, 'Failed to restore existing sessions'),
  );

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error in main');
  process.exit(1);
});
