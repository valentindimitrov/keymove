import { isTextVisible } from './visible_text.js';
import { frameTarget } from './frame_target.js';
import { labelledToggle } from './searchable_attributes.js';
import {
  closestAcrossRoots,
  pageShadowRoots,
  renderedContains,
  isKeyMoveNode,
} from './dom_tree.js';

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
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
  const candidates = Array.from(
    [document, ...pageShadowRoots()].flatMap(root => [
      ...root.querySelectorAll(
        'dialog, [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
      ),
    ]),
  ).filter(
    node =>
      !isKeyMoveNode(node) &&
      !closestAcrossRoots(node, '[inert], [hidden], [aria-hidden="true"]') &&
      isTextVisible(node) &&
      (isNativeModal(node) ||
        (node.getAttribute('aria-modal') === 'true' &&
          (node.nodeName !== 'DIALOG' || node.hasAttribute('open')))),
  );
  const natives = candidates.filter(isNativeModal);
  const eligible = natives.length
    ? candidates.filter(node => natives.some(native => renderedContains(native, node)))
    : candidates;
  modalOrder = modalOrder.filter(node => eligible.includes(node));
  for (const node of eligible) if (!modalOrder.includes(node)) modalOrder.push(node);
  if (focused && !isKeyMoveNode(focused)) {
    const owner = eligible.findLast(node => renderedContains(node, focused));
    if (owner && !eligible.some(node => node !== owner && renderedContains(owner, node))) {
      modalOrder = modalOrder.filter(node => node !== owner);
      modalOrder.push(owner);
    }
  }
  // Nested dialogs always take precedence over their containing dialog.
  const leaves = modalOrder.filter(
    node => !eligible.some(other => other !== node && renderedContains(node, other)),
  );
  return leaves.at(-1) ?? null;
}

function actionIsInScope(node: Element, modal: Element | null): boolean {
  const remote = frameTarget(node);
  if (remote) return remote.alive() && actionIsInScope(remote.boundary, modal);
  const control = labelledToggle(node);
  if (
    control &&
    (closestAcrossRoots(control, '[inert]') || (modal && !renderedContains(modal, control)))
  )
    return false;
  return !closestAcrossRoots(node, '[inert]') && (!modal || renderedContains(modal, node));
}

export { activeModal, actionIsInScope, MODAL_CHANGED_EVENT };
