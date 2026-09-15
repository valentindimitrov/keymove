import React from 'react';
import useDocumentEvent from './use_document_event.js';
import Utils from '../lib/utils.js';
import { isTextVisible } from '../lib/visible_text.js';

type FocusSnapshot = {
  element: HTMLElement;
  selection: {
    start: number;
    end: number;
    direction: 'forward' | 'backward' | 'none';
  } | null;
};

function canRestore(element: HTMLElement) {
  if (!element.isConnected) return false;
  // Check the page's shadow hosts too: closest() and parentElement stop at a shadow root.
  for (let current: Element | null = element; current;) {
    if (current.closest(':disabled, [hidden], [inert]') || !isTextVisible(current)) return false;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return true;
}

/** Remember the page control only while focus belongs to this search session. */
function useSearchFocus(inputRef: React.RefObject<HTMLInputElement | null>) {
  const previousFocus = React.useRef<FocusSnapshot | null>(null);
  const discard = React.useCallback(() => {
    previousFocus.current = null;
  }, []);

  const handleFocusOut = React.useCallback(
    (event: FocusEvent) => {
      // Capture before the search receives focus, including direct clicks and page shadow DOM.
      const element = event.composedPath()[0];
      if (Utils.isExtensionElement(element ?? null)) {
        if (
          (event.relatedTarget && !Utils.isExtensionElement(event.relatedTarget)) ||
          (!event.relatedTarget && document.hasFocus() && document.visibilityState === 'visible')
        )
          discard();
        return;
      }
      if (
        !(element instanceof HTMLElement) ||
        element === document.body ||
        element === document.documentElement ||
        !Utils.isExtensionElement(event.relatedTarget)
      )
        return;
      const field = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
      previousFocus.current = {
        element,
        selection:
          field && element.selectionStart !== null
            ? {
                start: element.selectionStart,
                end: element.selectionEnd ?? element.selectionStart,
                direction: element.selectionDirection ?? 'none',
              }
            : null,
      };
    },
    [discard],
  );

  const handleFocusIn = React.useCallback(
    (event: FocusEvent) => {
      // A user's or page script's new focus takes precedence over the old return target.
      if (!Utils.isExtensionElement(event.composedPath()[0] ?? event.target)) discard();
    },
    [discard],
  );

  useDocumentEvent('focusout', true, handleFocusOut, true);
  useDocumentEvent('focusin', true, handleFocusIn, true);

  const restore = React.useCallback(() => {
    const snapshot = previousFocus.current;
    discard();
    const input = inputRef.current;
    if (!input || !Utils.elementIsActive(input)) return;
    if (snapshot && canRestore(snapshot.element)) {
      const { element, selection } = snapshot;
      element.focus({ preventScroll: true });
      // Focus handlers may redirect focus; never override that decision or its selection.
      if (
        Utils.elementIsActive(element) &&
        selection &&
        (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
        element.selectionStart !== null
      )
        element.setSelectionRange(selection.start, selection.end, selection.direction);
    }
    if (Utils.elementIsActive(input)) input.blur();
  }, [discard, inputRef]);

  return { restore, discard };
}

export default useSearchFocus;
