import React from 'react';
import { render, screen } from '@testing-library/react';
import { SEARCH_MODES } from '../../hooks/use_search_navigation.js';
import InfoPanelSettingRow from './info_panel/info_panel_setting_row.js';
import MatchesSummary from './matches_summary.js';
import SearchInput from './search_input.js';

test('gives the page search input a textbox name without a fake combobox popup', () => {
  render(
    <SearchInput
      searchText=""
      updateSearchText={vi.fn()}
      inputRef={React.createRef<HTMLInputElement>()}
      onBlur={vi.fn()}
    />,
  );

  const input = screen.getByRole('textbox', { name: 'Search page' });
  expect(input).not.toHaveAttribute('list');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

test('associates a setting checkbox with its visible label and description', () => {
  render(
    <InfoPanelSettingRow
      label="Autohide"
      description="Hide the searchbar when not searching."
      value={false}
      onChange={vi.fn()}
    />,
  );

  const checkbox = screen.getByRole('checkbox', { name: 'Autohide' });
  expect(checkbox).toHaveAccessibleDescription('Hide the searchbar when not searching.');
});

test('announces match count and selection changes as an atomic status', () => {
  render(
    <MatchesSummary
      mode={SEARCH_MODES.TEXT}
      hasSearchQuery
      selectedSelectionIndex={2}
      resultCount={12}
    />,
  );

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Text 3 / 12');
  expect(status).toHaveAttribute('aria-live', 'polite');
  expect(status).toHaveAttribute('aria-atomic', 'true');
});

test('keeps the mode label visible when a query has no matches', () => {
  const { rerender } = render(
    <MatchesSummary
      mode={SEARCH_MODES.ACTIONS}
      hasSearchQuery
      selectedSelectionIndex={null}
      resultCount={0}
    />,
  );

  expect(screen.getByRole('status')).toHaveTextContent('Actions 0 / 0');

  rerender(
    <MatchesSummary
      mode={SEARCH_MODES.ACTIONS}
      hasSearchQuery={false}
      selectedSelectionIndex={null}
      resultCount={0}
    />,
  );

  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

test('marks approximate results so the count does not overstate what is on the page', () => {
  render(
    <MatchesSummary
      mode={SEARCH_MODES.TEXT}
      hasSearchQuery
      isFuzzy
      selectedSelectionIndex={0}
      resultCount={2}
    />,
  );

  expect(screen.getByRole('status')).toHaveTextContent('Text ~ 1 / 2');
});
