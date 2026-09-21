// @vitest-environment node
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
    [SETTINGS_KEYS.HIGHLIGHT_MATCHES]: false,
    [SETTINGS_KEYS.SHOW_AUTOHIDE_BUTTON]: true,
    [SETTINGS_KEYS.LOCK_POSITION_AND_SIZE]: true,
  });

  expect(result).toEqual({
    settings: {
      tooltipsMode: true,
      theme: 'system',
      suggestionCount: 3,
      [SETTINGS_KEYS.AUTO_HIDE]: true,
      [SETTINGS_KEYS.ALWAYS_ON]: false,
      [SETTINGS_KEYS.START_IN_ACTION_MODE]: true,
      [SETTINGS_KEYS.HIGHLIGHT_MATCHES]: false,
      [SETTINGS_KEYS.SHOW_AUTOHIDE_BUTTON]: true,
      [SETTINGS_KEYS.LOCK_POSITION_AND_SIZE]: true,
    },
    issues: [],
  });
});

test('validates theme preferences and resets removed or invalid themes to system', () => {
  for (const theme of ['system', 'light', 'dark']) {
    expect(validateStoredSettings({ theme }).settings.theme).toBe(theme);
  }
  for (const theme of ['auto', '', true, null, {}, 1]) {
    const result = validateStoredSettings({ theme });
    expect(result.settings.theme).toBe('system');
    expect(result.issues).toEqual(['Stored setting "theme" must be system, light, or dark.']);
  }
  expect(validateStoredSettingChange('theme', { oldValue: 'dark' })).toEqual({
    value: 'system',
    issues: [],
  });
});

test('replaces malformed stored values with safe defaults', () => {
  const result = validateStoredSettings({
    [SETTINGS_KEYS.AUTO_HIDE]: 'false',
    [SETTINGS_KEYS.ALWAYS_ON]: null,
    [SETTINGS_KEYS.START_IN_ACTION_MODE]: 1,
    [SETTINGS_KEYS.HIGHLIGHT_MATCHES]: [],
    [SETTINGS_KEYS.SHOW_AUTOHIDE_BUTTON]: 'yes',
  });

  expect(result.settings).toEqual(DEFAULT_STORED_SETTINGS);
  expect(result.issues).toHaveLength(5);
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

test('Tooltips mode defaults on, preserves false and validates changes', () => {
  expect(validateStoredSettings({}).settings.tooltipsMode).toBe(true);
  expect(validateStoredSettings({ tooltipsMode: false }).settings.tooltipsMode).toBe(false);
  expect(validateStoredSettings({ tooltipsMode: 'false' }).settings.tooltipsMode).toBe(true);
  expect(validateStoredSettingChange('tooltipsMode', { newValue: false })).toEqual({
    value: false,
    issues: [],
  });
  expect(validateStoredSettingChange('tooltipsMode', { oldValue: false })).toEqual({
    value: true,
    issues: [],
  });
});

test('rejects malformed storage change envelopes', () => {
  const result = validateStoredSettingChange(SETTINGS_KEYS.AUTO_HIDE, 'invalid');

  expect(result.value).toBe(true);
  expect(result.issues).toEqual(['Storage change for "autoHide" must be an object.']);
});

test('validates layout locks and unlocks when the stored key is removed', () => {
  expect(validateStoredSettings({ lockPositionAndSize: 'true' }).settings.lockPositionAndSize).toBe(
    false,
  );
  expect(validateStoredSettingChange('lockPositionAndSize', { newValue: true }).value).toBe(true);
  expect(validateStoredSettingChange('lockPositionAndSize', { oldValue: true }).value).toBe(false);
});

test('validates suggestion counts and defaults Autohide to on without overriding saved choices', () => {
  expect(validateStoredSettings({}).settings.autoHide).toBe(true);
  expect(validateStoredSettings({ autoHide: false, suggestionCount: 7 }).settings).toMatchObject({
    autoHide: false,
    suggestionCount: 5,
  });
  for (const suggestionCount of [0, -1, 1.5, NaN, Infinity, '5', Number.MAX_SAFE_INTEGER + 1]) {
    const result = validateStoredSettings({ suggestionCount });
    expect(result.settings.suggestionCount).toBe(3);
    expect(result.issues).toHaveLength(1);
  }
  expect(validateStoredSettingChange('suggestionCount', { oldValue: 8 }).value).toBe(3);
});
