import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Searchbar from './searchbar.js';
import createExtensionRoot from '../../lib/create_extension_root.js';
import { makeRankedMatch, makeSearchResult, makeTextMatch } from '../../test_support/factories.js';
import type { SearchResult } from '../../lib/page_search_index.js';
import { MODAL_CHANGED_EVENT } from '../../lib/modal_context.js';

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
vi.mock('../../hooks/use_interaction_settings.js', () => ({
  default: () => ({
    ready: true,
    sites: {},
    openingShortcut: {
      code: 'KeyF',
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    },
  }),
}));
const settingsMocks = vi.hoisted(() => ({
  tooltipsMode: true,
  suggestionCount: 3,
  startInActionMode: false,
  highlightMatches: true,
  showAutohideButton: false,
}));
vi.mock('../../hooks/use_stored_settings.js', () => ({
  default: () => ({
    tooltipsMode: settingsMocks.tooltipsMode,
    suggestionCount: settingsMocks.suggestionCount,
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
  vi.spyOn(console, 'error');
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
  settingsMocks.tooltipsMode = true;
  settingsMocks.suggestionCount = 3;
  settingsMocks.highlightMatches = true;
  settingsMocks.showAutohideButton = false;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
  try {
    expect(console.error).not.toHaveBeenCalled();
  } finally {
    vi.mocked(console.error).mockRestore();
  }
});

async function flushSearch() {
  expect(searchMocks.findMatches).toHaveBeenCalled();
  // Queries start synchronously; drain their promises and the resulting React updates.
  await act(async () => {});
}

async function openLinkActionMenu() {
  const link = document.createElement('a');
  link.href = 'https://example.com/report';
  link.textContent = 'Report';
  document.body.append(link);
  settingsMocks.startInActionMode = true;
  searchMocks.findMatches.mockResolvedValue(makeSearchResult({ matchingLinksAndButtons: [link] }));
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  input.focus();
  fireEvent.input(input, { target: { value: 'report' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  expect(screen.getByRole('menu')).toBeInTheDocument();
  return { input, link };
}

test('explicit selection hovers without clicking, survives query edits, and ends on Escape', async () => {
  const link = document.createElement('a');
  link.href = '#men';
  link.textContent = 'Hommes';
  document.body.append(link);
  const enter = vi.fn();
  const leave = vi.fn();
  const click = vi.fn(event => event.preventDefault());
  link.addEventListener('mouseenter', enter);
  link.addEventListener('mouseleave', leave);
  link.addEventListener('click', click);
  settingsMocks.startInActionMode = true;
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingLinksAndButtons: [link],
      suggestions: [makeRankedMatch({ node: link, term: 'hommes' })],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.input(input, { target: { value: 'hommes' } });
  await flushSearch();
  expect(enter).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: '1', code: 'Digit1', altKey: true });
  expect(enter).toHaveBeenCalledTimes(1);
  expect(input).toHaveFocus();
  expect(click).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });
  expect(enter).toHaveBeenCalledTimes(1);
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  fireEvent.input(input, { target: { value: '' } });
  fireEvent.input(input, { target: { value: 'sneakers' } });
  await flushSearch();
  expect(leave).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  expect(leave).toHaveBeenCalledTimes(1);
});

test('Down opens actions, Up navigates only inside the menu and Escape returns to the query', async () => {
  const { input } = await openLinkActionMenu();
  expect(screen.getByRole('menuitem', { name: 'Open link' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', code: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp', code: 'ArrowUp' });
  expect(screen.getByRole('menuitem', { name: 'Open link' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(input).toHaveFocus();
  expect(input).toHaveValue('report');
  fireEvent.keyDown(input, { key: 'ArrowUp', code: 'ArrowUp' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test.each([true, false])(
  'menu Left returns and Right executes with tooltips %s',
  async tooltipsMode => {
    settingsMocks.tooltipsMode = tooltipsMode;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { input, link } = await openLinkActionMenu();
    const click = vi.spyOn(link, 'click');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft', code: 'ArrowLeft' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue('report');
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      expect(fireEvent.keyDown(input, { key, code: key })).toBe(true);
    }
    expect(click).not.toHaveBeenCalled();
    expect(input).toHaveValue('report');
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', code: 'ArrowDown' });
    }
    expect(screen.getByRole('menuitem', { name: 'Copy link address' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', code: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(writeText).toHaveBeenCalledExactlyOnceWith(link.href);
    expect(click).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    expect(input).toHaveValue('report');
  },
);

test('menu retains the selected suggestion and restores the full shortlist on Escape', async () => {
  const links = ['Report first', 'Report second', 'Report third', 'Report fourth'].map(label => {
    const link = document.createElement('a');
    link.href = `https://example.com/${label}`;
    link.textContent = label;
    document.body.append(link);
    return link;
  });
  settingsMocks.startInActionMode = true;
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingLinksAndButtons: links,
      suggestions: links.map(node => makeRankedMatch({ node, term: 'report' })),
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  input.focus();
  fireEvent.input(input, { target: { value: 'report' } });
  await flushSearch();
  expect(screen.getAllByRole('option')).toHaveLength(3);
  for (let i = 0; i < 3; i++) fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  const retained = screen.getByRole('group', { name: 'Selected result' });
  expect(retained.closest('#keymove-action-menu-container')).toBeNull();
  expect(retained.parentElement?.previousElementSibling?.id).toBe('keymove-action-menu-container');
  expect(retained).toHaveTextContent('Report fourth');
  expect(retained.querySelector('mark')).toHaveTextContent('Report');
  expect(retained.querySelector('.keymove-suggestion-context')).toHaveTextContent('link');
  expect(retained.querySelector('.keymove-suggestion-position')).toBeNull();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.keymove-suggestion')).toHaveLength(1);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.queryByRole('option', { selected: true })).not.toBeInTheDocument();
});

test('menu Alt+number runs the numbered action without changing the result', async () => {
  const { link } = await openLinkActionMenu();
  expect(screen.getByRole('group', { name: 'Selected result' })).toHaveTextContent('Report');
  const items = screen.getAllByRole('menuitem');
  items.forEach((item, index) => {
    expect(item.querySelector('.keymove-suggestion-position')).toHaveTextContent(String(index + 1));
    expect(item).toHaveAttribute('aria-keyshortcuts', `Alt+${index + 1}`);
  });
  // Physical digit codes also work where Alt changes the character produced by the key.
  fireEvent.keyDown(document.activeElement!, { key: '£', code: 'Digit3', altKey: true });
  await act(async () => {});
  expect(searchMocks.sendMessage).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ url: link.href, active: false }),
  );
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test.each([true, false])(
  'Tooltips mode %s controls menu hints without changing its shortcuts',
  async tooltipsMode => {
    settingsMocks.tooltipsMode = tooltipsMode;
    const { input } = await openLinkActionMenu();
    const first = screen.getAllByRole('menuitem')[0]!;
    expect(first.querySelector('.keymove-suggestion-position')?.textContent).toBe(
      tooltipsMode ? 'Alt + 1' : '1',
    );
    expect(Boolean(document.querySelector('#keymove-actions-hint'))).toBe(tooltipsMode);
    expect(Boolean(document.querySelector('.keymove-action-menu-footer'))).toBe(tooltipsMode);
    fireEvent.keyDown(document.activeElement!, { key: '3', code: 'Digit3', altKey: true });
    await act(async () => {});
    expect(searchMocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-describedby');
  },
);

test('Alt+6 copies linked text, and repeated shortcuts cannot duplicate a pending action', async () => {
  const pending = Promise.withResolvers<void>();
  const writeText = vi.fn().mockReturnValue(pending.promise);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const link = document.createElement('a');
  link.href = 'https://example.com/report';
  link.textContent = 'Report complete text';
  document.body.append(link);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: link, action: link, term: 'report' })],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  input.focus();
  fireEvent.input(input, { target: { value: 'report' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  expect(screen.getAllByRole('menuitem')).toHaveLength(6);
  fireEvent.keyDown(document.activeElement!, { key: '6', code: 'Digit6', altKey: true });
  fireEvent.keyDown(document.activeElement!, {
    key: '6',
    code: 'Digit6',
    altKey: true,
    repeat: true,
  });
  fireEvent.keyDown(document.activeElement!, { key: '4', code: 'Digit4', altKey: true });
  expect(writeText).toHaveBeenCalledExactlyOnceWith('Report complete text');
  await act(async () => pending.resolve());
  expect(input).toHaveFocus();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('menu number shortcuts ignore extra modifiers, composition, missing actions and disabled targets', async () => {
  const { input, link } = await openLinkActionMenu();
  const click = vi.spyOn(link, 'click');
  for (const flags of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { isComposing: true },
    { repeat: true },
  ]) {
    fireEvent.keyDown(document.activeElement!, {
      key: '1',
      code: 'Digit1',
      altKey: true,
      ...flags,
    });
  }
  fireEvent.keyDown(document.activeElement!, { key: '9', code: 'Digit9', altKey: true });
  expect(click).not.toHaveBeenCalled();
  expect(searchMocks.sendMessage).not.toHaveBeenCalled();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
  link.setAttribute('aria-disabled', 'true');
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  fireEvent.keyDown(document.activeElement!, { key: '1', code: 'Digit1', altKey: true });
  await act(async () => {});
  expect(click).not.toHaveBeenCalled();
  expect(screen.getByRole('menu')).toBeInTheDocument();
});

test('menu Enter runs the chosen link action rather than opening the current tab', async () => {
  const { link } = await openLinkActionMenu();
  const click = vi.spyOn(link, 'click');
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', code: 'ArrowDown' });
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', code: 'ArrowDown' });
  fireEvent.keyDown(document.activeElement!, { key: 'Enter', code: 'Enter' });
  await act(async () => {});
  expect(click).not.toHaveBeenCalled();
  expect(searchMocks.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({ url: link.href, active: false }),
  );
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('menu focus-only hands off without clicking, and normal page keys remain available', async () => {
  const { link } = await openLinkActionMenu();
  const click = vi.spyOn(link, 'click');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Focus without activating' }));
  await act(async () => {});
  expect(link).toHaveFocus();
  expect(click).not.toHaveBeenCalled();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  const down = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    code: 'ArrowDown',
    bubbles: true,
    cancelable: true,
  });
  link.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(false);
});

test('menu Tab continues result navigation and returns keyboard control to search', async () => {
  const { input, link } = await openLinkActionMenu();
  fireEvent.keyDown(document.activeElement!, { key: 'Tab', code: 'Tab' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(input).toHaveFocus();
  expect(input).toHaveValue('report');
  expect(link.scrollIntoView).toHaveBeenCalled();
});

test('menu copying retains the query and reports clipboard failure without activating a link', async () => {
  const writeText = vi
    .fn()
    .mockRejectedValueOnce(new Error('Clipboard blocked'))
    .mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { input, link } = await openLinkActionMenu();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link address' }));
  await screen.findByText('Could not complete this action. Please try again.');
  expect(screen.getByRole('menu')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link address' }));
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  expect(writeText).toHaveBeenLastCalledWith(link.href);
  expect(input).toHaveFocus();
  expect(input).toHaveValue('report');
});

test('a late clipboard completion does not dismiss a reopened menu for the same result', async () => {
  const pending = Promise.withResolvers<void>();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockReturnValue(pending.promise) },
  });
  const { input } = await openLinkActionMenu();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link address' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  await act(async () => pending.resolve());
  expect(screen.getByRole('menu')).toBeInTheDocument();
});

test('modified menu keys and composition do not activate or dismiss the menu', async () => {
  const { input, link } = await openLinkActionMenu();
  const click = vi.spyOn(link, 'click');
  for (const flags of [
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { metaKey: true },
    { isComposing: true },
  ]) {
    for (const key of ['Enter', 'ArrowRight', 'ArrowLeft']) {
      fireEvent.keyDown(document.activeElement!, { key, code: key, ...flags });
    }
  }
  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(click).not.toHaveBeenCalled();
  expect(searchMocks.sendMessage).not.toHaveBeenCalled();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown', isComposing: true });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test.each([true, false])(
  'Down opens during a background refresh and stays usable with tooltips %s',
  async tooltipsMode => {
    settingsMocks.tooltipsMode = tooltipsMode;
    const { input, link } = await openLinkActionMenu();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
    const refresh = Promise.withResolvers<SearchResult>();
    searchMocks.findMatches
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValue(makeSearchResult({ matchingLinksAndButtons: [link] }));
    const notify = searchMocks.subscribeToPageChanges.mock.calls.at(-1)![0] as () => void;
    act(notify);
    const refreshSignal = searchMocks.findMatches.mock.calls.at(-1)![0].signal as AbortSignal;
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    const menu = screen.getByRole('menu');
    expect(refreshSignal.aborted).toBe(true);
    const calls = searchMocks.findMatches.mock.calls.length;
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', code: 'ArrowDown' });
    const focusedAction = document.activeElement;
    act(() => {
      for (let i = 0; i < 10; i++) notify();
    });
    await act(async () => refresh.resolve(makeSearchResult()));
    expect(screen.getByRole('menu')).toBe(menu);
    expect(document.activeElement).toBe(focusedAction);
    expect(searchMocks.findMatches).toHaveBeenCalledTimes(calls);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
    await flushSearch();
    expect(input).toHaveFocus();
    expect(input).toHaveValue('report');
    expect(searchMocks.findMatches).toHaveBeenCalledTimes(calls + 1);
  },
);

test('menu actions recheck removed and disabled nodes, and an invalidated target dismisses the menu', async () => {
  const { input, link } = await openLinkActionMenu();
  const click = vi.spyOn(link, 'click');
  link.setAttribute('aria-disabled', 'true');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Open link' }));
  await act(async () => {});
  expect(click).not.toHaveBeenCalled();
  expect(input).toHaveFocus();
  link.removeAttribute('aria-disabled');
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  link.remove();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Open link' }));
  await act(async () => {});
  expect(click).not.toHaveBeenCalled();
  document.body.append(link);
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  link.remove();
  act(() => {
    searchMocks.subscribeToPageChanges.mock.calls.at(-1)![0]();
  });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(input).toHaveFocus();
  await flushSearch();
});

test('pure text results offer copy text without link actions', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Report with complete text';
  document.body.append(paragraph);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({ matchingText: [makeTextMatch({ node: paragraph })] }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  input.focus();
  fireEvent.input(input, { target: { value: 'report' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  fireEvent.keyDown(document.activeElement!, { key: 'Enter', code: 'Enter' });
  await act(async () => {});
  expect(writeText).toHaveBeenCalledWith(paragraph.textContent);
  expect(input).toHaveValue('report');
});

test('Down leaves pending queries, composition and unrelated form inputs alone', async () => {
  const pending = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches.mockReturnValue(pending.promise);
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  input.focus();
  fireEvent.input(input, { target: { value: 'report' } });
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  const field = document.createElement('input');
  document.body.append(field);
  act(() => field.focus());
  const down = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    code: 'ArrowDown',
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    field.dispatchEvent(down);
  });
  expect(down.defaultPrevented).toBe(false);
  await act(async () => pending.resolve(makeSearchResult()));
});

test('searches every keystroke immediately, including the first, and cancels superseded queries', async () => {
  vi.useFakeTimers();
  const pending = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches.mockReturnValue(pending.promise);
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  for (const [index, value] of ['s', 'sa', 'sav', 'save'].entries()) {
    input.focus();
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
  input.focus();
  fireEvent.input(input, { target: { value: '' } });
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(4);
  await act(async () => {
    pending.resolve(makeSearchResult());
  });
});

test('finishes a query during continuous page changes and coalesces one follow-up refresh', async () => {
  vi.useFakeTimers();
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save changes';
  document.body.append(paragraph);
  const matches = makeSearchResult({ matchingText: [makeTextMatch({ node: paragraph })] });
  const initial = Promise.withResolvers<SearchResult>();
  const refresh = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches.mockReturnValueOnce(initial.promise).mockReturnValue(refresh.promise);
  const view = render(<Searchbar />);
  fireEvent.input(screen.getByRole('combobox'), { target: { value: 'save' } });
  const notify = searchMocks.subscribeToPageChanges.mock.calls.at(-1)![0] as () => void;
  act(() => {
    for (let i = 0; i < 25; i++) notify();
  });
  expect(searchMocks.findMatches).toHaveBeenCalledOnce();
  expect(searchMocks.findMatches.mock.calls[0]![0].signal.aborted).toBe(false);
  await act(async () => initial.resolve(matches));
  expect(screen.getByRole('status')).toHaveTextContent('Text 1 / 1');
  expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'false');
  act(() => {
    for (let i = 0; i < 25; i++) notify();
  });
  expect(searchMocks.findMatches).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTime(100));
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(2);
  act(() => {
    for (let i = 0; i < 25; i++) notify();
  });
  expect(searchMocks.findMatches.mock.calls[1]![0].signal.aborted).toBe(false);
  await act(async () => refresh.resolve(matches));
  expect(screen.getByRole('status')).toHaveTextContent('Text 1 / 1');
  view.unmount();
  await act(async () => vi.advanceTimersByTime(500));
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(2);
});

test('new typing and clearing cancel queued page refreshes as well as obsolete searches', async () => {
  vi.useFakeTimers();
  const obsolete = Promise.withResolvers<SearchResult>();
  const current = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches
    .mockReturnValueOnce(obsolete.promise)
    .mockReturnValueOnce(current.promise)
    .mockResolvedValue(makeSearchResult());
  render(<Searchbar />);
  const input = screen.getByRole('combobox');
  input.focus();
  fireEvent.input(input, { target: { value: 'old' } });
  const notify = searchMocks.subscribeToPageChanges.mock.calls.at(-1)![0] as () => void;
  await act(async () => notify());
  input.focus();
  fireEvent.input(input, { target: { value: 'new' } });
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(2);
  expect(searchMocks.findMatches.mock.calls[0]![0].signal.aborted).toBe(true);
  act(notify);
  await act(async () => obsolete.resolve(makeSearchResult()));
  expect(searchMocks.findMatches.mock.calls[1]![0].signal.aborted).toBe(false);
  await act(async () => current.resolve(makeSearchResult()));
  input.focus();
  fireEvent.input(input, { target: { value: 'newer' } });
  await flushSearch();
  await act(async () => vi.advanceTimersByTime(100));
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(3);
  act(notify);
  act(notify);
  await flushSearch();
  input.focus();
  fireEvent.input(input, { target: { value: '' } });
  await act(async () => vi.advanceTimersByTime(500));
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(4);
});

test('a modal transition supersedes an in-flight page search instead of queueing behind it', async () => {
  vi.useFakeTimers();
  const outside = document.createElement('p');
  outside.textContent = 'Save outside';
  document.body.append(outside);
  const obsolete = Promise.withResolvers<SearchResult>();
  const current = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches
    .mockReturnValueOnce(obsolete.promise)
    .mockReturnValueOnce(current.promise);
  render(<Searchbar />);
  fireEvent.input(screen.getByRole('combobox'), { target: { value: 'save' } });
  const notify = searchMocks.subscribeToPageChanges.mock.calls.at(-1)![0] as () => void;
  act(notify);
  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const inside = document.createElement('p');
  inside.textContent = 'Save inside';
  modal.append(inside);
  document.body.append(modal);
  act(() => {
    document.dispatchEvent(new Event(MODAL_CHANGED_EVENT));
  });
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(2);
  expect(searchMocks.findMatches.mock.calls[0]![0].signal.aborted).toBe(true);
  await act(async () =>
    current.resolve(makeSearchResult({ matchingText: [makeTextMatch({ node: inside })] })),
  );
  await act(async () =>
    obsolete.resolve(makeSearchResult({ matchingText: [makeTextMatch({ node: outside })] })),
  );
  await act(async () => vi.advanceTimersByTime(100));
  expect(searchMocks.findMatches).toHaveBeenCalledTimes(2);
  expect(window.getSelection()?.toString()).toBe('Save inside');
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
      if (accepted) input.focus();
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
    input.focus();
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
    input.focus();
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
  input.focus();
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
  input.focus();
  fireEvent.change(input, { target: { value: 'old' } });
  await flushSearch();
  input.focus();
  fireEvent.change(input, { target: { value: 'new' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
  await act(async () => {
    oldSearch.resolve(makeSearchResult({ matchingLinksAndButtons: [oldAction] }));
  });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
  input.focus();
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
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();

  expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
});

test('returns to the default mode once the search is over, but not while typing', async () => {
  renderWithBothKinds();
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  act(() => input.focus());
  input.focus();
  fireEvent.change(input, { target: { value: 'sav' } });
  await flushSearch();

  const status = screen.getByRole('status');
  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(status).toHaveTextContent('Actions 1 / 1');

  // Still typing: the chosen mode survives.
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  expect(status).toHaveTextContent('Actions 1 / 1');

  // Escape ends the search and restores its default mode in one press.
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF', altKey: true });
  input.focus();
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
  input.focus();
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
  input.focus();
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
  input.focus();
  fireEvent.change(input, { target: { value: 'sav' } });
  await flushSearch();

  const status = screen.getByRole('status');
  // No Tab press: the first match is already the Enter target.
  expect(status).toHaveTextContent('Text 1 / 1');

  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(status).toHaveTextContent('Actions 1 / 1');

  // Continuing to type must not drop the user back into text mode.
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  expect(status).toHaveTextContent('Actions 1 / 1');
});

// The numbered rows of the results panel are the shortlist Alt+1 to Alt+3 aim at.
test('keeps the third row across pending and superseded queries and selects its current index', async () => {
  searchMocks.popupPosition = { x: 0.5, y: 0.99 };
  const nodes = ['alpha', 'beta', 'gamma', 'delta'].map(name => {
    const button = document.createElement('button');
    button.textContent = `Save ${name}`;
    document.body.append(button);
    return button;
  });
  const candidates = nodes.map((node, index) => makeRankedMatch({ node, score: 10 - index }));
  searchMocks.findMatches.mockResolvedValueOnce(
    makeSearchResult({
      matchingLinksAndButtons: nodes,
      suggestions: candidates,
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'sav' } });
  await flushSearch();
  expect(screen.getAllByRole('option')[2]).toHaveTextContent('gamma');
  const panel = screen.getByRole('listbox');
  const row = screen.getAllByRole('option')[2]!;

  const obsolete = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches.mockReturnValueOnce(obsolete.promise);
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  expect(screen.getByRole('listbox')).toBe(panel);
  expect(panel).toHaveAttribute('aria-busy', 'true');
  expect(panel.parentElement).toHaveClass('keymove-container-suggestions-above');
  expect(screen.getAllByRole('option')[2]).toBe(row);
  expect(row).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(row);
  fireEvent.keyDown(input, { key: '3', code: 'Digit3', altKey: true });
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  const current = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches.mockReturnValueOnce(current.promise);
  input.focus();
  fireEvent.change(input, { target: { value: 'saved' } });
  await act(async () =>
    current.resolve(
      makeSearchResult({
        matchingLinksAndButtons: [nodes[0]!, nodes[1]!, nodes[3]!, nodes[2]!],
        suggestions: [
          candidates[0]!,
          candidates[1]!,
          { ...candidates[3]!, score: 8.5 },
          candidates[2]!,
        ],
      }),
    ),
  );
  await act(async () => obsolete.resolve(makeSearchResult()));
  expect(screen.getByRole('listbox')).toBe(panel);
  expect(panel).toHaveAttribute('aria-busy', 'false');
  expect(screen.getAllByRole('option')[2]).toHaveTextContent('gamma');
  fireEvent.keyDown(input, { key: '3', code: 'Digit3', altKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 4 / 4');
  expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(nodes[2]);
});

test('uses the configured count, switches mode by clicking, opens settings and marks selected rows', async () => {
  settingsMocks.suggestionCount = 5;
  const nodes = Array.from({ length: 6 }, (_, index) => {
    const node = document.createElement('button');
    node.textContent = `Save ${index}`;
    document.body.append(node);
    return node;
  });
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: nodes[0]!, action: nodes[0]!, term: 'Save' })],
      matchingLinksAndButtons: nodes,
      suggestions: nodes.map((node, index) => makeRankedMatch({ node, score: 10 - index })),
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  expect(screen.getAllByRole('option')).toHaveLength(5);
  for (const number of [4, 5]) {
    fireEvent.keyDown(input, { key: String(number), code: `Digit${number}`, altKey: true });
    expect(screen.getByRole('status')).toHaveTextContent(`Actions ${number} / 6`);
    expect(screen.getAllByRole('option')[number - 1]).toHaveClass('keymove-suggestion-selected');
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(
      nodes[number - 1],
    );
  }
  fireEvent.click(screen.getByRole('button', { name: 'Switch to text' }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch to actions' }));
  expect(screen.getByRole('status')).toHaveTextContent('Actions 5 / 6');
  fireEvent.click(screen.getAllByRole('option')[4]!);
  expect(screen.getAllByRole('option')[4]).toHaveClass('keymove-suggestion-selected');
  expect(screen.getAllByRole('option')[0]).not.toHaveClass('keymove-suggestion-selected');
  fireEvent.click(screen.getByRole('button', { name: 'Switch to text' }));
  expect(screen.getByRole('status')).toHaveTextContent('Text 1 / 1');
  expect(screen.getAllByRole('option')[0]).toHaveClass('keymove-suggestion-selected');
  fireEvent.click(screen.getByRole('button', { name: 'Open KeyMove settings' }));
  expect(searchMocks.sendMessage).toHaveBeenCalledWith({ type: 'KEYMOVE_OPEN_SETTINGS' });
  expect(input).toHaveValue('save');
});

test('Alt+1 and Alt+2 jump to the numbered result, taking its mode with them', async () => {
  const firstParagraph = document.createElement('p');
  firstParagraph.textContent = 'Save now';
  const secondParagraph = document.createElement('p');
  secondParagraph.textContent = 'Saved items';
  const action = document.createElement('button');
  action.textContent = 'Save draft';
  document.body.append(firstParagraph, secondParagraph, action);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [
        makeTextMatch({ node: firstParagraph, action: null }),
        makeTextMatch({ node: secondParagraph, action: null }),
      ],
      matchingLinksAndButtons: [action],
      suggestions: [
        makeRankedMatch({ kind: 'action', node: action }),
        makeRankedMatch({ kind: 'text', node: secondParagraph }),
      ],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'sav' } });
  await flushSearch();

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Text 1 / 2');

  // Row 1 is an action while the bar is in text mode, so the mode follows the row.
  fireEvent.keyDown(input, { key: '1', code: 'Digit1', altKey: true });
  expect(status).toHaveTextContent('Actions 1 / 1');

  fireEvent.keyDown(input, { key: '2', code: 'Digit2', altKey: true });
  expect(status).toHaveTextContent('Text 2 / 2');
});

test('clicking suggestion contents selects and scrolls without dragging or activating', async () => {
  const first = document.createElement('p');
  first.textContent = 'Save now';
  const second = document.createElement('p');
  second.textContent = 'Saved items';
  const action = document.createElement('button');
  action.textContent = 'Save draft';
  const activate = vi.fn();
  action.addEventListener('click', activate);
  document.body.append(first, second, action);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: first }), makeTextMatch({ node: second })],
      matchingLinksAndButtons: [action],
      suggestions: [
        makeRankedMatch({ kind: 'action', node: action, term: 'Sav' }),
        makeRankedMatch({ kind: 'text', node: second, term: 'Sav' }),
      ],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'sav' } });
  await flushSearch();
  input.focus();
  const panel = document.getElementById('keymove-container')!;
  const originalPosition = panel.style.cssText;
  // Click a nested mark, with slight pointer movement as happens during a real click.
  for (const index of [1, 0]) {
    const row = screen.getAllByRole('option')[index]!;
    const target = within(row).getByText('Sav');
    expect(fireEvent.mouseDown(target, { button: 0, clientX: 200, clientY: 300 })).toBe(false);
    fireEvent.mouseMove(document, { clientX: 204, clientY: 302 });
    fireEvent.mouseUp(target, { button: 0, clientX: 204, clientY: 302 });
    fireEvent.click(target);
    expect(panel.style.cssText).toBe(originalPosition);
    expect(searchMocks.updatePopupPosition).not.toHaveBeenCalled();
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', row.id);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('sav');
    expect(activate).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      index === 1 ? 'Text 2 / 2' : 'Actions 1 / 1',
    );
    expect(window.getSelection()?.toString()).toBe(index === 1 ? second.textContent : '');
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(
      index === 1 ? second : action,
    );
  }
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
  expect(activate).toHaveBeenCalledOnce();
});

test('Alt+3 does nothing when the list is shorter than three rows', async () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Save now';
  document.body.append(paragraph);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({
      matchingText: [makeTextMatch({ node: paragraph, action: null })],
      suggestions: [makeRankedMatch({ kind: 'text', node: paragraph })],
    }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'sav' } });
  await flushSearch();

  const status = screen.getByRole('status');
  fireEvent.keyDown(input, { key: '3', code: 'Digit3', altKey: true });
  expect(status).toHaveTextContent('Text 1 / 1');
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
  input.focus();
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
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();

  // With no text results either there is nothing to fall back to, so the mode stands.
  fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('Actions 0 / 0');
});

test.each(['none', 'Tab', 'Shift+Tab', 'menu Tab'])(
  'text mode temporarily uses actions and restores text after backspace, including %s navigation',
  async navigation => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Reche';
    const action = document.createElement('input');
    action.placeholder = 'Rechercher';
    document.body.append(paragraph, action);
    searchMocks.findMatches.mockResolvedValue(
      makeSearchResult({ matchingLinksAndButtons: [action] }),
    );
    render(<Searchbar />);
    const input = screen.getByRole('combobox', { name: 'Search page' });
    input.focus();
    fireEvent.change(input, { target: { value: 'recher' } });
    await flushSearch();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Actions 1 / 1');

    if (navigation === 'menu Tab') {
      fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      fireEvent.keyDown(document.activeElement!, { key: 'Tab', code: 'Tab' });
    } else if (navigation !== 'none') {
      fireEvent.keyDown(input, {
        key: 'Tab',
        code: 'Tab',
        shiftKey: navigation === 'Shift+Tab',
      });
    }
    expect(status).toHaveTextContent('Actions 1 / 1');
    searchMocks.findMatches.mockResolvedValue(
      makeSearchResult({
        matchingText: [makeTextMatch({ node: paragraph, term: 'reche' })],
        matchingLinksAndButtons: [action],
      }),
    );
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace' });
    fireEvent.change(input, { target: { value: 'reche' } });
    await flushSearch();
    expect(status).toHaveTextContent('Text 1 / 1');
  },
);

test('Enter focuses the first action during text fallback', async () => {
  const action = document.createElement('input');
  action.placeholder = 'Rechercher';
  document.body.append(action);
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({ matchingLinksAndButtons: [action] }),
  );
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'recher' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
  expect(action).toHaveFocus();
});

test.each(['default', 'shortcut'])(
  'explicit action mode via %s stays in actions when text matches return',
  async choice => {
    settingsMocks.startInActionMode = choice === 'default';
    const action = document.createElement('button');
    const paragraph = document.createElement('p');
    document.body.append(action, paragraph);
    searchMocks.findMatches.mockResolvedValue(
      makeSearchResult({ matchingLinksAndButtons: [action] }),
    );
    render(<Searchbar />);
    const input = screen.getByRole('combobox', { name: 'Search page' });
    input.focus();
    fireEvent.change(input, { target: { value: 'recher' } });
    await flushSearch();
    if (choice === 'shortcut') {
      fireEvent.keyDown(input, { key: 'Tab', code: 'Tab', ctrlKey: true });
    }
    searchMocks.findMatches.mockResolvedValue(
      makeSearchResult({
        matchingText: [makeTextMatch({ node: paragraph, term: 'reche' })],
        matchingLinksAndButtons: [action],
      }),
    );
    fireEvent.change(input, { target: { value: 'reche' } });
    await flushSearch();
    expect(screen.getByRole('status')).toHaveTextContent('Actions 1 / 1');
  },
);

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
  input.focus();
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
  input.focus();
  fireEvent.change(input, { target: { value: 'how t' } });
  await flushSearch();
  expect(status).toHaveTextContent('Actions 1 / 1');
});

test('Escape closes the search in one press and Alt+F reopens it', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  const { container } = render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  act(() => {
    input.focus();
  });
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  expect(input).toHaveValue('');
  expect(container.firstElementChild).toHaveClass('keymove-hidden');
  fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF', altKey: true });
  expect(container.firstElementChild).not.toHaveClass('keymove-hidden');
  expect(input).toHaveFocus();
});

test.each(['Tab', 'Alt+1'])(
  'Alt+Backspace returns to the reading position before %s',
  async shortcut => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Help improve MDN';
    document.body.append(paragraph);
    searchMocks.findMatches.mockResolvedValue(
      makeSearchResult({
        matchingText: [makeTextMatch({ node: paragraph, term: 'improve' })],
        suggestions: [makeRankedMatch({ node: paragraph, kind: 'text', term: 'improve' })],
      }),
    );
    vi.stubGlobal('scrollX', 15);
    vi.stubGlobal('scrollY', 240);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      const { container } = render(<Searchbar />);
      // Start from ordinary reading, with no focused page control.
      fireEvent.keyDown(document.body, { key: 'i', code: 'KeyI' });
      const input = screen.getByRole('combobox', { name: 'Search page' });
      input.focus();
      fireEvent.change(input, { target: { value: 'improve' } });
      await flushSearch();
      fireEvent.keyDown(
        input,
        shortcut === 'Tab'
          ? { key: 'Tab', code: 'Tab' }
          : { key: '1', code: 'Digit1', altKey: true },
      );
      expect(paragraph.scrollIntoView).toHaveBeenCalled();
      vi.stubGlobal('scrollY', 1500);
      // Refining the same search must not replace the original position.
      input.focus();
      fireEvent.change(input, { target: { value: 'improv' } });
      await flushSearch();
      fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace', altKey: true });
      expect(scrollTo).toHaveBeenCalledWith({ left: 15, top: 240, behavior: 'instant' });
      expect(container.firstElementChild).toHaveClass('keymove-hidden');
      expect(input).toHaveValue('');
      expect(input).not.toHaveFocus();
    } finally {
      scrollTo.mockRestore();
      vi.unstubAllGlobals();
    }
  },
);

test('Escape keeps the current position and does not restore an earlier field', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  const original = document.createElement('textarea');
  original.value = 'Original text';
  document.body.append(original);
  render(<Searchbar />);
  act(() => {
    original.focus();
    original.setSelectionRange(2, 6, 'backward');
  });
  fireEvent.keyDown(original, { key: 'f', code: 'KeyF', altKey: true });
  const input = screen.getByRole('combobox', { name: 'Search page' });
  expect(input).toHaveFocus();
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  const focus = vi.spyOn(original, 'focus');
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  try {
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(input).not.toHaveFocus();
    expect(input).toHaveValue('');
    expect(focus).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  } finally {
    scrollTo.mockRestore();
  }
});

test.each(['button', 'input', 'a'] as const)(
  'leaves Escape and the new focus with a page %s',
  tag => {
    const original = document.createElement('input');
    const destination = document.createElement(tag);
    destination.setAttribute('tabindex', '0');
    document.body.append(original, destination);
    const { container } = render(<Searchbar />);
    act(() => original.focus());
    fireEvent.keyDown(original, { key: 'f', code: 'KeyF', altKey: true });
    act(() => destination.focus());
    const onEscape = vi.fn();
    destination.addEventListener('keydown', onEscape);
    expect(fireEvent.keyDown(destination, { key: 'Escape', code: 'Escape' })).toBe(true);
    expect(onEscape).toHaveBeenCalledOnce();
    expect(destination).toHaveFocus();
    expect(container.firstElementChild).not.toHaveClass('keymove-hidden');
    expect(
      fireEvent.keyDown(destination, { key: 'Backspace', code: 'Backspace', altKey: true }),
    ).toBe(true);
    expect(destination).toHaveFocus();
  },
);

test('a new search captures the new position after Escape closes the previous search', () => {
  vi.stubGlobal('scrollY', 100);
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<Searchbar />);
  fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF', altKey: true });
  const input = screen.getByRole('combobox', { name: 'Search page' });
  try {
    vi.stubGlobal('scrollY', 700);
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF', altKey: true });
    vi.stubGlobal('scrollY', 1200);
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace', altKey: true });
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 700, behavior: 'instant' });
  } finally {
    scrollTo.mockRestore();
    vi.unstubAllGlobals();
  }
});

test('activation discards the return position even if the action leaves search focused', async () => {
  settingsMocks.startInActionMode = true;
  const original = document.createElement('input');
  const button = document.createElement('button');
  button.textContent = 'Save';
  document.body.append(original, button);
  const click = vi.spyOn(button, 'click');
  searchMocks.findMatches.mockResolvedValue(
    makeSearchResult({ matchingLinksAndButtons: [button] }),
  );
  render(<Searchbar />);
  act(() => original.focus());
  fireEvent.keyDown(original, { key: 'f', code: 'KeyF', altKey: true });
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
  expect(click).toHaveBeenCalledOnce();
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  try {
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace', altKey: true });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(original).not.toHaveFocus();
  } finally {
    scrollTo.mockRestore();
  }
});

test.each(['blur first', 'hidden first'])(
  'keeps tab context when switching away: %s',
  async order => {
    const first = document.createElement('button');
    first.textContent = 'Save first';
    const second = document.createElement('button');
    second.textContent = 'Save second';
    document.body.append(first, second);
    searchMocks.findMatches.mockResolvedValue(
      makeSearchResult({
        matchingLinksAndButtons: [first, second],
        suggestions: [makeRankedMatch({ node: first }), makeRankedMatch({ node: second })],
      }),
    );
    render(<Searchbar />);
    const input = screen.getByRole('combobox', { name: 'Search page' });
    input.focus();
    fireEvent.change(input, { target: { value: 'save' } });
    await flushSearch();
    input.focus();
    fireEvent.keyDown(input, { key: '2', code: 'Digit2', altKey: true });
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue(order === 'hidden first' ? 'hidden' : 'visible');
    try {
      fireEvent.blur(input, { relatedTarget: null });
      visibility.mockReturnValue('hidden');
      fireEvent(document, new Event('visibilitychange'));
      visibility.mockReturnValue('visible');
      hasFocus.mockReturnValue(true);
      fireEvent(document, new Event('visibilitychange'));
      expect(input).toHaveValue('save');
      expect(screen.getByRole('status')).toHaveTextContent('Actions 2 / 2');
      expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
      expect(searchMocks.findMatches).toHaveBeenCalledOnce();
    } finally {
      hasFocus.mockRestore();
      visibility.mockRestore();
    }
  },
);

test('still clears a search when focus moves to a control on the same page', async () => {
  searchMocks.findMatches.mockResolvedValue(makeSearchResult());
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  const pageInput = document.createElement('input');
  document.body.append(pageInput);
  act(() => input.focus());
  act(() => pageInput.focus());
  expect(input).toHaveValue('');
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
  input.focus();
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
  input.focus();
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
  input.focus();
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
  input.focus();
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
  input.focus();
  fireEvent.change(input, { target: { value: 'result' } });
  await flushSearch();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Text 1 / 1'));
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
  input.focus();
  fireEvent.change(input, { target: { value: 'setings' } });
  await flushSearch();
  expect(screen.getByRole('status')).toHaveTextContent('Text ~ 1 / 1');

  // The next query has not resolved yet, so nothing is known to be approximate.
  searchMocks.findMatches.mockReturnValue(new Promise(() => undefined));
  input.focus();
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

  input.focus();
  fireEvent.change(input, { target: { value: 'sa' } });
  await flushSearch();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveAttribute('aria-expanded', 'false');

  input.focus();
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
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  expect(screen.getAllByRole('option')).toHaveLength(1);

  input.focus();
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('keeps the suggestions frame through empty results and the next pending query', async () => {
  const node = document.createElement('button');
  node.textContent = 'Save';
  document.body.append(node);
  const matches = makeSearchResult({
    matchingLinksAndButtons: [node],
    suggestions: [makeRankedMatch({ node, term: 'save' })],
  });
  searchMocks.findMatches.mockResolvedValueOnce(matches);
  render(<Searchbar />);
  const input = screen.getByRole('combobox', { name: 'Search page' });
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  await flushSearch();
  const panel = screen.getByRole('listbox');
  searchMocks.findMatches.mockResolvedValueOnce(makeSearchResult());
  input.focus();
  fireEvent.change(input, { target: { value: 'savexyz' } });
  await flushSearch();
  expect(screen.getByRole('listbox')).toBe(panel);
  expect(panel).toHaveTextContent('No matches');
  expect(input).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryAllByRole('option')).toHaveLength(0);
  const pending = Promise.withResolvers<SearchResult>();
  searchMocks.findMatches.mockReturnValueOnce(pending.promise);
  input.focus();
  fireEvent.change(input, { target: { value: 'save' } });
  expect(screen.getByRole('listbox')).toBe(panel);
  await act(async () => pending.resolve(matches));
  expect(screen.getByRole('listbox')).toBe(panel);
  expect(screen.getAllByRole('option')).toHaveLength(1);
  searchMocks.findMatches.mockResolvedValueOnce(makeSearchResult());
  input.focus();
  fireEvent.change(input, { target: { value: 'sa' } });
  await flushSearch();
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

test.each(['é', 'Б', 'λ', '日', 'ع', '𐐀'])(
  'starts searching with the first %s keystroke',
  async key => {
    searchMocks.findMatches.mockResolvedValue(makeSearchResult());
    render(<Searchbar />);
    const input = screen.getByRole('combobox', { name: 'Search page' });
    fireEvent.keyDown(document.body, { key });
    expect(input).toHaveFocus();
    expect(input).toHaveValue(key);
    await flushSearch();
  },
);
