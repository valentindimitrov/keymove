import { act, renderHook } from '@testing-library/react';
import { makeTextMatch } from '../test_support/factories.js';
import { KEYMOVE_CURRENT_HIGHLIGHT_NAME, KEYMOVE_HIGHLIGHT_NAME } from '../constants.js';
import useHighlights, {
  highlightRangesForMatches,
  highlightRangesForNodes,
  rangesForTextNode,
  MAX_HIGHLIGHT_RANGES,
} from './use_highlights.js';

afterEach(() => {
  document.body.innerHTML = '';
});

test('creates a range for every case-insensitive match without changing the DOM', () => {
  const button = document.createElement('button');
  button.innerHTML = '<span>Save</span> and save again';
  document.body.appendChild(button);
  const originalMarkup = button.innerHTML;

  const ranges = highlightRangesForNodes([button], 'save');

  expect(ranges.map(range => range.toString())).toEqual(['Save', 'save']);
  expect(button.innerHTML).toBe(originalMarkup);
  expect(button.querySelector('mark')).toBeNull();
});

test('does not duplicate ranges when matching nodes overlap', () => {
  const button = document.createElement('button');
  button.innerHTML = '<span>Save</span>';
  document.body.appendChild(button);

  const ranges = highlightRangesForNodes([button, button.querySelector('span')!], 'save');

  expect(ranges).toHaveLength(1);
});

test('deduplicates overlapping roots even when a descendant precedes its ancestor', () => {
  document.body.innerHTML = '<div><p><span>Save</span></p></div>';
  const parent = document.querySelector('div')!;
  const child = document.querySelector('span')!;
  expect(
    highlightRangesForNodes([child, parent, parent], 'save').map(range => range.toString()),
  ).toEqual(['Save']);
});

test('caps dense highlights without comparing every pair of matching blocks', () => {
  document.body.innerHTML = '<p>Save</p>'.repeat(1000);
  const nodes = [...document.querySelectorAll('p')];
  const contains = vi.spyOn(Node.prototype, 'contains');
  try {
    expect(highlightRangesForNodes(nodes, 'save')).toHaveLength(MAX_HIGHLIGHT_RANGES);
    expect(contains.mock.calls.length).toBeLessThan(nodes.length * 10);
  } finally {
    contains.mockRestore();
  }
});

test('moving the selection retains the existing general highlights', () => {
  document.body.innerHTML = '<p>Save one</p><p>Save two</p>';
  const matches = [...document.querySelectorAll('p')].map(node => makeTextMatch({ node }));
  const registry = new Map<string, unknown>();
  vi.stubGlobal('CSS', { highlights: registry });
  vi.stubGlobal(
    'Highlight',
    class {
      priority = 0;
    },
  );
  const { rerender, unmount } = renderHook(
    ({ selectedMatch }) => useHighlights({ matches, selectedMatch }),
    { initialProps: { selectedMatch: matches[0]! } },
  );
  try {
    const general = registry.get(KEYMOVE_HIGHLIGHT_NAME);
    const current = registry.get(KEYMOVE_CURRENT_HIGHLIGHT_NAME);
    rerender({ selectedMatch: matches[1]! });
    expect(registry.get(KEYMOVE_HIGHLIGHT_NAME)).toBe(general);
    expect(registry.get(KEYMOVE_CURRENT_HIGHLIGHT_NAME)).not.toBe(current);
  } finally {
    unmount();
    vi.unstubAllGlobals();
  }
});

test.each(['replace', 'disable', 'unmount'])(
  'cancels unfinished highlight preparation on %s',
  async change => {
    vi.useFakeTimers();
    let clock = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => {
      clock += 10;
      return clock;
    });
    document.body.innerHTML = '<p>Save</p>'.repeat(250);
    const matches = [...document.querySelectorAll('p')].map(node => makeTextMatch({ node }));
    const registry = new Map<string, unknown>();
    vi.stubGlobal('CSS', { highlights: registry });
    vi.stubGlobal('Highlight', class {});
    const { rerender, unmount } = renderHook(props => useHighlights(props), {
      initialProps: { matches, enabled: true },
    });
    try {
      expect(registry.size).toBe(0);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      if (change === 'replace') rerender({ matches: [matches[0]!], enabled: true });
      else if (change === 'disable') rerender({ matches, enabled: false });
      else unmount();
      const replacement = registry.get(KEYMOVE_HIGHLIGHT_NAME);
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => {
        vi.runAllTimers();
      });
      expect(registry.get(KEYMOVE_HIGHLIGHT_NAME)).toBe(replacement);
      expect(registry.size).toBe(change === 'replace' ? 1 : 0);
    } finally {
      unmount();
      now.mockRestore();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  },
);

test('finishes a dense highlight job across chunks while retaining the range cap', async () => {
  vi.useFakeTimers();
  let clock = 0;
  const now = vi.spyOn(performance, 'now').mockImplementation(() => {
    clock += 10;
    return clock;
  });
  document.body.innerHTML = '<p>Save</p>'.repeat(1000);
  const matches = [...document.querySelectorAll('p')].map(node => makeTextMatch({ node }));
  const registry = new Map<string, unknown>();
  const makeHighlight = vi.fn();
  vi.stubGlobal('CSS', { highlights: registry });
  vi.stubGlobal(
    'Highlight',
    class {
      constructor(...ranges: Range[]) {
        makeHighlight(ranges);
      }
    },
  );
  const { unmount } = renderHook(() => useHighlights({ matches }));
  try {
    expect(makeHighlight).not.toHaveBeenCalled();
    await act(async () => {
      vi.runAllTimers();
    });
    expect(makeHighlight).toHaveBeenCalledOnce();
    expect(makeHighlight.mock.calls[0]![0]).toHaveLength(MAX_HIGHLIGHT_RANGES);
    expect(registry.has(KEYMOVE_HIGHLIGHT_NAME)).toBe(true);
  } finally {
    unmount();
    now.mockRestore();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

test('finds repeated matches within one text node', () => {
  const textNode = document.createTextNode('go go go');
  expect(rangesForTextNode(textNode, 'go')).toHaveLength(3);
});

test('highlights phrases across inline nodes without highlighting hidden text', () => {
  const paragraph = document.createElement('p');
  paragraph.innerHTML =
    '<span>Save </span><strong>settings</strong><span hidden>save settings</span>';
  document.body.append(paragraph);
  const ranges = highlightRangesForNodes([paragraph], 'save settings');
  expect(ranges.map(range => range.toString())).toEqual(['Save settings']);
});

test('keeps DOM range offsets correct after lowercase expansion', () => {
  const text = document.createTextNode('\u0130 Save');
  expect(rangesForTextNode(text, 'save').map(range => range.toString())).toEqual(['Save']);
  expect(rangesForTextNode(text, '')).toEqual([]);
});

test('maps repeated collapsed whitespace matches and leaves markup untouched', () => {
  document.body.innerHTML = '<p>  İ Account   <b> settings</b> / Account\t\tsettings </p>';
  const node = document.querySelector('p')!;
  const before = node.innerHTML;
  expect(
    highlightRangesForNodes([node], 'account settings').map(range => range.toString()),
  ).toEqual(['Account    settings', 'Account\t\tsettings']);
  expect(node.innerHTML).toBe(before);
});

test('maps a match spanning the text processing chunk boundary', () => {
  document.body.innerHTML = `<p>${'x'.repeat(1021)}Save    settings</p>`;
  expect(
    highlightRangesForNodes([document.querySelector('p')!], 'save settings').map(range =>
      range.toString(),
    ),
  ).toEqual(['Save    settings']);
});

test('bounds highlight allocation on a page with tens of thousands of matches', () => {
  const text = document.createTextNode('go '.repeat(60_000));
  const ranges = rangesForTextNode(text, 'go');
  expect(ranges).toHaveLength(MAX_HIGHLIGHT_RANGES);
  expect(ranges.at(-1)?.toString()).toBe('go');
});

test('shares the highlight limit across blocks', () => {
  document.body.innerHTML = `<p>${'go '.repeat(400)}</p><p>${'go '.repeat(400)}</p>`;
  expect(highlightRangesForNodes([...document.querySelectorAll('p')], 'go')).toHaveLength(
    MAX_HIGHLIGHT_RANGES,
  );
});

test('maps expanded and supplementary characters across adjacent text nodes', () => {
  document.body.innerHTML = '<p><span>\u0130 😀 Sa</span><b>ve</b> <i>Save</i></p>';
  expect(
    highlightRangesForNodes([document.querySelector('p')!], 'save').map(range => range.toString()),
  ).toEqual(['Save', 'Save']);
});

test('highlights each match by its own matched term, not by the query', () => {
  document.body.innerHTML = '<p>Open the settings panel</p><p>Change your setings</p>';
  const [first, second] = [...document.querySelectorAll('p')];

  // A fuzzy search for "setings" matches each block through that block's own spelling.
  const ranges = highlightRangesForMatches([
    { node: first!, term: 'settings' },
    { node: second!, term: 'setings' },
  ]);

  expect(ranges.map(range => range.toString())).toEqual(['settings', 'setings']);
});

test('paints the current match with its own higher-priority highlight', () => {
  document.body.innerHTML = '<p>Save one</p><p>Save two</p>';
  const [first, second] = [...document.querySelectorAll('p')];
  const registry = new Map<string, { priority?: number }>();
  const highlights: Range[][] = [];
  class FakeHighlight {
    priority = 0;
    constructor(...ranges: Range[]) {
      highlights.push(ranges);
    }
  }
  vi.stubGlobal('CSS', { highlights: registry });
  vi.stubGlobal('Highlight', FakeHighlight);

  const matches = [
    { node: first!, term: 'save' },
    { node: second!, term: 'save' },
  ];
  const { unmount } = renderHook(() =>
    useHighlights({ matches, selectedMatch: matches[1]!, enabled: true }),
  );

  expect(registry.has(KEYMOVE_HIGHLIGHT_NAME)).toBe(true);
  expect(registry.get(KEYMOVE_CURRENT_HIGHLIGHT_NAME)?.priority).toBe(1);
  // The broad highlight covers both blocks; the current one covers only the selected block.
  expect(highlights[0]).toHaveLength(2);
  expect(highlights[1]).toHaveLength(1);

  unmount();
  expect(registry.size).toBe(0);
  vi.unstubAllGlobals();
});

test('paints nothing when match highlighting is turned off', () => {
  document.body.innerHTML = '<p>Save one</p>';
  const paragraph = document.querySelector('p')!;
  const registry = new Map<string, unknown>();
  vi.stubGlobal('CSS', { highlights: registry });
  vi.stubGlobal('Highlight', class {});

  const matches = [{ node: paragraph, term: 'save' }];
  renderHook(() => useHighlights({ matches, selectedMatch: matches[0]!, enabled: false }));

  expect(registry.size).toBe(0);
  vi.unstubAllGlobals();
});
