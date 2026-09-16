// Only types whose value is displayed as text. Passwords, file paths, hidden
// inputs and internal radio/checkbox/range values must never enter search results.
const TEXT_VALUE_TYPES = new Set(['text', 'search', 'number', 'email', 'tel', 'url']);

function hasSearchableInputValue(node: Element): node is HTMLInputElement {
  return node instanceof HTMLInputElement && TEXT_VALUE_TYPES.has(node.type);
}

// Call after visibility/scope checks. Read the property, not the initial HTML
// attribute, and do not cache it: changing .value need not mutate the DOM.
function inputDisplayValue(node: Element): string {
  return hasSearchableInputValue(node) ? node.value.trim() : '';
}

export { hasSearchableInputValue, inputDisplayValue };
