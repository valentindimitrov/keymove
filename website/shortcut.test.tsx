import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import useKeyboardShortcuts from '../src/hooks/use_keyboard_shortcuts.js';
import Shortcut from './shortcut.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Harness({ handler }: { handler: (name: string, event: KeyboardEvent) => void }) {
  useKeyboardShortcuts(handler);
  return (
    <>
      <div data-testid="switch">
        <Shortcut name="toggle_search_mode" />
      </div>
      <div data-testid="copy">
        <Shortcut name="copy_selected_link" />
      </div>
      <div data-testid="next-action">
        <Shortcut name="next_action_match" />
      </div>
    </>
  );
}

test.each([
  { platform: 'MacIntel', option: 'Option', copy: 'Command', mac: true },
  { platform: 'Win32', option: 'Alt', copy: 'Control', mac: false },
  { platform: 'Linux x86_64', option: 'Alt', copy: 'Control', mac: false },
])(
  'website labels agree with the real extension handler on $platform',
  ({ platform, option, copy, mac }) => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue(platform);
    const handler = vi.fn();
    render(<Harness handler={handler} />);
    expect(screen.getByTestId('switch')).toHaveTextContent(`${option}+S`);
    expect(screen.getByTestId('copy')).toHaveTextContent(`${copy}+C`);
    expect(screen.getByTestId('next-action')).toHaveTextContent('Control+Tab');

    // Option can change event.key on a Mac keyboard; the physical KeyS still switches modes.
    fireEvent.keyDown(document, { key: mac ? 'ß' : 's', code: 'KeyS', altKey: true });
    expect(handler).toHaveBeenLastCalledWith('toggle_search_mode', expect.any(KeyboardEvent));
    fireEvent.keyDown(document, { key: 'c', code: 'KeyC', ctrlKey: !mac, metaKey: mac });
    expect(handler).toHaveBeenLastCalledWith('copy_selected_link', expect.any(KeyboardEvent));
    const count = handler.mock.calls.length;
    fireEvent.keyDown(document, { key: 'c', code: 'KeyC', ctrlKey: mac, metaKey: !mac });
    expect(handler).toHaveBeenCalledTimes(count);
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', ctrlKey: true });
    expect(handler).toHaveBeenLastCalledWith('next_action_match', expect.any(KeyboardEvent));
  },
);
