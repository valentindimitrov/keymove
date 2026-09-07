import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Searchbar from './searchbar.js';
import createExtensionRoot from '../../lib/create_extension_root.js';
import { makeSearchResult, makeTextMatch } from '../../test_support/factories.js';
import type { SearchResult } from '../../lib/page_search_index.js';

const searchMocks = vi.hoisted(() => ({
  findMatches: vi.fn(),
  useHighlights: vi.fn(),
  updatePopupPosition: vi.fn(),
  resetPopupPosition: vi.fn(),
  sendMessage: vi.fn(),
  subscribeToPageChanges: vi.fn(),
  popupPosition: { x: 0.5, y: 0.75 },
  popupWidth: 420,
  updatePopupWidth: vi.fn(),
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
const settingsMocks = vi.hoisted(() => ({
  startInActionMode: false,
  highlightMatches: true,
  showAutohideButton: false,
}));
vi.mock('../../hooks/use_stored_settings.js', () => ({
  default: () => ({
    autoHide: false,
    updateAutoHide: vi.fn(),
    alwaysOn: true,
    updateAlwaysOn: vi.fn(),
    startInActionMode: settingsMocks.startInActionMode,
    updateStartInActionMode: vi.fn(),
    highlightMatches: settingsMocks.highlightMatches,
    updateHighlightMatches: vi.fn(),
    showAutohideButton: settingsMocks.showAutohideButton,
    updateShowAutohideButton: vi.fn(),
  }),
}));
vi.mock('../../hooks/use_highlight_colors.js', () => ({
  default: () => ({
    colors: { text: '#f59e0b', actions: '#a78bfa' },
    updateColor: vi.fn(),
    resetColors: vi.fn(),
  }),
}));
vi.mock('../../hooks/use_popup_width.js', () => ({
  default: () => ({
    width: searchMocks.popupWidth,
    updateWidth: searchMocks.updatePopupWidth,
    resetWidth: vi.fn(),
  }),
}));
vi.mock('../../hooks/use_popup_position.js', () => ({
  default: () => ({
    position: searchMocks.popupPosition,
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
  searchMocks.popupPosition = { x: 0.5, y: 0.75 };
  searchMocks.popupWidth = 420;
  searchMocks.updatePopupWidth.mockReset();
  settingsMocks.startInActionMode = false;
  settingsMocks.highlightMatches = true;
  settingsMocks.showAutohideButton = false;
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
  const pending = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches.mockReturnValue(pending.promise);
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
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
    pending.resolve(makeSearchResult());
  });
});

test('accepts a complete query in the shadow root despite host-page keyboard shortcuts', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
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
    const input = within(root.app).getByRole<HTMLInputElement>('combobox', { name: 'Search page' });
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
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null, term: 'save' })],
      matchingLinksAndButtons: [],
    }),
  );
  const root = createExtensionRoot('')!;
  const view = render(<Searchbar />, { container: root.app });
  try {
    const input = within(root.app).getByRole<HTMLInputElement>('combobox', { name: 'Search page' });
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
    expect(within(root.app).getByRole('status')).toHaveTextContent('Text 1 / 1');
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
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null, term: 'save' })],
      matchingLinksAndButtons: [],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });
  expect(screen.getByRole('status')).toHaveTextContent('Text 1 / 1');

  const earlier = document.createElement('p');
  earlier.textContent = 'Save first';
  paragraph.before(earlier);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: earlier }), makeTextMatch({ node: paragraph })],
      matchingLinksAndButtons: [],
    }),
  );
  const notify = searchMocks.subscribeToPageChanges.mock.calls.at(-1)![0] as () => void;
  act(notify);
  await flushSearch();
  expect(screen.getByRole('status')).toHaveTextContent('Text 2 / 2');
  expect(window.getSelection()?.toString()).toBe('Save second');

  paragraph.remove();
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: earlier, action: null, term: 'save' })],
      matchingLinksAndButtons: [],
    }),
  );
  act(notify);
  await flushSearch();
  expect(screen.getByRole('status')).toHaveTextContent('Text 0 / 1');
  expect(window.getSelection()?.rangeCount).toBe(0);
});

test('ignores an obsolete search response and resets both cursors on a new query', async () => {
  const oldSearch = Promise.withResolvers<SearchResult>();
  const oldAction = document.createElement('button');
  const newAction = document.createElement('button');
  document.body.append(oldAction, newAction);
  searchMocks.findMatches
    .mockReturnValueOnce(oldSearch.promise)
    .mockResolvedValue(makeSearchResult({ matchingLinksAndButtons: [newAction] }));
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'old' } });
  await flushSearch();
  fireEvent.change(input, { target: { value: 'new' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
  await act(async () => {
    oldSearch.resolve(makeSearchResult({ matchingLinksAndButtons: [oldAction] }));
  });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
  fireEvent.change(input, { target: { value: 'another' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
});

function renderWithBothKinds() {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save';
  const action = document.createElement('button');
  action.textContent = 'Save draft';
  document.body.append(paragraph, action);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null })],
      matchingLinksAndButtons: [action],
    }),
  );
}

test('starts in action mode when the stored default says so', async () => {
  settingsMocks.startInActionMode = true;
  renderWithBothKinds();
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();

  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
});

test('returns to the default mode once the search is over, but not while typing', async () => {
  renderWithBothKinds();
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'sav' } });
  await flushSearch();

  const status = screen.getByRole('status');
  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(status).toHaveTextContent('Actions 1 / 1');

  // Still typing: the chosen mode survives.
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  expect(status).toHaveTextContent('Actions 1 / 1');

  // Escape clears the query, then a second Escape ends the search and restores the default.
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  expect(status).toHaveTextContent('Text 1 / 1');
});

test('colours the overlay from the chosen mode and respects the highlight setting', async () => {
  settingsMocks.highlightMatches = false;
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save';
  const action = document.createElement('button');
  action.textContent = 'Save draft';
  document.body.append(paragraph, action);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null })],
      matchingLinksAndButtons: [action],
    }),
  );
  const { container } = render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();

  // Colours are inline so an unresolvable custom property can never blank the outline.
  const textOutline = container.querySelector<HTMLElement>('.keymove-selection');
  expect(textOutline?.style.borderColor).toBe('rgb(245, 158, 11)');

  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  const actionOutline = container.querySelector<HTMLElement>('.keymove-selection');
  expect(actionOutline?.style.borderColor).toBe('rgb(167, 139, 250)');
  expect(actionOutline?.style.boxShadow).toContain('rgba(167, 139, 250, 0.26)');

  expect(searchMocks.useHighlights).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: false }),
  );
});

test('hides the autohide button by default and shows it when the setting is on', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  const { unmount } = render(<Searchbar />);
  expect(screen.queryByRole('button', { name: /Turn Autohide/ })).toBeNull();
  unmount();

  settingsMocks.showAutohideButton = true;
  render(<Searchbar />);
  expect(screen.getByRole('button', { name: 'Turn Autohide on' })).toBeInTheDocument();
});

test('Tab keeps navigating the active mode instead of falling back to text', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save';
  const firstAction = document.createElement('button');
  firstAction.textContent = 'Save draft';
  const secondAction = document.createElement('button');
  secondAction.textContent = 'Save copy';
  document.body.append(paragraph, firstAction, secondAction);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null })],
      matchingLinksAndButtons: [firstAction, secondAction],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();

  const status = screen.getByRole('status');
  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(status).toHaveTextContent('Actions 1 / 2');

  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });
  expect(status).toHaveTextContent('Actions 2 / 2');
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', shiftKey: true });
  expect(status).toHaveTextContent('Actions 1 / 2');
});

test('selects the first match as soon as results arrive and keeps the mode while typing', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save';
  const action = document.createElement('button');
  action.textContent = 'Save draft';
  document.body.append(paragraph, action);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null })],
      matchingLinksAndButtons: [action],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'sav' } });
  await flushSearch();

  const status = screen.getByRole('status');
  // No Tab press: the first match is already the Enter target.
  expect(status).toHaveTextContent('Text 1 / 1');

  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(status).toHaveTextContent('Actions 1 / 1');

  // Continuing to type must not drop the user back into text mode.
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  expect(status).toHaveTextContent('Actions 1 / 1');
});

test('Alt+S toggles the search mode without moving either selection', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save';
  const firstAction = document.createElement('button');
  const secondAction = document.createElement('button');
  document.body.append(paragraph, firstAction, secondAction);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null, term: 'save' })],
      matchingLinksAndButtons: [firstAction, secondAction],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Text 1 / 1');

  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  expect(status).toHaveTextContent('Actions 2 / 2');

  // Toggling back and forth restores each mode's own cursor rather than resetting it.
  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(status).toHaveTextContent('Text 1 / 1');
  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(status).toHaveTextContent('Actions 2 / 2');
});

test('Alt+S keeps the mode label visible when nothing matches at all', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();

  // With no text results either there is nothing to fall back to, so the mode stands.
  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 0 / 0');
});

test('falls back to text when action mode is empty, and retries actions on the next query', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'How it works';
  const action = document.createElement('button');
  action.textContent = 'Show how';
  document.body.append(paragraph, action);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null, term: 'how' })],
      matchingLinksAndButtons: [],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'how' } });
  await flushSearch();

  const status = screen.getByRole('status');
  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  // Action mode was chosen but is empty, so navigation shows the text results instead.
  expect(status).toHaveTextContent('Text 1 / 1');

  // The choice was not rewritten, so the next query goes through actions again.
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null, term: 'how' })],
      matchingLinksAndButtons: [action],
    }),
  );
  fireEvent.change(input, { target: { value: 'how t' } });
  await flushSearch();
  expect(status).toHaveTextContent('Actions 1 / 1');
});

// The keyboard route to the same width and position the drag handles produce.
test('Alt+- and Alt+= resize the bar about its centre', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  act(() => {
    input.focus();
  });

  fireEvent.keyDown(input, { key: '=', code: 'Equal', altKey: true });
  expect(searchMocks.updatePopupWidth).toHaveBeenCalledWith(460);

  fireEvent.keyDown(input, { key: '-', code: 'Minus', altKey: true });
  expect(searchMocks.updatePopupWidth).toHaveBeenLastCalledWith(380);
});

test('Alt+Shift+arrows move the bar, and stop at the viewport edge', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  act(() => {
    input.focus();
  });

  fireEvent.keyDown(input, { key: 'ArrowUp', code: 'ArrowUp', altKey: true, shiftKey: true });
  const movedUp = searchMocks.updatePopupPosition.mock.lastCall![0];
  expect(movedUp.y).toBeLessThan(0.75);
  expect(movedUp.x).toBe(0.5);

  fireEvent.keyDown(input, { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true, shiftKey: true });
  expect(searchMocks.updatePopupPosition.mock.lastCall![0].x).toBeLessThan(0.5);
});

test('does not resize the bar when it is hidden', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  const { container } = render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  act(() => {
    input.focus();
  });
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  expect(container.firstElementChild).toHaveClass('keymove-hidden');

  fireEvent.keyDown(document.body, { key: '=', code: 'Equal', altKey: true });
  expect(searchMocks.updatePopupWidth).not.toHaveBeenCalled();
});

test('Escape clears the query, then hides the bar with Autohide off, and Alt+F restores focus', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  const { container } = render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
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
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({ matchingText: [], matchingLinksAndButtons: [button] }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  act(() => {
    input.focus();
  });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  const help = screen.getByRole('button', { name: 'KeyMove keyboard shortcuts' });
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
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({ matchingText: [], matchingLinksAndButtons: [button] }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
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
  const textMatch = makeTextMatch({ node: paragraph, action: link, term: 'documentation' });
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({ matchingText: [textMatch], matchingLinksAndButtons: [link] }),
  );

  const { container } = render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'documentation' } });

  await flushSearch();
  await waitFor(() =>
    expect(searchMocks.useHighlights).toHaveBeenLastCalledWith({
      matches: [textMatch],
      selectedMatch: textMatch,
      enabled: true,
      color: '#f59e0b',
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
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null, term: 'save' })],
      matchingLinksAndButtons: [firstAction, secondAction],
    }),
  );

  const { container } = render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
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
  // The first action is already selected when results arrive, so Ctrl+Tab advances to the second.
  expect(selections[0]).not.toHaveClass('keymove-selected-selection');
  expect(selections[1]).toHaveClass('keymove-selected-selection');

  fireEvent.keyDown(input, {
    bubbles: true,
    cancelable: true,
    code: 'Tab',
    key: 'Tab',
    ctrlKey: true,
    shiftKey: true,
  });

  selections = container.querySelectorAll('.keymove-selection');
  expect(selections[0]).toHaveClass('keymove-selected-selection');
  expect(selections[1]).not.toHaveClass('keymove-selected-selection');
  expect(window.getSelection()?.rangeCount).toBe(0);

  // Move back onto the anchor, which is the only action carrying a copyable URL.
  fireEvent.keyDown(input, {
    bubbles: true,
    cancelable: true,
    code: 'Tab',
    key: 'Tab',
    ctrlKey: true,
  });

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
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: link, action: link, term: 'save' })],
      matchingLinksAndButtons: [link],
    }),
  );

  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'result' } });
  await flushSearch();
  await screen.findByText('Text 1 / 1');
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

test('stops marking results as approximate once the query changes', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Settings';
  document.body.append(paragraph);
  searchMocks.findMatches.mockResolvedValueOnce({
    matchingText: [makeTextMatch({ node: paragraph, action: null, term: 'settings' })],
    matchingLinksAndButtons: [],
    suggestions: [],
    isFuzzy: true,
  });
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'setings' } });
  await flushSearch();
  expect(screen.getByRole('status')).toHaveTextContent('Text ~ 1 / 1');

  // The next query has not resolved yet, so nothing is known to be approximate.
  searchMocks.findMatches.mockReturnValue(new Promise(() => undefined));
  fireEvent.change(input, { target: { value: 'setingsx' } });
  expect(screen.getByRole('status')).toHaveTextContent('Text 0 / 0');
});

test('shows a ranked slate only once the query is worth ranking', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save your work';
  const action = document.createElement('button');
  action.textContent = 'Save';
  document.body.append(paragraph, action);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [makeTextMatch({ node: paragraph, action: null, term: 'save', score: 1 })],
    matchingLinksAndButtons: [action],
    suggestions: [
      { kind: 'action', node: action, score: 2, term: 'save' },
      { kind: 'text', node: paragraph, score: 1, term: 'save' },
    ],
    isFuzzy: false,
  });
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });

  fireEvent.change(input, { target: { value: 'sa' } });
  await flushSearch();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveAttribute('aria-expanded', 'false');

  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(2);
  expect(options[0]).toHaveTextContent('Save');
  expect(options[0]).toHaveTextContent('button');
  expect(input).toHaveAttribute('aria-expanded', 'true');
});

test('drops the slate when the query is cleared', async () => {
  const action = document.createElement('button');
  action.textContent = 'Save';
  document.body.append(action);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [],
    matchingLinksAndButtons: [action],
    suggestions: [{ kind: 'action', node: action, score: 2, term: 'save' }],
    isFuzzy: false,
  });
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  expect(screen.getAllByRole('option')).toHaveLength(1);

  fireEvent.change(input, { target: { value: '' } });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('opens the slate downwards when there is room, and upwards when there is not', async () => {
  const action = document.createElement('button');
  action.textContent = 'Save';
  document.body.append(action);
  searchMocks.findMatches.mockResolvedValue({
    matchingText: [],
    matchingLinksAndButtons: [action],
    suggestions: [{ kind: 'action', node: action, score: 2, term: 'save', distance: null }],
    isFuzzy: false,
  });

  // The default position sits at three quarters down, which still leaves room for one row.
  const { container, unmount } = render(<Searchbar />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Search page' }), {
    target: { value: 'save' },
  });
  await flushSearch();
  expect(container.querySelector('#keymove-container')).not.toHaveClass(
    'keymove-container-suggestions-above',
  );
  unmount();

  searchMocks.popupPosition = { x: 0.5, y: 0.99 };
  const second = render(<Searchbar />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Search page' }), {
    target: { value: 'save' },
  });
  await flushSearch();
  expect(second.container.querySelector('#keymove-container')).toHaveClass(
    'keymove-container-suggestions-above',
  );
});
