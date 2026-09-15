import { SETTINGS_KEYS, DEFAULT_SUGGESTION_COUNT, MAX_SUGGESTION_COUNT } from '../constants.js';

const DEFAULT_STORED_SETTINGS = Object.freeze({
  [SETTINGS_KEYS.SUGGESTION_COUNT]: DEFAULT_SUGGESTION_COUNT,
  [SETTINGS_KEYS.LOCK_POSITION_AND_SIZE]: false,
  [SETTINGS_KEYS.AUTO_HIDE]: true,
  [SETTINGS_KEYS.ALWAYS_ON]: true,
  [SETTINGS_KEYS.START_IN_ACTION_MODE]: false,
  [SETTINGS_KEYS.HIGHLIGHT_MATCHES]: true,
  [SETTINGS_KEYS.SHOW_AUTOHIDE_BUTTON]: false,
});

type StoredSettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];
type BooleanStoredSettingKey = Exclude<StoredSettingKey, 'suggestionCount'>;
type StoredSettings = Record<BooleanStoredSettingKey, boolean> & { suggestionCount: number };
type ValidationResult<T = boolean | number> = { value: T; issues: string[] };

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
  key: 'suggestionCount',
  value: unknown,
  options?: { allowMissing?: boolean },
): ValidationResult<number>;
function validateStoredSetting(
  key: BooleanStoredSettingKey,
  value: unknown,
  options?: { allowMissing?: boolean },
): ValidationResult<boolean>;
function validateStoredSetting(
  key: string,
  value: unknown,
  options?: { allowMissing?: boolean },
): ValidationResult;
function validateStoredSetting(
  key: string,
  value: unknown,
  { allowMissing = false }: { allowMissing?: boolean } = {},
): ValidationResult {
  assertKnownSettingKey(key);

  if (value === undefined && allowMissing) {
    return { value: DEFAULT_STORED_SETTINGS[key], issues: [] };
  }
  if (key === SETTINGS_KEYS.SUGGESTION_COUNT) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      ? { value: Math.min(value, MAX_SUGGESTION_COUNT), issues: [] }
      : {
          value: DEFAULT_SUGGESTION_COUNT,
          issues: ['Stored setting "suggestionCount" must be a positive whole number.'],
        };
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
    Object.assign(settings, { [key]: result.value });
    issues.push(...result.issues);
  });

  return { settings, issues };
}

function validateStoredSettingChange(
  key: 'suggestionCount',
  change: unknown,
): ValidationResult<number>;
function validateStoredSettingChange(
  key: BooleanStoredSettingKey,
  change: unknown,
): ValidationResult<boolean>;
function validateStoredSettingChange(key: string, change: unknown): ValidationResult;
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

export type { StoredSettingKey, BooleanStoredSettingKey };
export {
  DEFAULT_STORED_SETTINGS,
  validateStoredSetting,
  validateStoredSettingChange,
  validateStoredSettings,
};
