import { INPUT_NODE_TYPES, KEYS_VALID_FOR_FOCUS_REGEX, MAC_OS_PLATFORMS } from '../constants.js';
import { normalizedOpenableLinkUrl } from './extension_tabs.js';
import { isActionDisabled, labelledToggle } from './searchable_attributes.js';
import { iterateRenderedText } from './visible_text.js';

const FOCUS_WIDGET_ROLES = [
  'combobox',
  'listbox',
  'textbox',
  'searchbox',
  'slider',
  'spinbutton',
  'treeitem',
];

let selectedPageRange: Range | null = null;
let selectedShadowSelection: { start: Range; end: Range; roots: ShadowRoot[] } | null = null;
function ownsSelection(selection: Selection) {
  if (!selectedShadowSelection)
    return selection.rangeCount > 0 && selection.getRangeAt(0) === selectedPageRange;
  const { start, end, roots } = selectedShadowSelection;
  if (typeof selection.getComposedRanges === 'function') {
    const current = selection.getComposedRanges({ shadowRoots: roots })[0];
    return (
      current?.startContainer === start.startContainer &&
      current.startOffset === start.startOffset &&
      current.endContainer === end.startContainer &&
      current.endOffset === end.startOffset
    );
  }
  return (
    selection.anchorNode === start.startContainer &&
    selection.anchorOffset === start.startOffset &&
    selection.focusNode === end.startContainer &&
    selection.focusOffset === end.startOffset
  );
}
let savedInputSelection: {
  input: HTMLInputElement;
  start: number;
  end: number;
  direction: 'forward' | 'backward' | 'none';
} | null = null;

function differentInputIsActive(inputElement: Element | null) {
  const activeElement = getDeepActiveElement();
  return activeElement && activeElement !== inputElement && elementIsEditable(activeElement);
}

function elementIsEditable(element: Element) {
  return (
    (element instanceof HTMLElement && element.isContentEditable) ||
    INPUT_NODE_TYPES.includes(element.nodeName) ||
    FOCUS_WIDGET_ROLES.includes(element.getAttribute('role') ?? '')
  );
}

function getDeepActiveElement(): Element | null {
  let activeElement = document.activeElement;
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  return activeElement;
}

function elementIsActive(element: Element | null) {
  return getDeepActiveElement() === element;
}

function isExtensionElement(element: EventTarget | null) {
  return (
    element instanceof Element &&
    Boolean(
      element.closest('#keymove-container, #keymove-info-panel, #keymove-root, #keymove-portal'),
    )
  );
}

function clickOrFocusNode(node: HTMLElement) {
  if (isActionDisabled(node)) return;
  const clickInput =
    node instanceof HTMLInputElement &&
    ['checkbox', 'radio', 'submit', 'reset', 'button', 'image'].includes(node.type);
  const focusWidget = FOCUS_WIDGET_ROLES.includes(node.getAttribute('role') ?? '');
  if (
    (INPUT_NODE_TYPES.includes(node.nodeName) && !clickInput) ||
    node.isContentEditable ||
    node.matches(
      '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]',
    ) ||
    focusWidget
  ) {
    node.focus();
  } else if (
    clickInput ||
    labelledToggle(node) !== null ||
    node.nodeName === 'SUMMARY' ||
    node.matches(
      '[role="switch"], [role="radio"], [role="checkbox"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
    )
  ) {
    node.click();
  } else {
    const eventConfig = {
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    const PointerEventConstructor = window.PointerEvent ?? MouseEvent;

    const pointeroverEvent = new PointerEventConstructor('pointerover', eventConfig);
    const mouseoverEvent = new MouseEvent('mouseover', eventConfig);
    const pointerdownEvent = new PointerEventConstructor('pointerdown', eventConfig);
    const mousedownEvent = new MouseEvent('mousedown', eventConfig);
    const pointerupEvent = new PointerEventConstructor('pointerup', eventConfig);
    const mouseupEvent = new MouseEvent('mouseup', eventConfig);
    const pointeroutEvent = new PointerEventConstructor('pointerout', eventConfig);
    const mouseoutEvent = new MouseEvent('mouseout', eventConfig);

    node.dispatchEvent(pointeroverEvent);
    node.dispatchEvent(mouseoverEvent);
    node.dispatchEvent(pointerdownEvent);
    node.dispatchEvent(mousedownEvent);
    node.dispatchEvent(pointerupEvent);
    node.dispatchEvent(mouseupEvent);
    node.click();
    node.dispatchEvent(pointeroutEvent);
    node.dispatchEvent(mouseoutEvent);
  }
}

function linkUrlForNode(node: HTMLElement | null) {
  if (!(node instanceof HTMLAnchorElement) || !node.hasAttribute('href')) {
    return null;
  }
  return node.href;
}

function openableLinkUrlForNode(node: HTMLElement | null) {
  const linkUrl = linkUrlForNode(node);
  return normalizedOpenableLinkUrl(linkUrl ?? undefined);
}

function keyValidForFocus(key: string) {
  return KEYS_VALID_FOR_FOCUS_REGEX.test(key);
}

function clampNumber(number: number, min: number, max: number) {
  return Math.min(Math.max(number, min), max);
}

function isMacOS() {
  const platform = window.navigator.platform;
  return MAC_OS_PLATFORMS.includes(platform);
}

function nodeIsInViewport(node: Node) {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!(element instanceof Element)) {
    return false;
  }
  const boundingRect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  return (
    boundingRect.bottom > 0 &&
    boundingRect.right > 0 &&
    boundingRect.top < viewportHeight &&
    boundingRect.left < viewportWidth
  );
}

function scrollToNodeAtIndexInList(nodeList: readonly Element[], selectedIndex: number) {
  const selectedMatchingNode = nodeList.length > 0 ? nodeList[selectedIndex] : null;
  if (selectedMatchingNode) {
    const rect = selectedMatchingNode.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    // Native text selection can first reveal a result flush against the viewport edge.
    // Reserve context there too, while leaving comfortably visible results in place.
    const contextMargin = Math.min(200, viewportHeight * 0.2);
    const nearViewportEdge =
      rect.top < contextMargin || rect.bottom > viewportHeight - contextMargin;
    selectedMatchingNode.scrollIntoView({
      block: nearViewportEdge ? 'center' : 'nearest',
      inline: 'nearest',
    });
  }
}

function selectNodeContents(node: Element) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  if (!ownsSelection(selection)) {
    const input = getDeepActiveElement();
    savedInputSelection =
      input instanceof HTMLInputElement && input.selectionStart !== null
        ? {
            input,
            start: input.selectionStart,
            end: input.selectionEnd ?? input.selectionStart,
            direction: input.selectionDirection ?? 'none',
          }
        : null;
  }
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  selectedPageRange = range;
  selectedShadowSelection = null;
  // Native ranges are tree-local. Use composed endpoints for slotted/component text;
  // retain a snapshot because getRangeAt may re-scope a shadow selection to its host.
  if (node.getRootNode() instanceof ShadowRoot || node.shadowRoot || node.querySelector('slot')) {
    let first: [Node, number] | undefined;
    let last: [Node, number] | undefined;
    for (const part of iterateRenderedText(node)) {
      if (part) {
        first ??= part.start;
        last = part.end;
      }
    }
    if (first && last) {
      selection.setBaseAndExtent(...first, ...last);
      const start = new Range(),
        end = new Range();
      start.setStart(...first);
      start.collapse(true);
      end.setStart(...last);
      end.collapse(true);
      const roots = [...new Set([first[0].getRootNode(), last[0].getRootNode()])].filter(
        (root): root is ShadowRoot => root instanceof ShadowRoot,
      );
      selectedShadowSelection = { start, end, roots };
    }
  }
}

function clearPageSelection() {
  const selection = window.getSelection();
  if (selection && ownsSelection(selection)) {
    selection.removeAllRanges();
    if (savedInputSelection && elementIsActive(savedInputSelection.input)) {
      const { input, start, end, direction } = savedInputSelection;
      input.setSelectionRange(start, end, direction);
    }
  }
  selectedPageRange = null;
  selectedShadowSelection = null;
  savedInputSelection = null;
}

function restoreInputSelection(input: HTMLInputElement) {
  if (savedInputSelection?.input === input) clearPageSelection();
}

const Utils = {
  differentInputIsActive,
  elementIsActive,
  isExtensionElement,
  clickOrFocusNode,
  linkUrlForNode,
  openableLinkUrlForNode,
  keyValidForFocus,
  clampNumber,
  isMacOS,
  nodeIsInViewport,
  scrollToNodeAtIndexInList,
  selectNodeContents,
  clearPageSelection,
  restoreInputSelection,
};

export default Utils;
