import { labelledToggle } from './searchable_attributes.js';

/** Presentation only: never add these generated words to the search index. */
export function controlStateLabels(node: Element): string[] {
  const control = labelledToggle(node) ?? node;
  const states: string[] = [];
  // Native properties reflect the live state, unlike checked attributes or stale ARIA.
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    states.push(
      control.indeterminate ? 'partially checked' : control.checked ? 'checked' : 'unchecked',
    );
  } else if (control instanceof HTMLInputElement && control.type === 'radio') {
    states.push(control.checked ? 'selected' : 'unselected');
  } else {
    const role = control.getAttribute('role');
    const checked = control.getAttribute('aria-checked');
    if (role === 'checkbox' && checked === 'mixed') {
      states.push('partially checked');
    } else if (checked === 'true' || checked === 'false') {
      const enabled = checked === 'true';
      if (role === 'checkbox') states.push(enabled ? 'checked' : 'unchecked');
      if (role === 'radio') states.push(enabled ? 'selected' : 'unselected');
      if (role === 'switch') states.push(enabled ? 'on' : 'off');
    }
  }

  const details = control.parentElement;
  if (
    control.matches('summary') &&
    details instanceof HTMLDetailsElement &&
    details.querySelector('summary') === control
  ) {
    states.push(details.open ? 'expanded' : 'collapsed');
  } else {
    const expanded = control.getAttribute('aria-expanded');
    if (expanded === 'true' || expanded === 'false') {
      states.push(expanded === 'true' ? 'expanded' : 'collapsed');
    }
  }
  return states;
}
