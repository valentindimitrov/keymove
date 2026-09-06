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
  const revisions = React.useRef({ autoHide: 0, useOnEveryWebsite: 0, alwaysOn: 0 });
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

  const updateUseOnEveryWebsite = React.useCallback(
    (newUseOnEveryWebsite: boolean) => {
      const revision = ++revisions.current.useOnEveryWebsite;
      setUseOnEveryWebsite(newUseOnEveryWebsite);
      persistBooleanSetting(
        SETTINGS_KEYS.USE_ON_EVERY_WEBSITE,
        newUseOnEveryWebsite,
        useOnEveryWebsite,
        setUseOnEveryWebsite,
        () => revisions.current.useOnEveryWebsite === revision,
      );
    },
    [useOnEveryWebsite],
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
      if (revisions.current.useOnEveryWebsite === initialRevisions.useOnEveryWebsite)
        setUseOnEveryWebsite(settings.useOnEveryWebsite);
      if (revisions.current.alwaysOn === initialRevisions.alwaysOn) setAlwaysOn(settings.alwaysOn);
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
      applyChange(SETTINGS_KEYS.USE_ON_EVERY_WEBSITE, setUseOnEveryWebsite);
      applyChange(SETTINGS_KEYS.ALWAYS_ON, setAlwaysOn);
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
      browser.storage.onChanged.removeListener(updateStoredSettings);
    };
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
