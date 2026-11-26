import React from 'react';
import { EXTENSION_NAME } from '../../extension_identity.js';
import { KEYMOVE_INPUT_ID, KEYMOVE_SUGGESTIONS_ID } from '../../constants.js';
import Utils from '../../lib/utils.js';
import { isHandledByKeyMove, isTrustedInput, trusted } from '../../lib/trusted_input.js';

type SearchInputProps = {
  searchText: string;
  suggestionCount: number;
  suggestionsOpen?: boolean;
  actionMenuOpen?: boolean;
  tooltipsMode?: boolean;
  actionsAvailable?: boolean;
  imageSelected?: boolean;
  activeSuggestionIndex: number | null;
  updateSearchText: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onBlur: React.FocusEventHandler<HTMLInputElement>;
  onCopyCancelled?: () => void;
};

function stopKeyboardPropagation(event: React.KeyboardEvent<HTMLInputElement>) {
  // Page shortcut handlers see the shadow host as the target, not this editable input.
  event.stopPropagation();
}

function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
  stopKeyboardPropagation(event);
  if (!isTrustedInput(event)) return;
  const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c';
  if (
    !isCopy &&
    (Array.from(event.key).length === 1 ||
      [
        'Backspace',
        'Delete',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
      ].includes(event.key))
  ) {
    Utils.restoreInputSelection(event.currentTarget);
  }
}

let graphemes: Intl.Segmenter | undefined;

/** Where Left, Right, Home or End, without Shift, put the caret in `input`; else null. */
function caretForKey(input: HTMLInputElement, key: string, shift: boolean): number | null {
  if (shift) return null;
  const { value } = input;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? start;
  if (key === 'Home') return 0;
  if (key === 'End') return value.length;
  // In right-to-left text Left and Right move visually, not by string order; leave them.
  if (/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/.test(value)) return null;
  // By whole characters as users see them, so an accent never parts from its letter.
  graphemes ??= new Intl.Segmenter('und', { granularity: 'grapheme' });
  const bounds = [
    0,
    ...Array.from(graphemes.segment(value), part => part.index + part.segment.length),
  ];
  if (key === 'ArrowLeft') {
    if (start !== end) return start;
    return bounds.filter(bound => bound < start).at(-1) ?? 0;
  }
  if (key === 'ArrowRight') {
    if (start !== end) return end;
    return bounds.find(bound => bound > end) ?? value.length;
  }
  return null;
}

/** The value and caret a typed character, Backspace or Delete leaves in `input`. */
function editForKey(input: HTMLInputElement, key: string) {
  const { value } = input;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? start;
  if (Array.from(key).length === 1)
    return { value: value.slice(0, start) + key + value.slice(end), caret: start + key.length };
  if (key !== 'Backspace' && key !== 'Delete') return null;
  if (start !== end) return { value: value.slice(0, start) + value.slice(end), caret: start };
  // Whole characters, so a supplementary character is never split.
  if (key === 'Backspace') {
    const before = Array.from(value.slice(0, start));
    const removed = before.pop();
    if (removed === undefined) return null;
    return { value: before.join('') + value.slice(end), caret: start - removed.length };
  }
  const after = Array.from(value.slice(end));
  if (after.shift() === undefined) return null;
  return { value: value.slice(0, start) + after.join(''), caret: start };
}

// Editing hands the caret back to the input, dropping the result block's native selection.
const restoreSelection = trusted((event: React.SyntheticEvent<HTMLInputElement>) =>
  Utils.restoreInputSelection(event.currentTarget),
);

const SearchInput = (props: SearchInputProps) => {
  const {
    searchText,
    updateSearchText,
    inputRef,
    onBlur,
    onCopyCancelled,
    suggestionCount,
    activeSuggestionIndex,
  } = props;

  // A page shortcut handler sees only KeyMove's host, the whole of a closed root, and can
  // cancel a key typed here as if it were page input. Page handlers that run in the capture
  // phase come first, so a cancelled character, Backspace or Delete that KeyMove did not
  // take is applied here. The value is assigned through `value`, which React tracks, so its
  // next change event still fires.
  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      handleKeyDown(event);
      const native = event.nativeEvent;
      if (
        !isTrustedInput(event) ||
        !native.defaultPrevented ||
        isHandledByKeyMove(native) ||
        native.isComposing
      )
        return;
      // Copying: the cancelled keystroke also stopped the copy event KeyMove serves.
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'c'
      ) {
        onCopyCancelled?.();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const caret = caretForKey(event.currentTarget, event.key, event.shiftKey);
      if (caret !== null) {
        event.currentTarget.setSelectionRange(caret, caret);
        return;
      }
      if (event.shiftKey && Array.from(event.key).length !== 1) return;
      const edit = editForKey(event.currentTarget, event.key);
      if (!edit) return;
      const input = event.currentTarget;
      input.value = edit.value;
      input.setSelectionRange(edit.caret, edit.caret);
      updateSearchText(edit.value);
    },
    [updateSearchText, onCopyCancelled],
  );

  // Page script cannot reach this input in shipped builds, whose root is closed, but can in
  // test builds; React restores the controlled value when the handler ignores its events.
  const onSearchTextChange = React.useMemo(
    () =>
      trusted((event: React.ChangeEvent<HTMLInputElement>) => updateSearchText(event.target.value)),
    [updateSearchText],
  );

  return (
    <div id={'keymove-input-container'}>
      <input
        ref={inputRef}
        id={KEYMOVE_INPUT_ID}
        type="text"
        aria-label="Search page"
        role="combobox"
        aria-expanded={props.actionMenuOpen || (props.suggestionsOpen ?? suggestionCount > 0)}
        aria-haspopup={props.actionMenuOpen ? 'menu' : 'listbox'}
        aria-controls={
          props.actionMenuOpen
            ? 'keymove-action-menu'
            : (props.suggestionsOpen ?? suggestionCount > 0)
              ? KEYMOVE_SUGGESTIONS_ID
              : undefined
        }
        aria-describedby={
          props.actionsAvailable && props.tooltipsMode !== false
            ? 'keymove-actions-hint'
            : undefined
        }
        aria-activedescendant={
          props.actionMenuOpen || activeSuggestionIndex === null
            ? undefined
            : `keymove-suggestion-${activeSuggestionIndex}`
        }
        placeholder={`${EXTENSION_NAME}!`}
        value={searchText}
        onChange={onSearchTextChange}
        onKeyDown={onKeyDown}
        onKeyPress={stopKeyboardPropagation}
        onKeyUp={stopKeyboardPropagation}
        onPaste={restoreSelection}
        onCut={restoreSelection}
        onCompositionStart={restoreSelection}
        autoComplete={'off'}
        name={'keymove-search'}
        data-lpignore="true"
        onBlur={onBlur}
      />
      {props.actionsAvailable && props.tooltipsMode !== false && (
        <span id="keymove-actions-hint" hidden>
          {props.imageSelected
            ? 'Arrow keys select nearby images. Space opens image actions. Enter follows the image link. Escape returns to the text result.'
            : 'Press Down Arrow to open actions for the selected result.'}
        </span>
      )}
    </div>
  );
};

export default SearchInput;
