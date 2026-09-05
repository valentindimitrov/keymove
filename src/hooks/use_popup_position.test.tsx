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
