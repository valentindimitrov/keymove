import { DO_NOT_SEARCH_NODE_TYPES, KEYMOVE_ROOT_ID } from '../constants.js';

/** DOM ownership (including hosts), distinct from rendered ancestry through slots. */
export function ownerParent(node: Node): Element | null {
  return (
    node.parentElement ??
    (node.parentNode instanceof ShadowRoot
      ? node.parentNode.host
      : node instanceof ShadowRoot
        ? node.host
        : null)
  );
}

export function renderedParent(node: Node): Element | null {
  if ((node instanceof Element || node instanceof Text) && node.assignedSlot)
    return node.assignedSlot;
  const parent = node.parentElement;
  if (parent?.shadowRoot || (parent instanceof HTMLSlotElement && parent.assignedNodes().length))
    return null;
  return ownerParent(node);
}

export function closestAcrossRoots(node: Node | null, selector: string): Element | null {
  for (
    let current = node instanceof Element ? node : node ? ownerParent(node) : null;
    current;
    current = renderedParent(current)
  ) {
    if (current.matches(selector)) return current;
  }
  return null;
}

export function containsAcrossRoots(parent: Node, node: Node): boolean {
  for (let current: Node | null = node; current; current = ownerParent(current))
    if (current === parent) return true;
  return false;
}

export function renderedContains(parent: Node, node: Node): boolean {
  for (let current: Node | null = node; current; current = renderedParent(current))
    if (current === parent) return true;
  return false;
}

export function isKeyMoveNode(node: Node): boolean {
  for (let current: Node | null = node; current; current = ownerParent(current)) {
    if (current instanceof Element && current.id === KEYMOVE_ROOT_ID) return true;
  }
  return false;
}

export function* renderedChildren(node: Element): Generator<Node> {
  if (node.shadowRoot) {
    yield* node.shadowRoot.childNodes;
    return;
  }
  if (node instanceof HTMLSlotElement) {
    const assigned = node.assignedNodes();
    if (assigned.length) {
      yield* assigned;
      return;
    }
  }
  yield* node.childNodes;
}

/** A native range must not bridge separately assigned nodes: slots may reorder them. */
export function textRangeScope(node: Node): Node {
  for (let current: Node | null = node; current; current = current.parentNode) {
    if ((current instanceof Element || current instanceof Text) && current.assignedSlot)
      return current;
  }
  return node.getRootNode();
}

/** Iterative, checkpointable discovery; skip KeyMove before entering its shadow root. */
export function* walkOpenElements(root: Element | ShadowRoot): Generator<Element> {
  const stack: Iterator<Element>[] = [
    (root instanceof Element ? [root] : root.children)[Symbol.iterator](),
  ];
  while (stack.length) {
    const step = stack[stack.length - 1]!.next();
    if (step.done) {
      stack.pop();
      continue;
    }
    const node = step.value;
    if (node.id === KEYMOVE_ROOT_ID || DO_NOT_SEARCH_NODE_TYPES.includes(node.nodeName)) continue;
    yield node;
    stack.push(node.children[Symbol.iterator]());
    if (node.shadowRoot) stack.push(node.shadowRoot.children[Symbol.iterator]());
  }
}

export function compareRenderedOrder(left: Element, right: Element): number {
  if (left === right) return 0;
  const path = (node: Element) => {
    const parts: Element[] = [];
    for (let current: Element | null = node; current; current = renderedParent(current))
      parts.push(current);
    return parts.reverse();
  };
  const a = path(left),
    b = path(right);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length) return -1;
  if (i === b.length) return 1;
  const position = a[i]!.compareDocumentPosition(b[i]!);
  return position & Node.DOCUMENT_POSITION_PRECEDING
    ? 1
    : position & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 0;
}

// The index discovers roots in cancellable chunks. Other consumers reuse that inventory
// instead of walking the whole document whenever focus or modal state changes.
const roots = new Map<ShadowRoot, number>();
export const PAGE_ROOTS_CHANGED = 'keymove-page-roots-changed';
export function retainPageRoot(root: ShadowRoot) {
  roots.set(root, (roots.get(root) ?? 0) + 1);
}
export function releasePageRoot(root: ShadowRoot) {
  const count = roots.get(root) ?? 0;
  if (count <= 1) roots.delete(root);
  else roots.set(root, count - 1);
}
export function pageShadowRoots(): ShadowRoot[] {
  return [...roots.keys()].filter(root => root.host.isConnected && !isKeyMoveNode(root));
}
