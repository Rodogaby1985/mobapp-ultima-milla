// src/services/googleSheetsService.js - MOBAPP FLASH
// Carga y cachea las hojas MOBAPP FLASH CP y MOBAPP FLASH TARIFA
'use strict';

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const logger = require('../utils/logger');

let sheetsClient = null;

// Cache en memoria
// cpToZona: Map<string, string>  cp_string → zona_string
// tarifas: Array<{titulo, zona, peso_min, peso_max, precio}>
let cpToZonaCache = new Map();
let tarifasCache = [];

const CP_SHEET_NAME = 'MOBAPP FLASH CP';
const TARIFA_SHEET_NAME = 'MOBAPP FLASH TARIFA';

function getCredentials() {
  if (process.env.GCP_CREDENTIALS_JSON) {
    try {
      return JSON.parse(process.env.GCP_CREDENTIALS_JSON);
    } catch (e) {
      throw new Error('Las credenciales de GCP_CREDENTIALS_JSON no son un JSON válido.');
    }
  }
  if (process.env.GCP_CREDENTIALS_PATH) {
    try {
      return require(process.env.GCP_CREDENTIALS_PATH);
    } catch (e) {
      throw new Error(
        `No se pudo cargar el archivo de credenciales en la ruta: ${process.env.GCP_CREDENTIALS_PATH}`
      );
    }
  }
  throw new Error(
    'Credenciales de Google Cloud no encontradas. Define GCP_CREDENTIALS_JSON o GCP_CREDENTIALS_PATH.'
  );
}

const getSheetsClient = async () => {
  if (sheetsClient) return sheetsClient;

  const auth = new GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
};

/**
 * Carga las dos hojas FLASH en memoria al arranque del servidor.
 * MOBAPP FLASH CP  → cpToZonaCache  (Map<string, string>)
 * MOBAPP FLASH TARIFA → tarifasCache (Array<object>)
 */
const loadAllSheetDataIntoCache = async () => {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // --- Hoja CP ---
  const cpResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CP_SHEET_NAME}!A:C`,
  });
  const cpRows = cpResponse.data.values || [];
  const cpDataRows = cpRows.slice(1); // saltar header

  cpToZonaCache = new Map();
  for (const row of cpDataRows) {
    if (!row[0]) continue;
    const cp = String(row[0]).trim().padStart(4, '0');
    const zona = row[1] ? String(row[1]).trim() : '';
    if (cp && zona) {
      cpToZonaCache.set(cp, zona);
    }
  }
  logger.info(`[FLASH] Hoja CP cargada: ${cpToZonaCache.size} códigos postales.`);

  // --- Hoja TARIFA ---
  const tarifaResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TARIFA_SHEET_NAME}!A:F`,
  });
  const tarifaRows = tarifaResponse.data.values || [];
  const tarifaDataRows = tarifaRows.slice(1); // saltar header

  tarifasCache = [];
  for (const row of tarifaDataRows) {
    // Columnas: [0]=TITULO, [1]=(vacío), [2]=ZONA, [3]=PESO_MIN, [4]=PESO_MAX, [5]=PRECIO
    if (!row[2] || !row[5]) continue;
    tarifasCache.push({
      titulo: String(row[0] || '').trim(),
      zona: String(row[2]).trim(),
      peso_min: parseFloat(row[3] || '0'),
      peso_max: parseFloat(row[4] || '0'),
      precio: parseFloat(row[5] || '0'),
    });
  }
  logger.info(`[FLASH] Hoja TARIFA cargada: ${tarifasCache.length} tramos.`);
};

/**
 * Devuelve la zona correspondiente a un CP, o undefined si no existe.
 * @param {string} cp - CP como string de 4 dígitos
 * @returns {string|undefined}
 */
const getCpToZona = (cp) => cpToZonaCache.get(String(cp).trim().padStart(4, '0'));

/**
 * Devuelve el array completo de tarifas cargadas en caché.
 * @returns {Array<{titulo, zona, peso_min, peso_max, precio}>}
 */
const getTarifas = () => tarifasCache;

module.exports = {
  loadAllSheetDataIntoCache,
  getCpToZona,
  getTarifas,
  getSheetsClient,
};
