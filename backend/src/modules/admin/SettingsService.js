const configCache = require('../../core/config/configCache');

class SettingsService {
  static async getSetting(key) {
    const config = configCache.getSystemConfig();
    return config[key];
  }

  static async getSettings(keys) {
    const config = configCache.getSystemConfig();
    const result = {};
    for (const key of keys) {
      result[key] = config[key];
    }
    return result;
  }
}

module.exports = SettingsService;
