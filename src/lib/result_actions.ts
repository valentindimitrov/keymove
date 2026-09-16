import { isActionDisabled } from './searchable_attributes.js';
import Utils from './utils.js';

type ResultAction = {
  id: string;
  label: string;
  disabled?: boolean;
};

function actionsForResult(action: HTMLElement | null, text: Element | null): ResultAction[] {
  const items: ResultAction[] = [];
  if (action) {
    const disabled = isActionDisabled(action);
    const link = Utils.linkUrlForNode(action);
    items.push({
      id: 'activate',
      label: disabled ? 'Activate (unavailable)' : link ? 'Open link' : 'Activate control',
      disabled,
    });
    if (Utils.openableLinkUrlForNode(action)) {
      items.push(
        { id: 'foreground-tab', label: 'Open in new tab', disabled },
        { id: 'background-tab', label: 'Open in background tab', disabled },
      );
    }
    if (link) items.push({ id: 'copy-link', label: 'Copy link address' });
    if (action.tabIndex >= 0 || action.hasAttribute('tabindex') || action.isContentEditable) {
      items.push({ id: 'focus', label: 'Focus without activating', disabled });
    }
  }
  if (text) items.push({ id: 'copy-text', label: 'Copy text' });
  return items;
}

export { actionsForResult };
export type { ResultAction };
