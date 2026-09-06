import { INPUT_NODE_TYPES, KEYS_VALID_FOR_FOCUS_REGEX, MAC_OS_PLATFORMS } from '../constants.js';
import { normalizedOpenableLinkUrl } from './extension_tabs.js';

function differentInputIsActive(inputElement: Element | null) {
  const activeElement = getDeepActiveElement();
  return activeElement && activeElement !== inputElement && elementIsEditable(activeElement);
}

function elementIsEditable(element: Element) {
  return (
    (element instanceof HTMLElement && element.isContentEditable) ||
    INPUT_NODE_TYPES.includes(element.nodeName)
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
  if (INPUT_NODE_TYPES.includes(node.nodeName)) {
    node.focus();
  } else {
    const eventConfig = {
      bubbles: true,
      cancelable: true,
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
    selectedMatchingNode.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function selectNodeContents(node: Element) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

function clearPageSelection() {
  window.getSelection()?.removeAllRanges();
}

function hostIsGmail() {
  return window.location.host === 'mail.google.com';
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
  hostIsGmail,
};

export default Utils;
