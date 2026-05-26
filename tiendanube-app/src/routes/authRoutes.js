// src/routes/authRoutes.js - MOBAPP FLASH
const express = require('express');
const router = express.Router();
const oauthClient = require('../utils/oauthClient');
const tiendaNubeService = require('../services/tiendaNubeService');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// Inicio del flujo de instalación OAuth
router.get('/install', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauth_state = state;

  req.session.save((err) => {
    if (err) {
      logger.error('Error al guardar la sesión antes de redirigir:', err);
      return res.status(500).send('No se pudo iniciar el proceso de autorización.');
    }

    logger.info(`[FLASH /install] Iniciando OAuth. SessionID: ${req.sessionID}`);

    const redirectUri = `${config.publicApiUrl}/oauth_callback`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.tiendaNube.clientId,
      redirect_uri: redirectUri,
      state: state,
    });

    const finalUrl = `https://www.tiendanube.com/apps/${config.tiendaNube.clientId}/authorize?${params.toString()}`;

    logger.info(`[FLASH /install] publicApiUrl=${config.publicApiUrl}`);
    logger.info(`[FLASH /install] clientId=${config.tiendaNube.clientId}`);
    logger.info(`[FLASH /install] finalUrl=${finalUrl}`);

    res.redirect(finalUrl);
  });
});

// Callback OAuth de Tienda Nube
router.get('/oauth_callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;

    logger.info(`[FLASH /oauth_callback] SessionID: ${req.sessionID}`);
    logger.info(`[FLASH /oauth_callback] Estado CSRF recibido de la URL: ${state ? '[presente]' : '[ausente]'}`);

    if (!state || state !== req.session.oauth_state) {
      logger.error(`Fallo de verificación CSRF. Esperado: ${req.session.oauth_state}, Recibido: ${state}`);
      return res.status(400).send('Estado inválido (protección CSRF fallida)');
    }

    req.session.oauth_state = null;

    const tokenData = await oauthClient.exchangeCodeForToken(code);

    if (tokenData.error) {
      logger.error(`Error de Tienda Nube: ${tokenData.error_description}`);
      return res.status(400).send(`Error de Tienda Nube: ${tokenData.error_description}`);
    }

    const accessToken = tokenData.access_token;
    const storeId = tokenData.user_id;

    logger.info(`Token obtenido para la tienda ID: ${storeId}`);

    // Registrar el carrier MOBAPP FLASH
    const carrierName = 'MOBAPP Flash - Última Milla';
    const carrierInfo = await tiendaNubeService.registerShippingCarrier(
      storeId,
      accessToken,
      config.publicApiUrl,
      carrierName
    );
    const carrierId = carrierInfo.id;

    // Crear la única opción de envío FLASH
    await tiendaNubeService.createCarrierOption(storeId, accessToken, carrierId, {
      code: 'MOBAPP_FLASH',
      name: 'MOBAPP FLASH - Última Milla',
      types: 'ship',
      additional_days: 0,
      additional_cost: 0,
      allow_free_shipping: false,
      active: true,
    });

    res.send('¡Aplicación MOBAPP FLASH instalada y configurada con éxito!');
  } catch (error) {
    next(error);
  }
});

// Página de bienvenida / instalación
router.get('/', (_req, res) => {
  res.send(`
    <h1>MOBAPP FLASH - Última Milla</h1>
    <p>Para instalar la aplicación en tu Tienda Nube, hacé clic en el siguiente enlace:</p>
    <a href="/install">Instalar Aplicación</a>
  `);
});

module.exports = router;
