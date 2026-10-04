// @vitest-environment node
import { writeClipboardText } from './clipboard.js';

afterEach(() => vi.unstubAllGlobals());

function mockClipboard() {
  const write = vi.fn().mockResolvedValue(undefined);
  const writeText = vi.fn().mockResolvedValue(undefined);
  const item = vi.fn(function (this: object, data: unknown) {
    Object.assign(this, { data });
  });
  vi.stubGlobal('navigator', { clipboard: { write, writeText } });
  vi.stubGlobal('ClipboardItem', item);
  return { write, writeText, item };
}

test('starts a deferred write synchronously and supplies the eventual text as a blob', async () => {
  const { write, writeText, item } = mockClipboard();
  const pending = Promise.withResolvers<unknown>();
  const copying = writeClipboardText(pending.promise);
  expect(write).toHaveBeenCalledOnce();
  expect(writeText).not.toHaveBeenCalled();
  const data = item.mock.calls[0]![0] as Record<string, Promise<Blob>>;
  pending.resolve('Frame text');
  const blob = await data['text/plain']!;
  expect(blob.type).toBe('text/plain');
  expect(await blob.text()).toBe('Frame text');
  await copying;
});

test.each([null, 42, { text: 'untrusted' }])(
  'rejects stale or malformed frame text: %j',
  async value => {
    const { write } = mockClipboard();
    write.mockImplementation(
      (items: { data: Record<string, Promise<Blob>> }[]) => items[0]!.data['text/plain'],
    );
    await expect(writeClipboardText(Promise.resolve(value))).rejects.toThrow('no longer available');
  },
);

test('keeps a denied write visible without retrying and handles a later data failure', async () => {
  const { write, writeText } = mockClipboard();
  write.mockRejectedValue(new Error('Denied'));
  const pending = Promise.withResolvers<unknown>();
  await expect(writeClipboardText(pending.promise)).rejects.toThrow('Denied');
  pending.reject(new Error('Frame removed'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(writeText).not.toHaveBeenCalled();
});

test('uses immediate writeText for ready text and falls back for older clipboard implementations', async () => {
  const { writeText } = mockClipboard();
  const copying = writeClipboardText('Ready');
  expect(writeText).toHaveBeenCalledWith('Ready');
  await copying;
  vi.stubGlobal('ClipboardItem', undefined);
  await writeClipboardText(Promise.resolve('Deferred'));
  expect(writeText).toHaveBeenLastCalledWith('Deferred');
});
