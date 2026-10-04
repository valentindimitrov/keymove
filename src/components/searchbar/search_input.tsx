import React from 'react';
import { EXTENSION_NAME } from '../../extension_identity.js';
import { KEYMOVE_INPUT_ID, KEYMOVE_SUGGESTIONS_ID } from '../../constants.js';
import Utils from '../../lib/utils.js';

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
};

function stopKeyboardPropagation(event: React.KeyboardEvent<HTMLInputElement>) {
  // Page shortcut handlers see the shadow host as the target, not this editable input.
  event.stopPropagation();
}

function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
  stopKeyboardPropagation(event);
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

const SearchInput = (props: SearchInputProps) => {
  const { searchText, updateSearchText, inputRef, onBlur, suggestionCount, activeSuggestionIndex } =
    props;

  const onSearchTextChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => updateSearchText(event.target.value),
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
        onKeyDown={handleKeyDown}
        onKeyPress={stopKeyboardPropagation}
        onKeyUp={stopKeyboardPropagation}
        onPaste={event => Utils.restoreInputSelection(event.currentTarget)}
        onCut={event => Utils.restoreInputSelection(event.currentTarget)}
        onCompositionStart={event => Utils.restoreInputSelection(event.currentTarget)}
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
