import { DO_NOT_SEARCH_NODE_TYPES, KEYMOVE_ROOT_ID } from '../constants.js';

type StyleCache = WeakMap<Element, { style: CSSStyleDeclaration; subtreeVisible?: boolean }>;

function computedStyle(element: Element, cache: StyleCache) {
  let entry = cache.get(element);
  if (!entry) {
    entry = { style: window.getComputedStyle(element) };
    cache.set(element, entry);
  }
  return entry.style;
}

function isSubtreeVisible(element: Element, cache: StyleCache): boolean {
  const uncached: Element[] = [];
  let visible = true;
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    const cached = cache.get(ancestor)?.subtreeVisible;
    if (cached !== undefined) {
      visible = cached;
      break;
    }
    const style = computedStyle(ancestor, cache);
    uncached.push(ancestor);
    if (ancestor.id === KEYMOVE_ROOT_ID || DO_NOT_SEARCH_NODE_TYPES.includes(ancestor.nodeName)) {
      visible = false;
      break;
    }
    if (style.display === 'none' || style.opacity === '0' || style.contentVisibility === 'hidden') {
      visible = false;
      break;
    }
  }
  for (const node of uncached) cache.get(node)!.subtreeVisible = visible;
  return visible;
}

function isTextVisible(element: Element, cache: StyleCache = new WeakMap()): boolean {
  const visibility = computedStyle(element, cache).visibility;
  return visibility !== 'hidden' && visibility !== 'collapse' && isSubtreeVisible(element, cache);
}

function* iterateVisibleTextNodes(
  node: Element,
  cache: StyleCache = new WeakMap(),
): Generator<Text> {
  if (!isSubtreeVisible(node, cache)) return;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: candidate => {
      if (candidate instanceof Element) {
        return isSubtreeVisible(candidate, cache)
          ? NodeFilter.FILTER_SKIP
          : NodeFilter.FILTER_REJECT;
      }
      return candidate.parentElement && isTextVisible(candidate.parentElement, cache)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let text = walker.nextNode();
  while (text) {
    if (text instanceof Text) yield text;
    text = walker.nextNode();
  }
}

function visibleTextNodes(node: Element, cache: StyleCache = new WeakMap()): Text[] {
  return [...iterateVisibleTextNodes(node, cache)];
}

function visibleText(node: Element, cache: StyleCache = new WeakMap()): string {
  return visibleTextNodes(node, cache)
    .map(text => text.data)
    .join('');
}

export { isTextVisible, iterateVisibleTextNodes, visibleText, visibleTextNodes };
export type { StyleCache };
