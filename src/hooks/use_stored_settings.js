import React from 'react';
import { SETTINGS_KEYS } from '../constants.js';
import {
  DEFAULT_STORED_SETTINGS,
  validateStoredSettingChange,
  validateStoredSettings,
} from '../lib/stored_settings_schema.js';

function reportStorageIssues(issues) {
  issues.forEach(issue => console.warn(`YipYip ignored invalid storage data: ${issue}`));
}

const useStoredSettings = () => {
  const [autoHide, setAutoHide] = React.useState(DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.AUTO_HIDE]);
  const [useOnEveryWebsite, setUseOnEveryWebsite] = React.useState(
    DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.USE_ON_EVERY_WEBSITE],
  );
  const [alwaysOn, setAlwaysOn] = React.useState(DEFAULT_STORED_SETTINGS[SETTINGS_KEYS.ALWAYS_ON]);

  const updateAutoHide = React.useCallback(newAutoHide => {
    setAutoHide(newAutoHide);
    chrome.storage.local.set({ [SETTINGS_KEYS.AUTO_HIDE]: newAutoHide });
  }, []);

  const updateUseOnEveryWebsite = React.useCallback(newUseOnEveryWebsite => {
    setUseOnEveryWebsite(newUseOnEveryWebsite);
    chrome.storage.local.set({ [SETTINGS_KEYS.USE_ON_EVERY_WEBSITE]: newUseOnEveryWebsite });
  }, []);

  const updateAlwaysOn = React.useCallback(newAlwaysOn => {
    setAlwaysOn(newAlwaysOn);
    chrome.storage.local.set({ [SETTINGS_KEYS.ALWAYS_ON]: newAlwaysOn });
  }, []);

  const initializeStoredSettings = React.useCallback(data => {
    const { settings, issues } = validateStoredSettings(data);
    reportStorageIssues(issues);
    setAutoHide(settings[SETTINGS_KEYS.AUTO_HIDE]);
    setUseOnEveryWebsite(settings[SETTINGS_KEYS.USE_ON_EVERY_WEBSITE]);
    setAlwaysOn(settings[SETTINGS_KEYS.ALWAYS_ON]);
  }, []);

  const updateStoredSettings = React.useCallback((changes, storageNamespace) => {
    if (storageNamespace !== 'local' || !changes || typeof changes !== 'object') {
      return;
    }

    const applyChange = (key, setter) => {
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
  }, []);

  React.useEffect(() => {
    chrome.storage.local.get(Object.values(SETTINGS_KEYS), initializeStoredSettings);
    chrome.storage.onChanged.addListener(updateStoredSettings);
    return () => chrome.storage.onChanged.removeListener(updateStoredSettings);
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
