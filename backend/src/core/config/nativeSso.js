const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  enabled: String(process.env.NATIVE_SSO_ENABLED || 'true').toLowerCase() !== 'false',
  validatorUrl: process.env.TASY_TOKEN_VALIDATOR_URL || 'http://tasymanager.heal.br/api/medico/login',
  validatorTimeoutMs: parsePositiveInt(process.env.TASY_TOKEN_VALIDATOR_TIMEOUT_MS, 8000),
  maxTokenLength: parsePositiveInt(process.env.NATIVE_SSO_MAX_TOKEN_LENGTH, 32768)
};
