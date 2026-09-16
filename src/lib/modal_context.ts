import { KEYMOVE_ROOT_ID } from '../constants.js';
import { isTextVisible } from './visible_text.js';
import { labelledToggle } from './searchable_attributes.js';

let modalOrder: Element[] = [];
const MODAL_CHANGED_EVENT = 'keymove-modal-changed';

function isNativeModal(node: Element) {
  try {
    return node.matches('dialog:modal');
  } catch {
    return false;
  }
}

// Keep activation order as dialogs appear, and use real page focus to disambiguate
// stacked siblings. Focusing KeyMove itself must not reorder the stack.
function activeModal(focused: Element | null = document.activeElement): Element | null {
  const candidates = Array.from(
    document.querySelectorAll(
      'dialog, [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
    ),
  ).filter(
    node =>
      !node.closest('[inert], [hidden], [aria-hidden="true"]') &&
      isTextVisible(node) &&
      (isNativeModal(node) ||
        (node.getAttribute('aria-modal') === 'true' &&
          (node.nodeName !== 'DIALOG' || node.hasAttribute('open')))),
  );
  const natives = candidates.filter(isNativeModal);
  const eligible = natives.length
    ? candidates.filter(node => natives.some(native => native.contains(node)))
    : candidates;
  modalOrder = modalOrder.filter(node => eligible.includes(node));
  for (const node of eligible) if (!modalOrder.includes(node)) modalOrder.push(node);
  if (focused && !focused.closest(`#${KEYMOVE_ROOT_ID}`)) {
    const owner = eligible.findLast(node => node.contains(focused));
    if (owner && !eligible.some(node => node !== owner && owner.contains(node))) {
      modalOrder = modalOrder.filter(node => node !== owner);
      modalOrder.push(owner);
    }
  }
  // Nested dialogs always take precedence over their containing dialog.
  const leaves = modalOrder.filter(
    node => !eligible.some(other => other !== node && node.contains(other)),
  );
  return leaves.at(-1) ?? null;
}

function actionIsInScope(node: Element, modal: Element | null) {
  const control = labelledToggle(node);
  if (control && (control.closest('[inert]') || (modal && !modal.contains(control)))) return false;
  return !node.closest('[inert]') && (!modal || modal.contains(node));
}

export { activeModal, actionIsInScope, MODAL_CHANGED_EVENT };
