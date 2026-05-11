// src/utils/oauthClient.js
'use strict';

const axios = require('axios');
const config = require('../config');
const { TIENDA_NUBE_TOKEN_URL } = require('./constants');
const logger = require('./logger');

if (!config.tiendaNube.clientId || !config.tiendaNube.clientSecret || !config.publicApiUrl) {
  logger.error(
    'Falta configuración crítica (APP_ID, CLIENT_SECRET o PUBLIC_API_URL) en las variables de entorno.'
  );
  throw new Error('Credenciales o URL pública de Tienda Nube no configuradas.');
}

const getAuthorizationUrl = (state) => {
  const redirectUri = `${config.publicApiUrl}/oauth_callback`;
  const scopes = [
    'read_products',
    'write_products',
    'read_orders',
    'read_shipping',
    'edit_shipping',
    'read_logistics',
    'write_logistics',
  ];
  const params = new URLSearchParams({
    client_id: config.tiendaNube.clientId,
    scope: scopes.join(' '),
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state,
  }).toString();
  const authUrl = `https://www.tiendanube.com/apps/${config.tiendaNube.clientId}/authorize?${params}`;
  logger.info(`URL de autorización generada: ${authUrl}`);
  return authUrl;
};

const exchangeCodeForToken = async (code) => {
  const redirectUri = `${config.publicApiUrl}/oauth_callback`;
  const postData = {
    client_id: config.tiendaNube.clientId,
    client_secret: config.tiendaNube.clientSecret,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
  };

  logger.info('[DEBUG] Intercambiando código por token...');

  try {
    const response = await axios.post(TIENDA_NUBE_TOKEN_URL, postData, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.data.error) {
      logger.error(`Error en la respuesta de Tienda Nube: ${JSON.stringify(response.data)}`);
      throw new Error(response.data.error_description || 'Error desconocido de Tienda Nube');
    }

    logger.info(`Token de acceso recibido para la tienda: ${response.data.user_id}`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`Error al intercambiar código por token: ${errorMsg}`);
    if (error.response && error.response.data) {
      return error.response.data;
    }
    throw new Error(`Fallo al obtener el token de acceso: ${errorMsg}`);
  }
};

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForToken,
};
