import { DO_NOT_SEARCH_NODE_TYPES } from '../constants.js';
import {
  isKeyMoveRoot,
  ownerParent,
  renderedParent,
  renderedChildren,
  textRangeScope,
} from './dom_tree.js';
import { frameTarget } from './frame_target.js';

type StyleCache = WeakMap<
  Element,
  {
    style: CSSStyleDeclaration;
    subtreeVisible?: boolean;
    whitespace?: string;
  }
>;

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
  for (let ancestor: Element | null = element; ancestor; ancestor = renderedParent(ancestor)) {
    const cached = cache.get(ancestor)?.subtreeVisible;
    if (cached !== undefined) {
      visible = cached;
      break;
    }
    const style = computedStyle(ancestor, cache);
    uncached.push(ancestor);
    if (ownerParent(ancestor) && !renderedParent(ancestor)) {
      visible = false;
      break;
    }
    if (isKeyMoveRoot(ancestor) || DO_NOT_SEARCH_NODE_TYPES.includes(ancestor.nodeName)) {
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
  const remote = frameTarget(element);
  if (remote) return remote.alive() && isTextVisible(remote.boundary, cache);
  const visibility = computedStyle(element, cache).visibility;
  return visibility !== 'hidden' && visibility !== 'collapse' && isSubtreeVisible(element, cache);
}

type TextBoundary = [Node, number];
type RenderedTextPart = {
  text: string;
  searchText: string;
  start: TextBoundary;
  end: TextBoundary;
  linear: boolean;
};

function whitespaceFor(element: Element | null, cache: StyleCache): string {
  if (!element) return 'normal';
  const style = computedStyle(element, cache);
  const entry = cache.get(element)!;
  // Browsers return inherited computed values. The fallback also supports DOM test
  // environments that leave inherited properties empty.
  const collapse = style.getPropertyValue('white-space-collapse');
  entry.whitespace ??=
    style.whiteSpace.split(' ')[0] ||
    (collapse && collapse !== 'collapse'
      ? collapse
      : whitespaceFor(renderedParent(element), cache));
  return entry.whitespace;
}

type OwnedText = { skipped: Element[]; boundary: (element: Element, display: string) => boolean };
type RenderedTextOptions = {
  /**
   * Read only the text this element owns, leaving out each descendant subtree for which
   * `boundary` is true. A left-out subtree still contributes a line separator, and is
   * appended to `skipped` before the next part is yielded, so a reader can tell where the
   * owned text is interrupted.
   */
  ownedOnly?: OwnedText;
};

// Inline-level boxes share their parent's lines. Anything else (block, flex, grid, list
// items, table parts, and positioned or floated boxes, which browsers blockify) is laid
// out as a box of its own.
function isInlineLevel(display: string): boolean {
  return display === '' || /^(inline|contents|ruby)/.test(display);
}

function textPart(
  text: string,
  node: Text,
  start: number,
  end: number,
  linear = true,
): RenderedTextPart {
  return { text, searchText: text, start: [node, start], end: [node, end], linear };
}

/**
 * Whitespace-aware text with a compact map back to DOM boundaries. Unchanged runs use
 * linear offsets; collapsed whitespace and structural separators carry just two endpoints.
 * Null entries are work checkpoints, including when visiting nodes that emit no text.
 * No layout-dependent innerText reads, per-character maps, or retained page-wide ranges.
 */
function* iterateRenderedText(
  node: Element | Text,
  cache: StyleCache = new WeakMap(),
  options: RenderedTextOptions = {},
): Generator<RenderedTextPart | null> {
  const owned = options.ownedOnly;
  let pending: RenderedTextPart | null = null;
  let lineStart = true;
  function* append(part: RenderedTextPart): Generator<RenderedTextPart> {
    if (pending) {
      yield pending;
      pending = null;
    }
    yield part;
    lineStart = part.text.endsWith('\n');
  }
  const separate = (element: Element, offset: number) => {
    if (!lineStart)
      pending = {
        text: '\n',
        searchText: ' ',
        start: [element, offset],
        end: [element, offset],
        linear: false,
      };
  };
  function* readText(text: Text): Generator<RenderedTextPart | null> {
    const parent = renderedParent(text);
    if ((!parent && text.parentNode) || (parent && !isTextVisible(parent, cache))) return;
    const whitespace = whitespaceFor(parent, cache);
    const preserve = ['pre', 'pre-wrap', 'preserve', 'break-spaces'].includes(whitespace);
    const preserveBreaks = ['pre-line', 'preserve-breaks'].includes(whitespace);
    // Bound processing even when a page puts megabytes into one Text node.
    for (let offset = 0; offset < text.length; offset += 1024) {
      yield null;
      const chunk = text.data.slice(offset, offset + 1024);
      if (preserve || whitespace === 'preserve-spaces') {
        const value = preserve ? chunk : chunk.replace(/[\t\r\n\f]/g, ' ');
        yield* append(textPart(value, text, offset, offset + chunk.length));
        continue;
      }
      if (!/[\t\r\n\f]| {2}/.test(chunk) && !chunk.startsWith(' ') && !chunk.endsWith(' ')) {
        yield* append(textPart(chunk, text, offset, offset + chunk.length));
        continue;
      }
      const runs = preserveBreaks
        ? /[^\t\n\f\r ]+|\r\n|[\r\n]|[\t\f ]+/g
        : /[^\t\n\f\r ]+|[\t\n\f\r ]+/g;
      for (const match of chunk.matchAll(runs)) {
        const value = match[0];
        const start = offset + match.index;
        const end = start + value.length;
        if (preserveBreaks && /^[\r\n]/.test(value)) {
          pending = null;
          yield* append(textPart('\n', text, start, end, false));
        } else if (/^[\t\n\f\r ]/.test(value)) {
          if (!lineStart && pending?.text !== '\n') {
            if (pending) {
              if (textRangeScope(pending.start[0]) === textRangeScope(text))
                pending.end = [text, end];
            } else pending = textPart(' ', text, start, end, false);
          }
        } else yield* append(textPart(value, text, start, end));
      }
    }
  }
  if (node instanceof Text) {
    yield* readText(node);
    return;
  }
  if (!isSubtreeVisible(node, cache)) return;
  type Frame = { element: Element; children: Iterator<Node>; block: boolean };
  const stack: Frame[] = [{ element: node, children: renderedChildren(node), block: false }];
  while (stack.length) {
    yield null;
    const frame = stack[stack.length - 1]!;
    const step = frame.children.next();
    if (step.done) {
      if (frame.block) separate(frame.element, frame.element.childNodes.length);
      stack.pop();
      continue;
    }
    const child = step.value;
    if (child instanceof Text) yield* readText(child);
    else if (child instanceof Element && isSubtreeVisible(child, cache)) {
      if (child.tagName === 'BR') {
        if (isTextVisible(child, cache)) {
          pending = null;
          yield* append({
            text: '\n',
            searchText: ' ',
            start: [child, 0],
            end: [child, 0],
            linear: false,
          });
        }
        continue;
      }
      const display = computedStyle(child, cache).display;
      if (owned?.boundary(child, display)) {
        owned.skipped.push(child);
        separate(child, 0);
        continue;
      }
      const block =
        /^(block|flow-root|list-item|flex|grid|table|table-row|table-cell|table-caption)$/.test(
          display,
        );
      if (block) separate(child, 0);
      stack.push({ element: child, children: renderedChildren(child), block });
    }
  }
}

function visibleText(node: Element, cache: StyleCache = new WeakMap()): string {
  const remote = frameTarget(node);
  if (remote) return remote.row.text;
  const parts: string[] = [];
  for (const part of iterateRenderedText(node, cache)) if (part) parts.push(part.text);
  return parts.join('');
}

export { isInlineLevel, isTextVisible, iterateRenderedText, visibleText };
export type { StyleCache, OwnedText, RenderedTextPart, TextBoundary };
