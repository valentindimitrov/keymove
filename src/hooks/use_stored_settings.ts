import React from 'react';
import { EXTENSION_NAME } from '../extension_identity.js';
import { SETTINGS_KEYS } from '../constants.js';
import {
  DEFAULT_STORED_SETTINGS,
  validateStoredSettingChange,
  validateStoredSettings,
  validateStoredSetting,
} from '../lib/stored_settings_schema.js';
import type {
  StoredSettingKey,
  BooleanStoredSettingKey,
  Theme,
} from '../lib/stored_settings_schema.js';
import { isRecord } from '../lib/runtime_schema.js';
import { browser, type Browser } from 'wxt/browser';

function reportStorageIssues(issues: string[]) {
  issues.forEach(issue => console.warn(`${EXTENSION_NAME} ignored invalid storage data: ${issue}`));
}

function reportStorageError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${EXTENSION_NAME} could not ${operation}: ${message}`);
}

function persistSetting<T extends boolean | number | Theme>(
  key: StoredSettingKey,
  value: T,
  previousValue: T,
  setter: React.Dispatch<React.SetStateAction<T>>,
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
    tooltipsMode: 0,
    theme: 0,
    suggestionCount: 0,
    lockPositionAndSize: 0,
    showAutohideButton: 0,
    autoHide: 0,
    alwaysOn: 0,
    startInActionMode: 0,
    highlightMatches: 0,
  });
  const [tooltipsMode, setTooltipsMode] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS.tooltipsMode,
  );
  const updateTooltipsMode = React.useCallback(
    (value: boolean) => {
      const revision = ++revisions.current.tooltipsMode;
      setTooltipsMode(value);
      persistSetting(
        SETTINGS_KEYS.TOOLTIPS_MODE,
        value,
        tooltipsMode,
        setTooltipsMode,
        () => revisions.current.tooltipsMode === revision,
      );
    },
    [tooltipsMode],
  );
  const [theme, setTheme] = React.useState<Theme>(DEFAULT_STORED_SETTINGS.theme);
  const updateTheme = React.useCallback(
    (value: Theme) => {
      const validation = validateStoredSetting(SETTINGS_KEYS.THEME, value);
      if (validation.issues.length) {
        reportStorageIssues(validation.issues);
        return;
      }
      const revision = ++revisions.current.theme;
      setTheme(validation.value);
      persistSetting(
        SETTINGS_KEYS.THEME,
        validation.value,
        theme,
        setTheme,
        () => revisions.current.theme === revision,
      );
    },
    [theme],
  );
  const [suggestionCount, setSuggestionCount] = React.useState<number>(
    DEFAULT_STORED_SETTINGS.suggestionCount,
  );
  const updateSuggestionCount = React.useCallback(
    (value: number) => {
      const validation = validateStoredSetting(SETTINGS_KEYS.SUGGESTION_COUNT, value);
      if (validation.issues.length) {
        reportStorageIssues(validation.issues);
        return;
      }
      const revision = ++revisions.current.suggestionCount;
      setSuggestionCount(validation.value);
      persistSetting(
        SETTINGS_KEYS.SUGGESTION_COUNT,
        validation.value,
        suggestionCount,
        setSuggestionCount,
        () => revisions.current.suggestionCount === revision,
      );
    },
    [suggestionCount],
  );
  const [lockPositionAndSize, setLockPositionAndSize] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.LOCK_POSITION_AND_SIZE],
  );
  const updateLockPositionAndSize = React.useCallback(
    (value: boolean) => {
      const revision = ++revisions.current.lockPositionAndSize;
      setLockPositionAndSize(value);
      persistSetting(
        SETTINGS_KEYS.LOCK_POSITION_AND_SIZE,
        value,
        lockPositionAndSize,
        setLockPositionAndSize,
        () => revisions.current.lockPositionAndSize === revision,
      );
    },
    [lockPositionAndSize],
  );
  const [autoHide, setAutoHide] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.AUTO_HIDE],
  );
  // Never intercept page typing based on a provisional default. A successful read applies
  // the saved value (or the new-install default); a failed read leaves capture disabled.
  const [alwaysOn, setAlwaysOn] = React.useState(false);

  const updateAutoHide = React.useCallback(
    (newAutoHide: boolean) => {
      const revision = ++revisions.current.autoHide;
      setAutoHide(newAutoHide);
      persistSetting(
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
      persistSetting(
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
      persistSetting(
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
      persistSetting(
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
      persistSetting(
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
      if (revisions.current.tooltipsMode === initialRevisions.tooltipsMode)
        setTooltipsMode(settings.tooltipsMode);
      if (revisions.current.theme === initialRevisions.theme) setTheme(settings.theme);
      if (revisions.current.suggestionCount === initialRevisions.suggestionCount)
        setSuggestionCount(settings.suggestionCount);
      if (revisions.current.lockPositionAndSize === initialRevisions.lockPositionAndSize)
        setLockPositionAndSize(settings.lockPositionAndSize);
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
        key: BooleanStoredSettingKey,
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
      applyChange(SETTINGS_KEYS.TOOLTIPS_MODE, setTooltipsMode);
      if (Object.hasOwn(changes, SETTINGS_KEYS.THEME)) {
        const { value, issues } = validateStoredSettingChange(
          SETTINGS_KEYS.THEME,
          changes[SETTINGS_KEYS.THEME],
        );
        reportStorageIssues(issues);
        revisions.current.theme += 1;
        setTheme(value);
      }
      if (Object.hasOwn(changes, SETTINGS_KEYS.SUGGESTION_COUNT)) {
        const { value, issues } = validateStoredSettingChange(
          SETTINGS_KEYS.SUGGESTION_COUNT,
          changes[SETTINGS_KEYS.SUGGESTION_COUNT],
        );
        reportStorageIssues(issues);
        revisions.current.suggestionCount += 1;
        setSuggestionCount(value);
      }
      applyChange(SETTINGS_KEYS.LOCK_POSITION_AND_SIZE, setLockPositionAndSize);
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
    tooltipsMode,
    updateTooltipsMode,
    theme,
    updateTheme,
    suggestionCount,
    updateSuggestionCount,
    lockPositionAndSize,
    updateLockPositionAndSize,
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
