import { installFrameWorker } from './frame_worker.js';
import { FRAME_MESSAGE } from './frame_protocol.js';
import type { FrameReply, FrameRequest } from './frame_protocol.js';
import { PageSearchIndex } from './page_search_index.js';
import { setFrameTarget } from './frame_target.js';
import { makeSearchResult } from '../test_support/factories.js';
import { isImageInfo } from './image_schema.js';

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
