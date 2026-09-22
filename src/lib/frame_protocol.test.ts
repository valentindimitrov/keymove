// @vitest-environment node
import { isFrameRequest, isFrameReply } from './frame_protocol.js';

test('rejects untrusted commands and malformed snapshots', () => {
  expect(isFrameRequest({ op: 'command', generation: 'a', id: 1, command: 'eval' })).toBe(false);
  expect(isFrameRequest({ op: 'command', generation: 'a', id: -1, command: 'activate' })).toBe(
    false,
  );
  expect(isFrameRequest({ op: 'search', generation: 'a', query: '40', depth: 9 })).toBe(false);
  expect(
    isFrameRequest({ op: 'paint', generation: 'a', ids: [1], selected: 1, color: 'url(x)' }),
  ).toBe(false);
  expect(isFrameRequest({ op: 'command', generation: 'a', id: 1, command: 'activate' })).toBe(true);
  expect(isFrameReply({ generation: 'a', rows: [{ id: 1 }], isFuzzy: false })).toBe(false);
  expect(isFrameReply({ generation: 'a', rows: [], isFuzzy: false })).toBe(true);
});
