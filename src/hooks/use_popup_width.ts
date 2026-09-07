import React from 'react';
import { EXTENSION_NAME } from '../extension_identity.js';
import { browser, type Browser } from 'wxt/browser';
import { POPUP_WIDTH_STORAGE_KEY } from '../constants.js';
import {
  DEFAULT_POPUP_WIDTH,
  validatePopupWidthChange,
  validateStoredPopupWidth,
} from '../lib/popup_width_schema.js';
import type { PopupWidthValidation } from '../lib/popup_width_schema.js';
import { isRecord } from '../lib/runtime_schema.js';

function reportWidthIssues(issues: string[]) {
  issues.forEach(issue => console.warn(`${EXTENSION_NAME} ignored invalid popup width: ${issue}`));
}

function reportWidthError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${EXTENSION_NAME} could not ${operation}: ${message}`);
}

const usePopupWidth = () => {
  const revision = React.useRef(0);
  const [width, setWidth] = React.useState<number>(DEFAULT_POPUP_WIDTH);

  const applyStoredWidth = React.useCallback((result: PopupWidthValidation) => {
    reportWidthIssues(result.issues);
    setWidth(result.width);
  }, []);

  const updateWidth = React.useCallback(
    (newWidth: number) => {
      const writeRevision = ++revision.current;
      const previousWidth = width;
      setWidth(newWidth);
      void browser.storage.local.set({ [POPUP_WIDTH_STORAGE_KEY]: newWidth }).catch(error => {
        reportWidthError('save the popup width', error);
        if (revision.current === writeRevision) setWidth(previousWidth);
      });
    },
    [width],
  );

  const resetWidth = React.useCallback(() => updateWidth(DEFAULT_POPUP_WIDTH), [updateWidth]);

  const handleStorageChange = React.useCallback(
    (changes: unknown, storageNamespace: Browser.storage.AreaName) => {
      if (storageNamespace !== 'local') return;
      if (!isRecord(changes)) {
        reportWidthIssues(['Storage changes must be an object.']);
        return;
      }
      if (Object.hasOwn(changes, POPUP_WIDTH_STORAGE_KEY)) {
        revision.current += 1;
        applyStoredWidth(validatePopupWidthChange(changes[POPUP_WIDTH_STORAGE_KEY]));
      }
    },
    [applyStoredWidth],
  );

  React.useEffect(() => {
    let active = true;
    const initialRevision = revision.current;
    browser.storage.onChanged.addListener(handleStorageChange);
    void browser.storage.local
      .get(POPUP_WIDTH_STORAGE_KEY)
      .then(data => {
        if (active && revision.current === initialRevision)
          applyStoredWidth(validateStoredPopupWidth(data));
      })
      .catch(error => reportWidthError('read the popup width', error));
    return () => {
      active = false;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [applyStoredWidth, handleStorageChange]);

  return { width, updateWidth, resetWidth };
};

export default usePopupWidth;
