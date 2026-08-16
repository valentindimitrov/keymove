import rawKeyboardShortcuts from '../data/keyboard_shortcuts.json';
import rawSearchableAttributes from '../data/searchable_attributes_by_node_name.json';
import { validateKeyboardShortcuts, validateSearchableAttributes } from './static_data_schema.js';

const keyboardShortcuts = validateKeyboardShortcuts(rawKeyboardShortcuts);
const searchableAttributesByNodeName = validateSearchableAttributes(rawSearchableAttributes);

export { keyboardShortcuts, searchableAttributesByNodeName };
