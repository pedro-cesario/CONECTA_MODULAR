const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { parseBoolean } = require('../utils/parseBoolean');

const hasLdapConfig = Boolean(process.env.LDAP_URL && process.env.LDAP_BASE_DN);
const ldapEnabled = parseBoolean(process.env.LDAP_ENABLED, hasLdapConfig);

function requireEnv(varName, value) {
  if (!value) {
    throw new Error(`[LDAP Config] Variável de ambiente ${varName} é obrigatória quando LDAP está habilitado.`);
  }
  return value;
}

const config = {
  enabled: ldapEnabled,
  userDomain: ldapEnabled ? requireEnv('LDAP_USER_DOMAIN', process.env.LDAP_USER_DOMAIN) : (process.env.LDAP_USER_DOMAIN || 'heal'),
  adminUser: ldapEnabled ? requireEnv('LDAP_ADMIN_USER', process.env.LDAP_ADMIN_USER) : process.env.LDAP_ADMIN_USER,
  adminPassword: ldapEnabled ? requireEnv('LDAP_ADMIN_PASSWORD', process.env.LDAP_ADMIN_PASSWORD) : process.env.LDAP_ADMIN_PASSWORD
};

if (ldapEnabled) {
  config.url = requireEnv('LDAP_URL', process.env.LDAP_URL);
  config.baseDn = requireEnv('LDAP_BASE_DN', process.env.LDAP_BASE_DN);
} else {
  config.url = process.env.LDAP_URL || '';
  config.baseDn = process.env.LDAP_BASE_DN || '';
}

module.exports = config;