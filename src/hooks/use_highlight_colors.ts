import React from 'react';
import { EXTENSION_NAME } from '../extension_identity.js';
import { browser, type Browser } from 'wxt/browser';
import { HIGHLIGHT_COLORS_STORAGE_KEY } from '../constants.js';
import {
  DEFAULT_HIGHLIGHT_COLORS,
  validateHighlightColors,
  validateHighlightColorsChange,
} from '../lib/highlight_colors_schema.js';
import type { HighlightColors, HighlightColorsValidation } from '../lib/highlight_colors_schema.js';
import type { SearchMode } from './use_search_navigation.js';
import { isRecord } from '../lib/runtime_schema.js';

function reportColorIssues(issues: string[]) {
  issues.forEach(issue =>
    console.warn(`${EXTENSION_NAME} ignored invalid highlight colour: ${issue}`),
  );
}

function reportColorError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${EXTENSION_NAME} could not ${operation}: ${message}`);
}

const useHighlightColors = () => {
  const revision = React.useRef(0);
  const [colors, setColors] = React.useState<HighlightColors>({ ...DEFAULT_HIGHLIGHT_COLORS });

  const applyStoredColors = React.useCallback((result: HighlightColorsValidation) => {
    reportColorIssues(result.issues);
    setColors(result.colors);
  }, []);

  const updateColor = React.useCallback(
    (mode: SearchMode, color: string) => {
      const writeRevision = ++revision.current;
      const previousColors = colors;
      const nextColors = { ...colors, [mode]: color };
      setColors(nextColors);
      void browser.storage.local
        .set({ [HIGHLIGHT_COLORS_STORAGE_KEY]: nextColors })
        .catch(error => {
          reportColorError('save the highlight colours', error);
          if (revision.current === writeRevision) setColors(previousColors);
        });
    },
    [colors],
  );

  const resetColors = React.useCallback(() => {
    const writeRevision = ++revision.current;
    const previousColors = colors;
    setColors({ ...DEFAULT_HIGHLIGHT_COLORS });
    void browser.storage.local
      .set({ [HIGHLIGHT_COLORS_STORAGE_KEY]: { ...DEFAULT_HIGHLIGHT_COLORS } })
      .catch(error => {
        reportColorError('reset the highlight colours', error);
        if (revision.current === writeRevision) setColors(previousColors);
      });
  }, [colors]);

  const handleStorageChange = React.useCallback(
    (changes: unknown, storageNamespace: Browser.storage.AreaName) => {
      if (storageNamespace !== 'local') return;
      if (!isRecord(changes)) {
        reportColorIssues(['Storage changes must be an object.']);
        return;
      }
      if (Object.hasOwn(changes, HIGHLIGHT_COLORS_STORAGE_KEY)) {
        revision.current += 1;
        applyStoredColors(validateHighlightColorsChange(changes[HIGHLIGHT_COLORS_STORAGE_KEY]));
      }
    },
    [applyStoredColors],
  );

  React.useEffect(() => {
    let active = true;
    const initialRevision = revision.current;
    browser.storage.onChanged.addListener(handleStorageChange);
    void browser.storage.local
      .get(HIGHLIGHT_COLORS_STORAGE_KEY)
      .then(data => {
        if (!active || revision.current !== initialRevision) return;
        applyStoredColors(
          validateHighlightColors(isRecord(data) ? data[HIGHLIGHT_COLORS_STORAGE_KEY] : undefined),
        );
      })
      .catch(error => reportColorError('read the highlight colours', error));
    return () => {
      active = false;
      browser.storage?.onChanged.removeListener(handleStorageChange);
    };
  }, [applyStoredColors, handleStorageChange]);

  return { colors, updateColor, resetColors };
};

export default useHighlightColors;
