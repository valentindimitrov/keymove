import { act, render, screen, waitFor } from '@testing-library/react';
import { POPUP_POSITION_STORAGE_KEY } from '../constants.js';
import { DEFAULT_POPUP_POSITION } from '../lib/popup_position_schema.js';
import usePopupPosition from './use_popup_position.js';

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

let currentPosition: ReturnType<typeof usePopupPosition> | undefined;

function PopupPositionHarness() {
  currentPosition = usePopupPosition();
  return <div data-testid="position">{JSON.stringify(currentPosition.position)}</div>;
}

beforeEach(() => {
  currentPosition = undefined;
  storageMocks.get.mockReset().mockResolvedValue({});
  storageMocks.set.mockReset().mockResolvedValue(undefined);
  storageMocks.addListener.mockReset();
  storageMocks.removeListener.mockReset();
});

test('does not overwrite a drag with a delayed initial position', async () => {
  const initialRead = Promise.withResolvers<Record<string, unknown>>();
  storageMocks.get.mockReturnValue(initialRead.promise);
  render(<PopupPositionHarness />);
  act(() => currentPosition?.updatePosition({ x: 0.2, y: 0.4 }));
  await act(async () => {
    initialRead.resolve({ popupPosition: { x: 0.8, y: 0.8 } });
    await initialRead.promise;
  });
  expect(currentPosition?.position).toEqual({ x: 0.2, y: 0.4 });
});

test('retains a position change delivered before the initial read finishes', async () => {
  const initialRead = Promise.withResolvers<Record<string, unknown>>();
  storageMocks.get.mockReturnValue(initialRead.promise);
  render(<PopupPositionHarness />);
  const onChanged = storageMocks.addListener.mock.calls[0]![0] as (
    changes: unknown,
    area: string,
  ) => void;
  act(() => onChanged({ popupPosition: { newValue: { x: 0.2, y: 0.4 } } }, 'local'));
  await act(async () => {
    initialRead.resolve({ popupPosition: { x: 0.8, y: 0.8 } });
    await initialRead.promise;
  });
  expect(currentPosition?.position).toEqual({ x: 0.2, y: 0.4 });
});

test('uses the 75%-down centered default position', async () => {
  render(<PopupPositionHarness />);

  expect(screen.getByTestId('position')).toHaveTextContent(JSON.stringify(DEFAULT_POPUP_POSITION));
  await waitFor(() => expect(storageMocks.get).toHaveBeenCalledWith(POPUP_POSITION_STORAGE_KEY));
});

test('persists a dragged position and can reset it', async () => {
  render(<PopupPositionHarness />);
  await waitFor(() => expect(storageMocks.get).toHaveBeenCalled());

  act(() => currentPosition?.updatePosition({ x: 0.25, y: 0.4 }));
  expect(screen.getByTestId('position')).toHaveTextContent('{"x":0.25,"y":0.4}');
  expect(storageMocks.set).toHaveBeenLastCalledWith({
    [POPUP_POSITION_STORAGE_KEY]: { x: 0.25, y: 0.4 },
  });

  act(() => currentPosition?.resetPosition());
  expect(screen.getByTestId('position')).toHaveTextContent(JSON.stringify(DEFAULT_POPUP_POSITION));
  expect(storageMocks.set).toHaveBeenLastCalledWith({
    [POPUP_POSITION_STORAGE_KEY]: DEFAULT_POPUP_POSITION,
  });
});

test('rejects malformed stored position data at runtime', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  storageMocks.get.mockResolvedValue({
    [POPUP_POSITION_STORAGE_KEY]: { x: 'left', y: 3 },
  });

  render(<PopupPositionHarness />);

  await waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('position')).toHaveTextContent(JSON.stringify(DEFAULT_POPUP_POSITION));
  warn.mockRestore();
});

test('ignores malformed storage event containers and validates change records', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  render(<PopupPositionHarness />);
  await waitFor(() => expect(storageMocks.get).toHaveBeenCalled());
  const listener = storageMocks.addListener.mock.calls[0]![0] as (
    changes: unknown,
    area: string,
  ) => void;
  act(() => {
    listener(null, 'local');
    listener([], 'local');
    listener({ popupPosition: 'malformed' }, 'local');
  });
  expect(warn).toHaveBeenCalledTimes(3);
  expect(currentPosition?.position).toEqual(DEFAULT_POPUP_POSITION);
  warn.mockRestore();
});
