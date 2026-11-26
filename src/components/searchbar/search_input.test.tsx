import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchInput from './search_input.js';

// A page shortcut handler sees only KeyMove's host and cancels keys it takes for its own.
function cancelInCapture(keys: string[]) {
  const cancel = (event: KeyboardEvent) => {
    if (keys.includes(event.key)) event.preventDefault();
  };
  window.addEventListener('keydown', cancel, true);
  return () => window.removeEventListener('keydown', cancel, true);
}

test('recovered Left and Right move by whole characters, never splitting an accent', () => {
  const updateSearchText = vi.fn();
  render(
    <SearchInput
      searchText={'Café au lait'}
      updateSearchText={updateSearchText}
      inputRef={React.createRef<HTMLInputElement>()}
      onBlur={vi.fn()}
      suggestionCount={0}
      activeSuggestionIndex={null}
    />,
  );
  const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search page' });
  input.focus();
  input.setSelectionRange(5, 5);
  const restore = cancelInCapture(['ArrowLeft', 'ArrowRight']);
  try {
    fireEvent.keyDown(input, { key: 'ArrowLeft', code: 'ArrowLeft' });
    // Before the whole accented e, not between the e and its combining accent.
    expect(input.selectionStart).toBe(3);
    fireEvent.keyDown(input, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(input.selectionStart).toBe(5);
  } finally {
    restore();
  }
});
