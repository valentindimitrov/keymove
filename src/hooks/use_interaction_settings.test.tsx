import { act, renderHook, waitFor } from '@testing-library/react';
import useInteractionSettings from './use_interaction_settings.js';

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock('wxt/browser', () => ({ browser: { storage: { local: storage, onChanged: storage } } }));
beforeEach(() => {
  vi.clearAllMocks();
  storage.get.mockReset().mockResolvedValue({});
  storage.set.mockReset().mockResolvedValue(undefined);
  storage.remove.mockReset().mockResolvedValue(undefined);
});
function change(key: string, value: unknown) {
  act(() => {
    storage.addListener.mock.calls[0]![0]({ [key]: { newValue: value } }, 'local');
  });
}
test('late initial reads cannot overwrite a newer rule or its removal', async () => {
  const read = Promise.withResolvers<Record<string, unknown>>();
  storage.get.mockReturnValue(read.promise);
  const { result, unmount } = renderHook(useInteractionSettings);
  expect(result.current.ready).toBe(false);
  change('siteBehavior:github.com', 'paused');
  change('siteBehavior:linear.app', undefined);
  await act(async () =>
    read.resolve({
      'siteBehavior:github.com': 'type',
      'siteBehavior:linear.app': 'paused',
      'siteBehavior:jira.example': 'shortcut',
    }),
  );
  expect(result.current.sites).toEqual({ 'github.com': 'paused', 'jira.example': 'shortcut' });
  expect(result.current.ready).toBe(true);
  unmount();
  expect(storage.removeListener).toHaveBeenCalledWith(storage.addListener.mock.calls[0]![0]);
});
test('writes separate hostname keys, removes inheritance overrides, and handles prototype-like hostnames safely', async () => {
  const { result } = renderHook(useInteractionSettings);
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => {
    result.current.updateSite('github.com', 'paused');
    result.current.updateSite('__proto__', 'shortcut');
  });
  expect(storage.set).toHaveBeenCalledWith({ 'siteBehavior:github.com': 'paused' });
  expect(Object.getPrototypeOf(result.current.sites)).toBe(Object.prototype);
  expect(Object.hasOwn(result.current.sites, '__proto__')).toBe(true);
  await act(async () => result.current.updateSite('github.com', undefined));
  expect(storage.remove).toHaveBeenCalledWith('siteBehavior:github.com');
  expect(result.current.sites['github.com']).toBeUndefined();
});
test('failed writes roll back and report errors without replacing later storage updates', async () => {
  storage.get.mockResolvedValue({ 'siteBehavior:github.com': 'type' });
  const { result } = renderHook(useInteractionSettings);
  await waitFor(() => expect(result.current.ready).toBe(true));
  storage.set.mockRejectedValueOnce(new Error('quota'));
  await act(async () => result.current.updateSite('github.com', 'paused'));
  expect(result.current.sites['github.com']).toBe('type');
  expect(result.current.error).toMatch(/Could not save/);
  const write = Promise.withResolvers<void>();
  storage.set.mockReturnValueOnce(write.promise);
  act(() => result.current.updateSite('github.com', 'paused'));
  change('siteBehavior:github.com', 'shortcut');
  await act(async () => write.reject(new Error('failed')));
  expect(result.current.sites['github.com']).toBe('shortcut');
});
test('failed reads keep keyboard interception disabled and expose a recovery message', async () => {
  storage.get.mockRejectedValue(new Error('unavailable'));
  const { result } = renderHook(useInteractionSettings);
  await waitFor(() => expect(result.current.error).toMatch(/Reopen settings/));
  expect(result.current.ready).toBe(false);
});
