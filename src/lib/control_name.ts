import { iterateRenderedText, isTextVisible } from './visible_text.js';
import { walkOpenElements } from './dom_tree.js';

// Explicitly referenced labels may be hidden. Keep traversal bounded so the index can
// yield even if a site references a very large subtree. Never read field values.
function* labelParts(node: Element, referenced = false): Generator<string | null> {
  if (!referenced || isTextVisible(node)) {
    for (const part of iterateRenderedText(node)) yield part?.text ?? null;
  } else {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: child =>
        child instanceof Element && child.matches('script, style, input, textarea, select')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    let child = walker.nextNode();
    while (child) {
      yield null;
      if (child instanceof Text) {
        for (let offset = 0; offset < child.length; offset += 1024)
          yield child.data.slice(offset, offset + 1024);
      }
      child = walker.nextNode();
    }
  }
  // Rendered text intentionally excludes alternative text; control names include it.
  for (const child of walkOpenElements(node)) {
    yield null;
    if (child instanceof HTMLImageElement && (referenced || isTextVisible(child)))
      yield ` ${child.alt} `;
  }
}

function* iterateControlName(node: Element): Generator<string | null> {
  const ids = node.getAttribute('aria-labelledby')?.trim().split(/\s+/) ?? [];
  let foundReference = false;
  for (const id of ids) {
    const root = node.getRootNode();
    const reference =
      root instanceof Document || root instanceof ShadowRoot ? root.getElementById(id) : null;
    if (reference) {
      foundReference = true;
      yield* labelParts(reference, true);
      yield ' ';
    }
  }
  if (foundReference) return;
  const ariaLabel = node.getAttribute('aria-label')?.trim();
  if (ariaLabel) {
    yield ariaLabel;
    return;
  }
  if (
    node instanceof HTMLInputElement ||
    node instanceof HTMLSelectElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLButtonElement
  ) {
    if (node.labels?.length) {
      for (const label of node.labels) {
        yield* labelParts(label, true);
        yield ' ';
      }
      return;
    }
  }
  let hasText = false;
  for (const part of labelParts(node)) {
    if (part?.trim()) hasText = true;
    yield part;
  }
  if (hasText) return;
  if (node instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(node.type)) {
    yield node.value || (node.type === 'submit' ? 'Submit' : node.type === 'reset' ? 'Reset' : '');
    return;
  }
  for (const attribute of ['alt', 'title', 'placeholder', 'name']) {
    const value = node.getAttribute(attribute)?.trim();
    if (value) {
      yield value;
      return;
    }
  }
}

function controlName(node: Element) {
  return [...iterateControlName(node)].join('').replace(/\s+/g, ' ').trim();
}

export { iterateControlName, controlName };
