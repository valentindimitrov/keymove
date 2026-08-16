import { waitFor } from '@testing-library/react';
import type { Browser } from 'wxt/browser';
import { handleInstallationEvent } from './background.js';

const browserMocks = vi.hoisted(() => ({
  remove: vi.fn(),
  query: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: { local: { remove: browserMocks.remove } },
    tabs: { query: browserMocks.query },
  },
}));

beforeEach(() => {
  browserMocks.remove.mockReset().mockResolvedValue(undefined);
  browserMocks.query.mockReset().mockResolvedValue([]);
});

test('reports failure to remove the legacy email setting during an update', async () => {
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  browserMocks.remove.mockRejectedValueOnce(new Error('storage unavailable'));
  const details: Browser.runtime.InstalledDetails = {
    reason: 'update',
    previousVersion: '1.2.0',
  };

  handleInstallationEvent(details);

  await waitFor(() =>
    expect(debugSpy).toHaveBeenCalledWith(
      'YipYip could not remove the legacy email setting: storage unavailable',
    ),
  );
  expect(browserMocks.query).not.toHaveBeenCalled();
  debugSpy.mockRestore();
});

test('reports a tab-query failure while installing into existing tabs', async () => {
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  browserMocks.query.mockRejectedValueOnce(new Error('tabs unavailable'));
  const details: Browser.runtime.InstalledDetails = { reason: 'install' };

  handleInstallationEvent(details);

  await waitFor(() =>
    expect(debugSpy).toHaveBeenCalledWith(
      'YipYip could not query tabs during installation: tabs unavailable',
    ),
  );
  debugSpy.mockRestore();
});
