// src/services/tiendaNubeService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { TIENDA_NUBE_API_BASE_URL, TIENDA_NUBE_API_VERSION } = require('../utils/constants');

const registerShippingCarrier = async (storeId, accessToken, publicApiUrl, carrierName) => {
  const headers = {
    Authentication: `bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': `TiendaNubeShippingApp/${process.env.APP_ID}`,
  };

  const carrierData = {
    name: carrierName,
    callback_url: `${publicApiUrl}/api/shipping_rates`,
    active: true,
    country_codes: ['AR'],
    types: 'ship',
  };

  const requestUrl = `${TIENDA_NUBE_API_BASE_URL}/${TIENDA_NUBE_API_VERSION}/${storeId}/shipping_carriers`;

  logger.info(`[DEBUG] Registro Carrier: URL -> ${requestUrl}`);

  try {
    const response = await axios.post(requestUrl, carrierData, { headers });
    logger.info(
      `Shipping Carrier registrado exitosamente para store_id ${storeId}: ${JSON.stringify(response.data)}`
    );
    return response.data;
  } catch (error) {
    logger.error(`Error al registrar Shipping Carrier para store_id ${storeId}:`);
    if (error.response) {
      logger.error(`  Status: ${error.response.status}`);
      logger.error(`  Data: ${JSON.stringify(error.response.data)}`);
    } else {
      logger.error(`  Error message: ${error.message}`);
    }
    throw new Error(
      `No se pudo registrar el Shipping Carrier: ${
        error.response ? error.response.data.message || JSON.stringify(error.response.data) : error.message
      }`
    );
  }
};

const createCarrierOption = async (storeId, accessToken, carrierId, optionData) => {
  const headers = {
    Authentication: `bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': `TiendaNubeShippingApp/${process.env.APP_ID}`,
  };
  const requestUrl = `${TIENDA_NUBE_API_BASE_URL}/${TIENDA_NUBE_API_VERSION}/${storeId}/shipping_carriers/${carrierId}/options`;

  try {
    const response = await axios.post(requestUrl, optionData, { headers });
    logger.info(
      `Opción de Carrier creada exitosamente para carrier ${carrierId}: ${JSON.stringify(response.data)}`
    );
    return response.data;
  } catch (error) {
    logger.error(`Error al crear Opción de Carrier para carrier ${carrierId}:`);
    if (error.response) {
      logger.error(`  Status: ${error.response.status}`);
      logger.error(`  Data: ${JSON.stringify(error.response.data)}`);
    } else {
      logger.error(`  Error message: ${error.message}`);
    }
    throw new Error(
      `No se pudo crear la opción de Carrier: ${
        error.response ? error.response.data.message || JSON.stringify(error.response.data) : error.message
      }`
    );
  }
};

module.exports = {
  registerShippingCarrier,
  createCarrierOption,
};
