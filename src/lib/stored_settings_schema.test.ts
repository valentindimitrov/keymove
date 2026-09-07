import { SETTINGS_KEYS } from '../constants.js';
import {
  DEFAULT_STORED_SETTINGS,
  validateStoredSettingChange,
  validateStoredSettings,
} from './stored_settings_schema.js';

test('accepts boolean values returned by extension storage', () => {
  const result = validateStoredSettings({
    [SETTINGS_KEYS.AUTO_HIDE]: true,
    [SETTINGS_KEYS.ALWAYS_ON]: false,
    [SETTINGS_KEYS.START_IN_ACTION_MODE]: true,
  });

  expect(result).toEqual({
    settings: {
      [SETTINGS_KEYS.AUTO_HIDE]: true,
      [SETTINGS_KEYS.ALWAYS_ON]: false,
      [SETTINGS_KEYS.START_IN_ACTION_MODE]: true,
    },
    issues: [],
  });
});

test('replaces malformed stored values with safe defaults', () => {
  const result = validateStoredSettings({
    [SETTINGS_KEYS.AUTO_HIDE]: 'false',
    [SETTINGS_KEYS.ALWAYS_ON]: null,
    [SETTINGS_KEYS.START_IN_ACTION_MODE]: 1,
  });

  expect(result.settings).toEqual(DEFAULT_STORED_SETTINGS);
  expect(result.issues).toHaveLength(3);
  expect(result.issues[0]).toContain('must be a boolean');
});

test('uses defaults when the storage API returns an invalid container', () => {
  expect(validateStoredSettings(null)).toEqual({
    settings: { ...DEFAULT_STORED_SETTINGS },
    issues: ['Extension storage must return an object.'],
  });
});

test('treats a removed setting as a reset to its default', () => {
  expect(validateStoredSettingChange(SETTINGS_KEYS.ALWAYS_ON, { oldValue: false })).toEqual({
    value: true,
    issues: [],
  });
});

test('rejects malformed storage change envelopes', () => {
  const result = validateStoredSettingChange(SETTINGS_KEYS.AUTO_HIDE, 'invalid');

  expect(result.value).toBe(false);
  expect(result.issues).toEqual(['Storage change for "autoHide" must be an object.']);
});
