// src/routes/shippingRoutes.js - MOBAPP FLASH
// Endpoint POST /api/shipping_rates para cotización de envío en Tienda Nube
'use strict';

const express = require('express');
const router = express.Router();
const { calcularTarifa } = require('../services/flashCalculator');
const logger = require('../utils/logger');

/**
 * POST /api/shipping_rates
 *
 * Payload esperado de Tienda Nube:
 * {
 *   "destination": { "zipcode": "1414" },
 *   "items": [{ "grams": 1000, "quantity": 1 }, ...],
 *   "carrier": { "options": [...] }  (puede estar presente)
 * }
 */
router.post('/shipping_rates', async (req, res) => {
  try {
    const data = req.body || {};

    // Obtener el código postal destino
    const zipcode = data.destination?.zipcode || data.destination?.postal_code || '';

    // Sumar grams * quantity de todos los items
    const items = data.items || [];
    let pesoTotalGramos = 0;
    for (const item of items) {
      pesoTotalGramos += (parseFloat(item.grams) || 0) * (parseFloat(item.quantity) || 1);
    }

    logger.info(`[FLASH /shipping_rates] CP: ${zipcode}, Peso total: ${pesoTotalGramos}g`);

    // Calcular tarifa
    const tarifa = calcularTarifa(zipcode, pesoTotalGramos);

    if (!tarifa) {
      logger.info(`[FLASH /shipping_rates] Sin tarifa para CP ${zipcode} / ${pesoTotalGramos}g`);
      return res.status(200).json({ rates: [] });
    }

    logger.info(
      `[FLASH /shipping_rates] Tarifa encontrada: ${tarifa.titulo} / $${tarifa.precio} / Zona: ${tarifa.zona}`
    );

    // Respuesta en formato Tienda Nube
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

    return res.status(200).json({
      rates: [
        {
          name: tarifa.titulo,
          code: 'MOBAPP_FLASH',
          price: tarifa.precio,
          price_merchant: tarifa.precio,
          currency: 'ARS',
          type: 'ship',
          min_delivery_date: now.toISOString(),
          max_delivery_date: tomorrow.toISOString(),
          phone_required: false,
          reference: `flash-${zipcode}`,
        },
      ],
    });
  } catch (error) {
    logger.error(`[FLASH /shipping_rates] Error: ${error.message}`);
    return res.status(500).json({ rates: [], error: 'Error interno al calcular la tarifa.' });
  }
});

module.exports = router;
