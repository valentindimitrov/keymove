import React from 'react';
import { EXTENSION_NAME } from '../../extension_identity.js';
import { KEYMOVE_INPUT_ID } from '../../constants.js';

type SearchInputProps = {
  searchText: string;
  updateSearchText: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onBlur: React.FocusEventHandler<HTMLInputElement>;
};

const SearchInput = (props: SearchInputProps) => {
  const { searchText, updateSearchText, inputRef, onBlur } = props;

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
        placeholder={`${EXTENSION_NAME}!`}
        value={searchText}
        onChange={onSearchTextChange}
        autoComplete={'off'}
        name={'keymove-search'}
        data-lpignore="true"
        onBlur={onBlur}
      />
    </div>
  );
};

export default SearchInput;
