// src/config.js - MOBAPP FLASH
'use strict';

require('dotenv').config();

let publicApiUrl = process.env.DOKKU_APP_SSL_URL || process.env.PUBLIC_API_URL;

if (publicApiUrl && !publicApiUrl.startsWith('http')) {
  publicApiUrl = `https://${publicApiUrl}`;
}

const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  modality: process.env.MODALIDAD || 'flash',
  publicApiUrl: publicApiUrl,
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  tiendaNube: {
    clientId: process.env.APP_ID,
    clientSecret: process.env.CLIENT_SECRET,
  },
  google: {
    sheetId: process.env.GOOGLE_SHEET_ID,
  },
};

module.exports = config;
