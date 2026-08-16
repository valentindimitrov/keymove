import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Searchbar from './searchbar.js';

const searchMocks = vi.hoisted(() => ({
  findMatches: vi.fn(),
  useHighlights: vi.fn(),
}));

vi.mock('../../lib/find_in_page.js', () => ({
  default: class MockFindInPage {
    findMatches(options: { signal?: AbortSignal }) {
      return searchMocks.findMatches(options);
    }
  },
}));

vi.mock('../../hooks/use_highlights.js', () => ({ default: searchMocks.useHighlights }));
vi.mock('../../hooks/use_extension_messaging.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/use_url_change_subscription.js', () => ({
  default: () => ({ host: 'example.com' }),
}));
vi.mock('../../hooks/use_stored_settings.js', () => ({
  default: () => ({
    autoHide: false,
    updateAutoHide: vi.fn(),
    useOnEveryWebsite: true,
    updateUseOnEveryWebsite: vi.fn(),
    alwaysOn: true,
    updateAlwaysOn: vi.fn(),
  }),
}));

beforeEach(() => {
  searchMocks.findMatches.mockReset();
  searchMocks.useHighlights.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

test('keeps text highlighting separate from Tab navigation through actions', async () => {
  const textResult = document.createElement('p');
  textResult.textContent = 'Save this text';
  const firstAction = document.createElement('button');
  firstAction.textContent = 'Save draft';
  const secondAction = document.createElement('a');
  secondAction.textContent = 'Save and publish';
  document.body.append(textResult, firstAction, secondAction);
  searchMocks.findMatches.mockResolvedValue({
    matchingNodes: [textResult, firstAction, secondAction],
    matchingLinksAndButtons: [firstAction, secondAction],
    bestMatchingLinkOrButtonIndex: 0,
  });

  const { container } = render(<Searchbar />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'save' } });

  await waitFor(() => expect(searchMocks.findMatches).toHaveBeenCalled());
  await waitFor(() => expect(container.querySelectorAll('.yipyip-selection')).toHaveLength(2));
  expect(searchMocks.useHighlights).toHaveBeenLastCalledWith({
    searchText: 'save',
    matchingNodes: [textResult, firstAction, secondAction],
  });

  await act(async () => {
    fireEvent.keyDown(input, { bubbles: true, cancelable: true, code: 'Tab', key: 'Tab' });
  });

  const selections = container.querySelectorAll('.yipyip-selection');
  expect(selections[0]).not.toHaveClass('yipyip-selected-selection');
  expect(selections[1]).toHaveClass('yipyip-selected-selection');
});
