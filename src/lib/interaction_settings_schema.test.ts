// @vitest-environment node
import {
  DEFAULT_OPENING_SHORTCUT,
  hostnameFromSettingKey,
  matchesOpeningShortcut,
  openingShortcutIssue,
  parseOpeningShortcut,
  parseSiteBehavior,
  siteHostname,
} from './interaction_settings_schema.js';

test('site rules use exact canonical HTTP hostnames, not paths or wildcard profiles', () => {
  expect(siteHostname('https://GitHub.com/org/repo')).toBe('github.com');
  expect(siteHostname('chrome://extensions')).toBeNull();
  expect(siteHostname('not a url')).toBeNull();
  for (const invalid of ['github.com/path', 'github.com:443', 'GitHub.com', '', 'user@github.com'])
    expect(hostnameFromSettingKey(`siteBehavior:${invalid}`)).toBeNull();
  expect(hostnameFromSettingKey('siteBehavior:github.com')).toBe('github.com');
  expect(parseSiteBehavior('enabled')).toBeUndefined();
});

test('validates all modifier flags and rejects plain typing and existing KeyMove shortcuts', () => {
  for (const value of [
    null,
    {},
    { ...DEFAULT_OPENING_SHORTCUT, altKey: false },
    { ...DEFAULT_OPENING_SHORTCUT, code: 'KeyS' },
    { ...DEFAULT_OPENING_SHORTCUT, code: 'Digit1' },
    { ...DEFAULT_OPENING_SHORTCUT, altKey: 'true' },
  ]) {
    expect(openingShortcutIssue(value)).not.toBeNull();
    expect(parseOpeningShortcut(value)).toEqual(DEFAULT_OPENING_SHORTCUT);
  }
  const custom = { ...DEFAULT_OPENING_SHORTCUT, code: 'KeyK', shiftKey: true };
  expect(openingShortcutIssue(custom)).toBeNull();
  expect(matchesOpeningShortcut(custom, custom)).toBe(true);
  expect(matchesOpeningShortcut({ ...custom, shiftKey: false }, custom)).toBe(false);
  expect(parseOpeningShortcut({ ...custom, untrusted: 'ignored' })).toEqual(custom);
});
