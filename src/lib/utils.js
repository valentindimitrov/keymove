import { INPUT_NODE_TYPES, KEYS_VALID_FOR_FOCUS_REGEX, MAC_OS_PLATFORMS } from '../constants.js';

function differentInputIsActive(inputElement) {
  const activeElement = getDeepActiveElement();
  return activeElement && activeElement !== inputElement && elementIsEditable(activeElement);
}

function elementIsEditable(element) {
  return element.isContentEditable || INPUT_NODE_TYPES.includes(element.nodeName);
}

function getDeepActiveElement() {
  let activeElement = document.activeElement;
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  return activeElement;
}

function elementIsActive(element) {
  return getDeepActiveElement() === element;
}

function clickOrFocusNode(node) {
  if (INPUT_NODE_TYPES.includes(node.nodeName)) {
    node.focus();
  } else {
    const eventConfig = {
      view: window,
      bubbles: true,
      cancelable: true,
    };

    var mouseoverEvent = new MouseEvent('mouseover', eventConfig);
    var mousedownEvent = new MouseEvent('mousedown', eventConfig);
    var mouseupEvent = new MouseEvent('mouseup', eventConfig);
    var mouseoutEvent = new MouseEvent('mouseout', eventConfig);

    node.dispatchEvent(mouseoverEvent);
    node.dispatchEvent(mousedownEvent);
    node.dispatchEvent(mouseupEvent);
    node.dispatchEvent(mouseoutEvent);

    node.click();
  }
}

function keyValidForFocus(key) {
  return KEYS_VALID_FOR_FOCUS_REGEX.test(key);
}

function getTextContentOfNode(node) {
  if (typeof node.textContent == 'string') {
    return node.textContent;
  } else {
    return node.innerText;
  }
}

function clampNumber(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function compareDescending(a, b) {
  return b - a;
}

function isMacOS() {
  const platform = window.navigator.platform;
  return MAC_OS_PLATFORMS.includes(platform);
}

function nodeIsInViewport(node) {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  const boundingRect = element.getBoundingClientRect();
  return (
    boundingRect.top >= 0 &&
    boundingRect.left >= 0 &&
    boundingRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    boundingRect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

function scrollToNodeAtIndexInList(nodeList, selectedIndex) {
  const selectedMatchingNode = nodeList.length > 0 ? nodeList[selectedIndex] : null;
  if (selectedMatchingNode) {
    selectedMatchingNode.scrollIntoViewIfNeeded();
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
