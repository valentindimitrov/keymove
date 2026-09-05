import React from 'react';
import { EXTENSION_NAME } from '../extension_identity.js';
import { browser, type Browser } from 'wxt/browser';
import { POPUP_POSITION_STORAGE_KEY } from '../constants.js';
import { DEFAULT_POPUP_POSITION, validatePopupPosition } from '../lib/popup_position_schema.js';
import type { PopupPosition } from '../lib/popup_position_schema.js';

function reportPositionIssues(issues: string[]) {
  issues.forEach(issue =>
    console.warn(`${EXTENSION_NAME} ignored invalid popup position: ${issue}`),
  );
}

function reportPositionError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${EXTENSION_NAME} could not ${operation}: ${message}`);
}

const usePopupPosition = () => {
  const [position, setPosition] = React.useState<PopupPosition>({ ...DEFAULT_POPUP_POSITION });

  const applyStoredPosition = React.useCallback((value: unknown) => {
    const result = validatePopupPosition(value);
    reportPositionIssues(result.issues);
    setPosition(result.position);
  }, []);

  const updatePosition = React.useCallback(
    (newPosition: PopupPosition) => {
      const previousPosition = position;
      setPosition(newPosition);
      void browser.storage.local.set({ [POPUP_POSITION_STORAGE_KEY]: newPosition }).catch(error => {
        reportPositionError('save the popup position', error);
        setPosition(currentPosition =>
          currentPosition === newPosition ? previousPosition : currentPosition,
        );
      });
    },
    [position],
  );

  const resetPosition = React.useCallback(
    () => updatePosition({ ...DEFAULT_POPUP_POSITION }),
    [updatePosition],
  );

  const handleStorageChange = React.useCallback(
    (
      changes: Record<string, Browser.storage.StorageChange>,
      storageNamespace: Browser.storage.AreaName,
    ) => {
      if (storageNamespace === 'local' && Object.hasOwn(changes, POPUP_POSITION_STORAGE_KEY)) {
        applyStoredPosition(changes[POPUP_POSITION_STORAGE_KEY]?.newValue);
      }
    },
    [applyStoredPosition],
  );

  React.useEffect(() => {
    void browser.storage.local
      .get(POPUP_POSITION_STORAGE_KEY)
      .then(data => applyStoredPosition(data[POPUP_POSITION_STORAGE_KEY]))
      .catch(error => reportPositionError('read the popup position', error));
    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, [applyStoredPosition, handleStorageChange]);

  return { position, updatePosition, resetPosition };
};

export default usePopupPosition;
