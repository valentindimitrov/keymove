import React from 'react';
import { EXTENSION_NAME } from '../extension_identity.js';
import { SETTINGS_KEYS } from '../constants.js';
import {
  DEFAULT_STORED_SETTINGS,
  validateStoredSettingChange,
  validateStoredSettings,
} from '../lib/stored_settings_schema.js';
import type { StoredSettingKey } from '../lib/stored_settings_schema.js';
import { isRecord } from '../lib/runtime_schema.js';
import { browser, type Browser } from 'wxt/browser';

function reportStorageIssues(issues: string[]) {
  issues.forEach(issue => console.warn(`${EXTENSION_NAME} ignored invalid storage data: ${issue}`));
}

function reportStorageError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${EXTENSION_NAME} could not ${operation}: ${message}`);
}

function persistBooleanSetting(
  key: StoredSettingKey,
  value: boolean,
  previousValue: boolean,
  setter: React.Dispatch<React.SetStateAction<boolean>>,
  isCurrent: () => boolean,
) {
  void browser.storage.local.set({ [key]: value }).catch(error => {
    reportStorageError(`save the "${key}" setting`, error);
    if (isCurrent()) {
      setter(previousValue);
    }
  });
}

const useStoredSettings = () => {
  const revisions = React.useRef({
    showAutohideButton: 0,
    autoHide: 0,
    alwaysOn: 0,
    startInActionMode: 0,
    highlightMatches: 0,
  });
  const [autoHide, setAutoHide] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.AUTO_HIDE],
  );
  const [alwaysOn, setAlwaysOn] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.ALWAYS_ON],
  );

  const updateAutoHide = React.useCallback(
    (newAutoHide: boolean) => {
      const revision = ++revisions.current.autoHide;
      setAutoHide(newAutoHide);
      persistBooleanSetting(
        SETTINGS_KEYS.AUTO_HIDE,
        newAutoHide,
        autoHide,
        setAutoHide,
        () => revisions.current.autoHide === revision,
      );
    },
    [autoHide],
  );

  const [startInActionMode, setStartInActionMode] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.START_IN_ACTION_MODE],
  );

  const updateStartInActionMode = React.useCallback(
    (newStartInActionMode: boolean) => {
      const revision = ++revisions.current.startInActionMode;
      setStartInActionMode(newStartInActionMode);
      persistBooleanSetting(
        SETTINGS_KEYS.START_IN_ACTION_MODE,
        newStartInActionMode,
        startInActionMode,
        setStartInActionMode,
        () => revisions.current.startInActionMode === revision,
      );
    },
    [startInActionMode],
  );

  const [highlightMatches, setHighlightMatches] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.HIGHLIGHT_MATCHES],
  );

  const updateHighlightMatches = React.useCallback(
    (newHighlightMatches: boolean) => {
      const revision = ++revisions.current.highlightMatches;
      setHighlightMatches(newHighlightMatches);
      persistBooleanSetting(
        SETTINGS_KEYS.HIGHLIGHT_MATCHES,
        newHighlightMatches,
        highlightMatches,
        setHighlightMatches,
        () => revisions.current.highlightMatches === revision,
      );
    },
    [highlightMatches],
  );

  const [showAutohideButton, setShowAutohideButton] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.SHOW_AUTOHIDE_BUTTON],
  );

  const updateShowAutohideButton = React.useCallback(
    (newShowAutohideButton: boolean) => {
      const revision = ++revisions.current.showAutohideButton;
      setShowAutohideButton(newShowAutohideButton);
      persistBooleanSetting(
        SETTINGS_KEYS.SHOW_AUTOHIDE_BUTTON,
        newShowAutohideButton,
        showAutohideButton,
        setShowAutohideButton,
        () => revisions.current.showAutohideButton === revision,
      );
    },
    [showAutohideButton],
  );

  const updateAlwaysOn = React.useCallback(
    (newAlwaysOn: boolean) => {
      const revision = ++revisions.current.alwaysOn;
      setAlwaysOn(newAlwaysOn);
      persistBooleanSetting(
        SETTINGS_KEYS.ALWAYS_ON,
        newAlwaysOn,
        alwaysOn,
        setAlwaysOn,
        () => revisions.current.alwaysOn === revision,
      );
    },
    [alwaysOn],
  );

  const initializeStoredSettings = React.useCallback(
    (data: unknown, initialRevisions: Record<StoredSettingKey, number>) => {
      const { settings, issues } = validateStoredSettings(data);
      reportStorageIssues(issues);
      if (revisions.current.autoHide === initialRevisions.autoHide) setAutoHide(settings.autoHide);
      if (revisions.current.alwaysOn === initialRevisions.alwaysOn) setAlwaysOn(settings.alwaysOn);
      if (revisions.current.startInActionMode === initialRevisions.startInActionMode)
        setStartInActionMode(settings.startInActionMode);
      if (revisions.current.highlightMatches === initialRevisions.highlightMatches)
        setHighlightMatches(settings.highlightMatches);
      if (revisions.current.showAutohideButton === initialRevisions.showAutohideButton)
        setShowAutohideButton(settings.showAutohideButton);
    },
    [],
  );

  const updateStoredSettings = React.useCallback(
    (changes: unknown, storageNamespace: Browser.storage.AreaName) => {
      if (storageNamespace !== 'local') {
        return;
      }
      if (!isRecord(changes)) {
        reportStorageIssues(['Storage changes must be an object.']);
        return;
      }

      const applyChange = (
        key: StoredSettingKey,
        setter: React.Dispatch<React.SetStateAction<boolean>>,
      ) => {
        if (!Object.hasOwn(changes, key)) {
          return;
        }
        const { value, issues } = validateStoredSettingChange(key, changes[key]);
        reportStorageIssues(issues);
        revisions.current[key] += 1;
        setter(value);
      };

      applyChange(SETTINGS_KEYS.AUTO_HIDE, setAutoHide);
      applyChange(SETTINGS_KEYS.ALWAYS_ON, setAlwaysOn);
      applyChange(SETTINGS_KEYS.START_IN_ACTION_MODE, setStartInActionMode);
      applyChange(SETTINGS_KEYS.HIGHLIGHT_MATCHES, setHighlightMatches);
      applyChange(SETTINGS_KEYS.SHOW_AUTOHIDE_BUTTON, setShowAutohideButton);
    },
    [],
  );

  React.useEffect(() => {
    let active = true;
    const initialRevisions = { ...revisions.current };
    browser.storage.onChanged.addListener(updateStoredSettings);
    void browser.storage.local
      .get(Object.values(SETTINGS_KEYS))
      .then(data => {
        if (active) initializeStoredSettings(data, initialRevisions);
      })
      .catch(error => reportStorageError('read stored settings', error));
    return () => {
      active = false;
      browser.storage?.onChanged.removeListener(updateStoredSettings);
    };
  }, [initializeStoredSettings, updateStoredSettings]);

  return {
    autoHide,
    updateAutoHide,
    alwaysOn,
    updateAlwaysOn,
    startInActionMode,
    updateStartInActionMode,
    highlightMatches,
    updateHighlightMatches,
    showAutohideButton,
    updateShowAutohideButton,
  };
};

export default useStoredSettings;
