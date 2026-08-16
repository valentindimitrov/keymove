import { INPUT_NODE_TYPES, KEYS_VALID_FOR_FOCUS_REGEX, MAC_OS_PLATFORMS } from '../constants.js';

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

function clickOrFocusNode(node: HTMLElement) {
  if (INPUT_NODE_TYPES.includes(node.nodeName)) {
    node.focus();
  } else {
    const eventConfig = {
      view: window,
      bubbles: true,
      cancelable: true,
    };

    const mouseoverEvent = new MouseEvent('mouseover', eventConfig);
    const mousedownEvent = new MouseEvent('mousedown', eventConfig);
    const mouseupEvent = new MouseEvent('mouseup', eventConfig);
    const mouseoutEvent = new MouseEvent('mouseout', eventConfig);

    node.dispatchEvent(mouseoverEvent);
    node.dispatchEvent(mousedownEvent);
    node.dispatchEvent(mouseupEvent);
    node.dispatchEvent(mouseoutEvent);

    node.click();
  }
}

function keyValidForFocus(key: string) {
  return KEYS_VALID_FOR_FOCUS_REGEX.test(key);
}

function getTextContentOfNode(node: Node): string {
  if (typeof node.textContent === 'string') {
    return node.textContent;
  }
  if (node instanceof HTMLElement) {
    return node.innerText;
  }
  return '';
}

function clampNumber(number: number, min: number, max: number) {
  return Math.min(Math.max(number, min), max);
}

function compareDescending(a: number, b: number) {
  return b - a;
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
  return (
    boundingRect.top >= 0 &&
    boundingRect.left >= 0 &&
    boundingRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    boundingRect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

function scrollToNodeAtIndexInList(nodeList: readonly HTMLElement[], selectedIndex: number) {
  const selectedMatchingNode = nodeList.length > 0 ? nodeList[selectedIndex] : null;
  if (selectedMatchingNode) {
    selectedMatchingNode.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function hostIsGmail() {
  return window.location.host === 'mail.google.com';
}

const Utils = {
  differentInputIsActive,
  elementIsActive,
  clickOrFocusNode,
  keyValidForFocus,
  getTextContentOfNode,
  clampNumber,
  compareDescending,
  isMacOS,
  nodeIsInViewport,
  scrollToNodeAtIndexInList,
  hostIsGmail,
};

export default Utils;
