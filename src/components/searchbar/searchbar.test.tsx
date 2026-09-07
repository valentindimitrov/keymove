import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Searchbar from './searchbar.js';
import createExtensionRoot from '../../lib/create_extension_root.js';

const searchMocks = vi.hoisted(() => ({
  findMatches: vi.fn(),
  useHighlights: vi.fn(),
  updatePopupPosition: vi.fn(),
  resetPopupPosition: vi.fn(),
  sendMessage: vi.fn(),
  subscribeToPageChanges: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: { runtime: { sendMessage: searchMocks.sendMessage } },
}));

vi.mock('../../lib/find_in_page.js', () => ({
  subscribeToPageChanges: searchMocks.subscribeToPageChanges,
  default: class MockFindInPage {
    findMatches(options: { signal?: AbortSignal }) {
      return searchMocks.findMatches(options);
    }
  },
}));

vi.mock('../../hooks/use_highlights.js', () => ({ default: searchMocks.useHighlights }));
vi.mock('../../hooks/use_extension_messaging.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/use_stored_settings.js', () => ({
  default: () => ({
    autoHide: false,
    updateAutoHide: vi.fn(),
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
  searchMocks.subscribeToPageChanges.mockReset().mockReturnValue(() => undefined);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

async function flushSearch() {
  expect(searchMocks.findMatches).toHaveBeenCalled();
  // Queries start synchronously; drain their promises and the resulting React updates.
  await act(async () => {});
}

test('searches every keystroke immediately, including the first, and cancels superseded queries', async () => {
  vi.useFakeTimers();
  const pending = Promise.withResolvers<{ matchingText: []; matchingLinksAndButtons: [] }>();
  searchMocks.findMatches.mockReturnValue(pending.promise);
  render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  for (const [index, value] of ['s', 'sa', 'sav', 'save'].entries()) {
    fireEvent.input(input, { target: { value } });
    expect(searchMocks.findMatches).toHaveBeenCalledTimes(index + 1);
    const options = searchMocks.findMatches.mock.calls[index]![0] as { signal: AbortSignal };
    expect(options.signal.aborted).toBe(false);
    if (index > 0) {
      const previous = searchMocks.findMatches.mock.calls[index - 1]![0] as { signal: AbortSignal };
      expect(previous.signal.aborted).toBe(true);
    }
  }
  expect(searchMocks.subscribeToPageChanges).toHaveBeenCalledOnce();
  fireEvent.input(input, { target: { value: '' } });
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(4);
  await act(async () => {
    pending.resolve({ matchingText: [], matchingLinksAndButtons: [] });
  });
});

test('accepts a complete query in the shadow root despite host-page keyboard shortcuts', async () => {
  searchMocks.findMatches.mockResolvedValue({ matchingText: [], matchingLinksAndButtons: [] });
  const pageShortcut = vi.fn((event: KeyboardEvent) => {
    // Page listeners see the shadow host, so an ordinary input guard cannot recognize our field.
    if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
  });
  document.addEventListener('keydown', pageShortcut);
  document.addEventListener('keypress', pageShortcut);
  document.addEventListener('keyup', pageShortcut);
  const root = createExtensionRoot('')!;
  const view = render(<Searchbar />, { container: root.app });
  try {
    const input = within(root.app).getByRole<HTMLInputElement>('textbox', { name: 'Search page' });
    fireEvent.keyDown(document.body, { key: 's', code: 'KeyS', composed: true });
    expect(root.shadowRoot.activeElement).toBe(input);
    expect(input).toHaveValue('s');
    for (const character of 'ave') {
      const accepted = fireEvent.keyDown(input, {
        key: character,
        code: `Key${character.toUpperCase()}`,
        composed: true,
      });
      if (accepted)
        fireEvent.input(input, { target: { value: input.value + character }, composed: true });
      fireEvent.keyPress(input, {
        key: character,
        charCode: character.charCodeAt(0),
        composed: true,
      });
      fireEvent.keyUp(input, { key: character, composed: true });
    }
    expect(input).toHaveValue('save');
    expect(pageShortcut).not.toHaveBeenCalled();
    await flushSearch();
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape', composed: true });
    expect(input).toHaveValue('');
  } finally {
    view.unmount();
    document.removeEventListener('keydown', pageShortcut);
    document.removeEventListener('keypress', pageShortcut);
    document.removeEventListener('keyup', pageShortcut);
    root.host.remove();
  }
});

test('preserves native block copying and restores query editing after Tab', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save the whole block';
  document.body.append(paragraph);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [{ node: paragraph, action: null }],
    matchingLinksAndButtons: [],
  });
  const root = createExtensionRoot('')!;
  const view = render(<Searchbar />, { container: root.app });
  try {
    const input = within(root.app).getByRole<HTMLInputElement>('textbox', { name: 'Search page' });
    act(() => input.focus());
    fireEvent.input(input, { target: { value: 'save' }, composed: true });
    input.setSelectionRange(2, 2);
    await flushSearch();
    fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', composed: true });
    expect(window.getSelection()?.toString()).toBe(paragraph.textContent);
    fireEvent.keyDown(input, { key: 'c', code: 'KeyC', ctrlKey: true, composed: true });
    expect(window.getSelection()?.toString()).toBe(paragraph.textContent);
    input.setSelectionRange(0, 0);
    expect(fireEvent.keyDown(input, { key: 'x', code: 'KeyX', composed: true })).toBe(true);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2]);
    expect(window.getSelection()?.rangeCount).toBe(0);
    fireEvent.input(input, { target: { value: 'saxve' }, composed: true });
    expect(input).toHaveValue('saxve');
    await flushSearch();
    expect(within(root.app).getByRole('status')).toHaveTextContent('Text 0 / 1');
    fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', composed: true });
    expect(window.getSelection()?.toString()).toBe(paragraph.textContent);
    fireEvent.paste(input, { composed: true });
    expect(window.getSelection()?.rangeCount).toBe(0);
  } finally {
    view.unmount();
    root.host.remove();
  }
});

test('refreshes a live query while retaining the selected block and clearing a removed selection', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save second';
  document.body.append(paragraph);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [{ node: paragraph, action: null }],
    matchingLinksAndButtons: [],
  });
  render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });
  expect(screen.getByRole('status')).toHaveTextContent('Text 1 / 1');

  const earlier = document.createElement('p');
  earlier.textContent = 'Save first';
  paragraph.before(earlier);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [
      { node: earlier, action: null },
      { node: paragraph, action: null },
    ],
    matchingLinksAndButtons: [],
  });
  const notify = searchMocks.subscribeToPageChanges.mock.calls.at(-1)![0] as () => void;
  act(notify);
  await flushSearch();
  expect(screen.getByRole('status')).toHaveTextContent('Text 2 / 2');
  expect(window.getSelection()?.toString()).toBe('Save second');

  paragraph.remove();
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [{ node: earlier, action: null }],
    matchingLinksAndButtons: [],
  });
  act(notify);
  await flushSearch();
  expect(screen.getByRole('status')).toHaveTextContent('Text 0 / 1');
  expect(window.getSelection()?.rangeCount).toBe(0);
});

test('ignores an obsolete search response and resets both cursors on a new query', async () => {
  const oldSearch = Promise.withResolvers<{
    matchingText: [];
    matchingLinksAndButtons: HTMLElement[];
  }>();
  const oldAction = document.createElement('button');
  const newAction = document.createElement('button');
  document.body.append(oldAction, newAction);
  searchMocks.findMatches
    .mockReturnValueOnce(oldSearch.promise)
    .mockResolvedValue({ matchingText: [], matchingLinksAndButtons: [newAction] });
  render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'old' } });
  await flushSearch();
  fireEvent.change(input, { target: { value: 'new' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
  await act(async () => {
    oldSearch.resolve({ matchingText: [], matchingLinksAndButtons: [oldAction] });
  });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
  fireEvent.change(input, { target: { value: 'another' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
});

test('Escape clears the query, then hides the bar with Autohide off, and Alt+F restores focus', async () => {
  searchMocks.findMatches.mockResolvedValue({ matchingText: [], matchingLinksAndButtons: [] });
  const { container } = render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  act(() => {
    input.focus();
  });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  expect(input).toHaveValue('');
  expect(container.firstElementChild).not.toHaveClass('keymove-hidden');
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  expect(container.firstElementChild).toHaveClass('keymove-hidden');
  fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF', altKey: true });
  expect(container.firstElementChild).not.toHaveClass('keymove-hidden');
  expect(input).toHaveFocus();
});

test('does not clear results or intercept Tab and Enter when focus moves to help controls', async () => {
  const button = document.createElement('button');
  button.textContent = 'Save';
  const click = vi.spyOn(button, 'click');
  document.body.append(button);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [],
    matchingLinksAndButtons: [button],
  });
  render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  act(() => {
    input.focus();
  });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  const help = screen.getByRole('button', { name: 'KeyMove help and settings' });
  act(() => {
    help.focus();
  });
  expect(input).toHaveValue('save');
  expect(fireEvent.keyDown(help, { key: 'Tab', code: 'Tab' })).toBe(true);
  expect(fireEvent.keyDown(help, { key: 'Enter', code: 'Enter' })).toBe(true);
  expect(click).not.toHaveBeenCalled();
});

test('leaves composition keys alone and never opens buttons with modified Enter', async () => {
  const button = document.createElement('button');
  button.textContent = 'Save';
  document.body.append(button);
  const click = vi.spyOn(button, 'click');
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [],
    matchingLinksAndButtons: [button],
  });
  render(<Searchbar />);
  const input = screen.getByRole('textbox', { name: 'Search page' });
  fireEvent.keyDown(document.body, { key: 'a', code: 'KeyA', isComposing: true });
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: true });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', ctrlKey: true });
  expect(click).not.toHaveBeenCalled();
  expect(searchMocks.sendMessage).not.toHaveBeenCalled();
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

  await flushSearch();
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

  await flushSearch();
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
  await flushSearch();
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
