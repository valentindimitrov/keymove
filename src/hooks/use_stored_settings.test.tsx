import { act, render, screen, waitFor } from '@testing-library/react';
import { EXTENSION_NAME } from '../extension_identity.js';
import useStoredSettings from './use_stored_settings.js';

const storageMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: storageMocks.get,
        set: storageMocks.set,
      },
      onChanged: {
        addListener: storageMocks.addListener,
        removeListener: storageMocks.removeListener,
      },
    },
  },
}));

let currentSettings: ReturnType<typeof useStoredSettings> | undefined;

function StoredSettingsHarness() {
  currentSettings = useStoredSettings();
  return <div data-testid="auto-hide">{String(currentSettings.autoHide)}</div>;
}

beforeEach(() => {
  currentSettings = undefined;
  storageMocks.get.mockReset().mockResolvedValue({});
  storageMocks.set.mockReset().mockResolvedValue(undefined);
  storageMocks.addListener.mockReset();
  storageMocks.removeListener.mockReset();
});

test.each([false, true, undefined])(
  'keeps automatic typing capture off until the saved value %s is loaded',
  async savedValue => {
    const initialRead = Promise.withResolvers<Record<string, boolean>>();
    storageMocks.get.mockReturnValue(initialRead.promise);
    render(<StoredSettingsHarness />);
    expect(currentSettings?.alwaysOn).toBe(false);
    await act(async () =>
      initialRead.resolve(savedValue === undefined ? {} : { alwaysOn: savedValue }),
    );
    expect(currentSettings?.alwaysOn).toBe(savedValue ?? true);
  },
);

test('preserves an explicit always-on choice made before storage responds', async () => {
  const initialRead = Promise.withResolvers<Record<string, boolean>>();
  storageMocks.get.mockReturnValue(initialRead.promise);
  render(<StoredSettingsHarness />);
  act(() => currentSettings?.updateAlwaysOn(true));
  await act(async () => initialRead.resolve({ alwaysOn: false }));
  expect(currentSettings?.alwaysOn).toBe(true);
});

test('does not overwrite a local update with a delayed initial read', async () => {
  const initialRead = Promise.withResolvers<Record<string, boolean>>();
  storageMocks.get.mockReturnValue(initialRead.promise);
  render(<StoredSettingsHarness />);
  act(() => currentSettings?.updateAutoHide(true));
  await act(async () => {
    initialRead.resolve({ autoHide: false, alwaysOn: false });
    await initialRead.promise;
  });
  expect(currentSettings?.autoHide).toBe(true);
  expect(currentSettings?.alwaysOn).toBe(false);
});

test('retains storage changes delivered before initialization completes', async () => {
  const initialRead = Promise.withResolvers<Record<string, boolean>>();
  storageMocks.get.mockReturnValue(initialRead.promise);
  render(<StoredSettingsHarness />);
  const onChanged = storageMocks.addListener.mock.calls[0]![0] as (
    changes: unknown,
    area: string,
  ) => void;
  act(() => onChanged({ autoHide: { newValue: true } }, 'local'));
  await act(async () => {
    initialRead.resolve({ autoHide: false });
    await initialRead.promise;
  });
  expect(currentSettings?.autoHide).toBe(true);
});

test('retains a lock arriving from another tab over a delayed storage read', async () => {
  const initialRead = Promise.withResolvers<Record<string, boolean>>();
  storageMocks.get.mockReturnValue(initialRead.promise);
  render(<StoredSettingsHarness />);
  const onChanged = storageMocks.addListener.mock.calls[0]![0] as (
    changes: unknown,
    area: string,
  ) => void;
  act(() => onChanged({ lockPositionAndSize: { newValue: true } }, 'local'));
  await act(async () => initialRead.resolve({ lockPositionAndSize: false }));
  expect(currentSettings?.lockPositionAndSize).toBe(true);
  act(() => onChanged({ lockPositionAndSize: { oldValue: true } }, 'local'));
  expect(currentSettings?.lockPositionAndSize).toBe(false);
});

test('does not roll back a newer update when an older write fails with the same value', async () => {
  const write = Promise.withResolvers<void>();
  storageMocks.set.mockReturnValueOnce(write.promise);
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(<StoredSettingsHarness />);
  await act(async () => {
    await Promise.resolve();
  });
  act(() => currentSettings?.updateAutoHide(true));
  act(() => currentSettings?.updateAutoHide(false));
  act(() => currentSettings?.updateAutoHide(true));
  await act(async () => {
    write.reject(new Error('old write failed'));
  });
  expect(currentSettings?.autoHide).toBe(true);
  error.mockRestore();
});

test('keeps automatic capture off and reports an unavailable storage read', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  storageMocks.get.mockRejectedValueOnce(new Error('storage unavailable'));

  render(<StoredSettingsHarness />);

  expect(await screen.findByTestId('auto-hide')).toHaveTextContent('true');
  await waitFor(() =>
    expect(errorSpy).toHaveBeenCalledWith(
      `${EXTENSION_NAME} could not read stored settings: storage unavailable`,
    ),
  );
  expect(currentSettings?.alwaysOn).toBe(false);
  act(() => currentSettings?.updateAlwaysOn(true));
  expect(currentSettings?.alwaysOn).toBe(true);
  errorSpy.mockRestore();
});

test('rolls back an optimistic setting update when storage rejects it', async () => {
  storageMocks.get.mockResolvedValue({ autoHide: false });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  storageMocks.set.mockRejectedValueOnce(new Error('write failed'));
  render(<StoredSettingsHarness />);
  await waitFor(() => expect(storageMocks.get).toHaveBeenCalled());

  act(() => currentSettings?.updateAutoHide(true));
  expect(screen.getByTestId('auto-hide')).toHaveTextContent('true');

  await waitFor(() => expect(screen.getByTestId('auto-hide')).toHaveTextContent('false'));
  expect(errorSpy).toHaveBeenCalledWith(
    `${EXTENSION_NAME} could not save the "autoHide" setting: write failed`,
  );
  errorSpy.mockRestore();
});

test('persists suggestion count and keeps a newer remote count over a delayed read', async () => {
  const initial = Promise.withResolvers<Record<string, unknown>>();
  storageMocks.get.mockReturnValueOnce(initial.promise);
  render(<StoredSettingsHarness />);
  act(() => currentSettings?.updateSuggestionCount(10));
  expect(storageMocks.set).toHaveBeenCalledWith({ suggestionCount: 5 });
  const changed = storageMocks.addListener.mock.calls[0]![0] as (
    changes: unknown,
    area: string,
  ) => void;
  act(() => changed({ suggestionCount: { newValue: 8 } }, 'local'));
  await act(async () => initial.resolve({ suggestionCount: 3 }));
  expect(currentSettings?.suggestionCount).toBe(5);
  act(() => changed({ suggestionCount: { oldValue: 8 } }, 'local'));
  expect(currentSettings?.suggestionCount).toBe(3);
});
