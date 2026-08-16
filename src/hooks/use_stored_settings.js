import React from 'react';
import { SETTINGS_KEYS } from '../constants.js';


const useStoredSettings = () => {
  const [autoHide, setAutoHide] = React.useState(false);
  const [useOnEveryWebsite, setUseOnEveryWebsite] = React.useState(true);
  const [alwaysOn, setAlwaysOn] = React.useState(true);

  const updateAutoHide = React.useCallback(newAutoHide => {
    setAutoHide(newAutoHide)
    chrome.storage.local.set({ [SETTINGS_KEYS.AUTO_HIDE]: newAutoHide });
  }, [])

  const updateUseOnEveryWebsite = React.useCallback(newUseOnEveryWebsite => {
    setUseOnEveryWebsite(newUseOnEveryWebsite)
    chrome.storage.local.set({ [SETTINGS_KEYS.USE_ON_EVERY_WEBSITE]: newUseOnEveryWebsite });
  }, [])

  const updateAlwaysOn = React.useCallback(newAlwaysOn => {
    setAlwaysOn(newAlwaysOn)
    chrome.storage.local.set({ [SETTINGS_KEYS.ALWAYS_ON]: newAlwaysOn });
  }, [])

  const initializeStoredSettings = React.useCallback(data => {
    if (Object.hasOwn(data, SETTINGS_KEYS.AUTO_HIDE)) {
      setAutoHide(Boolean(data[SETTINGS_KEYS.AUTO_HIDE]));
    }
    if (Object.hasOwn(data, SETTINGS_KEYS.USE_ON_EVERY_WEBSITE)) {
      setUseOnEveryWebsite(Boolean(data[SETTINGS_KEYS.USE_ON_EVERY_WEBSITE]));
    }
    if (Object.hasOwn(data, SETTINGS_KEYS.ALWAYS_ON)) {
      setAlwaysOn(data[SETTINGS_KEYS.ALWAYS_ON]);
    }
  }, [])

  const updateStoredSettings = React.useCallback((changes, storageNamespace) => {
    if (storageNamespace === 'local') {
      if (Object.hasOwn(changes, SETTINGS_KEYS.AUTO_HIDE)) {
        setAutoHide(Boolean(changes[SETTINGS_KEYS.AUTO_HIDE].newValue));
      }
      if (Object.hasOwn(changes, SETTINGS_KEYS.USE_ON_EVERY_WEBSITE)) {
        setUseOnEveryWebsite(Boolean(changes[SETTINGS_KEYS.USE_ON_EVERY_WEBSITE].newValue));
      }
      if (Object.hasOwn(changes, SETTINGS_KEYS.ALWAYS_ON)) {
        setAlwaysOn(changes[SETTINGS_KEYS.ALWAYS_ON].newValue);
      }
    }
  }, [])

  React.useEffect(() => {
    chrome.storage.local.get(Object.values(SETTINGS_KEYS), initializeStoredSettings);
    chrome.storage.onChanged.addListener(updateStoredSettings);
    return () => chrome.storage.onChanged.removeListener(updateStoredSettings);
  }, [initializeStoredSettings, updateStoredSettings])

  return {
    autoHide,
    updateAutoHide,
    useOnEveryWebsite,
    updateUseOnEveryWebsite,
    alwaysOn,
    updateAlwaysOn
  }
}

export default useStoredSettings;
