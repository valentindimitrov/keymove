// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createPreviewCopy, findBrowser, openRepositoryPage } from './preview-extension.js';

test('each preview loads an independent snapshot of the current build', () => {
  const first = createPreviewCopy(path.resolve(import.meta.dirname, '../assets'));
  let second: ReturnType<typeof createPreviewCopy> | undefined;
  try {
    const file = path.join(first.directory, 'preview-test.txt');
    writeFileSync(file, 'initial build');
    second = createPreviewCopy(first.directory);
    writeFileSync(file, 'updated build');
    expect(second.directory).not.toBe(first.directory);
    expect(readFileSync(path.join(second.directory, 'preview-test.txt'), 'utf8')).toBe(
      'initial build',
    );
    expect(readFileSync(file, 'utf8')).toBe('updated build');
  } finally {
    second?.cleanup();
    first.cleanup();
  }
});

const env = { ProgramFiles: 'C:\\Program Files', PATH: 'D:\\Browser Tools' };
const vivaldi = 'C:\\Program Files\\Vivaldi\\Application\\vivaldi.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const firefox = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';

test.each(['GitHub - valentindimitrov/keymove', 'Page not found · GitHub · GitHub'])(
  'recognizes a loaded GitHub page (%s) and closes only the welcome tab',
  async title => {
    const sendCommand = vi.fn(async (method: string) => {
      if (method === 'Target.createTarget') return { targetId: 'repo' };
      if (method === 'Target.getTargetInfo')
        return {
          targetInfo: {
            url: 'https://github.com/valentindimitrov/keymove',
            title,
          },
        };
      if (method === 'Target.getTargets')
        return {
          targetInfos: [
            {
              targetId: 'welcome',
              type: 'page',
              url: 'chrome-extension://mpognobbkildjkofajifpdfhcoklimli/components/welcome/welcome.html',
            },
            { targetId: 'other', type: 'page', url: 'https://example.com' },
            { targetId: 'worker', type: 'service_worker', url: 'vivaldi://welcome' },
          ],
        };
      return {};
    });
    await expect(openRepositoryPage({ sendCommand })).resolves.toBe(title);
    expect(sendCommand).toHaveBeenCalledWith('Target.createTarget', {
      url: 'https://github.com/valentindimitrov/keymove',
    });
    expect(
      sendCommand.mock.calls.filter(([method]) => method === 'Target.closeTarget'),
    ).toHaveLength(1);
    expect(sendCommand).toHaveBeenCalledWith('Target.closeTarget', { targetId: 'welcome' });
    expect(sendCommand).toHaveBeenLastCalledWith('Target.activateTarget', { targetId: 'repo' });
  },
);

test('does not claim navigation succeeded when the browser response is malformed', async () => {
  await expect(openRepositoryPage({ sendCommand: vi.fn().mockResolvedValue({}) })).rejects.toThrow(
    'tab ID',
  );
});

test('selects installed browsers in Vivaldi, Chrome, Firefox order', () => {
  const installed = new Set([vivaldi, chrome, firefox]);
  const available = (file: string) => installed.has(file);
  expect(findBrowser('auto', env, 'win32', available)).toEqual({
    name: 'vivaldi',
    binary: vivaldi,
  });
  installed.delete(vivaldi);
  expect(findBrowser('auto', env, 'win32', available).name).toBe('chrome');
  installed.delete(chrome);
  expect(findBrowser('auto', env, 'win32', available).name).toBe('firefox');
  installed.clear();
  expect(() => findBrowser('auto', env, 'win32', available)).toThrow(
    'No Vivaldi, Chrome, or Firefox',
  );
});

test('honors explicit browser choice and custom paths without falling back silently', () => {
  expect(findBrowser('firefox', env, 'win32', () => true).name).toBe('firefox');
  expect(() => findBrowser('firefox', env, 'win32', file => file === chrome)).toThrow('No firefox');
  const custom = 'D:\\Browser Tools\\vivaldi.exe';
  expect(
    findBrowser('auto', { ...env, KEYMOVE_VIVALDI_BINARY: custom }, 'win32', () => true).binary,
  ).toBe(custom);
  expect(() =>
    findBrowser('auto', { KEYMOVE_VIVALDI_BINARY: 'relative.exe' }, 'win32', () => true),
  ).toThrow('absolute executable');
  expect(() => findBrowser('edge')).toThrow('Unknown browser');
});

test('finds portable Windows and Linux browsers on PATH', () => {
  expect(
    findBrowser('auto', env, 'win32', file => file === 'D:\\Browser Tools\\chrome.exe').name,
  ).toBe('chrome');
  expect(
    findBrowser(
      'auto',
      { PATH: '/usr/bin:/opt/bin' },
      'linux',
      file => file === '/opt/bin/vivaldi-stable',
    ),
  ).toEqual({ name: 'vivaldi', binary: '/opt/bin/vivaldi-stable' });
});
