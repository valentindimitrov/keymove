import { SETTINGS_KEYS } from '../constants.js';

const DEFAULT_STORED_SETTINGS = Object.freeze({
  [SETTINGS_KEYS.AUTO_HIDE]: false,
  [SETTINGS_KEYS.USE_ON_EVERY_WEBSITE]: true,
  [SETTINGS_KEYS.ALWAYS_ON]: true,
});

function issueFor(key, value) {
  const receivedType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  return `Stored setting "${key}" must be a boolean; received ${receivedType}.`;
}

function assertKnownSettingKey(key) {
  if (!Object.hasOwn(DEFAULT_STORED_SETTINGS, key)) {
    throw new TypeError(`Unknown stored setting "${key}".`);
  }
}

function validateStoredSetting(key, value, { allowMissing = false } = {}) {
  assertKnownSettingKey(key);

  if (value === undefined && allowMissing) {
    return { value: DEFAULT_STORED_SETTINGS[key], issues: [] };
  }
  if (typeof value === 'boolean') {
    return { value, issues: [] };
  }
  return {
    value: DEFAULT_STORED_SETTINGS[key],
    issues: [issueFor(key, value)],
  };
}

function validateStoredSettings(data) {
  const settings = { ...DEFAULT_STORED_SETTINGS };
  const issues = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      settings,
      issues: ['Extension storage must return an object.'],
    };
  }

  Object.keys(DEFAULT_STORED_SETTINGS).forEach(key => {
    if (!Object.hasOwn(data, key)) {
      return;
    }
    const result = validateStoredSetting(key, data[key]);
    settings[key] = result.value;
    issues.push(...result.issues);
  });

  return { settings, issues };
}

function validateStoredSettingChange(key, change) {
  assertKnownSettingKey(key);
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    return {
      value: DEFAULT_STORED_SETTINGS[key],
      issues: [`Storage change for "${key}" must be an object.`],
    };
  }

  return validateStoredSetting(key, change.newValue, { allowMissing: true });
}

export {
  DEFAULT_STORED_SETTINGS,
  validateStoredSetting,
  validateStoredSettingChange,
  validateStoredSettings,
};
