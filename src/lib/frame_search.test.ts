import { FrameSearch, mergeFrameResults } from './frame_search.js';
import { FRAME_MESSAGE } from './frame_protocol.js';
import type { FrameReply } from './frame_protocol.js';
import { makeSearchResult, makeRankedMatch, makeTextMatch } from '../test_support/factories.js';
import { frameTarget, setFrameTarget, resultIsConnected } from './frame_target.js';
import { isTextVisible } from './visible_text.js';
import { actionIsInScope } from './modal_context.js';

const transport = vi.hoisted(() => ({ send: vi.fn(), add: vi.fn(), remove: vi.fn() }));
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'test',
      sendMessage: transport.send,
      onMessage: { addListener: transport.add, removeListener: transport.remove },
    },
  },
}));

test('discards superseded responses, retains current handles, and releases hidden frames', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  vi.spyOn(frame, 'getClientRects').mockReturnValue([
    { width: 100, height: 100 },
  ] as unknown as DOMRectList);
  const pending: { generation: string; resolve: (value: FrameReply) => void }[] = [];
  transport.send.mockImplementation((message: { request: { op: string; generation: string } }) => {
    if (message.request.op !== 'search') return Promise.resolve(true);
    return new Promise<FrameReply>(resolve =>
      pending.push({ generation: message.request.generation, resolve }),
    );
  });
  vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation((message: { token: string }) => {
    const listener = transport.add.mock.calls.at(-1)![0];
    listener(
      { type: FRAME_MESSAGE, kind: 'ready', token: message.token, frameId: 7 },
      { id: 'test' },
    );
  });
  const coordinator = new FrameSearch(vi.fn());
  const stale = vi.fn(),
    fresh = vi.fn();
  const old = new AbortController();
  const first = coordinator.search('old', old.signal, stale);
  await vi.waitFor(() => expect(pending).toHaveLength(1));
  old.abort();
  const second = coordinator.search('new', new AbortController().signal, fresh);
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  const row = {
    id: 1,
    kind: 'action' as const,
    action: null,
    label: 'New field',
    text: '',
    context: 'text field',
    href: null,
    disabled: false,
    focusable: true,
    score: 1,
    term: null,
    distance: null,
  };
  pending[1]!.resolve({ generation: pending[1]!.generation, rows: [row], isFuzzy: false });
  const result = await second;
  pending[0]!.resolve({ generation: pending[0]!.generation, rows: [row], isFuzzy: false });
  await first;
  expect(stale).not.toHaveBeenCalled();
  const handle = result[0]!.matchingLinksAndButtons[0]!;
  expect(resultIsConnected(handle)).toBe(true);
  frame.hidden = true;
  expect(await coordinator.search('new', new AbortController().signal, fresh)).toEqual([]);
  expect(resultIsConnected(handle)).toBe(false);
  coordinator.stop();
  expect(transport.remove).toHaveBeenCalled();
  frame.remove();
  vi.restoreAllMocks();
});

test('a same-query partial refresh retains results from siblings still searching', async () => {
  const frames = [document.createElement('iframe'), document.createElement('iframe')];
  document.body.append(...frames);
  const pending: { generation: string; resolve: (value: FrameReply) => void }[] = [];
  transport.send.mockImplementation((message: { request: { op: string; generation: string } }) => {
    if (message.request.op !== 'search') return Promise.resolve(true);
    return new Promise<FrameReply>(resolve =>
      pending.push({ generation: message.request.generation, resolve }),
    );
  });
  frames.forEach((frame, index) => {
    vi.spyOn(frame, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(
      (message: { token: string }) => {
        transport.add.mock.calls.at(-1)![0](
          { type: FRAME_MESSAGE, kind: 'ready', token: message.token, frameId: index + 1 },
          { id: 'test' },
        );
      },
    );
  });
  const reply = (index: number) =>
    pending[index]!.resolve({
      generation: pending[index]!.generation,
      isFuzzy: false,
      rows: [
        {
          id: 1,
          kind: 'text',
          action: null,
          label: 'Otter',
          text: 'Otter',
          context: '',
          href: null,
          disabled: false,
          focusable: false,
          score: 1,
          term: 'otter',
          distance: null,
        },
      ],
    });
  const search = new FrameSearch(vi.fn());
  try {
    const initial = search.search('otter', new AbortController().signal, vi.fn());
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    reply(0);
    reply(1);
    const before = await initial;
    const publish = vi.fn();
    const refresh = search.search('otter', new AbortController().signal, publish);
    await vi.waitFor(() => expect(pending).toHaveLength(4));
    reply(2);
    await vi.waitFor(() => expect(publish).toHaveBeenCalled());
    const partial = publish.mock.calls[0]![0] as typeof before;
    reply(3);
    await refresh;
    expect(partial[1]!.matchingText[0]!.node).toBe(before[1]!.matchingText[0]!.node);
  } finally {
    search.stop();
    frames.forEach(frame => frame.remove());
    vi.restoreAllMocks();
  }
});

test('exact results in one document exclude fuzzy results from other documents', () => {
  const fuzzy = makeSearchResult({ matchingText: [makeTextMatch()], isFuzzy: true });
  const exact = makeSearchResult({ matchingLinksAndButtons: [document.createElement('button')] });
  expect(mergeFrameResults([fuzzy, exact]).matchingText).toEqual([]);
  expect(mergeFrameResults([fuzzy, exact]).isFuzzy).toBe(false);
  expect(mergeFrameResults([makeSearchResult(), fuzzy]).isFuzzy).toBe(true);
});

test('merges all navigable results and ranks the mixed shortlist across documents', () => {
  const text = makeTextMatch();
  const action = document.createElement('button');
  const merged = mergeFrameResults([
    makeSearchResult({
      matchingText: [text],
      suggestions: [makeRankedMatch({ kind: 'text', node: text.node, score: 1 })],
    }),
    makeSearchResult({
      matchingLinksAndButtons: [action],
      suggestions: [makeRankedMatch({ node: action, score: 2 })],
    }),
  ]);
  expect(merged.matchingText).toEqual([text]);
  expect(merged.matchingLinksAndButtons).toEqual([action]);
  expect(merged.suggestions.map(row => row.node)).toEqual([action, text.node]);
});

test('detached remote handles obey their actual iframe lifetime and modal scope', () => {
  const iframe = document.createElement('iframe');
  const modal = document.createElement('div');
  document.body.append(iframe, modal);
  const node = document.createElement('button');
  setFrameTarget(node, {
    row: {
      id: 1,
      kind: 'action',
      action: null,
      label: 'Minimum',
      text: '',
      context: 'text field',
      href: null,
      disabled: false,
      focusable: true,
      score: 1,
      term: null,
      distance: null,
    },
    boundary: iframe,
    alive: () => iframe.isConnected,
    command: vi.fn(),
    paint: vi.fn(),
  });
  expect(resultIsConnected(node)).toBe(true);
  expect(isTextVisible(node)).toBe(true);
  expect(actionIsInScope(node, modal)).toBe(false);
  modal.append(iframe);
  expect(actionIsInScope(node, modal)).toBe(true);
  iframe.style.display = 'none';
  expect(isTextVisible(node)).toBe(false);
  iframe.remove();
  expect(resultIsConnected(node)).toBe(false);
  expect(frameTarget(document.createElement('p'))).toBeUndefined();
  modal.remove();
});
