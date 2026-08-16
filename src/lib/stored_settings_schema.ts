import { SETTINGS_KEYS } from '../constants.js';

const DEFAULT_STORED_SETTINGS = Object.freeze({
  [SETTINGS_KEYS.AUTO_HIDE]: false,
  [SETTINGS_KEYS.USE_ON_EVERY_WEBSITE]: true,
  [SETTINGS_KEYS.ALWAYS_ON]: true,
});

type StoredSettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];
type StoredSettings = Record<StoredSettingKey, boolean>;
type ValidationResult = { value: boolean; issues: string[] };

function issueFor(key: StoredSettingKey, value: unknown) {
  const receivedType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  return `Stored setting "${key}" must be a boolean; received ${receivedType}.`;
}

function assertKnownSettingKey(key: string): asserts key is StoredSettingKey {
  if (!Object.hasOwn(DEFAULT_STORED_SETTINGS, key)) {
    throw new TypeError(`Unknown stored setting "${key}".`);
  }
}

function validateStoredSetting(
  key: string,
  value: unknown,
  { allowMissing = false }: { allowMissing?: boolean } = {},
): ValidationResult {
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

function validateStoredSettings(data: unknown): { settings: StoredSettings; issues: string[] } {
  const settings: StoredSettings = { ...DEFAULT_STORED_SETTINGS };
  const issues: string[] = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      settings,
      issues: ['Extension storage must return an object.'],
    };
  }

  (Object.keys(DEFAULT_STORED_SETTINGS) as StoredSettingKey[]).forEach(key => {
    if (!Object.hasOwn(data, key)) {
      return;
    }
    const result = validateStoredSetting(key, (data as Record<string, unknown>)[key]);
    settings[key] = result.value;
    issues.push(...result.issues);
  });

  return { settings, issues };
}

function validateStoredSettingChange(key: string, change: unknown): ValidationResult {
  assertKnownSettingKey(key);
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    return {
      value: DEFAULT_STORED_SETTINGS[key],
      issues: [`Storage change for "${key}" must be an object.`],
    };
  }

  return validateStoredSetting(key, (change as Record<string, unknown>).newValue, {
    allowMissing: true,
  });
}

export type { StoredSettingKey, StoredSettings, ValidationResult };
export {
  DEFAULT_STORED_SETTINGS,
  validateStoredSetting,
  validateStoredSettingChange,
  validateStoredSettings,
};
