import { installFrameWorker } from './frame_worker.js';
import { FRAME_MESSAGE } from './frame_protocol.js';
import type { FrameReply, FrameRequest } from './frame_protocol.js';

const transport = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  send: vi.fn().mockResolvedValue(null),
}));
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
