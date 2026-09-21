import React from 'react';
import { browser } from 'wxt/browser';
import { isRecord } from '../lib/runtime_schema.js';
import {
  DEFAULT_OPENING_SHORTCUT,
  OPENING_SHORTCUT_KEY,
  SITE_BEHAVIOR_PREFIX,
  hostnameFromSettingKey,
  openingShortcutIssue,
  parseOpeningShortcut,
  parseSiteBehavior,
} from '../lib/interaction_settings_schema.js';
import type { OpeningShortcut, SiteBehavior } from '../lib/interaction_settings_schema.js';

// One storage key per hostname: updates in two popup windows cannot overwrite other sites.
export default function useInteractionSettings() {
  const [sites, setSites] = React.useState<Record<string, SiteBehavior>>({});
  const [openingShortcut, setOpeningShortcut] = React.useState(DEFAULT_OPENING_SHORTCUT);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const revisions = React.useRef(new Map<string, number>());
  const alive = React.useRef(true);
  const apply = React.useCallback((key: string, value: unknown) => {
    if (key === OPENING_SHORTCUT_KEY) setOpeningShortcut(parseOpeningShortcut(value));
    const hostname = hostnameFromSettingKey(key);
    if (hostname)
      setSites(previous => {
        const next = { ...previous };
        const behavior = parseSiteBehavior(value);
        if (behavior)
          Object.defineProperty(next, hostname, {
            value: behavior,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        else delete next[hostname];
        return next;
      });
  }, []);
  React.useEffect(() => {
    alive.current = true;
    let active = true;
    const initial = new Map(revisions.current);
    const onChanged = (changes: unknown, area: string) => {
      if (area !== 'local' || !isRecord(changes)) return;
      for (const [key, change] of Object.entries(changes)) {
        if (key !== OPENING_SHORTCUT_KEY && !hostnameFromSettingKey(key)) continue;
        revisions.current.set(key, (revisions.current.get(key) ?? 0) + 1);
        apply(key, isRecord(change) ? change.newValue : undefined);
      }
    };
    browser.storage.onChanged.addListener(onChanged);
    void browser.storage.local
      .get(null)
      .then(data => {
        if (!active) return;
        if (!isRecord(data)) throw new Error('Invalid storage response');
        for (const [key, value] of Object.entries(data)) {
          if ((revisions.current.get(key) ?? 0) === (initial.get(key) ?? 0)) apply(key, value);
        }
        setReady(true);
      })
      .catch(() => {
        if (active)
          setError('Could not load site and shortcut settings. Reopen settings to retry.');
      });
    return () => {
      active = false;
      alive.current = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, [apply]);

  const persist = React.useCallback(
    async (key: string, value: unknown, previous: unknown) => {
      const revision = (revisions.current.get(key) ?? 0) + 1;
      revisions.current.set(key, revision);
      apply(key, value);
      setError(null);
      try {
        if (value === undefined) await browser.storage.local.remove(key);
        else await browser.storage.local.set({ [key]: value });
      } catch {
        if (!alive.current) return;
        if (revisions.current.get(key) === revision) apply(key, previous);
        setError('Could not save the change. Please try again.');
      }
    },
    [apply],
  );

  const updateSite = (hostname: string, behavior: SiteBehavior | undefined) => {
    const key = SITE_BEHAVIOR_PREFIX + hostname;
    if (!ready || hostnameFromSettingKey(key) !== hostname) return;
    void persist(key, behavior, Object.hasOwn(sites, hostname) ? sites[hostname] : undefined);
  };
  const updateOpeningShortcut = (value: OpeningShortcut) => {
    if (!ready || openingShortcutIssue(value)) return;
    void persist(OPENING_SHORTCUT_KEY, value, openingShortcut);
  };
  return { sites, openingShortcut, ready, error, updateSite, updateOpeningShortcut };
}
