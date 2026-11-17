// @vitest-environment node
import { boundedClient, editingCommands, openPage } from './browser-driver.js';

test('sends digit key codes for numbered shortcuts', async () => {
  const sendCommand = vi
    .fn()
    .mockResolvedValueOnce({ targetId: 'target' })
    .mockResolvedValueOnce({ targetInfo: { url: 'http://localhost/', title: 'Fixture' } })
    .mockResolvedValueOnce({ sessionId: 'session' })
    .mockResolvedValue({});
  const page = await openPage({ sendCommand }, 'http://localhost/');
  await page.key('1', 1);
  expect(sendCommand).toHaveBeenCalledWith(
    'Input.dispatchKeyEvent',
    expect.objectContaining({ code: 'Digit1', key: '1', modifiers: 1, type: 'keyDown' }),
    'session',
  );
});

test('rejects malformed target identifiers before using them', async () => {
  await expect(
    openPage({ sendCommand: vi.fn().mockResolvedValue({}) }, 'http://localhost/'),
  ).rejects.toThrow();
});

test('bounds a stalled browser command and releases its timer', async () => {
  vi.useFakeTimers();
  try {
    const client = boundedClient({ sendCommand: () => new Promise(() => {}) });
    const result = expect(client.sendCommand('Runtime.evaluate', {})).rejects.toThrow(
      'Browser command timed out: Runtime.evaluate',
    );
    await vi.advanceTimersByTimeAsync(20000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

test('names native editing commands for Command shortcuts on macOS only', () => {
  expect(editingCommands('v', 4, 'darwin')).toEqual(['paste']);
  expect(editingCommands('c', 4, 'darwin')).toEqual(['copy']);
  expect(editingCommands('a', 4, 'darwin')).toEqual(['selectAll']);
  expect(editingCommands('z', 12, 'darwin')).toEqual(['redo']);
  // Control+V on Windows and Linux already reaches the renderer's editing shortcuts.
  expect(editingCommands('v', 2, 'win32')).toEqual([]);
  expect(editingCommands('v', 4, 'linux')).toEqual([]);
  // Other modifier combinations are page shortcuts, not editing commands.
  expect(editingCommands('v', 5, 'darwin')).toEqual([]);
  expect(editingCommands('k', 4, 'darwin')).toEqual([]);
});
