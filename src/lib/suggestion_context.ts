import { visibleText } from './visible_text.js';
import { matchingTextSpans } from './search_text.js';
import { controlName } from './control_name.js';
import { inputDisplayValue } from './input_value.js';
import { controlStateLabels } from './control_state.js';
import { renderedParent } from './dom_tree.js';
import { isActionDisabled, labelledToggle } from './searchable_attributes.js';

const LANDMARK_LABELS: [string, string][] = [
  ['nav', 'Navigation'],
  ['[role="navigation"]', 'Navigation'],
  ['header', 'Header'],
  ['[role="banner"]', 'Header'],
  ['footer', 'Footer'],
  ['[role="contentinfo"]', 'Footer'],
  ['aside', 'Sidebar'],
  ['[role="complementary"]', 'Sidebar'],
  ['dialog', 'Dialog'],
  ['[role="dialog"]', 'Dialog'],
  ['form', 'Form'],
  ['table', 'Table'],
  ['main', 'Main content'],
  ['[role="main"]', 'Main content'],
];

const CONTROL_LABELS: [string, string][] = [
  ['a[href]', 'link'],
  ['button', 'button'],
  ['[role="button"]', 'button'],
  ['[role="link"]', 'link'],
  ['[role="checkbox"]', 'checkbox'],
  ['[role="tab"]', 'tab'],
  ['select', 'dropdown'],
  ['textarea', 'text field'],
  ['summary', 'disclosure'],
  ['[role="switch"]', 'switch'],
  ['[role="radio"]', 'radio'],
  ['[role="combobox"], [role="listbox"]', 'dropdown'],
  ['[contenteditable]', 'editor'],
];

const BLOCK_LABELS: [string, string][] = [
  ['h1, h2, h3, h4, h5, h6', 'heading'],
  ['li', 'list item'],
  ['td, th', 'table cell'],
  ['blockquote', 'quote'],
  ['pre, code', 'code'],
  ['figcaption', 'caption'],
];

const MAX_LABEL_LENGTH = 80;

function firstMatchingLabel(node: Element, labels: [string, string][]) {
  for (const [selector, label] of labels) {
    if (node.matches(selector)) return label;
  }
  return null;
}

function inputLabel(node: Element) {
  if (node.nodeName !== 'INPUT') return null;
  const type = (node.getAttribute('type') || 'text').toLocaleLowerCase();
  if (type === 'checkbox' || type === 'radio') return type;
  if (type === 'submit' || type === 'button' || type === 'reset') return 'button';
  return 'text field';
}

/** What activating this result would do, in the words a person would use. */
function kindLabelForNode(node: Element, kind: 'action' | 'text') {
  if (kind === 'action') {
    const label =
      inputLabel(labelledToggle(node) ?? node) ??
      firstMatchingLabel(node, CONTROL_LABELS) ??
      'control';
    return [
      label,
      ...controlStateLabels(node),
      ...(isActionDisabled(node) ? ['unavailable'] : []),
    ].join(' · ');
  }
  return firstMatchingLabel(node, BLOCK_LABELS) ?? 'paragraph';
}

/**
 * The region of the page a result sits in. The same label often appears more than once, and
 * knowing which one is in the sidebar is usually enough to tell them apart.
 */
function landmarkForNode(node: Element) {
  let current: Element | null = node;
  while (current && current !== document.body) {
    const label = firstMatchingLabel(current, LANDMARK_LABELS);
    if (label) return label;
    current = renderedParent(current);
  }
  return null;
}

/** The text shown for a result: an action's accessible name, or a text block's own words. */
function labelForNode(node: Element, kind: 'action' | 'text') {
  if (kind === 'action') {
    const name = controlName(node);
    const value = inputDisplayValue(node);
    return value && name && value !== name ? `${name} — ${value}` : value || name;
  }
  return visibleText(node).replace(/\s+/g, ' ').trim();
}

/**
 * Trims a long block to a window around the match, so a row shows the words either side of
 * what matched rather than the opening of a paragraph that matched near its end.
 */
function excerptAround(label: string, term: string | null, maxLength = MAX_LABEL_LENGTH) {
  if (label.length <= maxLength) return { excerpt: label, elided: false };
  const span = term ? matchingTextSpans(label, term, 1)[0] : undefined;
  if (!span) return { excerpt: `${label.slice(0, maxLength).trimEnd()}…`, elided: true };
  const lead = Math.max(0, span.start - Math.floor((maxLength - (span.end - span.start)) / 2));
  const excerpt = label.slice(lead, lead + maxLength).trim();
  return {
    excerpt: `${lead > 0 ? '…' : ''}${excerpt}${lead + maxLength < label.length ? '…' : ''}`,
    elided: true,
  };
}

export { excerptAround, kindLabelForNode, labelForNode, landmarkForNode };
