import React from 'react';
import { PopupSettingsView } from '../src/components/popup/popup_settings.js';
import {
  DEFAULT_STORED_SETTINGS,
  validateStoredSetting,
} from '../src/lib/stored_settings_schema.js';
import type useStoredSettings from '../src/hooks/use_stored_settings.js';
type StoredSettings = Pick<
  ReturnType<typeof useStoredSettings>,
  keyof typeof DEFAULT_STORED_SETTINGS
>;
import { DEFAULT_OPENING_SHORTCUT } from '../src/lib/interaction_settings_schema.js';
import type { SiteBehavior } from '../src/lib/interaction_settings_schema.js';
import { usePortalTarget } from '../src/components/searchbar/portal.js';
import useTheme from '../src/hooks/use_theme.js';
import popupStyles from '../src/popup.css?inline';
import previewStyles from './theme.css?inline';

export default function SettingsPreview() {
  const [settings, setSettings] = React.useState<StoredSettings>({
    ...DEFAULT_STORED_SETTINGS,
    theme: validateStoredSetting(
      'theme',
      new URLSearchParams(location.search).get('theme') ?? 'system',
    ).value,
  });
  const update =
    <K extends keyof StoredSettings>(key: K) =>
    (value: StoredSettings[K]) =>
      setSettings(previous => ({ ...previous, [key]: value }));
  const [sites, setSites] = React.useState<Record<string, SiteBehavior>>({
    'github.com': 'shortcut',
    'linear.app': 'paused',
  });
  const [openingShortcut, setOpeningShortcut] = React.useState(DEFAULT_OPENING_SHORTCUT);
  const [colors, setColors] = React.useState({ text: '#f59e0b', actions: '#a78bfa' });
  const [position, setPosition] = React.useState({ x: 0.5, y: 0.75 });
  const [width, setWidth] = React.useState(550);
  const root = usePortalTarget()?.getRootNode();
  useTheme(settings.theme, root instanceof ShadowRoot ? root.host : null);
  return (
    <>
      <style>{popupStyles}</style>
      <style>{previewStyles}</style>
      <div className="keymove-theme-preview">
        <PopupSettingsView
          hostname="github.com"
          onShowSearch={async () => {}}
          searchUnavailable={
            sites['github.com'] === 'paused' ? 'Paused on this site. Resume in Sites.' : null
          }
          settings={{
            ...settings,
            updateAlwaysOn: update('alwaysOn'),
            updateAutoHide: update('autoHide'),
            updateTheme: update('theme'),
            updateTooltipsMode: update('tooltipsMode'),
            updateSuggestionCount: update('suggestionCount'),
            updateStartInActionMode: update('startInActionMode'),
            updateHighlightMatches: update('highlightMatches'),
            updateShowAutohideButton: update('showAutohideButton'),
            updateLockPositionAndSize: update('lockPositionAndSize'),
          }}
          interaction={{
            sites,
            openingShortcut,
            ready: true,
            error: null,
            updateOpeningShortcut: setOpeningShortcut,
            updateSite: (host, value) =>
              setSites(previous => {
                const next = { ...previous };
                if (value) next[host] = value;
                else delete next[host];
                return next;
              }),
          }}
          colors={{
            colors,
            updateColor: (mode, value) => setColors(previous => ({ ...previous, [mode]: value })),
            resetColors: () => setColors({ text: '#f59e0b', actions: '#a78bfa' }),
          }}
          position={{
            position,
            updatePosition: setPosition,
            resetPosition: () => setPosition({ x: 0.5, y: 0.75 }),
          }}
          width={{ width, updateWidth: setWidth, resetWidth: () => setWidth(550) }}
        />
      </div>
    </>
  );
}
