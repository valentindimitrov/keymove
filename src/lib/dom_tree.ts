import { DO_NOT_SEARCH_NODE_TYPES } from '../constants.js';

// KeyMove recognises the roots it created by reference. Page script can give any
// element KeyMove's ids, but it cannot add to this set, so an impostor stays page
// content: searchable, and never mistaken for KeyMove's interface.
const keyMoveRoots = new WeakSet<Element>();

export function markKeyMoveRoot(element: Element) {
  keyMoveRoots.add(element);
}

export function isKeyMoveRoot(node: Node): boolean {
  return node instanceof Element && keyMoveRoots.has(node);
}

/**
 * Shipped builds close KeyMove's shadow roots, so page script can neither read what they
 * show, which includes text from cross-origin frames, nor drive the interface. Test builds
 * (`--mode test`), unit tests and development servers such as `pnpm preview:ui` keep them
 * open so Playwright and jsdom can look inside. See SECURITY.md, "Isolation from the page".
 */
export const KEYMOVE_SHADOW_ROOT_MODE: ShadowRootMode =
  import.meta.env.DEV || import.meta.env.MODE === 'test' ? 'open' : 'closed';

// A closed root is reachable only through the reference attachShadow returns.
const keyMoveShadowRoots = new WeakMap<Element, ShadowRoot>();

/** Creates the shadow root of a KeyMove host and records both, by reference. */
export function attachKeyMoveShadow(host: HTMLElement): ShadowRoot {
  const root = host.attachShadow({ mode: KEYMOVE_SHADOW_ROOT_MODE });
  markKeyMoveRoot(host);
  keyMoveShadowRoots.set(host, root);
  return root;
}

/** The shadow root of one of this copy's hosts, open or closed; null for anything else. */
export function keyMoveShadowRoot(element: Element): ShadowRoot | null {
  return keyMoveShadowRoots.get(element) ?? null;
}

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
    if (isKeyMoveRoot(current)) return true;
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

/** Ownership traversal for discovery/indexing; assigned nodes stay in their owning tree. */
export function* walkOwnedElements(
  root: Element | ShadowRoot,
  { enterShadowRoots = true } = {},
): Generator<Element> {
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
    if (isKeyMoveRoot(node) || DO_NOT_SEARCH_NODE_TYPES.includes(node.nodeName)) continue;
    yield node;
    stack.push(node.children[Symbol.iterator]());
    if (enterShadowRoots && node.shadowRoot)
      stack.push(node.shadowRoot.children[Symbol.iterator]());
  }
}

/** Rendered descendants for actions and names, following slots instead of their fallback. */
export function* walkRenderedElements(root: Element): Generator<Element> {
  const stack: Iterator<Node>[] = [[root][Symbol.iterator]()];
  while (stack.length) {
    const step = stack[stack.length - 1]!.next();
    if (step.done) {
      stack.pop();
      continue;
    }
    const node = step.value;
    if (
      !(node instanceof Element) ||
      isKeyMoveRoot(node) ||
      DO_NOT_SEARCH_NODE_TYPES.includes(node.nodeName)
    )
      continue;
    yield node;
    stack.push(renderedChildren(node));
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
