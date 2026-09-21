import { isRecord } from './runtime_schema.js';
import { keyboardShortcuts } from './static_data.js';

export type SiteBehavior = 'type' | 'shortcut' | 'paused';
export const SITE_BEHAVIOR_PREFIX = 'siteBehavior:';
export const OPENING_SHORTCUT_KEY = 'openingShortcut';
export type OpeningShortcut = {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};
export const DEFAULT_OPENING_SHORTCUT: OpeningShortcut = Object.freeze({
  code: 'KeyF',
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
});
const modifiers = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const;

export function siteHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.hostname : null;
  } catch {
    return null;
  }
}

export function hostnameFromSettingKey(key: string): string | null {
  if (!key.startsWith(SITE_BEHAVIOR_PREFIX)) return null;
  const hostname = key.slice(SITE_BEHAVIOR_PREFIX.length);
  return hostname && siteHostname(`https://${hostname}`) === hostname ? hostname : null;
}

export function parseSiteBehavior(value: unknown): SiteBehavior | undefined {
  return value === 'type' || value === 'shortcut' || value === 'paused' ? value : undefined;
}

export function openingShortcutIssue(value: unknown): string | null {
  if (
    !isRecord(value) ||
    typeof value.code !== 'string' ||
    !/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2]))$/.test(value.code) ||
    !modifiers.every(key => typeof value[key] === 'boolean')
  )
    return 'Use a letter, number, or function key with Alt, Control, or Command.';
  if (!(value.altKey || value.ctrlKey || value.metaKey))
    return 'Include Alt, Control, or Command so ordinary typing stays available.';
  // A binding must not shadow another KeyMove action on either supported platform.
  const conflict = keyboardShortcuts.some(shortcut => {
    const matcher = shortcut.eventMatcher;
    if (shortcut.name === 'focus_searchbar' || !matcher || matcher.code !== value.code)
      return false;
    return ['default', 'mac'].some(platform => {
      const flags =
        platform === 'mac'
          ? (matcher.flags?.mac ?? matcher.flags?.default)
          : matcher.flags?.default;
      const excluded =
        platform === 'mac'
          ? (matcher.discludedFlags?.mac ?? matcher.discludedFlags?.default)
          : matcher.discludedFlags?.default;
      return (flags ?? []).every(key => value[key]) && (excluded ?? []).every(key => !value[key]);
    });
  });
  return conflict ? 'This shortcut is already used by another KeyMove action.' : null;
}

export function parseOpeningShortcut(value: unknown): OpeningShortcut {
  if (openingShortcutIssue(value)) return DEFAULT_OPENING_SHORTCUT;
  const record = value as OpeningShortcut;
  return {
    code: record.code,
    altKey: record.altKey,
    ctrlKey: record.ctrlKey,
    metaKey: record.metaKey,
    shiftKey: record.shiftKey,
  };
}

export function matchesOpeningShortcut(event: OpeningShortcut, shortcut: OpeningShortcut): boolean {
  return event.code === shortcut.code && modifiers.every(key => event[key] === shortcut[key]);
}

export function openingShortcutKeys(shortcut: OpeningShortcut, mac = false): string[] {
  return [
    shortcut.ctrlKey ? 'Control' : '',
    shortcut.altKey ? (mac ? 'Option' : 'Alt') : '',
    shortcut.metaKey ? (mac ? 'Command' : 'Meta') : '',
    shortcut.shiftKey ? 'Shift' : '',
    shortcut.code.replace(/^(Key|Digit)/, ''),
  ].filter(Boolean);
}
