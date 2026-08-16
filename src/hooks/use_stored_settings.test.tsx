import { act, render, screen, waitFor } from '@testing-library/react';
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

test('keeps defaults and reports an unavailable storage read', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  storageMocks.get.mockRejectedValueOnce(new Error('storage unavailable'));

  render(<StoredSettingsHarness />);

  expect(await screen.findByTestId('auto-hide')).toHaveTextContent('false');
  await waitFor(() =>
    expect(errorSpy).toHaveBeenCalledWith(
      'YipYip could not read stored settings: storage unavailable',
    ),
  );
  errorSpy.mockRestore();
});

test('rolls back an optimistic setting update when storage rejects it', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  storageMocks.set.mockRejectedValueOnce(new Error('write failed'));
  render(<StoredSettingsHarness />);
  await waitFor(() => expect(storageMocks.get).toHaveBeenCalled());

  act(() => currentSettings?.updateAutoHide(true));
  expect(screen.getByTestId('auto-hide')).toHaveTextContent('true');

  await waitFor(() => expect(screen.getByTestId('auto-hide')).toHaveTextContent('false'));
  expect(errorSpy).toHaveBeenCalledWith(
    'YipYip could not save the "autoHide" setting: write failed',
  );
  errorSpy.mockRestore();
});
