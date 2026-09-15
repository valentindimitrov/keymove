import React from 'react';
import useStoredValue from './use_stored_value.js';
import { HIGHLIGHT_COLORS_STORAGE_KEY } from '../constants.js';
import {
  DEFAULT_HIGHLIGHT_COLORS,
  validateHighlightColors,
} from '../lib/highlight_colors_schema.js';
import type { SearchMode } from './use_search_navigation.js';

const schema = {
  key: HIGHLIGHT_COLORS_STORAGE_KEY,
  description: 'highlight colours',
  initialValue: DEFAULT_HIGHLIGHT_COLORS,
  validate: (raw: unknown) => {
    const result = validateHighlightColors(raw);
    return { value: result.colors, issues: result.issues };
  },
};

export default function useHighlightColors() {
  const { value: colors, updateValue, resetValue: resetColors } = useStoredValue(schema);
  const updateColor = React.useCallback(
    (mode: SearchMode, color: string) => {
      updateValue(previous => ({ ...previous, [mode]: color }));
    },
    [updateValue],
  );
  return { colors, updateColor, resetColors };
}
