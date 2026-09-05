import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Searchbar from './searchbar.js';

const searchMocks = vi.hoisted(() => ({
  findMatches: vi.fn(),
  useHighlights: vi.fn(),
  updatePopupPosition: vi.fn(),
  resetPopupPosition: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: { runtime: { sendMessage: searchMocks.sendMessage } },
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
vi.mock('../../hooks/use_popup_position.js', () => ({
  default: () => ({
    position: { x: 0.5, y: 0.75 },
    updatePosition: searchMocks.updatePopupPosition,
    resetPosition: searchMocks.resetPopupPosition,
  }),
}));

beforeEach(() => {
  searchMocks.findMatches.mockReset();
  searchMocks.useHighlights.mockReset();
  searchMocks.updatePopupPosition.mockReset();
  searchMocks.resetPopupPosition.mockReset();
  searchMocks.sendMessage.mockReset().mockResolvedValue(undefined);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

test('Tab selects and copies a whole text block, and Enter opens its nested action', async () => {
  const paragraph = document.createElement('p');
  paragraph.append('Read the ');
  const link = document.createElement('a');
  link.href = '/documentation';
  link.textContent = 'documentation';
  link.addEventListener('click', event => event.preventDefault());
  paragraph.append(link, ' before continuing.');
  document.body.append(paragraph);
  const click = vi.spyOn(link, 'click');
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [{ node: paragraph, action: link }],
    matchingLinksAndButtons: [link],
  });

  const { container } = render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'documentation' } });

  await waitFor(() => expect(searchMocks.findMatches).toHaveBeenCalled());
  await waitFor(() =>
    expect(searchMocks.useHighlights).toHaveBeenLastCalledWith({
      searchText: 'documentation',
      matchingNodes: [paragraph],
    }),
  );

  fireEvent.keyDown(input, { bubbles: true, cancelable: true, code: 'Tab', key: 'Tab' });

  expect(window.getSelection()?.toString()).toBe(paragraph.textContent);
  expect(container.querySelectorAll('.keymove-selection')).toHaveLength(1);
  expect(container.querySelector('.keymove-selection')).toHaveClass('keymove-selected-selection');

  const setData = vi.fn();
  const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(copyEvent, 'clipboardData', { value: { setData } });
  document.dispatchEvent(copyEvent);
  expect(setData).toHaveBeenCalledWith('text/plain', paragraph.textContent);
  expect(copyEvent.defaultPrevented).toBe(true);

  fireEvent.keyDown(input, { bubbles: true, cancelable: true, code: 'Enter', key: 'Enter' });
  expect(click).toHaveBeenCalledOnce();
});

test('Ctrl+Tab and Shift+Ctrl+Tab navigate only action elements', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save this text';
  const firstAction = document.createElement('button');
  firstAction.textContent = 'Save draft';
  const secondAction = document.createElement('a');
  secondAction.textContent = 'Save and publish';
  secondAction.href = 'https://example.com/publish';
  document.body.append(paragraph, firstAction, secondAction);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [{ node: paragraph, action: null }],
    matchingLinksAndButtons: [firstAction, secondAction],
  });

  const { container } = render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });

  await waitFor(() => expect(searchMocks.findMatches).toHaveBeenCalled());
  await act(async () => {
    fireEvent.keyDown(input, {
      bubbles: true,
      cancelable: true,
      code: 'Tab',
      key: 'Tab',
      ctrlKey: true,
    });
  });

  let selections = container.querySelectorAll('.keymove-selection');
  expect(selections).toHaveLength(2);
  expect(selections[0]).toHaveClass('keymove-selected-selection');
  expect(selections[1]).not.toHaveClass('keymove-selected-selection');

  fireEvent.keyDown(input, {
    bubbles: true,
    cancelable: true,
    code: 'Tab',
    key: 'Tab',
    ctrlKey: true,
    shiftKey: true,
  });

  selections = container.querySelectorAll('.keymove-selection');
  expect(selections[0]).not.toHaveClass('keymove-selected-selection');
  expect(selections[1]).toHaveClass('keymove-selected-selection');
  expect(window.getSelection()?.rangeCount).toBe(0);

  const setData = vi.fn();
  const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(copyEvent, 'clipboardData', { value: { setData } });
  document.dispatchEvent(copyEvent);
  expect(setData).toHaveBeenCalledWith('text/plain', 'https://example.com/publish');
});

test.each([
  { name: 'Shift+Enter', shiftKey: true, ctrlKey: false, active: true },
  { name: 'Ctrl+Enter', shiftKey: false, ctrlKey: true, active: false },
])('$name opens the selected link with active=$active', async ({ shiftKey, ctrlKey, active }) => {
  const link = document.createElement('a');
  link.href = 'https://example.com/result';
  link.textContent = 'Open result';
  document.body.append(link);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [{ node: link, action: link }],
    matchingLinksAndButtons: [link],
  });

  render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'result' } });
  await waitFor(() => expect(searchMocks.findMatches).toHaveBeenCalled());
  await screen.findByText('Text 0 / 1');
  fireEvent.keyDown(input, {
    bubbles: true,
    cancelable: true,
    code: 'Tab',
    key: 'Tab',
    ctrlKey: true,
  });

  fireEvent.keyDown(input, {
    bubbles: true,
    cancelable: true,
    code: 'Enter',
    key: 'Enter',
    shiftKey,
    ctrlKey,
  });

  expect(searchMocks.sendMessage).toHaveBeenCalledWith({
    type: 'KEYMOVE_OPEN_LINK_IN_NEW_TAB',
    url: 'https://example.com/result',
    active,
  });
});
