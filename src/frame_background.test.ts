// @vitest-environment node
import { registerFrameRelay } from './frame_background.js';
import { FRAME_MESSAGE } from './lib/frame_protocol.js';

const api = vi.hoisted(() => ({ add: vi.fn(), send: vi.fn().mockResolvedValue(true) }));
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { id: 'test', onMessage: { addListener: api.add } },
    tabs: { sendMessage: api.send },
  },
}));

test('relays only validated extension messages within the sender tab', async () => {
  registerFrameRelay();
  const listener = api.add.mock.calls[0]![0];
  const sender = { id: 'test', tab: { id: 12 }, frameId: 0 };
  const message = {
    type: FRAME_MESSAGE,
    kind: 'request',
    frameId: 5,
    request: { op: 'command', generation: 'current', id: 2, command: 'activate' },
  };
  const respond = vi.fn();
  expect(listener(message, { ...sender, id: 'foreign' }, respond)).toBeUndefined();
  expect(listener(message, { ...sender, tab: undefined }, respond)).toBeUndefined();
  expect(
    listener({ ...message, request: { ...message.request, command: 'eval' } }, sender, respond),
  ).toBeUndefined();
  expect(api.send).not.toHaveBeenCalled();
  expect(listener(message, sender, respond)).toBe(true);
  await Promise.resolve();
  expect(api.send).toHaveBeenCalledWith(
    12,
    { type: FRAME_MESSAGE, kind: 'deliver', requester: 0, request: message.request },
    { frameId: 5 },
  );
  expect(respond).toHaveBeenCalledWith(true);
});

test('validates streamed replies and stamps the authenticated source frame', async () => {
  api.add.mockClear();
  api.send.mockClear();
  registerFrameRelay();
  const listener = api.add.mock.calls[0]![0];
  const sender = { id: 'test', tab: { id: 12 }, frameId: 7 };
  const reply = { generation: 'current', rows: [], isFuzzy: false };
  const message = { type: FRAME_MESSAGE, kind: 'results', frameId: 0, source: 99, reply };
  expect(listener({ ...message, reply: { rows: 'invalid' } }, sender, vi.fn())).toBeUndefined();
  expect(api.send).not.toHaveBeenCalled();
  expect(listener(message, sender, vi.fn())).toBe(true);
  await Promise.resolve();
  expect(api.send).toHaveBeenCalledWith(
    12,
    { type: FRAME_MESSAGE, kind: 'results', source: 7, reply },
    { frameId: 0 },
  );
});
