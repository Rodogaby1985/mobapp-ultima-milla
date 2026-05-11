// app.js - MOBAPP FLASH Última Milla (Tienda Nube)
// Adaptado de mobapp-tienda-nube-v2dom
'use strict';

const config = require('./src/config');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { RedisStore } = require('connect-redis');
const { createClient } = require('redis');
const logger = require('./src/utils/logger');
const authRoutes = require('./src/routes/authRoutes');
const shippingRoutes = require('./src/routes/shippingRoutes');
const { loadAllSheetDataIntoCache } = require('./src/services/googleSheetsService');

const app = express();

// Configuración para proxy inverso (Dokku/nginx)
app.set('trust proxy', 1);

// Configuración de Redis
const redisClient = createClient({ url: config.redisUrl });
redisClient.connect().catch(err => logger.error('No se pudo conectar a Redis:', err));

const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'flash-session:',
});

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Sesión con Redis
app.use(
  session({
    store: redisStore,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'none',
    },
  })
);

// Exponer modalidad en el request
app.use((req, _res, next) => {
  req.modality = config.modality;
  next();
});

// Rutas
app.use('/', authRoutes);
app.use('/api', shippingRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Manejador de errores global
app.use((err, _req, res, _next) => {
  logger.error(`Unhandled error: ${err.stack || err}`);
  res.status(500).send('Ocurrió un error interno en el servidor.');
});

// Arranque del servidor
async function startServer() {
  try {
    logger.info('Iniciando carga de la caché de Google Sheets...');
    await loadAllSheetDataIntoCache();
    logger.info('¡Éxito! La caché de Google Sheets ha sido cargada.');

    app.listen(config.port, config.host, () => {
      logger.info(`Servidor LISTO Y ESCUCHANDO en http://${config.host}:${config.port}`);
      logger.info(`MODALIDAD: ${config.modality.toUpperCase()}`);
      logger.info(`PUBLIC_API_URL: ${config.publicApiUrl || 'NO DEFINIDA'}`);
    });
  } catch (error) {
    logger.error('FATAL: No se pudo cargar la caché inicial de Google Sheets. El servidor no se iniciará.');
    logger.error(error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
