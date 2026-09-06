import { DO_NOT_SEARCH_NODE_TYPES, KEYMOVE_ROOT_ID } from '../constants.js';

type StyleCache = WeakMap<Element, CSSStyleDeclaration>;

function computedStyle(element: Element, cache: StyleCache) {
  let style = cache.get(element);
  if (!style) {
    style = window.getComputedStyle(element);
    cache.set(element, style);
  }
  return style;
}

function isTextVisible(element: Element, cache: StyleCache = new WeakMap()): boolean {
  const visibility = computedStyle(element, cache).visibility;
  if (visibility === 'hidden' || visibility === 'collapse') {
    return false;
  }
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.id === KEYMOVE_ROOT_ID || DO_NOT_SEARCH_NODE_TYPES.includes(ancestor.nodeName)) {
      return false;
    }
    const style = computedStyle(ancestor, cache);
    if (style.display === 'none' || style.opacity === '0' || style.contentVisibility === 'hidden') {
      return false;
    }
  }
  return true;
}

function visibleTextNodes(node: Element, cache: StyleCache = new WeakMap()): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let text = walker.nextNode();
  while (text) {
    if (text instanceof Text && text.parentElement && isTextVisible(text.parentElement, cache)) {
      nodes.push(text);
    }
    text = walker.nextNode();
  }
  return nodes;
}

function visibleText(node: Element, cache: StyleCache = new WeakMap()): string {
  return visibleTextNodes(node, cache)
    .map(text => text.data)
    .join('');
}

export { isTextVisible, visibleText, visibleTextNodes };
export type { StyleCache };
