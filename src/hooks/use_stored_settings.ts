import React from 'react';
import { SETTINGS_KEYS } from '../constants.js';
import {
  DEFAULT_STORED_SETTINGS,
  validateStoredSettingChange,
  validateStoredSettings,
} from '../lib/stored_settings_schema.js';
import type { StoredSettingKey } from '../lib/stored_settings_schema.js';
import { browser, type Browser } from 'wxt/browser';

function reportStorageIssues(issues: string[]) {
  issues.forEach(issue => console.warn(`YipYip ignored invalid storage data: ${issue}`));
}

function reportStorageError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`YipYip could not ${operation}: ${message}`);
}

function persistBooleanSetting(
  key: StoredSettingKey,
  value: boolean,
  previousValue: boolean,
  setter: React.Dispatch<React.SetStateAction<boolean>>,
) {
  void browser.storage.local.set({ [key]: value }).catch(error => {
    reportStorageError(`save the "${key}" setting`, error);
    setter(currentValue => (currentValue === value ? previousValue : currentValue));
  });
}

const useStoredSettings = () => {
  const [autoHide, setAutoHide] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.AUTO_HIDE],
  );
  const [useOnEveryWebsite, setUseOnEveryWebsite] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.USE_ON_EVERY_WEBSITE],
  );
  const [alwaysOn, setAlwaysOn] = React.useState<boolean>(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.ALWAYS_ON],
  );

  const updateAutoHide = React.useCallback(
    (newAutoHide: boolean) => {
      setAutoHide(newAutoHide);
      persistBooleanSetting(SETTINGS_KEYS.AUTO_HIDE, newAutoHide, autoHide, setAutoHide);
    },
    [autoHide],
  );

  const updateUseOnEveryWebsite = React.useCallback(
    (newUseOnEveryWebsite: boolean) => {
      setUseOnEveryWebsite(newUseOnEveryWebsite);
      persistBooleanSetting(
        SETTINGS_KEYS.USE_ON_EVERY_WEBSITE,
        newUseOnEveryWebsite,
        useOnEveryWebsite,
        setUseOnEveryWebsite,
      );
    },
    [useOnEveryWebsite],
  );

  const updateAlwaysOn = React.useCallback(
    (newAlwaysOn: boolean) => {
      setAlwaysOn(newAlwaysOn);
      persistBooleanSetting(SETTINGS_KEYS.ALWAYS_ON, newAlwaysOn, alwaysOn, setAlwaysOn);
    },
    [alwaysOn],
  );

  const initializeStoredSettings = React.useCallback((data: unknown) => {
    const { settings, issues } = validateStoredSettings(data);
    reportStorageIssues(issues);
    setAutoHide(settings[SETTINGS_KEYS.AUTO_HIDE]);
    setUseOnEveryWebsite(settings[SETTINGS_KEYS.USE_ON_EVERY_WEBSITE]);
    setAlwaysOn(settings[SETTINGS_KEYS.ALWAYS_ON]);
  }, []);

  const updateStoredSettings = React.useCallback(
    (
      changes: Record<string, Browser.storage.StorageChange>,
      storageNamespace: Browser.storage.AreaName,
    ) => {
      if (storageNamespace !== 'local') {
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
        setter(value);
      };

      applyChange(SETTINGS_KEYS.AUTO_HIDE, setAutoHide);
      applyChange(SETTINGS_KEYS.USE_ON_EVERY_WEBSITE, setUseOnEveryWebsite);
      applyChange(SETTINGS_KEYS.ALWAYS_ON, setAlwaysOn);
    },
    [],
  );

  React.useEffect(() => {
    void browser.storage.local
      .get(Object.values(SETTINGS_KEYS))
      .then(initializeStoredSettings)
      .catch(error => reportStorageError('read stored settings', error));
    browser.storage.onChanged.addListener(updateStoredSettings);
    return () => browser.storage.onChanged.removeListener(updateStoredSettings);
  }, [initializeStoredSettings, updateStoredSettings]);

  return {
    autoHide,
    updateAutoHide,
    useOnEveryWebsite,
    updateUseOnEveryWebsite,
    alwaysOn,
    updateAlwaysOn,
  };
};

export default useStoredSettings;
