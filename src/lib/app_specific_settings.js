import { validateAppSpecificSettings } from './app_specific_settings_schema.js';

const appSpecificSettingsModules = import.meta.glob('../data/app_specific_settings/*.json', {
  eager: true,
  import: 'default',
});

const appSpecificSettingsByHost = new Map();
Object.entries(appSpecificSettingsModules).forEach(([source, value]) => {
  const appSpecificSettings = validateAppSpecificSettings(value, source);
  if (appSpecificSettingsByHost.has(appSpecificSettings.host)) {
    throw new TypeError(`Duplicate app-specific settings for host "${appSpecificSettings.host}".`);
  }
  appSpecificSettingsByHost.set(appSpecificSettings.host, appSpecificSettings);
});

class AppSpecificSettings {
  static getSettingsForHost(host) {
    return appSpecificSettingsByHost.get(host) || {};
  }
}

export default AppSpecificSettings;
