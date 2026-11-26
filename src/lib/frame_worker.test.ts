import { installFrameWorker } from './frame_worker.js';
import { FRAME_MESSAGE, FRAME_PROBE } from './frame_protocol.js';
import type { FrameReply, FrameRequest } from './frame_protocol.js';
import { PageSearchIndex } from './page_search_index.js';
import { setFrameTarget } from './frame_target.js';
import { makeSearchResult } from '../test_support/factories.js';
import { isImageInfo } from './image_schema.js';
import { acceptSyntheticInputForTesting } from './trusted_input.js';

const transport = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  send: vi.fn().mockResolvedValue(null),
}));

test('routes image selection with live tokens and cleans its frame overlay', async () => {
  document.body.innerHTML =
    '<figure><img src="https://example.com/photo.png" alt="Product"><figcaption>Samba</figcaption></figure><figure><img id="neighbour" src="https://example.com/other.png"></figure>';
  for (const image of document.querySelectorAll('img')) image.scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return new DOMRect(this.id === 'neighbour' ? 250 : 0, 0, 200, 200);
  });
  transport.add.mockClear();
  const teardown = installFrameWorker();
  const listener = transport.add.mock.calls[0]![0];
  const request = (body: FrameRequest): Promise<unknown> =>
    new Promise(resolve => {
      listener(
        { type: FRAME_MESSAGE, kind: 'deliver', requester: 0, request: body },
        { id: 'test' },
        resolve,
      );
    });
  try {
    const reply = (await request({
      op: 'search',
      query: 'Samba',
      generation: 'images',
      depth: 1,
    })) as FrameReply;
    const id = reply.rows.find(row => row.kind === 'text')!.id;
    const command = { op: 'command' as const, generation: 'images', id };
    const image = await request({ ...command, command: { image: 'next', token: '' } });
    expect(isImageInfo(image)).toBe(true);
    if (!isImageInfo(image)) throw new Error('Missing image');
    expect(
      document
        .getElementById('keymove-root')
        ?.shadowRoot?.querySelector('.keymove-selected-selection'),
    ).not.toBeNull();
    expect(await request({ ...command, command: { image: 'info', token: 'stale' } })).toBeNull();
    expect(await request({ ...command, command: { image: 'info', token: image.token } })).toEqual(
      image,
    );
    const moved = await request({ ...command, command: { image: 'right', token: image.token } });
    expect(isImageInfo(moved)).toBe(true);
    if (!isImageInfo(moved)) throw new Error('Missing neighbour image');
    expect(moved.url).toBe('https://example.com/other.png');
    expect(
      await request({ ...command, command: { image: 'left', token: image.token } }),
    ).toBeNull();
    await request({ ...command, command: { image: 'clear', token: moved.token } });
    expect(document.getElementById('keymove-root')).toBeNull();
    await request({ op: 'stop' });
    expect(await request({ ...command, command: { image: 'next', token: '' } })).toBeNull();
  } finally {
    teardown();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  }
});
test('a new query clears outlines; a refresh keeps them for the top frame to repaint', async () => {
  document.body.innerHTML = '<p>otter one</p><p>beaver two</p>';
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
  transport.add.mockClear();
  const teardown = installFrameWorker();
  const listener = transport.add.mock.calls[0]![0];
  const request = (body: FrameRequest): Promise<unknown> =>
    new Promise(resolve => {
      listener(
        { type: FRAME_MESSAGE, kind: 'deliver', requester: 0, request: body },
        { id: 'test' },
        resolve,
      );
    });
  const marks = () => document.getElementById('keymove-root');
  const paint = { op: 'paint' as const, selected: null, color: '#f59e0b', highlight: false };
  try {
    const reply = (await request({
      op: 'search',
      query: 'otter',
      generation: 'one',
      depth: 1,
    })) as FrameReply;
    const id = reply.rows.find(row => row.kind === 'text')!.id;
    await request({ ...paint, generation: 'one', ids: [id], selected: id });
    expect(marks()).not.toBeNull();
    // The query moves on; this frame has no rows now, so nothing paints it again.
    const next = (await request({
      op: 'search',
      query: 'otterzzz',
      generation: 'two',
      depth: 1,
    })) as FrameReply;
    expect(next.rows).toEqual([]);
    // The top frame's cleanup paint still carries the first generation.
    expect(await request({ ...paint, generation: 'one', ids: [] })).toBeNull();
    expect(marks()).toBeNull();
    // A refresh of the same query keeps the marks until the top frame repaints them.
    const third = (await request({
      op: 'search',
      query: 'beaver',
      generation: 'three',
      depth: 1,
    })) as FrameReply;
    const beaver = third.rows.find(row => row.kind === 'text')!.id;
    await request({ ...paint, generation: 'three', ids: [beaver], selected: beaver });
    await request({ op: 'search', query: 'beaver', generation: 'four', depth: 1 });
    expect(marks()).not.toBeNull();
    expect(await request({ ...paint, generation: 'four', ids: [] })).toBe(true);
    expect(marks()).toBeNull();
  } finally {
    teardown();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  }
});

test('never highlights matches retained from a search for another query', async () => {
  document.body.innerHTML = '<p>otter one</p><p>beaver two</p>';
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
  const registry = new Map<string, { size: number }>();
  vi.stubGlobal('CSS', { highlights: registry });
  // jsdom has no adoptedStyleSheets.
  Object.defineProperty(document, 'adoptedStyleSheets', {
    value: [],
    writable: true,
    configurable: true,
  });
  vi.stubGlobal(
    'Highlight',
    class {
      size: number;
      constructor(...ranges: Range[]) {
        this.size = ranges.length;
      }
    },
  );
  transport.add.mockClear();
  const teardown = installFrameWorker();
  const listener = transport.add.mock.calls[0]![0];
  const request = (body: FrameRequest): Promise<unknown> =>
    new Promise(resolve => {
      listener(
        { type: FRAME_MESSAGE, kind: 'deliver', requester: 0, request: body },
        { id: 'test' },
        resolve,
      );
    });
  const paint = { op: 'paint' as const, selected: null, color: '#f59e0b', highlight: true };
  try {
    const reply = (await request({
      op: 'search',
      query: 'otter',
      generation: 'one',
      depth: 1,
    })) as FrameReply;
    const id = reply.rows.find(row => row.kind === 'text')!.id;
    // A search for another query is still running when a cached painter repaints.
    const pending = request({ op: 'search', query: 'beaver', generation: 'two', depth: 1 });
    await request({ ...paint, generation: 'two', ids: [id] });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(registry.has('keymove-search-results')).toBe(false);
    await pending;
    await request({ ...paint, generation: 'two', ids: [id] });
    await vi.waitFor(() => expect(registry.get('keymove-search-results')?.size).toBe(1));
  } finally {
    teardown();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'adoptedStyleSheets');
  }
});

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'test',
      sendMessage: transport.send,
      onMessage: { addListener: transport.add, removeListener: transport.remove },
    },
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  },
}));

test('indexes lazily and rejects stale, disabled, removed and foreign-owner actions', async () => {
  document.body.innerHTML =
    '<label for="amount">Minimum</label><input id="amount" value="40"><button>Launch</button>';
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  const teardown = installFrameWorker();
  expect(observe).not.toHaveBeenCalled();
  const listener = transport.add.mock.calls[0]![0];
  const request = (body: FrameRequest, requester = 0): Promise<unknown> =>
    new Promise(resolve => {
      listener(
        { type: FRAME_MESSAGE, kind: 'deliver', request: body, requester },
        { id: 'test' },
        resolve,
      );
    });
  try {
    const reply = (await request({
      op: 'search',
      query: '40',
      generation: 'one',
      depth: 1,
    })) as FrameReply;
    expect(reply.rows[0]?.label).toBe('Minimum — 40');
    const command = {
      op: 'command' as const,
      generation: 'one',
      id: reply.rows[0]!.id,
      command: 'activate' as const,
    };
    expect(await request(command, 99)).toBeNull();
    expect(await request({ ...command, generation: 'stale' })).toBeNull();
    const input = document.querySelector('input')!;
    input.disabled = true;
    expect(await request(command)).toBe(false);
    input.disabled = false;
    expect(await request(command)).toBe(true);
    expect(document.activeElement).toBe(input);
    input.remove();
    expect(await request(command)).toBeNull();
    expect(await request({ op: 'stop' })).toBe(true);
    expect(await request(command)).toBeNull();
  } finally {
    teardown();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  }
});
test('an unresponsive nested iframe does not discard its parents own matches', async () => {
  document.body.innerHTML = '<p>otter</p><iframe></iframe>';
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);
  vi.spyOn(document.querySelector('iframe')!, 'getClientRects').mockReturnValue([
    {},
  ] as unknown as DOMRectList);
  transport.add.mockClear();
  const teardown = installFrameWorker();
  const listener = transport.add.mock.calls[0]![0];
  let timer: ReturnType<typeof setTimeout>;
  const parentDeadline = new Promise(resolve => {
    timer = setTimeout(() => resolve('timed out'), 1500);
  });
  const reply = new Promise(resolve =>
    listener(
      {
        type: FRAME_MESSAGE,
        kind: 'deliver',
        requester: 0,
        request: { op: 'search', query: 'otter', generation: 'nested', depth: 1 },
      },
      { id: 'test' },
      resolve,
    ),
  );
  try {
    const result = await Promise.race([reply, parentDeadline]);
    expect(result).not.toBe('timed out');
    expect((result as FrameReply).rows.some(row => row.text === 'otter')).toBe(true);
  } finally {
    clearTimeout(timer!);
    teardown();
    await reply;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  }
});

test('releases nested hover after its handle leaves the current results', async () => {
  document.body.innerHTML = '<iframe></iframe><button>Local</button>';
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);
  const remote = document.createElement('button');
  const command = vi.fn().mockResolvedValue(true);
  setFrameTarget(remote, {
    boundary: document.querySelector('iframe')!,
    alive: () => true,
    command,
    paint: () => {},
    row: {
      id: 1,
      kind: 'action',
      action: null,
      label: 'Nested',
      text: '',
      context: '',
      href: null,
      disabled: false,
      focusable: true,
      score: 1,
      term: null,
      distance: null,
    },
  });
  vi.spyOn(PageSearchIndex.prototype, 'search')
    .mockResolvedValueOnce(makeSearchResult({ matchingLinksAndButtons: [remote] }))
    .mockResolvedValueOnce(makeSearchResult());
  transport.add.mockClear();
  const teardown = installFrameWorker();
  const listener = transport.add.mock.calls[0]![0];
  const request = (body: FrameRequest): Promise<unknown> =>
    new Promise(resolve =>
      listener(
        { type: FRAME_MESSAGE, kind: 'deliver', request: body, requester: 0 },
        { id: 'test' },
        resolve,
      ),
    );
  try {
    const reply = (await request({
      op: 'search',
      query: 'nested',
      generation: 'one',
      depth: 1,
    })) as FrameReply;
    const id = reply.rows[0]!.id;
    await request({ op: 'command', generation: 'one', id, command: 'hover' });
    expect(command).toHaveBeenLastCalledWith('hover');
    await request({ op: 'search', query: 'missing', generation: 'two', depth: 1 });
    await request({ op: 'command', generation: 'two', id, command: 'unhover' });
    expect(command).toHaveBeenLastCalledWith('unhover');
  } finally {
    teardown();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  }
});

test('a page-dispatched pagehide does not stop the frame helper', async () => {
  document.body.innerHTML = '<button>Launch</button>';
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);
  transport.add.mockClear();
  const teardown = installFrameWorker();
  const listener = transport.add.mock.calls[0]![0];
  const request = (body: FrameRequest): Promise<unknown> =>
    new Promise(resolve => {
      listener(
        { type: FRAME_MESSAGE, kind: 'deliver', requester: 0, request: body },
        { id: 'test' },
        resolve,
      );
    });
  try {
    const reply = (await request({
      op: 'search',
      query: 'Launch',
      generation: 'live',
      depth: 1,
    })) as FrameReply;
    const command = {
      op: 'command' as const,
      generation: 'live',
      id: reply.rows[0]!.id,
      command: 'validate' as const,
    };
    acceptSyntheticInputForTesting(false);
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    expect(await request(command)).toBe(true);
  } finally {
    acceptSyntheticInputForTesting(true);
    teardown();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  }
});

test('answers only real frame probes from the parent', () => {
  const teardown = installFrameWorker();
  transport.send.mockClear();
  const probe = () =>
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window.parent,
        data: { type: FRAME_PROBE, token: 'probe-token' },
      }),
    );
  const hellos = () =>
    transport.send.mock.calls.filter(([message]) => message.kind === 'hello').length;
  try {
    acceptSyntheticInputForTesting(false);
    probe();
    expect(hellos()).toBe(0);
    acceptSyntheticInputForTesting(true);
    probe();
    expect(hellos()).toBe(1);
  } finally {
    acceptSyntheticInputForTesting(true);
    teardown();
  }
});

test('an orphaned helper retires instead of messaging a runtime that is gone', () => {
  let valid = true;
  let retired = 0;
  const alive = () => {
    if (!valid) retired++;
    return valid;
  };
  transport.send.mockClear();
  const teardown = installFrameWorker(alive);
  try {
    expect(transport.send).toHaveBeenCalledTimes(1);
    valid = false;
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window.parent,
        data: { type: FRAME_PROBE, token: 'a'.repeat(32) },
      }),
    );
    expect(retired).toBe(1);
    expect(transport.send).toHaveBeenCalledTimes(1);
  } finally {
    teardown();
  }
});
