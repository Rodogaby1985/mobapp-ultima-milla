// src/services/flashCalculator.js - MOBAPP FLASH
// Lógica de cálculo: CP → Zona → Tarifa por tramo de peso
'use strict';

const { getCpToZona, getTarifas } = require('./googleSheetsService');

/**
 * Calcula la tarifa de envío para un CP y peso dados.
 *
 * @param {string|number} cp - Código postal del destino (se normaliza a string de 4 dígitos)
 * @param {number} pesoGramos - Peso total del pedido en gramos
 * @returns {{ titulo: string, precio: number, zona: string } | null}
 *   Retorna el objeto de tarifa si se encontró match, o null si no corresponde envío.
 */
function calcularTarifa(cp, pesoGramos) {
  // 1. Normalizar CP a string de 4 dígitos
  const cpStr = String(cp).replace(/\D/g, '').padStart(4, '0');

  // 2. Buscar zona en el mapa CP → Zona
  const zona = getCpToZona(cpStr);
  if (!zona) {
    return null;
  }

  // 3. Convertir gramos a kg
  const pesoKg = pesoGramos / 1000;

  // 4. Buscar tarifa: zona match Y pesoKg > peso_min Y pesoKg <= peso_max
  const tarifas = getTarifas();
  const tarifa = tarifas.find(
    t =>
      t.zona === zona &&
      pesoKg > t.peso_min &&
      pesoKg <= t.peso_max
  );

  if (!tarifa) {
    return null;
  }

  // 5. Devolver resultado
  return {
    titulo: tarifa.titulo,
    precio: tarifa.precio,
    zona: zona,
  };
}

module.exports = { calcularTarifa };
