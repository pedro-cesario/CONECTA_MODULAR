const ldap = require('ldapjs');

const config = {
  url: process.env.LDAP_URL,
  baseDn: process.env.LDAP_BASE_DN,
  userDomain: process.env.LDAP_USER_DOMAIN || 'heal',
  adminUser: process.env.LDAP_ADMIN_USER,
  adminPassword: process.env.LDAP_ADMIN_PASSWORD
};

if (!config.url || !config.baseDn) {
  console.warn('[LDAP Test] LDAP_URL e LDAP_BASE_DN não configurados. Autenticação LDAP desabilitada.');
}

function escapeLdapFilter(value) {
  return String(value)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\x00/g, '\\00')
    .replace(/\//g, '\\2f');
}

function createClient() {
  return new Promise((resolve, reject) => {
    try {
      const client = ldap.createClient({
        url: config.url,
        timeout: 5000,
        connectTimeout: 5000
      });

      let settled = false;

      client.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      client.on('connect', () => {
        if (!settled) {
          settled = true;
          resolve(client);
        }
      });

      client.on('connectTimeout', () => {
        if (!settled) {
          settled = true;
          reject(new Error('LDAP connection timeout'));
        }
      });

      setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('LDAP connection timeout'));
        }
      }, 8000);
    } catch (err) {
      reject(err);
    }
  });
}

async function authenticate(username, password) {
  const client = await createClient();

  const safeUsername = escapeLdapFilter(username);

  return new Promise((resolve, reject) => {
    const userDomain = config.userDomain;
    const userFormats = [
      `${safeUsername}@${userDomain}.local`,
      `CN=${safeUsername},CN=Users,${config.baseDn}`,
      `${userDomain}\\${safeUsername}`
    ];

    function tryBind(index) {
      if (index >= userFormats.length) {
        client.unbind(() => {});
        return resolve(null);
      }

      client.bind(userFormats[index], password, (err) => {
        if (err) {
          tryBind(index + 1);
        } else {
          client.unbind(() => {});
          resolve({ authenticated: true, username, nome: username });
        }
      });
    }

    tryBind(0);
  });
}

module.exports = { authenticate };