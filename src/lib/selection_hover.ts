import { isKeyMoveNode, renderedParent } from './dom_tree.js';
import { activeModal, actionIsInScope } from './modal_context.js';
import { isActionDisabled } from './searchable_attributes.js';
import { isTextVisible } from './visible_text.js';
import { frameTarget, resultIsConnected } from './frame_target.js';

function eligible(node: Element) {
  return (
    resultIsConnected(node) &&
    !isKeyMoveNode(node) &&
    isTextVisible(node) &&
    !isActionDisabled(node) &&
    actionIsInScope(node, activeModal())
  );
}

function ancestry(node: Element | null) {
  const path: Element[] = [];
  for (let current = node; current; current = renderedParent(current)) path.push(current);
  return path;
}

/** Best-effort JS hover only: never click, focus, rewrite CSS, or move the real pointer. */
export class SelectionHover {
  private path: Element[] = [];
  private generation = 0;

  get hasTarget() {
    return this.path.length > 0;
  }

  select(node: Element | null) {
    this.transition(node && eligible(node) ? node : null);
  }

  reconcile() {
    const target = this.path[0];
    if (target && !eligible(target)) this.clear();
  }

  clear() {
    this.transition(null);
  }

  releaseTo(node: Element | null) {
    if (this.path.length === 0) return;
    // A real pointer entering the same menu already owns its shared ancestors.
    // Release only our old branch, without closing or re-entering the physical target.
    this.transition(node, true);
  }

  private transition(next: Element | null, relinquish = false) {
    const previous = this.path[0] ?? null;
    if (frameTarget(previous) || frameTarget(next)) {
      if (previous === next) return;
      if (frameTarget(previous)) {
        void frameTarget(previous)!.command('unhover');
        this.path = [];
      } else if (previous) this.transition(null);
      if (frameTarget(next)) {
        if (!relinquish) {
          this.path = [next!];
          void frameTarget(next)!.command('hover');
        }
        return;
      }
    }
    if (previous === next) {
      if (relinquish) {
        this.path = [];
        this.generation++;
      }
      return;
    }
    // Retain the old ancestry so removal of the target still releases its menu owner.
    const oldPath = this.path;
    const nextPath = ancestry(next);
    this.path = relinquish ? [] : nextPath;
    const generation = ++this.generation;
    const rect = (next ?? previous)?.getBoundingClientRect();
    const emit = (node: Element, type: string, relatedTarget: Element | null, bubbles: boolean) => {
      // Page handlers may synchronously close KeyMove or change modal scope.
      if (generation !== this.generation) return;
      const config = {
        bubbles,
        composed: bubbles,
        cancelable: bubbles,
        relatedTarget,
        clientX: rect ? rect.left + rect.width / 2 : 0,
        clientY: rect ? rect.top + rect.height / 2 : 0,
        buttons: 0,
      };
      const event =
        type.startsWith('pointer') && window.PointerEvent
          ? new PointerEvent(type, {
              ...config,
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true,
            })
          : new MouseEvent(type, config);
      node.dispatchEvent(event);
    };
    for (const prefix of ['pointer', 'mouse']) {
      if (previous) emit(previous, `${prefix}out`, next, true);
      for (const node of oldPath) {
        if (!nextPath.includes(node)) emit(node, `${prefix}leave`, next, false);
      }
    }
    for (const prefix of relinquish ? [] : ['pointer', 'mouse']) {
      if (next) emit(next, `${prefix}over`, previous, true);
      for (const node of [...nextPath].reverse()) {
        if (!oldPath.includes(node)) emit(node, `${prefix}enter`, previous, false);
      }
    }
    this.reconcile();
  }
}
