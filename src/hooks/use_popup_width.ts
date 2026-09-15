import useStoredValue from './use_stored_value.js';
import { POPUP_WIDTH_STORAGE_KEY } from '../constants.js';
import { DEFAULT_POPUP_WIDTH, validatePopupWidth } from '../lib/popup_width_schema.js';

const schema = {
  key: POPUP_WIDTH_STORAGE_KEY,
  description: 'popup width',
  initialValue: DEFAULT_POPUP_WIDTH,
  validate: (raw: unknown) => {
    const result = validatePopupWidth(raw);
    return { value: result.width, issues: result.issues };
  },
};

export default function usePopupWidth() {
  const { value, updateValue, resetValue } = useStoredValue(schema);
  return { width: value, updateWidth: updateValue, resetWidth: resetValue };
}
