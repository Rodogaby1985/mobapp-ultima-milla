'use strict';
const axios = require('axios');
const config = require('../config');

/**
 * Intercambia el authorization "code" devuelto por Tienda Nube por un access_token.
 * Doc: https://dev.tiendanube.com/docs/applications/authentication
 *
 * @param {string} code - Código de autorización recibido en /oauth_callback
 * @returns {Promise<{access_token:string, token_type:string, scope:string, user_id:number}>}
 */
async function exchangeCodeForToken(code) {
  const url = 'https://www.tiendanube.com/apps/authorize/token';
  const body = {
    client_id: config.tiendaNube.clientId,
    client_secret: config.tiendaNube.clientSecret,
    grant_type: 'authorization_code',
    code,
  };

  const { data } = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
  });

  return data;
}

module.exports = { exchangeCodeForToken };
