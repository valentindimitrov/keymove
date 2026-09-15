import useStoredValue from './use_stored_value.js';
import { POPUP_POSITION_STORAGE_KEY } from '../constants.js';
import { DEFAULT_POPUP_POSITION, validatePopupPosition } from '../lib/popup_position_schema.js';

const schema = {
  key: POPUP_POSITION_STORAGE_KEY,
  description: 'popup position',
  initialValue: DEFAULT_POPUP_POSITION,
  validate: (raw: unknown) => {
    const result = validatePopupPosition(raw);
    return { value: result.position, issues: result.issues };
  },
};

export default function usePopupPosition() {
  const { value, updateValue, resetValue } = useStoredValue(schema);
  return { position: value, updatePosition: updateValue, resetPosition: resetValue };
}
